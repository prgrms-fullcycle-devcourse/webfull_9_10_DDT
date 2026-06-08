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
      <AlertDialogContent className='bg-[#1F2937]! flex flex-col gap-2 py-4'>
        <AlertDialogHeader className='mt-4'>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
        </AlertDialogHeader>
        {options.description && (
          <AlertDialogDescription className='text-xs'>
            {options.description}
          </AlertDialogDescription>
        )}
        <div className='w-full flex gap-3 mt-4'>
          <AlertDialogCancel onClick={onCancel} className='flex-1 py-6'>
            {options.cancelText ?? '취소'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              options.variant === 'destructive' &&
                'bg-destructive! text-destructive-foreground! hover:bg-destructive/90',
              'flex-1 py-6',
            )}
          >
            {options.confirmText ?? '확인'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
