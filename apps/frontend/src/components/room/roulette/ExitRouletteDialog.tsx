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

/**
 * 아직 뽑을 벌칙이 남았는데 나가려 할 때, 자동 결정 안내와 함께 확인을 받는 다이얼로그.
 *
 * @param isOpen - 다이얼로그 열림 여부
 * @param onOpenChange - 열림 상태 변경 핸들러
 * @param onExit - 나가기 확정 핸들러 (남은 벌칙 자동 결정)
 * @param isPending - 나가기 처리 진행 중 여부
 */
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
