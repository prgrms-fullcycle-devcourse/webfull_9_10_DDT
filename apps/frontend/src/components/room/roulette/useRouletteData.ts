'use client';
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { getRouletteApi } from '@/api/generated/roulette-api-벌칙-룰렛/roulette-api-벌칙-룰렛';
import { useAuth } from '@/hooks/useAuth';
import { clearGuestAccessToken } from '@/lib/authToken';
import { queryKeys } from '@/lib/queryKeys';
import type {
  ExitRouletteResponseDto,
  GiveUpRouletteResponseDto,
  ResultMemberDto,
  ResultResponseDto,
  SpinRouletteResponseDto,
} from '@/api/generated/models';

type RoulettePenalty = { id: string; label: string };
type RouletteRulePenalty = { itemId: string; content: string };

const toRouletteItems = (
  penalties: RouletteRulePenalty[] = [],
): RoulettePenalty[] =>
  penalties.map((item) => ({ id: item.itemId, label: item.content }));

const shuffleItems = <T>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const getUnrevealedPenaltyCount = (
  member: ResultMemberDto | null | undefined,
) =>
  Math.max(
    0,
    (member?.penalties.totalCount ?? 0) - (member?.penaltyCount ?? 0),
  );

export const getAxiosMessage = (err: unknown): string | undefined => {
  const errorData = axios.isAxiosError(err) ? err.response?.data : null;
  const rawMessage =
    errorData && typeof errorData === 'object' && 'message' in errorData
      ? (errorData as { message?: unknown }).message
      : undefined;
  return Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : undefined;
};

export function useRouletteData(roomCode: string, isGiveUpRoulette: boolean) {
  const { me } = useAuth();
  const queryClient = useQueryClient();

  const clearGuestSession = useCallback(() => {
    if (clearGuestAccessToken()) {
      queryClient.setQueryData(queryKeys.auth.me(), null);
    }
  }, [queryClient]);

  const {
    data: result,
    dataUpdatedAt,
    isError: isResultError,
    isLoading: isResultLoading,
  } = useQuery({
    queryKey: queryKeys.result.detail(roomCode),
    queryFn: async () => {
      const res = await getResultApi().resultControllerGetResult(roomCode);
      return res.data as unknown as ResultResponseDto;
    },
    enabled: !isGiveUpRoulette,
  });

  const {
    data: giveUpResult,
    isError: isGiveUpResultError,
    isLoading: isGiveUpResultLoading,
    dataUpdatedAt: giveUpDataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.result.giveUp(roomCode),
    queryFn: async () => {
      const res =
        await getRouletteApi().rouletteControllerGetGiveUpResult(roomCode);
      return res.data as unknown as GiveUpRouletteResponseDto;
    },
    enabled: isGiveUpRoulette,
  });

  const spinMutation = useMutation({
    mutationFn: async (spinIndex: number) => {
      const res = await getRouletteApi().rouletteControllerSpinRoulette(
        roomCode,
        { spinIndex },
      );
      return res.data as unknown as SpinRouletteResponseDto;
    },
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      const res =
        await getRouletteApi().rouletteControllerExitRoulette(roomCode);
      return res.data;
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res =
        await getRouletteApi().rouletteControllerExitRoulette(roomCode);
      return res.data as unknown as ExitRouletteResponseDto;
    },
  });

  const rouletteItems = useMemo<RoulettePenalty[]>(
    () =>
      toRouletteItems(
        isGiveUpRoulette ? giveUpResult?.penaltyPool : result?.rule?.penalties,
      ),
    [giveUpResult, isGiveUpRoulette, result],
  );

  const rouletteLabels = useMemo(
    () => rouletteItems.map((item) => item.label),
    [rouletteItems],
  );

  const myResult = useMemo(() => {
    if (!result || !me) return null;
    if (me.role === 'user')
      return result.members.find((m) => m.userId === me.id) ?? null;
    if (me.role === 'guest')
      return result.members.find((m) => m.guestToken === me.id) ?? null;
    return null;
  }, [me, result]);

  const giveUpSpinResults = useMemo(() => {
    const penalties = giveUpResult?.penalties ?? [];
    return shuffleItems(
      penalties.flatMap((penalty) =>
        Array.from({ length: penalty.count }, () => ({
          spinIndex: 0,
          penaltyItemId: penalty.itemId,
          penaltyContent: penalty.content,
          remainingSpins: 0,
          isFinished: false,
        })),
      ),
    );
  }, [giveUpResult]);

  const hasRouletteItems = rouletteItems.length > 0;
  const isSoloMember = (result?.members?.length ?? 0) <= 1;
  const revealedChances = isGiveUpRoulette ? 0 : (myResult?.penaltyCount ?? 0);

  return {
    result,
    dataUpdatedAt,
    isResultError,
    isResultLoading,
    giveUpResult,
    giveUpDataUpdatedAt,
    isGiveUpResultError,
    isGiveUpResultLoading,
    spinMutation,
    exitMutation,
    skipMutation,
    rouletteItems,
    rouletteLabels,
    myResult,
    giveUpSpinResults,
    hasRouletteItems,
    isSoloMember,
    revealedChances,
    clearGuestSession,
  };
}
