'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';

export function SessionRestorer() {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedIn = useAuth().isLoggedIn;
  const { confirm, confirmProps } = useConfirm();

  const hasPromptedRef = useRef(false);

  const { data: activeRoom } = useQuery({
    queryKey: ['activeRoom', isLoggedIn],
    queryFn: async () => {
      const res = await getRoomApi().roomControllerGetMyActiveRoom();
      const data = (
        res as unknown as {
          data: { code: string; title: string; phase: string };
        }
      ).data;
      return data || null;
    },
    enabled: isLoggedIn && !pathname.includes('/room/'),
    retry: false,
  });

  useEffect(() => {
    if (
      activeRoom?.code &&
      !hasPromptedRef.current &&
      !pathname.includes('/room/')
    ) {
      hasPromptedRef.current = true;

      const promptRestore = async () => {
        const ok = await confirm({
          title: '진행 중인 집중 세션이 있습니다.',
          description: `[${activeRoom.title}] 방으로 복귀하시겠습니까?`,
          confirmText: '복귀하기',
          cancelText: '무시하기',
        });
        if (ok) {
          let targetPath = `/room/${activeRoom.code}/contract`;
          if (activeRoom.phase === 'timer') {
            targetPath = `/room/${activeRoom.code}/timer`;
          } else if (activeRoom.phase === 'result') {
            targetPath = `/room/${activeRoom.code}/semi-result`;
          }
          router.push(targetPath);
        }
      };
      promptRestore();
    }
  }, [activeRoom, pathname, confirm, router]);

  return <ConfirmDialog {...confirmProps} />;
}
