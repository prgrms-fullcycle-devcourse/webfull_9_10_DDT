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
import { isMeMember } from '@/lib/member';

type RoulettePenalty = { id: string; label: string };
type RouletteRulePenalty = { itemId: string; content: string };

const toRouletteItems = (
  penalties: RouletteRulePenalty[] = [],
): RoulettePenalty[] =>
  penalties.map((item) => ({ id: item.itemId, label: item.content }));

/** 배열을 Fisher-Yates로 섞은 새 배열을 반환한다. (포기자 벌칙을 무작위 순서로 뽑기 위함) */
const shuffleItems = <T>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * 아직 룰렛으로 공개되지 않은 벌칙 수 = 총 벌칙 수 - 이미 공개된 수. (남은 스핀 횟수)
 *
 * @param member - 결과 멤버 데이터
 * @returns 남은(미공개) 벌칙 개수 (최소 0)
 */
export const getUnrevealedPenaltyCount = (
  member: ResultMemberDto | null | undefined,
) =>
  Math.max(
    0,
    (member?.penalties.totalCount ?? 0) - (member?.penaltyCount ?? 0),
  );

/**
 * Axios 에러 응답 본문에서 message를 안전하게 추출한다. (배열이면 join)
 *
 * @param err - 잡은 에러 (Axios 에러가 아닐 수 있음)
 * @returns 추출한 메시지 문자열, 없으면 undefined
 */
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

/**
 * 룰렛 화면의 데이터/서버 통신 계층 훅. 결과 조회·스핀·나가기/스킵 mutation과
 * 휠 라벨·내 결과·포기자 스핀 목록 등 파생 데이터를 제공한다. (UI 로직은 useRouletteLogic이 담당)
 *
 * @param roomCode - 방 코드
 * @param isGiveUpRoulette - 중도 포기자 전용 룰렛인지 (일반 결과 대신 give-up 결과/풀을 사용)
 * @returns 쿼리/뮤테이션 결과 + 룰렛 아이템·라벨·내 결과 등 파생값
 */
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
    return result.members.find((m) => isMeMember(me, m)) ?? null;
  }, [me, result]);

  // 포기자 벌칙을 미리 확정해 둔다: 각 벌칙을 count만큼 펼쳐(개수만큼 슬롯 생성) 무작위로 섞는다.
  // 일반 룰렛은 스핀마다 서버에 결과를 묻지만, 포기자는 이 목록을 순서대로 소비한다.
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
