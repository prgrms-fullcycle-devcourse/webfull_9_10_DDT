'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useYjsContract } from '@/hooks/useYjsContract';
import { cn } from '@/lib/utils';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Plus, Trash2, User } from 'lucide-react';

interface FieldOwner {
  userId: string;
  nickname: string;
  color: string;
}

interface ContractFormValues {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

interface ContractFormProps {
  roomCode: string;
  userId: string;
  nickname: string;
  canEdit: boolean;
}

interface OwnerIndicatorProps {
  fieldKey: string;
  fieldOwners: Record<string, FieldOwner>;
}

// 외부로 분리된 Indicator 컴포넌트
const OwnerIndicator = ({ fieldKey, fieldOwners }: OwnerIndicatorProps) => {
  const owner = fieldOwners[fieldKey];
  if (!owner) return null;
  return (
    <Badge
      variant='outline'
      className='ml-2 animate-pulse'
      style={{ borderColor: owner.color, color: owner.color }}
    >
      <User className='w-3 h-3 mr-1' />
      {owner.nickname} 편집 중
    </Badge>
  );
};

const ContractForm = ({
  roomCode,
  userId,
  nickname,
  canEdit,
}: ContractFormProps) => {
  const {
    fields,
    tiers,
    penalties,
    isConnected,
    fieldOwners,
    updateField,
    handleFocus,
    handleBlur,
    addTier,
    updateTier,
    removeTier,
    addPenalty,
    updatePenalty,
    removePenalty,
  } = useYjsContract(roomCode, true);

  const [arrayError, setArrayError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ContractFormValues>({
    defaultValues: { focusMin: 0, breakMin: 0, rounds: 0 },
  });

  useEffect(() => {
    setValue('focusMin', fields.focusMin);
    setValue('breakMin', fields.breakMin);
    setValue('rounds', fields.rounds); // 빠졌던 횟수 폼 동기화 유지
  }, [fields, setValue]);

  const validateArrays = (): string | null => {
    if (tiers.length === 0) return '벌칙 강도를 1단계 이상 설정해주세요';
    if (penalties.length === 0) return '벌칙을 1개 이상 입력해주세요';
    return null;
  };

  const onSubmit = (data: ContractFormValues) => {
    const error = validateArrays();
    if (error) {
      setArrayError(error);
      return;
    }
    setArrayError(null);
    console.log('서명 완료:', data, tiers, penalties);
  };

  return (
    <div className='max-w-2xl mx-auto p-4'>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <div className='flex justify-between items-center'>
              <CardTitle className='text-2xl font-bold'>집중 계약서</CardTitle>
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? '실시간 연결됨' : '연결 시도 중...'}
              </Badge>
            </div>
            <CardDescription>
              방 ID: {roomCode} - 함께 규칙을 정하고 서명하세요.
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-6'>
            {/* 기본 설정 섹션 */}
            <div className='space-y-4'>
              <h3 className='text-sm font-medium text-muted-foreground uppercase tracking-wider'>
                기본 시간 설정
              </h3>

              {/* 1. 집중 시간 */}
              <div className='space-y-2'>
                <div className='flex items-center'>
                  <Label htmlFor='focusMin'>집중 시간 (분)</Label>
                  <OwnerIndicator
                    fieldKey='focusMin'
                    fieldOwners={fieldOwners}
                  />
                </div>
                <Input
                  id='focusMin'
                  type='number'
                  {...register('focusMin', {
                    required: true,
                    min: 1,
                    max: 120,
                  })}
                  className={cn(
                    fieldOwners['focusMin'] && 'outline-2 outline-offset-1',
                  )}
                  style={{ outlineColor: fieldOwners['focusMin']?.color }}
                  disabled={
                    !canEdit ||
                    (!!fieldOwners['focusMin'] &&
                      fieldOwners['focusMin'].userId !== userId)
                  }
                  onFocus={() => handleFocus('focusMin', userId, nickname)}
                  onBlur={handleBlur}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setValue('focusMin', val);
                    updateField('focusMin', val);
                  }}
                />
              </div>

