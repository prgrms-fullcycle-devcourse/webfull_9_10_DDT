'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Users, Lightbulb } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { CloseButton } from '@/components/layout/CloseButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useConfirm } from '@/hooks/useConfirm';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { useMutation } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/error';
import { isMobileOrTablet } from '@/lib/device';
import { useAuth } from '@/hooks/useAuth';
import { useActiveRoom, getActiveRoomPath } from '@/hooks/useActiveRoom';
import { startTermsAgreementLogin } from '@/lib/authNavigation';

type Step = 'form' | 'complete';
/* ── 완료 화면 ── */
function CreateRoomComplete({
  roomName,
  password,
  roomCode,
  inviteLink,
  onCopyAll,
}: {
  roomName: string;
  password: string;
  roomCode: string;
  inviteLink: string;
  onCopyAll: () => void;
}) {
  return (
    <div className='flex flex-col gap-5 pt-2'>
      <p className='text-center text-base text-white/70'>
        방이 성공적으로 생성되었어요!
      </p>

      {/* 정보 카드 */}
      <div className='bg-card border border-border rounded-[16px] px-4 py-5 flex flex-col gap-4'>
        {/* 방 이름 & 최대 인원 */}
        <div className='flex gap-4'>
          <div className='flex-1 flex flex-col gap-1'>
            <span className='text-xs text-[#6B7280]'>방 이름</span>
            <span className='text-sm font-semibold text-white'>{roomName}</span>
          </div>
          <div className='flex flex-col gap-1'>
            <span className='text-xs text-[#6B7280]'>최대 인원</span>
            <span className='text-sm font-semibold text-white'>10명</span>
          </div>
        </div>

        <div className='border-t border-white/[0.08]' />

        {/* 비밀번호 */}
        <div className='flex flex-col gap-1'>
          <span className='text-xs text-[#6B7280]'>비밀번호</span>
          <span className='text-2xl font-semibold text-white'>{password}</span>
        </div>

        <div className='border-t border-white/[0.08]' />

        {/* 방 코드 */}
        <div className='flex flex-col gap-1'>
          <span className='text-xs text-[#6B7280]'>방 코드</span>
          <span className='text-2xl font-bold text-white tracking-widest'>
            {roomCode}
          </span>
        </div>

        <div className='border-t border-white/[0.08]' />

        {/* 친구 초대 링크 */}
        <div className='flex flex-col gap-1'>
          <span className='text-xs text-[#6B7280]'>친구 초대 링크</span>
          <span className='text-xs text-ring break-all'>{inviteLink}</span>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className='flex items-center gap-2 text-xs text-muted-foreground leading-relaxed'>
        <Lightbulb size={14} className='text-[#FACC15] shrink-0 mt-0.5' />
        <span>
          링크와 비밀번호를 공유하여 <br />
          같이 집중할 멤버들과 함께 입장해 시작해보세요!
        </span>
      </div>

      {/* 복사 버튼 */}
      <Button
        variant='outline'
        onClick={onCopyAll}
        className='w-full h-auto py-3 rounded-[16px] border border-ring text-sm text-white/80 hover:bg-white/5'
      >
        초대 정보 공유
      </Button>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export const CreateRoom = () => {
  const router = useRouter();
  const { me, refetchMe } = useAuth();
  const isGuest = me?.role === 'guest';

  const onBack = () => {
    router.back();
  };

  // 로그인 팝업(/terms) 열기
  const handleOpenLogin = () => {
    startTermsAgreementLogin(router.push);
  };
  const [step, setStep] = useState<Step>('form');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { confirm, confirmProps } = useConfirm();
  const activeRoom = useActiveRoom();

  const isValid =
    roomName.trim().length > 0 && password.length >= 4 && password.length <= 12;

  const createRoomMutation = useMutation({
    mutationFn: async (input: { title: string; password: string }) => {
      const res = await getRoomApi().roomControllerCreate(input);
      return res.data as { code: string; url: string };
    },
    onSuccess: (data) => {
      setRoomCode(data.code);
      sessionStorage.setItem(`isHost:${data.code}`, 'true');
      sessionStorage.setItem(`hostPassword:${data.code}`, password);
      setStep('complete');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, '방 생성 실패'));
    },
  });

  // 방장이 입장하지 않고 나가면 방을 폭파(삭제)한다. leaveRoom은 방장이면 deleteRoom을 호출한다.
  const destroyRoomMutation = useMutation({
    mutationFn: async (code: string) => {
      await getRoomApi().roomControllerLeaveRoom(code);
    },
    onSuccess: () => {
      sessionStorage.removeItem(`isHost:${roomCode}`);
      sessionStorage.removeItem(`hostPassword:${roomCode}`);
      onBack();
    },
    onError: (err) => {
      // 이미 삭제됐거나 실패해도 사용자는 나가려는 의도이므로 화면은 빠져나간다.
      toast.error(getErrorMessage(err, '방 폭파에 실패했습니다.'));
      onBack();
    },
  });

  // 방 만들기 화면 진입 시 이미 진행 중인 방이 있으면 복귀/홈으로 유도 모달을 띄운다.
  // (참여 중인 방이 있으면 새 방 생성 화면에 머무를 수 없게 함)
  const activeRoomPromptedRef = useRef(false);
  useEffect(() => {
    if (!activeRoom || activeRoomPromptedRef.current) {
      return;
    }
    activeRoomPromptedRef.current = true;
    void (async () => {
      const ok = await confirm({
        title: '이미 진행 중인 방이 있습니다',
        description: `[${activeRoom.title}] 방으로 복귀하시겠습니까?`,
        confirmText: '방 복귀하기',
        cancelText: '홈으로',
      });
      router.push(ok ? getActiveRoomPath(activeRoom) : '/');
    })();
  }, [activeRoom, confirm, router]);

  // 생성완료 화면에서 나가기(X) → 폭파 확인 다이얼로그 → 확인 시 방 폭파
  const handleExit = async () => {
    const ok = await confirm({
      title: '지금 나가면 방이 폭파됩니다',
      description: '정말 폭파하시겠습니까?',
      confirmText: '방 폭파하기',
      cancelText: '취소',
      variant: 'destructive',
    });
    if (!ok) return;
    destroyRoomMutation.mutate(roomCode);
  };

  // 로그인 팝업에서 OAUTH_SUCCESS를 받으면 회원 정보 갱신 → 게스트 화면 해제
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_SUCCESS') {
        void refetchMe();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetchMe]);

  const handleSubmit = () => {
    if (!isValid) return;
    createRoomMutation.mutate({ title: roomName, password });
  };

  const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${roomCode}`;

  const handleCopyAll = async () => {
    const text = `[${roomName}] 에 초대합니다\n비밀번호 : ${password}\n방 코드 : ${roomCode}\n입장 링크 : ${inviteLink}`;

    // 모바일/태블릿이면 네이티브 공유 시트로, 그 외에는 클립보드 복사로 폴백한다.
    // text에 이미 제목·비밀번호·코드·링크가 모두 담겨 있으므로 title·url은 넘기지 않는다.
    // (둘을 함께 넘기면 공유 앱이 text 앞뒤로 합쳐 중복 표기됨)
    if (isMobileOrTablet() && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        // 사용자가 공유 시트를 닫은 경우(AbortError)는 조용히 무시한다.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('초대 정보가 복사되었어요');
    } catch {
      toast.error('초대 정보 복사에 실패했습니다.');
    }
  };

  if (isGuest) {
    return (
      <MobileLayout
        header={
          <>
            <BackButton onClick={onBack} />
            <HeaderTitle>방 만들기</HeaderTitle>
          </>
        }
      >
        <div className='flex flex-col items-center gap-3 pt-16 text-center'>
          <p className='text-base font-bold text-white'>
            방을 만들려면 로그인이 필요해요.
          </p>
          <p className='text-sm text-white/50'>
            게스트는 방을 만들 수 없어요.
            <br />
            회원으로 로그인 후 이용해주세요.
          </p>
          <Button
            onClick={handleOpenLogin}
            className='mt-3 h-12 rounded-[14px] px-6 font-bold'
          >
            로그인하기
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <>
      <MobileLayout
        header={
          <>
            {step === 'complete' ? (
              <CloseButton onClick={handleExit} />
            ) : (
              <BackButton onClick={onBack} />
            )}
            <HeaderTitle align={step === 'complete' ? 'center' : 'left'}>
              {step === 'complete' ? '방 생성 완료 🎉' : '방 만들기'}
            </HeaderTitle>
          </>
        }
        bottomButton={
          step === 'complete' ? (
            <Button size='cta' onClick={() => router.push(`/room/${roomCode}`)}>
              입장하기
            </Button>
          ) : (
            <Button
              disabled={!isValid || createRoomMutation.isPending}
              onClick={handleSubmit}
              size='cta'
              className='disabled:bg-secondary disabled:text-muted-foreground'
            >
              {createRoomMutation.isPending ? '생성 중...' : '방 만들기'}
            </Button>
          )
        }
      >
        {step === 'complete' ? (
          <CreateRoomComplete
            roomName={roomName}
            password={password}
            roomCode={roomCode}
            inviteLink={inviteLink}
            onCopyAll={handleCopyAll}
          />
        ) : (
          <>
            <p className='text-center text-[20px] font-normal text-white/50 leading-relaxed pb-6'>
              비밀방을 생성해
              <br />
              같이 집중할 멤버를 초대하세요.
            </p>

            <div className='flex justify-center mb-8'>
              <div className='inline-flex items-center gap-2.5 bg-card border border-border rounded-lg px-4 py-3.5 text-sm text-muted-foreground'>
                <Users size={18} className='text-[#6B7280] shrink-0' />
                최대 10명까지 입장 가능합니다.
              </div>
            </div>

            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-2'>
                <Label className='text-[15px] font-bold text-white/85'>
                  방 이름
                </Label>
                <FormInput
                  type='text'
                  placeholder='방 이름을 입력해주세요'
                  maxLength={20}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <span className='text-xs text-[#6B7280] text-right'>
                  {roomName.length}/20
                </span>
              </div>

              <div className='flex flex-col gap-2'>
                <Label className='text-[15px] font-bold text-white/85'>
                  비밀번호
                </Label>
                <div className='relative flex items-center'>
                  <FormInput
                    type={showPassword ? 'text' : 'password'}
                    placeholder='비밀번호를 입력해주세요'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className='pr-10'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label='비밀번호 표시'
                    className='absolute right-1 text-[#6B7280] hover:text-white/75 hover:bg-transparent'
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
                <span className='text-xs text-[#6B7280] pl-0.5'>
                  · 비밀번호는 4~12자이어야 합니다.
                </span>
              </div>
            </div>
          </>
        )}
      </MobileLayout>

      {/* 나가기(방 폭파) 확인 다이얼로그 */}
      <ConfirmDialog {...confirmProps} />
    </>
  );
};
