"use client";

import React, { useMemo } from 'react';
import { Wheel } from 'react-custom-roulette';

interface RouletteData {
  option: string;
  style?: { backgroundColor?: string; textColor?: string };
}

interface PenaltyRouletteProps {
  mustStartSpinning: boolean;
  targetIndex: number;
  onStopSpinning: () => void;
  items?: string[];
}

const getCssVariable = (name: string) => {
  if (typeof window === 'undefined') return '';

  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
};

export const PenaltyRoulette = React.memo(function PenaltyRoulette({
  mustStartSpinning,
  targetIndex,
  onStopSpinning,
  items = [],
}: PenaltyRouletteProps) {
  const displayItems = useMemo(
    () => (items.length > 0 ? items : ['준비중']),
    [items],
  );
  const safeTargetIndex =
    targetIndex >= 0 && targetIndex < displayItems.length ? targetIndex : 0;

  const rouletteTheme = useMemo(
    () => ({
      even: getCssVariable('--roulette-wheel-even'),
      odd: getCssVariable('--roulette-wheel-odd'),
      center: getCssVariable('--roulette-wheel-center'),
      border: getCssVariable('--roulette-panel-border'),
      foreground: getCssVariable('--foreground'),
      font: getCssVariable('--font-noto-sans-kr'),
    }),
    [],
  );

  const rouletteData: RouletteData[] = useMemo(
    () =>
      displayItems.map((item, index) => ({
        option: item,
        style: {
          backgroundColor: index % 2 === 0 ? rouletteTheme.even : rouletteTheme.odd,
          textColor: rouletteTheme.foreground,
        },
      })),
    [displayItems, rouletteTheme],
  );

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-full contain-layout [&>div:first-child]:!h-full [&>div:first-child]:!max-h-full [&>div:first-child]:!max-w-full [&>div:first-child]:!overflow-hidden [&>div:first-child]:!w-full [&_canvas]:!h-full [&_canvas]:!w-full">
      <Wheel
        mustStartSpinning={mustStartSpinning}
        prizeNumber={safeTargetIndex}
        data={rouletteData}
        onStopSpinning={onStopSpinning}
        spinDuration={0.8}
        outerBorderColor={rouletteTheme.border}
        outerBorderWidth={4}
        innerRadius={20}
        innerBorderColor={rouletteTheme.border}
        innerBorderWidth={2}
        radiusLineColor={rouletteTheme.border}
        radiusLineWidth={1}
        fontSize={18}
        textDistance={60}
        fontFamily={rouletteTheme.font}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--roulette-panel-border)] bg-[var(--roulette-wheel-center)] text-[10px] font-bold text-foreground shadow-md">
        DDT
      </div>
    </div>
  );
});

export default PenaltyRoulette;
