'use client';

import { getRuleApi } from '@/api/generated/rule-api-계약서-관리/rule-api-계약서-관리';
import { SavedRule, toBackendFormat } from '@/lib/contractTransform';
import { useRoomStore } from '@/store/useRoomStore';
import { ApplyData, UseContractYjsReturn } from '@/types/yjs';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { SaveContractDialog } from './SaveContractDialog';
import { LoadContractDialog } from './LoadContractDialog';
import { useAuth } from '@/hooks/useAuth';

interface ContractActionsProps {
  fields: UseContractYjsReturn['fields'];
  tiers: UseContractYjsReturn['tiers'];
  penalties: UseContractYjsReturn['penalties'];
  applyAll: UseContractYjsReturn['applyAll'];
}

export function ContractActions({
  fields,
  tiers,
  penalties,
  applyAll,
}: ContractActionsProps) {
  const queryClient = useQueryClient();
  const me = useAuth().me;

  const myMember = useRoomStore((state) =>
    me ? state.members[me.id] : undefined,
  );
  const canEdit = myMember?.canEdit ?? false;
  const isGuest = me?.role === 'guest';

  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  const handleSave = async (title: string) => {
    const payload = toBackendFormat(fields, tiers, penalties);

    try {
      const cached = queryClient.getQueryData<SavedRule[]>(['saved-rules']);
      const existing = cached?.find((r) => r.title === title);

      if (existing) {
        await getRuleApi().ruleControllerUpdateRuleTemplate(existing.ruleId, {
          title,
          ...payload,
        });
      } else {
        await getRuleApi().ruleControllerSaveRuleTemplate({
          title,
          ...payload,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['saved-rules'] });
      toast.success(`"${title}" 저장됨`);
    } catch {
      toast.error('저장 실패');
      throw new Error();
    }
  };

  const handleLoad = (data: ApplyData) => {
    applyAll(data);
  };

  if (!me || isGuest) return null;

  return (
    <div className='flex gap-1'>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        onClick={() => setSaveOpen(true)}
        className='border border-white/20 px-3 py-3 rounded-sm!'
      >
        저장
      </Button>

      {canEdit && (
        <Button
          type='button'
          size='sm'
          variant='ghost'
          onClick={() => setLoadOpen(true)}
          className='border border-white/20 px-3 py-3 rounded-sm!'
        >
          불러오기
        </Button>
      )}

      <SaveContractDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSave={handleSave}
      />

      <LoadContractDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        onLoad={handleLoad}
      />
    </div>
  );
}
