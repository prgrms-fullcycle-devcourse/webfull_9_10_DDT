'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ForfeitDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onForfeit: () => void;
  isPending: boolean;
}

/**
 * "탈옥하기"(중도 포기) 버튼과 확인 다이얼로그. 확인 시 남은 시간이 전부 이탈로 처리됨을 안내한다.
 *
 * @param isOpen - 다이얼로그 열림 여부
 * @param onOpenChange - 열림 상태 변경 핸들러
 * @param onForfeit - 탈옥 확정 핸들러
 * @param isPending - 탈옥 처리 진행 중 여부 (버튼 비활성/문구 전환)
 */
export function ForfeitDialog({
  isOpen,
  onOpenChange,
  onForfeit,
  isPending,
}: ForfeitDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type='button'
          className='w-full h-12 rounded-[14px] text-base font-bold bg-transparent border border-border text-muted-foreground hover:bg-muted/30 transition-colors'
        >
          탈옥하기
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>탈옥하시겠어요?</DialogTitle>
          <DialogDescription>
            탈옥하면 남은 시간이
            <br />
            모두 이탈 시간으로 처리돼요.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type='button'
            onClick={onForfeit}
            disabled={isPending}
            className='flex-1 h-12 rounded-lg bg-destructive hover:bg-destructive/80 text-white font-bold border-none'
          >
            {isPending ? '탈옥 하는 중...' : '탈옥하기'}
          </Button>
          <Button
            type='button'
            variant='secondary'
            onClick={() => onOpenChange(false)}
            className='flex-1 h-12 rounded-lg'
          >
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