              {/* 2. 휴식 시간 */}
              <div className='space-y-2'>
                <div className='flex items-center'>
                  <Label htmlFor='breakMin'>휴식 시간 (분)</Label>
                  <OwnerIndicator
                    fieldKey='breakMin'
                    fieldOwners={fieldOwners}
                  />
                </div>
                <Input
                  id='breakMin'
                  type='number'
                  {...register('breakMin', { required: true, min: 1 })}
                  className={cn(
                    fieldOwners['breakMin'] &&
                      'outline outline-2 outline-offset-1',
                  )}
                  style={{ outlineColor: fieldOwners['breakMin']?.color }}
                  disabled={
                    !canEdit ||
                    (!!fieldOwners['breakMin'] &&
                      fieldOwners['breakMin'].userId !== userId)
                  }
                  onFocus={() => handleFocus('breakMin', userId, nickname)}
                  onBlur={handleBlur}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setValue('breakMin', val);
                    updateField('breakMin', val);
                  }}
                />
              </div>

              {/* 3. 반복 횟수 (누락 복구됨!) */}
              <div className='space-y-2'>
                <div className='flex items-center'>
                  <Label htmlFor='rounds'>반복 횟수 (회)</Label>
                  <OwnerIndicator fieldKey='rounds' fieldOwners={fieldOwners} />
                </div>
                <Input
                  id='rounds'
                  type='number'
                  {...register('rounds', { required: true, min: 1 })}
                  className={cn(
                    fieldOwners['rounds'] &&
                      'outline outline-2 outline-offset-1',
                  )}
                  style={{ outlineColor: fieldOwners['rounds']?.color }}
                  disabled={
                    !canEdit ||
                    (!!fieldOwners['rounds'] &&
                      fieldOwners['rounds'].userId !== userId)
                  }
                  onFocus={() => handleFocus('rounds', userId, nickname)}
                  onBlur={handleBlur}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setValue('rounds', val);
                    updateField('rounds', val);
                  }}
                />
              </div>
            </div>

            <Separator />

            {/* 벌칙 강도 섹션 */}
            <div className='space-y-4'>
              <div className='flex justify-between items-center'>
                <h3 className='text-sm font-medium text-muted-foreground uppercase tracking-wider'>
                  벌칙 강도
                </h3>
                {canEdit && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={addTier}
                  >
                    <Plus className='w-4 h-4 mr-1' /> 단계 추가
                  </Button>
                )}
              </div>

              <div className='space-y-3'>
                {tiers.map((tier, i) => (
                  <div
                    key={tier.tier}
                    className='flex items-center gap-3 bg-muted/30 p-2 rounded-md'
                  >
                    <span className='text-sm font-mono'>{tier.minPct}% ~</span>
                    <Input
                      className='w-20'
                      type='number'
                      value={tier.maxPct ?? ''}
                      disabled={!canEdit || i === tiers.length - 1}
                      onChange={(e) => {
                        const newMaxPct = Number(e.target.value);
                        updateTier(i, { maxPct: newMaxPct });
                        if (i + 1 < tiers.length) {
                          updateTier(i + 1, { minPct: newMaxPct });
                        }
                      }}
                    />
                    <span className='text-sm'>이탈 시 벌칙</span>
                    <Input
                      className='w-16'
                      type='number'
                      value={tier.count}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateTier(i, { count: Number(e.target.value) })
                      }
                    />
                    <span className='text-sm'>개</span>
                    {canEdit && tiers.length > 1 && (
                      <Button
                        variant='ghost'
                        size='icon'
                        className='text-destructive'
                        onClick={() => removeTier(i)}
                      >
                        <Trash2 className='w-4 h-4' />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 벌칙 목록 섹션 */}
            <div className='space-y-4'>
              <div className='flex justify-between items-center'>
                <h3 className='text-sm font-medium text-muted-foreground uppercase tracking-wider'>
                  벌칙 목록
                </h3>
                {canEdit && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => addPenalty('')}
                  >
                    <Plus className='w-4 h-4 mr-1' /> 벌칙 추가
                  </Button>
                )}
              </div>
              <div className='grid gap-4'>
                {penalties.map((p, i) => {
                  const penaltyKey = `penalty_${p.id}`; // 고유 필드 키 생성

                  return (
                    <div key={p.id} className='space-y-2'>
                      {/* 벌칙별 편집 상태 인디케이터 추가 */}
                      <OwnerIndicator
                        fieldKey={penaltyKey}
                        fieldOwners={fieldOwners}
                      />
                      <div className='flex gap-2 items-center'>
                        <Input
                          value={p.content}
                          className={cn(
                            fieldOwners[penaltyKey] &&
                              'outline outline-2 outline-offset-1',
                          )}
                          style={{
                            outlineColor: fieldOwners[penaltyKey]?.color,
                          }}
                          // 여기서 본인이 아닌 다른 사람이 편집 중일 때 입력을 막음
                          disabled={
                            !canEdit ||
                            (!!fieldOwners[penaltyKey] &&
                              fieldOwners[penaltyKey].userId !== userId)
                          }
                          placeholder='예: 팔굽혀펴기 10회'
                          onFocus={() =>
                            handleFocus(penaltyKey, userId, nickname)
                          }
                          onBlur={handleBlur}
                          onChange={(e) => updatePenalty(i, e.target.value)}
                        />
                        {canEdit && (
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => removePenalty(i)}
                          >
                            <Trash2 className='w-4 h-4 text-destructive' />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 에러 메시지 */}
            {arrayError && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{arrayError}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter>
            <Button type='submit' className='w-full text-lg font-bold py-6'>
              계약서에 서명하기
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ContractForm;
