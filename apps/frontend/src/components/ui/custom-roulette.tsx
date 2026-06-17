'use client';

import Image from 'next/image';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Wheel } from 'react-custom-roulette';

// SSR(서버 렌더)에서 useLayoutEffect 경고를 피하기 위한 동형(isomorphic) 처리
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface RouletteData {
  option: string;
  style?: { backgroundColor?: string; textColor?: string };
}

interface PenaltyRouletteProps {
  mustStartSpinning: boolean;
  targetIndex: number;
  onStopSpinning: () => void;
  items?: string[];
  spinDuration?: number;
  isDrawDone?: boolean;
}

const LABEL_MAX_LENGTH_TIERS = [
  { minCount: 49, maxLen: 1 },
  { minCount: 48, maxLen: 2 },
  { minCount: 36, maxLen: 4 },
  { minCount: 24, maxLen: 6 },
  { minCount: 0, maxLen: 8 },
] as const;

const DEFAULT_LABEL_MAX_LENGTH = 8;

/**
 * 휠 칸 수(count)에 맞춰 칸 라벨의 최대 글자 수를 정한다. 칸이 많을수록 짧게 잘라 겹침을 막는다.
 *
 * @param count - 휠 칸(벌칙) 개수
 * @returns 라벨 최대 글자 수
 */
const getLabelMaxLength = (count: number) =>
  LABEL_MAX_LENGTH_TIERS.find((tier) => count >= tier.minCount)?.maxLen ??
  DEFAULT_LABEL_MAX_LENGTH;

const getCssVariable = (name: string) => {
  if (typeof window === 'undefined') return '';

  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
};

// ── 동적 프리뷰 ──────────────────────────────────────────────
const START_SPINNING_TIME = 2600;
const CONTINUE_SPINNING_TIME = 750;
const STOP_SPINNING_TIME = 8000;
const PREVIEW_FULL_LOOPS = 4;

/**
 * CSS cubic-bezier(x1,y1,x2,y2)와 동일한 이징 함수를 만든다.
 * 프리뷰 텍스트 룰렛이 실제 휠과 같은 가속/감속 곡선으로 인덱스를 진행하도록 쓴다.
 * 뉴턴법으로 x→t를 풀고, 실패 시 이분탐색으로 보정한다.
 *
 * @returns 진행률 x(0~1)를 받아 이징된 y(0~1)를 반환하는 함수
 */
const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solveT = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xErr = sampleX(t) - x;
      if (Math.abs(xErr) < 1e-4) return t;
      const dx = sampleDX(t);
      if (Math.abs(dx) < 1e-6) break;
      t -= xErr / dx;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const xVal = sampleX(t);
      if (Math.abs(xVal - x) < 1e-4) break;
      if (xVal < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveT(x));
  };
};

const EASE_START = cubicBezier(0.71, -0.29, 0.96, 0.9);
const EASE_STOP = cubicBezier(0, 0, 0.35, 1.02);

interface RoulettePreviewProps {
  items: string[];
  isSpinning: boolean;
  targetIndex: number;
  spinDuration: number;
  isDrawDone: boolean;
}

/**
 * 휠 위쪽의 텍스트 프리뷰 바. 실제 휠과 동일한 이징으로 벌칙명을 빠르게 넘기다가
 * 멈출 때 당첨 항목으로 고정한다. (휠 라벨이 작아 잘 안 보이는 것을 보완)
 * requestAnimationFrame으로 가속→등속→감속착지 3구간을 직접 시뮬레이션한다.
 *
 * @param items - 벌칙 후보 목록
 * @param isSpinning - 스핀 진행 여부
 * @param targetIndex - 최종 당첨 인덱스
 * @param spinDuration - 스핀 속도 배율
 * @param isDrawDone - 뽑기 완료 여부 (대기 문구 분기)
 */
