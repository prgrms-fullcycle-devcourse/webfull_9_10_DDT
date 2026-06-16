'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { getErrorMessage } from '@/lib/error';

// 방 코드는 nanoid(8) 8자리 → 이 길이가 채워져야 입장 버튼을 활성화한다.
const ROOM_CODE_LENGTH = 8;

// 인라인 에러 텍스트를 OTP 입력과 연결하기 위한 id (스크린리더 aria-describedby용).
const CODE_ERROR_ID = 'room-code-error';

interface RoomCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 방 코드로 입장하는 다이얼로그.
 *
 * 입장 전 해당 코드의 방이 실제로 존재하는지 먼저 확인하고, 없는/잘못된 코드면
 * 페이지 이동 없이 다이얼로그를 유지한 채 입력칸 아래에 에러를 보여준다.
 *
 * @param open - 다이얼로그 열림 여부 (부모가 제어)
 * @param onOpenChange - 열림 상태 변경 콜백 (취소·바깥클릭·ESC·입장 성공 시 호출)
 */
export const RoomCodeDialog = ({ open, onOpenChange }: RoomCodeDialogProps) => {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [codeError, setCodeError] = useState('');
  // 입장 검증 응답을 아직 기다리는 중인지. 닫힌 뒤 늦게 도착한 응답을 무시하기 위한 플래그.
  const pendingEnterRef = useRef(false);
  // OTP 입력 엘리먼트. 에러로 입력값을 비운 뒤에도 포커스를 되돌리기 위해 참조한다.
  const otpInputRef = useRef<HTMLInputElement>(null);

  /**
   * 다이얼로그 열림 상태를 부모에 전달하되, 닫힐 때는 내부 입력 상태를 초기화한다.
   * (다음에 다시 열 때 깨끗한 상태를 보장)
   *
   * @param next - 변경될 열림 여부
   */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // 닫는 순간 진행 중이던 검증 결과는 무시한다.
      pendingEnterRef.current = false;
      setRoomCode('');
      setCodeError('');
    }
    onOpenChange(next);
  };

  const validateRoomMutation = useMutation({
    mutationFn: async (code: string) => {
      await getRoomApi().roomControllerFindById(code);
    },
    onSuccess: (_data, code) => {
      // 사용자가 검증 도중 닫았다면 늦게 도착한 성공으로 이동시키지 않는다.
      if (!pendingEnterRef.current) return;
      pendingEnterRef.current = false;
      setRoomCode('');
      onOpenChange(false);
      router.push(`/room/${code}`);
    },
    onError: (err) => {
      // 사용자가 검증 도중 닫았다면 늦게 도착한 에러를 무시한다.
      if (!pendingEnterRef.current) return;
      pendingEnterRef.current = false;
      // 실패 시 입력칸을 비워 다시 입력하도록 유도한다.
      setRoomCode('');
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setCodeError('존재하지 않거나 종료된 방이에요.');
      } else {
        setCodeError(
          getErrorMessage(err, '입장에 실패했어요. 잠시 후 다시 시도해주세요.'),
        );
      }
      // 값이 비워지고 버튼이 비활성화되며 포커스가 풀리므로, 리렌더 커밋 이후 입력칸으로 포커스를 되돌린다.
      setTimeout(() => otpInputRef.current?.focus(), 0);
    },
  });

  const isCodeValid = roomCode.length === ROOM_CODE_LENGTH;

  const handleEnterByCode = () => {
    if (!isCodeValid || validateRoomMutation.isPending) return;
    pendingEnterRef.current = true;
    setCodeError('');
    validateRoomMutation.mutate(roomCode);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>방 코드로 입장</DialogTitle>
          <DialogDescription>
            입장하실 방 코드를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2 py-2'>
          {/* 방 코드는 nanoid(8) 기본 알파벳(대소문자·숫자·-·_)을 사용하므로 대소문자를 구분하고 허용 문자에 -, _를 포함한다. */}
          <InputOTP
            ref={otpInputRef}
            maxLength={ROOM_CODE_LENGTH}
            pattern='^[A-Za-z0-9_-]*$'
            value={roomCode}
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? CODE_ERROR_ID : undefined}
            onChange={(value) => {
              setRoomCode(value);
              // 다시 입력하면 에러를 즉시 해제한다.
              if (codeError) setCodeError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEnterByCode();
            }}
            containerClassName='w-full'
          >
            <InputOTPGroup className='w-full justify-between gap-1.5'>
              {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  aria-invalid={codeError ? true : undefined}
                  className='h-12 flex-1 rounded-md border border-white/15 bg-black/40 shadow-none first:rounded-l-md last:rounded-r-md data-[active=true]:ring-2 data-[active=true]:ring-ring/30 dark:bg-black/40'
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {/* 입력칸 아래 인라인 에러 텍스트 (없는/잘못된 코드일 때 표시) */}
          {codeError && (
            <p id={CODE_ERROR_ID} className='text-xs text-destructive'>
              {codeError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant='secondary'
            className='flex-1 h-12 rounded-lg'
            onClick={() => handleOpenChange(false)}
          >
            취소
          </Button>
          <Button
            disabled={!isCodeValid || validateRoomMutation.isPending}
            onClick={handleEnterByCode}
            className='flex-1 h-12 rounded-lg font-bold'
          >
            {validateRoomMutation.isPending ? '확인 중...' : '입장하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
