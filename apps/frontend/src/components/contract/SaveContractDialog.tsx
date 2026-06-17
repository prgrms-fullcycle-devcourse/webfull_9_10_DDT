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

interface SaveContractDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}

interface SavedRuleMeta {
  ruleId: string;
  title: string;
}

export function SaveContractDialog({
  open,
  onClose,
  onSave,
}: SaveContractDialogProps) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle('');
      onClose();
    }
  };

  const { data: list } = useQuery({
    queryKey: ['saved-rules'],
    queryFn: async () => {
      const res = await getRuleApi().ruleControllerGetSavedRules();
      return res.data as unknown as SavedRuleMeta[];
    },
    enabled: open,
  });

  const trimmedTitle = title.trim();
  const willOverwrite =
    trimmedTitle && list?.some((r) => r.title === trimmedTitle);

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
          className='bg-background! h-12 w-full border border-white/20 rounded-sm!'
        />
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
