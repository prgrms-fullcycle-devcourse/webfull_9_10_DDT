'use client';

import { getRuleApi } from '@/api/generated/rule-api-계약서-관리/rule-api-계약서-관리';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

interface SaveContractDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}

interface SavedRuleMeta {
  ruleId: string;
  title: string;
}

// 각서 제목 최대 글자 수 (백엔드 DTO @MaxLength와 동일하게 유지)
const TITLE_MAX_LENGTH = 30;

/**
 * 각서 저장 다이얼로그.
 * 제목을 입력하면 신규 저장, 동일 제목이 있으면 덮어쓰기 안내를 표시합니다.
 * 저장 로직 자체는 부모(ContractActions)의 onSave에 위임합니다.
 *
 * @param open - 다이얼로그 열림 상태
 * @param onClose - 닫기 콜백
 * @param onSave - 제목을 받아 저장을 수행하는 비동기 콜백. 실패 시 throw하면 다이얼로그가 닫히지 않음
 */
export function SaveContractDialog({
  open,
  onClose,
  onSave,
}: SaveContractDialogProps) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /**
   * 다이얼로그 닫힘 시 제목 입력을 초기화합니다.
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle('');
      onClose();
    }
  };

  // 입력한 제목과 동일한 기존 각서가 있으면 덮어쓰기 모드로 전환
  const { data: list } = useQuery({
    queryKey: queryKeys.rules.saved(),
    queryFn: async () => {
      const res = await getRuleApi().ruleControllerGetSavedRules();
      return res.data as unknown as SavedRuleMeta[];
    },
    enabled: open,
  });

  const trimmedTitle = title.trim();
  const willOverwrite =
    trimmedTitle && list?.some((r) => r.title === trimmedTitle);

  /**
   * 저장 핸들러.
   * onSave 성공 시 다이얼로그를 닫고, 실패 시(throw) 다이얼로그를 유지합니다.
   */
  const handleSave = async () => {
    if (!trimmedTitle) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(trimmedTitle);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='flex flex-col gap-4'>
        <DialogHeader>
          <DialogTitle>각서 저장</DialogTitle>
        </DialogHeader>

        <Input
          placeholder='각서의 제목을 입력해주세요.'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX_LENGTH}
          className='bg-background! h-12 w-full border border-white/20 rounded-sm!'
        />
        <div className='flex items-center justify-between gap-2'>
          <DialogDescription
            className={cn(
              'text-xs',
              title.length > 0 && !willOverwrite && 'text-primary',
            )}
          >
            {willOverwrite
              ? '같은 제목의 각서가 있어요. 덮어쓰시겠어요?'
              : '제목을 입력하고 저장하면 새 각서로 저장돼요.'}
          </DialogDescription>
          <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
            {String(title.length).padStart(2)}/{TITLE_MAX_LENGTH}
          </span>
        </div>

        <DialogFooter className='w-full flex'>
          <Button
            type='button'
            variant='secondary'
            onClick={onClose}
            disabled={isSaving}
            className='flex-1 h-12 rounded-lg'
          >
            취소
          </Button>
          <Button
            type='button'
            onClick={handleSave}
            disabled={isSaving || !trimmedTitle}
            className='flex-1 h-12 rounded-lg font-bold'
          >
            {isSaving ? '저장 중...' : willOverwrite ? '덮어쓰기' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
