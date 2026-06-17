'use client';

import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  options: {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * useConfirm 훅과 짝을 이루는 확인 다이얼로그 UI. (보통 `{...confirmProps}`로 펼쳐 사용)
 * options가 null이면 렌더하지 않으며, variant='destructive'면 버튼 순서를 뒤집고 강조색을 입힌다.
 *
 * @param open - 다이얼로그 열림 여부
 * @param options - 표시할 내용(title·description·버튼 텍스트·variant), null이면 미표시
 * @param onConfirm - 확인 버튼 클릭 핸들러
 * @param onCancel - 취소 버튼 클릭 핸들러
 * @param onOpenChange - 열림 상태 변경(바깥클릭·ESC 등) 핸들러
 */
export function ConfirmDialog({
  open,
  options,
  onConfirm,
  onCancel,
  onOpenChange,
}: ConfirmDialogProps) {
  if (!options) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='bg-card border border-border ring-0 flex flex-col gap-2 py-4'>
        <AlertDialogHeader className='mt-4 place-items-start text-left'>
          <AlertDialogTitle className='whitespace-pre-line'>
            {options.title}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription
          className={cn(!options.description && 'sr-only', 'text-xs')}
        >
          {options.description ??
            '선택한 작업을 진행하거나 취소할 수 있는 확인 창입니다.'}
        </AlertDialogDescription>
        <div
          className={cn(
            'w-full flex gap-3 mt-4',
            options.variant === 'destructive' && 'flex-row-reverse',
          )}
        >
          <AlertDialogCancel
            variant='secondary'
            onClick={onCancel}
            className='flex-1 h-12 rounded-lg'
          >
            {options.cancelText ?? '취소'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              options.variant === 'destructive' &&
                'bg-destructive! text-destructive-foreground! hover:bg-destructive/90',
              'flex-1 h-12 rounded-lg font-bold',
            )}
          >
            {options.confirmText ?? '확인'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
