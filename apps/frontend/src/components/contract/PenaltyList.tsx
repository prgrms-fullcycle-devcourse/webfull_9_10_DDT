import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { useRoomStore } from '@/store/useRoomStore';
import { UseContractYjsReturn } from '@/types/yjs';
import OwnerIndicator from './OwnerIndicator';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { CONTRACT_INPUT_FOCUS } from './inputStyles';
import { blurOnEnter } from './utils';
import { Separator } from '../ui/separator';
import { useAuth } from '@/hooks/useAuth';
import {
  ComponentPropsWithoutRef,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';

interface PenaltyListProps {
  yjs: Pick<
    UseContractYjsReturn,
    | 'addPenalty'
    | 'penalties'
    | 'updatePenalty'
    | 'removePenalty'
    | 'fieldOwners'
    | 'handleFocus'
    | 'handleBlur'
  >;
}

interface PenaltyInputProps extends Omit<
  ComponentPropsWithoutRef<typeof Input>,
  'value' | 'onChange'
> {
  content: string;
  onUpdate: (val: string) => void;
}

/**
 * 벌칙 항목의 Yjs 실시간 협업 입력 컴포넌트.
 * 한글 IME 조합(composition) 중에는 Yjs 동기화를 지연하여 커서 이동을 방지합니다.
 * 편집 중이 아닐 때만 외부 Yjs 값(다른 유저의 수정)을 로컬 draft에 반영합니다.
 * focus 시 placeholder를 비우고 blur 시 복원합니다.
 *
 * @param content - Yjs에서 받은 현재 벌칙 내용
 * @param onUpdate - 값 변경 시 Yjs에 동기화하는 콜백
 */
const PenaltyInput = forwardRef<HTMLInputElement, PenaltyInputProps>(
  ({ content, onUpdate, onFocus, onBlur, onKeyDown, placeholder, ...props }, ref) => {
    const [draft, setDraft] = useState(content ?? '');
    const isEditingRef = useRef(false);
    const isComposingRef = useRef(false);
    const [isFocused, setIsFocused] = useState(false);

    // 편집 중이 아닐 때만 외부 Yjs 값 반영 (다른 유저 업데이트)
    useEffect(() => {
      if (!isEditingRef.current) {
        setDraft(content ?? '');
      }
    }, [content]);

    return (
      <Input
        ref={ref}
        maxLength={50}
        value={draft}
        placeholder={isFocused ? '' : placeholder}
        autoComplete='off'
        autoCorrect='off'
        spellCheck={false}
        onFocus={(e) => {
          setIsFocused(true);
          isEditingRef.current = true;
          onFocus?.(e);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          const val = (e.target as HTMLInputElement).value;
          setDraft(val);
          onUpdate(val);
        }}
        onChange={(e) => {
          const val = e.target.value;
          setDraft(val); // 로컬 상태만 업데이트 → cursor 유지
          if (!isComposingRef.current) {
            onUpdate(val); // 한글 조합 중 아닐 때만 Yjs 동기화
          }
        }}
        {...props}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          blurOnEnter(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          isEditingRef.current = false;
          onUpdate(draft); // blur 시 최종 값 Yjs 동기화
          onBlur?.(e);
        }}
      />
    );
  },
);
PenaltyInput.displayName = 'PenaltyInput';

/**
 * 벌칙 목록 카드 컴포넌트.
 * Yjs를 통해 실시간 협업으로 벌칙을 추가/수정/삭제합니다.
 * 편집 권한(canEdit)이 없으면 입력 비활성화 + 추가/삭제 버튼 숨김.
 * 다른 유저가 편집 중인 필드는 OwnerIndicator로 표시됩니다.
 *
 * @param yjs - useYjsContract에서 반환된 벌칙 관련 함수/상태 (addPenalty, penalties 등)
 */
export default function PenaltyList({ yjs }: PenaltyListProps) {
  const me = useAuth().me;
  const myMember = useRoomStore((state) =>
    me ? state.members[me.id] : undefined,
  );

  const {
    addPenalty,
    penalties,
    updatePenalty,
    removePenalty,
    fieldOwners,
    handleFocus,
    handleBlur,
  } = yjs;

  const lastInputRef = useRef<HTMLInputElement | null>(null);
  const prevLengthRef = useRef(penalties.length);
  const shouldFocusRef = useRef(false);

  /**
   * 벌칙 추가 핸들러.
   * 빈 항목을 추가한 뒤, 렌더 완료 후 마지막 입력에 자동 포커스합니다.
   */
  const handleAddPenalty = () => {
    shouldFocusRef.current = true;
    addPenalty('');
  };

  // 벌칙이 새로 추가됐을 때(길이 증가 + shouldFocus 플래그) 마지막 입력에 포커스
  useEffect(() => {
    if (penalties.length > prevLengthRef.current && shouldFocusRef.current) {
      lastInputRef.current?.focus();
      shouldFocusRef.current = false;
    }
    prevLengthRef.current = penalties.length;
  }, [penalties.length]);

  if (!me) return null;

  const canEdit = myMember?.canEdit ?? false;
  const myNickname = myMember?.nickname ?? me.nickname;
  return (
    <Card>
      <CardHeader className='flex justify-between items-end'>
        <CardTitle>벌칙 목록</CardTitle>
        <CardDescription className='text-xs'>
          벌칙은 중복될 수 있어요.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className='space-y-4'>
          <div className='flex flex-col gap-2'>
            {penalties.map((p, i) => {
              const penaltyKey = `penalty_${p.id}`;
              return (
                <div key={p.id} className='space-y-2'>
                  <OwnerIndicator
                    fieldKey={penaltyKey}
                    fieldOwners={fieldOwners}
                  />
                  <div className='flex flex-1 items-center gap-1'>
                    <PenaltyInput
                      ref={i === penalties.length - 1 ? lastInputRef : null}
                      content={p.content}
                      onUpdate={(val) => updatePenalty(i, val)}
                      className={cn(
                        CONTRACT_INPUT_FOCUS,
                        fieldOwners[penaltyKey] && 'outline-2 outline-offset-1',
                        'bg-background! h-12 z-0 flex-1 min-w-0',
                      )}
                      style={{
                        outlineColor: fieldOwners[penaltyKey]?.color,
                      }}
                      disabled={
                        !canEdit ||
                        (!!fieldOwners[penaltyKey] &&
                          fieldOwners[penaltyKey].userId !== me.id)
                      }
                      placeholder='예: 팔굽혀펴기 10회'
                      onFocus={() => handleFocus(penaltyKey, me.id, myNickname)}
                      onBlur={handleBlur}
                    />
                    {canEdit && (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={`${i + 1}번째 벌칙 삭제`}
                        onClick={() => removePenalty(i)}
                        className='shrink-0 w-10 h-10'
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {canEdit && (
              <Button
                type='button'
                variant='outline'
                disabled={!canEdit}
                size='lg'
                onClick={handleAddPenalty}
              >
                <Plus className='w-4 h-4 mr-1' /> 벌칙 추가
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