const RoulettePreview = React.memo(function RoulettePreview({
  items,
  isSpinning,
  targetIndex,
  spinDuration,
  isDrawDone,
}: RoulettePreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const activeIndexRef = useRef(0);
  const pendingTargetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // 매 프레임 effect 재실행 없이 직전 위치를 읽기 위한 ref 동기화
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!isSpinning || items.length === 0 || targetIndex < 0) return;

    setHasSpun(true);
    const count = items.length;
    const startIndex = activeIndexRef.current % count;
    const target = targetIndex % count;
    pendingTargetRef.current = target;
    const offset = (target - startIndex + count) % count;
    const d = Math.max(0.01, spinDuration);
    const t1 = START_SPINNING_TIME * d;
    const t2 = CONTINUE_SPINNING_TIME * d;
    const t3 = STOP_SPINNING_TIME * d;
    const total = t1 + t2 + t3;
    const phase3Ticks = PREVIEW_FULL_LOOPS * count + offset;

    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      let ticks: number;
      if (elapsed < t1) {
        // 가속: 0 → 1바퀴
        ticks = EASE_START(elapsed / t1) * count;
      } else if (elapsed < t1 + t2) {
        // 등속: 1 → 2바퀴
        ticks = count + ((elapsed - t1) / t2) * count;
      } else if (elapsed < total) {
        // 감속 착지: 2바퀴 → 최종(목표 안착)
        ticks = 2 * count + EASE_STOP((elapsed - t1 - t2) / t3) * phase3Ticks;
      } else {
        ticks = 2 * count + phase3Ticks; // 정확한 최종값
      }
      const nextIndex =
        (((startIndex + Math.round(ticks)) % count) + count) % count;
      setActiveIndex(nextIndex);
      if (elapsed < total) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isSpinning, items.length, targetIndex, spinDuration]);

  // 스핀 종료 시 마지막 당첨 인덱스로 확정(고정) — raf 타이밍 오차 보정
  useEffect(() => {
    if (!isSpinning && hasSpun) {
      setActiveIndex(pendingTargetRef.current);
    }
  }, [isSpinning, hasSpun]);

  const hasItems = items.length > 0;
  // 스핀 시작 이후 고정 노출할 마지막 당첨 벌칙명
  const pinnedLabel = hasItems ? (items[activeIndex] ?? items[0]) : '';

  return (
    <div className='mb-5 flex h-10 w-full min-w-0 items-center overflow-hidden rounded-[14px] bg-[var(--roulette-panel)] px-3'>
      {!hasSpun ? (
        <p className='w-full text-center text-xs text-muted-foreground'>
          {isDrawDone ? '벌칙 결정 완료' : '뽑기 대기 중…'}
        </p>
      ) : (
        <p className='w-full truncate text-center text-base font-bold text-foreground'>
          {pinnedLabel}
        </p>
      )}
    </div>
  );
});

// ── 장식용 점 링 ─────────────────────────────────────────────
const DOT_RING_RADIUS = 45;
const LIB_INITIAL_OFFSET_DEG = 43;
const WHEEL_WRAPPER_DEG = -43;

interface RimDotsProps {
  count: number;
  isSpinning: boolean;
  wheelWrapperRef: React.RefObject<HTMLDivElement | null>;
}

// 회전 휠 엘리먼트(=캔버스의 부모)의 현재 회전각(deg, -180~180)을 transform 행렬에서 추출
const readWheelAngle = (wrapper: HTMLDivElement | null): number | null => {
  const wheelEl = wrapper?.querySelector('canvas')?.parentElement;
  if (!wheelEl) return null;

  const transform = getComputedStyle(wheelEl).transform;
  if (!transform || transform === 'none') return null;

  const matched = transform.match(/matrix\(([^)]+)\)/);
  if (!matched) return null;

  const [a, b] = matched[1].split(',').map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  return (Math.atan2(b, a) * 180) / Math.PI;
};

/**
 * 휠 테두리를 따라 도는 장식용 점 링. 실제 휠 캔버스의 회전각을 transform 행렬에서 읽어
 * 같은 각도로 함께 돌고, 정지 시에는 칸 경계에 정확히 스냅한다.
 *
 * @param count - 칸(벌칙) 개수 (= 점 개수)
 * @param isSpinning - 스핀 진행 여부
 * @param wheelWrapperRef - 회전 휠을 담은 래퍼 ref (각도 측정 대상)
 */
