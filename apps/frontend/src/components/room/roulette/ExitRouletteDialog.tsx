import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ExitRouletteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExit: () => void;
  isPending: boolean;
}

export function ExitRouletteDialog({
  isOpen,
  onOpenChange,
  onExit,
  isPending,
}: ExitRouletteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>결정할 벌칙이 아직 남았어요.</DialogTitle>
          <DialogDescription>
            지금 나가면 벌칙이 자동으로 결정돼요.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant='secondary'
            onClick={() => onOpenChange(false)}
            className='flex-1 h-12 rounded-lg'
          >
            취소
          </Button>
          <Button
            onClick={onExit}
            disabled={isPending}
            className='flex-1 h-12 rounded-lg font-bold'
          >
            {isPending ? '처리 중...' : '나가기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
