import { useSocket } from '@/contexts/SocketContext';
import { getProfileImageSrc } from '@/lib/profileImage';
import { useRoomStore } from '@/store/useRoomStore';
import Image from 'next/image';
import { Card, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { EllipsisVertical, Lock, Unlock } from 'lucide-react';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/hooks/useConfirm';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { MemberTagBadges } from '../common/MemberTagBadges';
import { useAuth } from '@/hooks/useAuth';
import { useShallow } from 'zustand/react/shallow';

/** 1×1 투명 PNG. 프로필 이미지 로딩 중 blur placeholder로 사용 */
const BLUR_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * 멤버 서명 목록 컴포넌트.
 * 본인 서명 토글 + 다른 멤버들의 서명 상태를 표시합니다.
 * 방장에게는 멤버별 편집 권한 토글(잠금/해제)과 강제 퇴장 메뉴가 추가됩니다.
 * 첫 서명 시 알림 권한을 요청합니다 (push 구독 등록을 위한 사전 동의).
 */
export default function MemberSignList() {
  const socket = useSocket();
  const me = useAuth().me;
  const { members, hostId } = useRoomStore(
    useShallow((s) => ({ members: s.members, hostId: s.hostId })),
  );
  const { confirm, confirmProps } = useConfirm();

  if (!me) {
    return;
  }

  const isHost = me.id === hostId;
  const myMember = members[me.id];
  const myNickname = myMember?.nickname ?? me.nickname ?? '내';
  const myProfileImage = myMember?.profileImage ?? me.profileImage;
  const isMeSigned = myMember?.isSigned ?? false;
  const memberList = Object.entries(members);
  const signedCount = memberList.filter(([, m]) => m.isSigned).length;
  const memberCount = memberList.length;

  /**
   * 본인 서명 토글 핸들러.
   * 서명 시 알림 권한이 default(미응답)이면 requestPermission을 먼저 호출합니다.
   * Socket.IO 'member:sign' 이벤트로 서명 상태를 전체 멤버에게 브로드캐스트합니다.
   */
  const handleSignToggle = async () => {
    const newSigned = !isMeSigned;
    if (
      newSigned &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      await Notification.requestPermission();
    }
    socket?.emit('member:sign', { signed: newSigned });
  };

  /**
   * 멤버 강제 퇴장 핸들러. (방장 전용)
   * 확인 다이얼로그를 거친 후 Socket.IO 'member:kick' 이벤트를 전송합니다.
   *
   * @param targetId - 강퇴할 멤버의 userId 또는 guestToken
   */
  const handleKickMember = async (targetId: string) => {
    if (!isHost) {
      return;
    }
    const ok = await confirm({
      title: `${members[targetId].nickname} 님을 강제 퇴장시키겠어요?`,
      description: '강제 퇴장된 멤버는 재입장이 안돼요.',
      confirmText: '강제 퇴장시키기',
      cancelText: '아니요',
      variant: 'destructive',
    });
    if (!ok) {
      return;
    }

    socket?.emit('member:kick', { targetId });
  };

  /**
   * 개별 멤버의 편집 권한을 토글합니다. (방장 전용)
   * Socket.IO 'edit:member' 이벤트로 실시간 반영됩니다.
   *
   * @param targetId - 대상 멤버 ID
   * @param canEdit - 편집 허용 여부
   */
  const handleMemberEditToggle = (targetId: string, canEdit: boolean) => {
    socket?.emit('edit:member', { targetId, canEdit });
  };

  return (
    <Card>
      <div className='pr-4 pl-4'>
        <div>
          <div className='flex w-full justify-between items-center pb-2'>
            <div className='flex items-center p-1 gap-2'>
              <div className='relative'>
                <Image
                  src={
                    getProfileImageSrc(myProfileImage) ?? '/avatars/bear.png'
                  }
                  alt={`${myNickname} 프로필 이미지`}
                  width={40}
                  height={40}
                  placeholder='blur'
                  blurDataURL={BLUR_PLACEHOLDER}
                  className={cn(
                    'rounded-full ring-3',
                    isMeSigned ? 'ring-success' : 'ring-white/40',
                  )}
                />
                {isMeSigned && (
                  <span className='absolute -top-1 z-10 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center'>
                    <svg width='10' height='8' viewBox='0 0 10 8' fill='none'>
                      <path
                        d='M1 4L3.5 6.5L9 1'
                        stroke='white'
                        strokeWidth='1.5'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </span>
                )}
              </div>
              <div className='flex items-center gap-1'>
                <span className='font-bold'>나</span>
                <MemberTagBadges isHost={isHost} />
              </div>
            </div>
            <Button
              type='button'
              variant={isMeSigned ? 'outline' : 'default'}
              onClick={handleSignToggle}
              className={cn(
                'rounded-sm! px-4!',
                isMeSigned
                  ? 'border-primary! bg-transparent! text-primary'
                  : 'bg-success!',
              )}
            >
              {isMeSigned ? '취소' : '서명'}
            </Button>
          </div>
          <Separator />
        </div>
        <div className='mb-3'>
          {memberList
            .filter(([id]) => id !== me.id)
            .map(([id, m]) => {
              const isThisHost = m.isHost;
              return (
                <div key={id} className=''>
                  <div className='flex w-full justify-between items-center pt-2 pb-2'>
                    <div className='flex items-center p-1 gap-2'>
                      <div className='relative'>
                        <Image
                          src={
                            getProfileImageSrc(m.profileImage) ??
                            '/avatars/bear.png'
                          }
                          alt={m.nickname}
                          width={40}
                          height={40}
                          placeholder='blur'
                          blurDataURL={BLUR_PLACEHOLDER}
                          className={cn(
                            'rounded-full ring-3',
                            m.isSigned ? 'ring-success' : 'ring-white/40',
                          )}
                        />
                        {m.isSigned && (
                          <span className='absolute -top-1 z-10 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center'>
                            <svg
                              width='10'
                              height='8'
                              viewBox='0 0 10 8'
                              fill='none'
                            >
                              <path
                                d='M1 4L3.5 6.5L9 1'
                                stroke='white'
                                strokeWidth='1.5'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className='flex items-center gap-1'>
                        <span>{m.nickname}</span>
                        <MemberTagBadges isHost={isThisHost} />
                      </div>
                    </div>
                    {isHost && (
                      <div className='flex flex-row items-center gap-1'>
                        <Switch
                          size='lg'
                          checked={m.canEdit ?? false}
                          onCheckedChange={(checked) => {
                            handleMemberEditToggle(id, checked);
                          }}
                          thumbIcon={
                            m.canEdit ? (
                              <Unlock className='w-4 h-4 text-purple-600' />
                            ) : (
                              <Lock className='w-4 h-4 text-purple-600' />
                            )
                          }
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              aria-label={`${m.nickname} 멤버 옵션`}
                            >
                              <EllipsisVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => handleKickMember(id)}
                              className='flex p-0 text-destructive items-center justify-center py-2!'
                            >
                              강제 퇴장
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  <Separator />
                </div>
              );
            })}
        </div>
        <div className='flex justify-between'>
          <p className='text-success'>
            {signedCount} / {memberCount}명 서명 완료
          </p>
          <CardDescription>서명하지 않으면 강퇴돼요.</CardDescription>
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </Card>
  );
}
