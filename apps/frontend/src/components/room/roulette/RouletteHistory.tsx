'use client';
import { forwardRef } from 'react';

interface RouletteHistoryProps {
  history: string[];
}

/**
 * 룰렛으로 확정된 벌칙 목록을 순번과 함께 보여주는 리스트. 비어 있으면 렌더하지 않는다.
 * 새 벌칙이 추가될 때 스크롤 이동을 위해 부모가 ref를 받을 수 있도록 forwardRef로 구현한다.
 *
 * @param history - 확정된 벌칙명 배열 (뽑힌 순서)
 */
export const RouletteHistory = forwardRef<HTMLDivElement, RouletteHistoryProps>(
  ({ history }, ref) => {
    if (history.length === 0) return null;

    return (
      <div ref={ref} className='flex flex-col gap-2'>
        <h3 className='mb-1 text-sm font-semibold text-muted-foreground'>
          결정된 벌칙
        </h3>
        {history.map((penalty, idx) => (
          <div
            key={`${penalty}-${idx}`}
            className='flex items-center gap-3 rounded-xl border border-[var(--roulette-history-border)] bg-[var(--roulette-history)] p-4'
          >
            <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground'>
              {idx + 1}
            </div>
            <span className='min-w-0 text-sm font-medium'>{penalty}</span>
          </div>
        ))}
      </div>
    );
  },
);
RouletteHistory.displayName = 'RouletteHistory';
