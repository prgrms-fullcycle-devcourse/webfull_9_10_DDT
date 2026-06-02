import { useSocket } from '@/contexts/SocketContext';
import { getProfileImageSrc } from '@/lib/profileImage';
import { useAuthStore } from '@/store/useAuthStore';
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

export default function MemberSignList() {
  const socket = useSocket();
  const me = useAuthStore((state) => state.me);
  const members = useRoomStore((state) => state.members);
  const hostId = useRoomStore((state) => state.hostId);
  const { confirm, confirmProps } = useConfirm();

  if (!me) {
    return;
  }

  const isHost = me.id === hostId;
  const myMember = members[me.id];
  const myProfileImage = myMember?.profileImage ?? me.profileImage;
  const isMeSigned = myMember?.isSigned ?? false;
  const memberList = Object.entries(members);
  const signedCount = memberList.filter(([, m]) => m.isSigned).length;
  const memberCount = memberList.length;

  const handleSignToggle = () => {
    socket?.emit('member:sign', { signed: !isMeSigned });
  };

  const handleKickMember = async (targetId: string) => {
    if (!isHost) {
      return;
    }
    const ok = await confirm({
      title: `${members[targetId].nickname} 님을 강제 퇴장 하시겠어요?`,
      description: '강퇴당한 멤버는 재입장이 안됩니다.',
      confirmText: '퇴장시키기',
      cancelText: '아니요',
      variant: 'destructive',
    });
    if (!ok) {
      return;
    }

    socket?.emit('member:kick', { targetId });
  };

  const handleMemberEditToggle = (targetId: string, canEdit: boolean) => {
    socket?.emit('edit:member', { targetId, canEdit });
  };

  return (
    <Card>
      <div className='p-2'>
        <div>
          <div className='flex w-full justify-between items-center p-1 my-1'>
            <div className='flex items-center p-1 gap-2'>
              <div className='relative'>
                <Image
                  src={
                    getProfileImageSrc(myProfileImage) ?? '/avatars/bear.png'
                  }
                  alt={me.id}
                  width={40}
                  height={40}
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
              <div className='flex gap-1 items-end'>
                <span>나</span>
                {isHost && (
                  <span className='text-xs text-muted-foreground'>(방장)</span>
                )}
              </div>
            </div>
            <Button
              type='button'
              variant='ghost'
              onClick={handleSignToggle}
              className={cn(
                'ring-1 rounded-sm! px-4!',
                isMeSigned ? 'ring-success' : 'ring-ring',
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
                <div key={id} className='my-1'>
                  <div className='flex w-full justify-between items-center p-1'>
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
                      <div>
                        <span>{m.nickname}</span>
                        {isThisHost && <span>(방장)</span>}
                      </div>
                    </div>
                    {isHost && (
                      <div className='flex'>
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
                            <Button variant='ghost' size='icon'>
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
          <CardDescription>서명하지 않으면 강퇴되요</CardDescription>
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </Card>
  );
}