const RimDots = React.memo(function RimDots({
  count,
  isSpinning,
  wheelWrapperRef,
}: RimDotsProps) {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(0);
  const prevRawRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const applyWheelDelta = useCallback(() => {
    const raw = readWheelAngle(wheelWrapperRef.current);
    if (raw === null) return;

    // 첫 측정값은 기준점으로만 사용(변위 0)
    if (prevRawRef.current === null) {
      prevRawRef.current = raw;
      return;
    }

    // (-180,180] 경계를 넘는 순간을 연속 회전으로 언랩
    let delta = raw - prevRawRef.current;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;

    prevRawRef.current = raw;
    rotationRef.current += delta;

    if (ringRef.current) {
      ringRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
    }
  }, [wheelWrapperRef]);

  // 정지 시: 휠이 실제 멈춘 자리의 칸 경계에 점을 정확히 스냅.
  const snapToBoundary = useCallback(() => {
    const theta = readWheelAngle(wheelWrapperRef.current);
    if (theta === null) return;

    const n = Math.max(2, count);
    const seg = 360 / n;
    const target = theta + LIB_INITIAL_OFFSET_DEG + 180 / n;
    let diff = (((target - rotationRef.current) % seg) + seg) % seg;
    if (diff > seg / 2) diff -= seg;

    rotationRef.current += diff;
    if (ringRef.current) {
      ringRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
    }
  }, [count, wheelWrapperRef]);

  useEffect(() => {
    if (!isSpinning) {
      let frames = 0;
      let prevAngle: number | null = null;
      const settle = () => {
        const cur = readWheelAngle(wheelWrapperRef.current);
        if (
          cur !== null &&
          prevAngle !== null &&
          Math.abs(cur - prevAngle) < 0.05
        ) {
          snapToBoundary();
          return;
        }
        prevAngle = cur;
        if (frames++ < 20) {
          rafRef.current = requestAnimationFrame(settle);
        } else {
          snapToBoundary(); // 안전장치: 끝내 안정 신호가 없으면 마지막 값으로 스냅
        }
      };
      rafRef.current = requestAnimationFrame(settle);

      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    // 스핀 시작: 기준 각도 재설정 후 매 프레임 휠을 추적
    prevRawRef.current = readWheelAngle(wheelWrapperRef.current);

    const tick = () => {
      applyWheelDelta();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isSpinning, applyWheelDelta, snapToBoundary, wheelWrapperRef]);

  const dots = useMemo(() => {
    const n = Math.max(2, count);
    const seg = (2 * Math.PI) / n;
    const baseRad =
      ((WHEEL_WRAPPER_DEG - LIB_INITIAL_OFFSET_DEG) * Math.PI) / 180 -
      Math.PI / n;
    return Array.from({ length: n }, (_, i) => {
      const angle = i * seg + baseRad;
      return {
        left: 50 + DOT_RING_RADIUS * Math.cos(angle),
        top: 50 + DOT_RING_RADIUS * Math.sin(angle),
      };
    });
  }, [count]);

  return (
    <div ref={ringRef} className='pointer-events-none absolute inset-0 z-10'>
      {dots.map((dot, index) => (
        <span
          key={index}
          className='absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_4px_rgba(0,0,0,0.4)]'
          style={{ left: `${dot.left}%`, top: `${dot.top}%` }}
        />
      ))}
    </div>
  );
});

/**
 * 벌칙 룰렛 휠. react-custom-roulette 위에 텍스트 프리뷰·장식 점 링·중앙 아이콘·정지 위치 고정을 얹은 컴포넌트.
 * 라벨은 칸 수에 맞춰 잘라 표시하고, 색상은 CSS 변수 테마에서 가져온다.
 * 스핀이 멈춘 직후 마지막 회전 위치를 캡처해 다시 그려질 때 튀지 않도록 고정한다.
 *
 * @param mustStartSpinning - true가 되면 스핀 시작
 * @param targetIndex - 최종 당첨 칸 인덱스
 * @param onStopSpinning - 스핀 정지 시 콜백
 * @param items - 벌칙 후보 목록 (비면 '준비중' 한 칸)
 * @param spinDuration - 스핀 속도 배율 (기본 0.3)
 * @param isDrawDone - 뽑기 완료 여부 (프리뷰 대기 문구 분기)
 */
export const PenaltyRoulette = React.memo(function PenaltyRoulette({
  mustStartSpinning,
  targetIndex,
  onStopSpinning,
  items = [],
  spinDuration = 0.3,
  isDrawDone = false,
}: PenaltyRouletteProps) {
  const wheelWrapperRef = useRef<HTMLDivElement>(null);

  const lastSpinTransformRef = useRef<string | null>(null);
  const getRotationContainer = useCallback(
    () =>
      (wheelWrapperRef.current?.querySelector('canvas')?.parentElement ??
        null) as HTMLElement | null,
    [],
  );

  useEffect(() => {
    if (!mustStartSpinning) return;

    let rafId = requestAnimationFrame(function capture() {
      const rc = getRotationContainer();
      const t = rc && getComputedStyle(rc).transform;
      if (t && t !== 'none') lastSpinTransformRef.current = t;
      rafId = requestAnimationFrame(capture);
    });

    return () => cancelAnimationFrame(rafId);
  }, [mustStartSpinning, getRotationContainer]);

  // 정지 직후(화면에 그려지기 전): 스핀이 멈춘 '바로 그 위치'(마지막 캡처값)로 고정한다.
  useIsomorphicLayoutEffect(() => {
    if (mustStartSpinning) return;

    const rc = getRotationContainer();
    const pinned = lastSpinTransformRef.current;
    if (!rc || !pinned) return;

    rc.style.transform = pinned;

    return () => {
      rc.style.transform = '';
    };
  }, [mustStartSpinning, getRotationContainer]);

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
      third: getCssVariable('--roulette-wheel-third'),
      center: getCssVariable('--roulette-wheel-center'),
      border: getCssVariable('--roulette-panel-border'),
      foreground: getCssVariable('--foreground'),
      font: getCssVariable('--font-noto-sans-kr'),
    }),
    [],
  );

  const rouletteData: RouletteData[] = useMemo(() => {
    const maxLen = getLabelMaxLength(displayItems.length);
    const n = displayItems.length;
    const colors = [rouletteTheme.even, rouletteTheme.odd, rouletteTheme.third];
    return displayItems.map((item, index) => {
      const colorIndex = n % 2 === 1 && index === n - 1 ? 2 : index % 2;
      return {
        option: item.length > maxLen ? item.slice(0, maxLen - 1) + '…' : item,
        style: {
          backgroundColor: colors[colorIndex],
          textColor: rouletteTheme.foreground,
        },
      };
    });
  }, [displayItems, rouletteTheme]);

  return (
    <div className='mx-auto flex w-full max-w-[320px] flex-col items-center'>
      <RoulettePreview
        items={items}
        isSpinning={mustStartSpinning}
        targetIndex={safeTargetIndex}
        spinDuration={spinDuration}
        isDrawDone={isDrawDone}
      />
      <div className='relative aspect-square w-full'>
        <div
          className='pointer-events-none absolute left-1/2 top-[-2px] z-30 h-0 w-0 -translate-x-1/2'
          style={{
            borderLeft: '13px solid transparent',
            borderRight: '13px solid transparent',
            borderTop: '20px solid var(--roulette-pointer)',
            filter: 'drop-shadow(0 2px 2px rgba(0, 0, 0, 0.35))',
          }}
        />

        {/* 바깥 검정 림 + 그림자 */}
        <div className='absolute inset-0 rounded-full bg-[var(--roulette-wheel-center)] p-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.45)]'>
          <div
            ref={wheelWrapperRef}
            className='relative flex aspect-square w-full rotate-[-43deg] items-center justify-center overflow-hidden rounded-full contain-layout [&>div:first-child]:!h-full [&>div:first-child]:!max-h-full [&>div:first-child]:!max-w-full [&>div:first-child]:!overflow-hidden [&>div:first-child]:!w-full [&_canvas]:!h-full [&_canvas]:!w-full'
          >
            <Wheel
              mustStartSpinning={mustStartSpinning}
              prizeNumber={safeTargetIndex}
              data={rouletteData}
              onStopSpinning={onStopSpinning}
              spinDuration={spinDuration}
              outerBorderColor={rouletteTheme.border}
              outerBorderWidth={8}
              innerRadius={20}
              innerBorderColor={rouletteTheme.border}
              innerBorderWidth={2}
              radiusLineColor={rouletteTheme.border}
              radiusLineWidth={1}
              fontSize={18}
              textDistance={65}
              fontFamily={rouletteTheme.font}
              startingOptionIndex={0}
              pointerProps={{ style: { display: 'none' } }}
            />
          </div>

          {/* 장식 점 링 */}
          <RimDots
            count={displayItems.length}
            isSpinning={mustStartSpinning}
            wheelWrapperRef={wheelWrapperRef}
          />

          <div className='pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--roulette-panel-border)] bg-[var(--roulette-wheel-center)] shadow-md'>
            <Image
              src='/icons/icon-1024x1024.png'
              alt='앱 아이콘'
              width={44}
              height={44}
              className='h-full w-full rounded-full object-cover'
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default PenaltyRoulette;
