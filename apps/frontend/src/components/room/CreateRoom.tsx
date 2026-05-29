'use client';

import { useState } from 'react';
import { useRouter } from "next/navigation";
import { toast } from 'sonner';
import { Eye, EyeOff, Users, Lightbulb } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { CloseButton } from '@/components/layout/CloseButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type Step = 'form' | 'complete';

interface CreateRoomProps {
  onBack?: () => void;
  onEnter?: (roomCode: string) => void;
}

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
      <div className='bg-[#111827] border border-white/[0.12] rounded-[16px] px-4 py-5 flex flex-col gap-4'>

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
          <span className='text-sm font-semibold text-white'>{password}</span>
        </div>

        <div className='border-t border-white/[0.08]' />

        {/* 방 코드 */}
        <div className='flex flex-col gap-1'>
          <span className='text-xs text-[#6B7280]'>방 코드</span>
          <span className='text-2xl font-bold text-white tracking-widest'>{roomCode}</span>
        </div>

        <div className='border-t border-white/[0.08]' />

        {/* 친구 초대 링크 */}
        <div className='flex flex-col gap-1'>
          <span className='text-xs text-[#6B7280]'>친구 초대 링크</span>
          <span className='text-xs text-[#8B5CF6] break-all'>{inviteLink}</span>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className='flex items-start gap-2 text-xs text-[#9CA3AF] leading-relaxed'>
        <Lightbulb size={14} className='text-[#FACC15] shrink-0 mt-0.5' />
        <span>링크와 비밀번호를 공유하여 같이 집중할 멤버들과 함께 입장해 시작해보세요!</span>
      </div>

      {/* 복사 버튼 */}
      <Button
        variant='outline'
        onClick={onCopyAll}
        className='w-full h-auto py-3 rounded-[16px] border border-[#8B5CF6] dark:border-[#8B5CF6] text-sm text-white/80 hover:bg-white/5'
      >
        초대 정보 모두 복사
      </Button>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export const CreateRoom = ({ onEnter }: CreateRoomProps) => {
  const router = useRouter();

  const onBack = () => {
    router.back();
  };
  const [step, setStep] = useState<Step>('form');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const isValid = roomName.trim().length > 0 && password.length >= 4 && password.length <= 12;

  const handleSubmit = async () => {
    if (!isValid) return;
    if (!document.cookie.includes('access_token=')) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const token = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1];

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: roomName, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message ?? '방 생성에 실패했습니다.');
      }

      const data: { code: string; url: string } = await response.json();
      setRoomCode(data.code);
      setStep('complete');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '방 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${roomCode}`;

  const handleCopyAll = async () => {
    const text = `[${roomName}] 에 초대합니다\n비밀번호 : ${password}\n방 코드 : ${roomCode}\n입장 링크 : ${inviteLink}`;
    await navigator.clipboard.writeText(text);
    toast.success('초대 정보가 복사되었어요');
  };

  return (
    <>
    <MobileLayout
      header={
        <>
          {step === 'complete' ? (
            <CloseButton onClick={() => setShowExitDialog(true)} />
          ) : (
            <BackButton onClick={onBack} />
          )}
          <HeaderTitle>
            {step === 'complete' ? '방 생성 완료 🎉' : '방 만들기'}
          </HeaderTitle>
        </>
      }
      bottomButton={
        step === 'complete' ? (
          <Button
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)', boxShadow: '0 0 40px rgba(124,58,237,0.45)' }}
            className='w-full h-14 rounded-[24px] text-base font-bold hover:scale-[1.01] active:scale-[0.98]'
            onClick={() => onEnter?.(roomCode)}
          >
            입장하기
          </Button>
        ) : (
          <Button
            disabled={!isValid || isSubmitting}
            onClick={handleSubmit}
            style={{
              background: isValid ? 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)' : undefined,
              boxShadow: isValid ? '0 0 40px rgba(124,58,237,0.45)' : undefined,
            }}
            className='w-full h-14 rounded-[24px] text-base font-bold hover:scale-[1.01] active:scale-[0.98] disabled:bg-[#1F2937] disabled:text-[#9CA3AF]'
          >
            {isSubmitting ? '생성 중...' : '방 만들기'}
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
            비밀방을 생성해<br />같이 집중할 멤버를 초대하세요.
          </p>

          <div className='flex justify-center mb-8'>
            <div className='inline-flex items-center gap-2.5 bg-[#111827] border border-white/[0.12] rounded-[16px] px-4 py-[14px] text-sm text-[#9CA3AF]'>
              <Users size={18} className='text-[#6B7280] shrink-0' />
              최대 10명까지 입장 가능합니다.
            </div>
          </div>

          <div className='flex flex-col gap-5'>
            <div className='flex flex-col gap-2'>
              <Label className='text-[15px] font-bold text-white/85'>방 이름</Label>
              <Input
                type='text'
                placeholder='방 이름을 입력해주세요'
                maxLength={20}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className='h-[52px] rounded-[16px] border-white/[0.12] bg-[#1A1A2E] px-4 text-sm text-white placeholder:text-white/30 focus-visible:border-[#8B5CF6] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30'
              />
              <span className='text-xs text-[#6B7280] text-right'>{roomName.length}/20</span>
            </div>

            <div className='flex flex-col gap-2'>
              <Label className='text-[15px] font-bold text-white/85'>비밀번호</Label>
              <div className='relative flex items-center'>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder='비밀번호를 입력해주세요'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='h-[52px] rounded-[16px] border-white/[0.12] bg-[#1A1A2E] px-4 pr-10 text-sm text-white placeholder:text-white/30 focus-visible:border-[#8B5CF6] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30'
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

    {/* 나가기 확인 다이얼로그 */}
    <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            지금 나가면 초대 링크를<br />다시 확인할 수 없어요
          </DialogTitle>
          <DialogDescription>정말 나가시겠습니까?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant='outline'
            className='flex-1 h-12 rounded-[14px] border-white/[0.18] text-white/80 bg-transparent hover:bg-white/5'
            onClick={() => setShowExitDialog(false)}
          >
            취소
          </Button>
          <Button
            className='flex-1 h-12 rounded-[14px] font-bold'
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)' }}
            onClick={() => { setShowExitDialog(false); onBack?.(); }}
          >
            나가기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};
