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
  // 클릭/타이핑으로 채워진 칸을 편집 중인지. true면 커서가 놓인 채워진 칸은 글자 대신 커서만 보인다.
  const [isEditing, setIsEditing] = useState(false);
  // 클릭으로 지정한 활성 칸(시각 고정용). 타이핑/이동/블러 시 해제하고 라이브러리 상태에 넘긴다.
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // 입장 검증 응답을 아직 기다리는 중인지. 닫힌 뒤 늦게 도착한 응답을 무시하기 위한 플래그.
  const pendingEnterRef = useRef(false);
  // OTP 입력 엘리먼트. 칸 클릭/붙여넣기 시 커서 위치 제어와, 에러 시 포커스 해제(blur)에 사용한다.
  const otpInputRef = useRef<HTMLInputElement>(null);
  // 클릭 좌표로 어느 칸을 눌렀는지 계산하기 위해 슬롯들이 들어있는 영역을 참조한다.
  const slotsContainerRef = useRef<HTMLDivElement>(null);
  // 완성 시 포커스를 옮길 대상(입장하기 버튼). 다이얼로그로 포커스가 튀는 것 방지.
  const submitButtonRef = useRef<HTMLButtonElement>(null);

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
      setIsEditing(false);
      setEditIndex(null);
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
      // 값이 비워지므로 편집 시각 상태도 함께 초기화한다. 안 하면 직전 클릭으로 잡힌
      // editIndex가 남아 빈 입력에서 커서가 엉뚱한 칸에 표시될 수 있다.
      setIsEditing(false);
      setEditIndex(null);
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setCodeError('존재하지 않거나 종료된 방이에요.');
      } else {
        setCodeError(
          getErrorMessage(err, '입장에 실패했어요. 잠시 후 다시 시도해주세요.'),
        );
      }
      // 에러 시에는 입력칸 포커스를 풀어 키보드를 내리고, 에러 메시지를 본 뒤 다시 시도하게 한다.
      otpInputRef.current?.blur();
    },
  });

  const isCodeValid = roomCode.length === ROOM_CODE_LENGTH;

  /**
   * 입력된 방 코드가 실제 존재하는 방인지 검증한 뒤 입장시킨다.
   * (코드가 8자가 아니거나 검증 진행 중이면 무시)
   */
  const handleEnterByCode = () => {
    if (!isCodeValid || validateRoomMutation.isPending) return;
    pendingEnterRef.current = true;
    setCodeError('');
    validateRoomMutation.mutate(roomCode);
  };

  /**
   * 클릭/더블클릭한 가로 좌표로 어느 칸을 눌렀는지 찾아 커서를 옮긴다.
   * - 채워진 칸: 그 칸으로 커서 이동 + '글자 숨김+커서만'(편집) 상태로 전환
   * - 빈 칸/간격: 항상 입력 끝(다음 입력 칸)으로 커서를 모아 다중 선택을 막는다
   */
  const moveCaretToSlotAt = (clientX: number) => {
    const input = otpInputRef.current;
    const container = slotsContainerRef.current;
    if (!input || !container) return;
    const slots = container.querySelectorAll<HTMLElement>(
      '[data-slot="input-otp-slot"]',
    );
    // 손가락이 칸 사이 간격에 닿아도 '가장 가까운 칸'으로 스냅한다. (간격 터치 시 빈칸으로 튐 방지)
    let nearest = -1;
    let bestDist = Infinity;
    slots.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const dist =
        clientX < rect.left
          ? rect.left - clientX
          : clientX > rect.right
            ? clientX - rect.right
            : 0;
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    });
    const len = input.value.length;
    if (nearest >= 0 && nearest < len) {
      // 채워진 칸(또는 그 근처): 그 칸을 선택(범위)해 글자를 숨기고 커서만 보여주며, 타이핑 시 교체되게 한다.
      setIsEditing(true);
      // 시각적 활성 칸을 즉시 고정해, 라이브러리 선택이 끝으로 튀어도 잔상이 안 생기게 한다.
      setEditIndex(nearest);
      input.setSelectionRange(nearest, nearest + 1);
    } else {
      // 빈 칸/간격: 입력 끝으로 커서를 모은다. 활성 칸도 그 한 칸으로 고정해
      // (더블탭 전체선택이 떠도) 모든 값이 포커싱돼 보이는 것을 시각적으로 막는다.
      setIsEditing(false);
      const pos = Math.min(len, ROOM_CODE_LENGTH - 1);
      setEditIndex(pos);
      input.setSelectionRange(pos, len);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* blur 후 Radix가 포커스를 옮겨도 컨테이너에 포커스 아웃라인이 보이지 않게 한다. */}
      <DialogContent className='outline-none'>
        <DialogHeader>
          <DialogTitle>방 코드로 입장</DialogTitle>
          <DialogDescription>
            입장하실 방 코드를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <div ref={slotsContainerRef} className='flex flex-col gap-2 py-2'>
          {/* 방 코드는 nanoid(8) 기본 알파벳(대소문자·숫자·-·_)을 사용하므로 대소문자를 구분하고 허용 문자에 -, _를 포함한다. */}
          <InputOTP
            ref={otpInputRef}
            maxLength={ROOM_CODE_LENGTH}
            pattern='^[A-Za-z0-9_-]*$'
            value={roomCode}
            // 비밀번호 매니저 대응용 폭 강제확장/좌표검사가 모바일 탭 인식을 흔들어 끈다.
            pushPasswordManagerStrategy='none'
            // 방 코드는 영문 대소문자/숫자/-/_ 를 쓰므로 문자 키보드를 띄우고,
            // 자동 대문자화/자동완성/맞춤법을 꺼서 코드가 변형되지 않게 한다.
            inputMode='text'
            autoCapitalize='none'
            autoComplete='off'
            spellCheck={false}
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? CODE_ERROR_ID : undefined}
            onChange={(value) => {
              setRoomCode(value);
              // 타이핑(자동 이동)부터는 라이브러리 활성칸을 따른다.
              setEditIndex(null);
              // 다시 입력하면 에러를 즉시 해제한다.
              if (codeError) setCodeError('');
              // 마지막 칸까지 채워져(완성 또는 마지막 칸 수정) 더 입력할 칸이 없으면
              // 포커스를 풀어 전체 코드가 보이게 한다. (다이얼로그로 튀지 않게 버튼으로 이동)
              // value !== roomCode 조건: input-otp가 포커스/값 변경 시 쏘는 합성 input
              // 이벤트(값은 그대로)로 포커스 해제가 오발되는 것을 막는다.
              if (
                value !== roomCode &&
                value.length === ROOM_CODE_LENGTH &&
                (otpInputRef.current?.selectionStart ?? 0) >= ROOM_CODE_LENGTH
              ) {
                setIsEditing(false);
                setEditIndex(null);
                // 완성 직후엔 입장 버튼이 아직 disabled(직전 렌더 기준)라 focus가 무시된다.
                // 버튼이 활성화되는 리렌더 다음 프레임에 옮겨야 모바일에서도 키보드가 내려간다.
                requestAnimationFrame(() => submitButtonRef.current?.focus());
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEnterByCode();
              // 방향키 등으로 칸을 옮기면 시각 고정을 풀어 라이브러리 활성칸을 따른다.
              else if (
                e.key.startsWith('Arrow') ||
                e.key === 'Home' ||
                e.key === 'End'
              )
                setEditIndex(null);
            }}
            // 가장 이른 시점에 활성 칸을 고정해, 네이티브 캐럿이 끝으로 튀기 전에 시각을 잡는다.
            // (preventDefault 미사용 → iOS 소프트키보드 유지)
            onPointerDown={(e) => {
              if (e.button > 0) return;
              moveCaretToSlotAt(e.clientX);
            }}
            onClick={(e) => moveCaretToSlotAt(e.clientX)}
            // PC에서 채워진 칸을 빠르게 두 번 클릭하면 단어선택→우클릭(컨텍스트) 메뉴가 뜨는 것을 막는다.
            onDoubleClick={(e) => {
              e.preventDefault();
              moveCaretToSlotAt(e.clientX);
            }}
            onContextMenu={(e) => e.preventDefault()}
            // 빈칸 더블탭 등으로 입력창이 '전체(여러 글자)'를 선택하면 모든 칸이 활성처럼 보이고
            // 그 상태로 입력하면 전체가 교체된다. 이 OTP의 정상 선택은 최대 1글자이므로
            // 2글자 이상 선택은 즉시 끝으로 collapse하고 활성 칸도 한 칸으로 고정한다.
            onSelect={(e) => {
              const input = e.currentTarget;
              const start = input.selectionStart ?? 0;
              const end = input.selectionEnd ?? 0;
              if (end - start > 1) {
                const pos = Math.min(input.value.length, ROOM_CODE_LENGTH - 1);
                input.setSelectionRange(pos, input.value.length);
                setIsEditing(false);
                setEditIndex(pos);
              }
            }}
            // 포커스를 잃으면 편집 상태를 해제해 글자를 다시 보여준다.
            onBlur={() => {
              setIsEditing(false);
              setEditIndex(null);
            }}
            // 방 코드는 8자 고정 토큰이므로, 붙여넣기는 커서 위치와 무관하게 처음부터 전체 교체한다.
            onPaste={(e) => {
              const text = e.clipboardData?.getData('text') ?? '';
              const cleaned = text
                .replace(/[^A-Za-z0-9_-]/g, '')
                .slice(0, ROOM_CODE_LENGTH);
              e.preventDefault();
              if (!cleaned) return;
              setIsEditing(false);
              setEditIndex(null);
              setRoomCode(cleaned);
              if (codeError) setCodeError('');
              if (cleaned.length === ROOM_CODE_LENGTH) {
                // 8자 전체가 붙여넣어져 완성되면 타이핑 완성과 동일하게 포커스를 푼다(버튼으로 이동).
                // 버튼 활성화 리렌더 이후 포커스해야 모바일에서 무시되지 않는다.
                requestAnimationFrame(() => submitButtonRef.current?.focus());
              } else {
                // 부분 붙여넣기는 입력을 이어가도록 커서를 끝으로 모은다.
                requestAnimationFrame(() => {
                  const input = otpInputRef.current;
                  if (!input) return;
                  const pos = Math.min(cleaned.length, ROOM_CODE_LENGTH - 1);
                  input.setSelectionRange(pos, cleaned.length);
                });
              }
            }}
            containerClassName='w-full'
          >
            <InputOTPGroup className='w-full justify-between gap-1.5'>
              {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  showCaretWhenFilled={isEditing}
                  activeIndexOverride={editIndex}
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
            ref={submitButtonRef}
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
