'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
import { CloseButton } from '@/components/layout/CloseButton';
import { RouletteWheel } from './RouletteWheel';
import { RouletteHistory } from './RouletteHistory';
import { RouletteTimer } from './RouletteTimer';
import { useRouletteLogic } from './useRouletteLogic';
import { SpotlightOverlay } from './SpotlightOverlay';
import { ExitRouletteDialog } from './ExitRouletteDialog';

/**
 * 벌칙 룰렛 화면. 타이머·휠·확정 내역·나가기 다이얼로그·확정 스포트라이트를 조합한 컨테이너.
 * 모든 상태/동작은 useRouletteLogic이 제공하며, URL의 `from=giveup`이면 중도 포기자 전용 룰렛으로 동작한다.
 */
export function Roulette() {
  useBlockBrowserBack();

  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const isGiveUpRoulette = searchParams.get('from') === 'giveup';

  const { data, state, actions, selectedPenaltyRef } = useRouletteLogic(
    params.code,
    isGiveUpRoulette,
  );

  return (
    <MobileLayout
      header={
        <div className='flex w-full items-center justify-between text-foreground'>
          <span className='mx-auto text-lg font-medium'>벌칙 룰렛</span>
          <CloseButton
            onClick={() =>
              state.isCompleted
                ? actions.moveToFinishTarget()
                : actions.setIsDialogOpen(true)
            }
            aria-label='룰렛 나가기'
          />
        </div>
      }
      bottomButton={
        <div className='flex w-full flex-row gap-2'>
          {state.skipVisibleNow && (
            <Button
              variant='secondary'
              size='main'
              className='flex-2 whitespace-nowrap rounded-[14px] px-2 font-bold'
              onClick={actions.handleSkip}
              disabled={!state.canSkipNow}
            >
              {data.skipMutation.isPending ? '처리 중...' : '결과 바로보기'}
            </Button>
          )}
          <Button
            variant='default'
            size='main'
            className='flex-3 rounded-[14px] font-bold'
            onClick={() => actions.handleStartSpinning()}
            disabled={
              state.isSpinning ||
              ((state.cannotStart || state.isAutoDraw) && !state.isDrawDone)
            }
          >
            {state.buttonLabel}
          </Button>
        </div>
      }
    >
      <div className='flex min-w-0 flex-col gap-4 pb-6 text-foreground'>
        <RouletteTimer
          serverTime={
            isGiveUpRoulette
              ? data.giveUpResult?.serverTime
              : data.result?.serverTime
          }
          rouletteEndsAt={
            isGiveUpRoulette
              ? data.giveUpResult?.rouletteEndsAt
              : data.result?.rouletteEndsAt
          }
          dataUpdatedAt={
            isGiveUpRoulette ? data.giveUpDataUpdatedAt : data.dataUpdatedAt
          }
          isDrawDone={state.isDrawDone}
          isAutoDraw={state.isAutoDraw}
          onExpiredChange={actions.setIsTimerExpired}
        />
        <RouletteWheel
          isSpinning={state.isSpinning}
          targetIndex={state.targetIndex}
          rouletteLabels={data.rouletteLabels}
          onStopSpinning={actions.handleStopSpinning}
          isAutoDraw={state.isAutoDraw}
          isDrawDone={state.isDrawDone}
          errors={state.errors}
        />
        <RouletteHistory
          ref={selectedPenaltyRef}
          history={state.history}
        />
      </div>

      <ExitRouletteDialog
        isOpen={state.isDialogOpen}
        onOpenChange={actions.setIsDialogOpen}
        onExit={actions.handleExit}
        isPending={data.exitMutation.isPending}
      />

      {state.spotlightLabel && (
        <SpotlightOverlay label={state.spotlightLabel} />
      )}
    </MobileLayout>
  );
}
