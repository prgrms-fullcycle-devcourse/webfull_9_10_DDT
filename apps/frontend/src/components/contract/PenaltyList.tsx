import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { useAuthStore } from '@/store/useAuthStore';
import { useRoomStore } from '@/store/useRoomStore';
import { UseContractYjsReturn } from '@/types/yjs';
import OwnerIndicator from './OwnerIndicator';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

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

export default function PenaltyList({ yjs }: PenaltyListProps) {
  const me = useAuthStore((state) => state.me);
  const members = useRoomStore((state) => state.members);

  if (!me) return null;
  const {
    addPenalty,
    penalties,
    updatePenalty,
    removePenalty,
    fieldOwners,
    handleFocus,
    handleBlur,
  } = yjs;

  const myMember = members[me!.id];
  const canEdit = myMember?.canEdit ?? false;
  const myNickname = myMember?.nickname ?? me.nickname;
  return (
    <Card>
      <CardHeader className='flex justify-between items-end'>
        <CardTitle>벌칙 목록</CardTitle>
        <CardDescription className='text-xs'>
          벌칙은 중복될 수 있음
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className='space-y-4'>
          <div className='flex flex-col gap-2'>
            {penalties.map((p, i) => {
              const penaltyKey = `penalty_${p.id}`; // 고유 필드 키 생성

              return (
                <div key={p.id} className='space-y-2'>
                  <OwnerIndicator
                    fieldKey={penaltyKey}
                    fieldOwners={fieldOwners}
                  />
                  <div className='flex gap-2 items-center'>
                    <div className='w-full h-fit relative'>
                      <Input
                        value={p.content}
                        className={cn(
                          fieldOwners[penaltyKey] &&
                            'outline-2 outline-offset-1',
                          'bg-background! h-12 z-0',
                        )}
                        style={{
                          outlineColor: fieldOwners[penaltyKey]?.color,
                        }}
                        // 여기서 본인이 아닌 다른 사람이 편집 중일 때 입력을 막음
                        disabled={
                          !canEdit ||
                          (!!fieldOwners[penaltyKey] &&
                            fieldOwners[penaltyKey].userId !== me.id)
                        }
                        placeholder='예: 팔굽혀펴기 10회'
                        onFocus={() =>
                          handleFocus(penaltyKey, me.id, myNickname)
                        }
                        onBlur={handleBlur}
                        onChange={(e) => updatePenalty(i, e.target.value)}
                      />
                      {canEdit && (
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => removePenalty(i)}
                          className='w-10 h-10 bg-none absolute top-1 right-1 hover:bg-none!'
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {canEdit && (
              <Button
                type='button'
                variant='ghost'
                disabled={!canEdit}
                size='lg'
                onClick={() => addPenalty('')}
                className='w-full ring-1 ring-ring'
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
