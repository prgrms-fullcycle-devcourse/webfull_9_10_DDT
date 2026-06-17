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

/**
 * 계약서(각서) 저장/불러오기 버튼 + 다이얼로그를 관리하는 컴포넌트.
 * 로그인 유저만 표시되며, 게스트는 렌더링하지 않습니다.
 * 불러오기 버튼은 편집 권한(canEdit)이 있을 때만 표시됩니다.
 *
 * @param fields - 현재 Yjs 타이머 설정값 (focusMin, breakMin, rounds)
 * @param tiers - 현재 Yjs 벌칙 등급 배열
 * @param penalties - 현재 Yjs 벌칙 목록 배열
 * @param applyAll - 불러온 템플릿 데이터를 Yjs에 일괄 적용하는 함수
 */
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

  /**
   * 각서 저장 핸들러.
   * 동일 제목의 템플릿이 캐시에 있으면 덮어쓰기(update), 없으면 신규 생성(save).
   * 성공 시 saved-rules 쿼리 캐시를 무효화하여 목록을 갱신합니다.
   *
   * @param title - 저장할 각서 제목
   * @throws 저장 실패 시 toast.error 표시 후 Error throw (다이얼로그 닫힘 방지)
   */
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
      toast.success(`"${title}" 저장 성공`);
    } catch {
      toast.error('저장 실패');
      throw new Error();
    }
  };

  /**
   * 각서 불러오기 핸들러.
   * LoadContractDialog에서 선택한 템플릿 데이터를 Yjs에 일괄 적용합니다.
   *
   * @param data - 적용할 템플릿 데이터 (fields, tiers, penalties)
   */
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
