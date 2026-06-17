"use client";

interface TimerCircleProps {
  timeLeft: number;
  totalDuration: number;
  strokeColor: string;
  subStatusText: string;
}

/**
 * 남은 시간을 원형 게이지 + mm:ss 텍스트로 보여주는 타이머 표시 컴포넌트.
 * SVG 원의 strokeDashoffset으로 진행률을 그리며, 1초 단위로 부드럽게 줄어든다.
 *
 * @param timeLeft - 남은 시간(초)
 * @param totalDuration - 현재 단계 전체 시간(초) (게이지 분모)
 * @param strokeColor - 진행 원 색상 Tailwind 클래스 (집중/휴식에 따라 다름)
 * @param subStatusText - 시간 위에 표시할 상태 문구 (예: '집중 중')
 */
export function TimerCircle({
  timeLeft,
  totalDuration,
  strokeColor,
  subStatusText,
}: TimerCircleProps) {
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const displayTime = timeLeft > 0 ? timeLeft : 0;

  // 진행률만큼 원 둘레를 채운다. strokeDashoffset이 0이면 가득 참, circumference면 비어 있음.
  const strokeDashoffset = totalDuration > 0
    ? circumference - ((totalDuration - displayTime) / totalDuration) * circumference
    : circumference;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 새 단계로 막 리셋된 순간(가득 찬 상태)에는 transition을 꺼서 게이지가 거꾸로 휙 도는 연출을 막는다.
  const isResetMoment = timeLeft === totalDuration;

  return (
    <div className="relative w-80 h-80 flex items-center justify-center mt-4">
      <svg className="w-full h-full transform -rotate-90">
        {/* 배경 회색 원 */}
        <circle 
          cx="160" 
          cy="160" 
          r={radius} 
          className="stroke-[rgba(255,255,255,0.12)]" 
          strokeWidth="12" 
          fill="transparent" 
        />
        {/* 애니메이션 진행 원 */}
        <circle
          cx="160"
          cy="160"
          r={radius}
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`origin-center ${strokeColor} ${
            isResetMoment 
              ? "transition-none" 
              : "transition-[stroke-dashoffset] duration-1000 ease-linear"
          }`}
        />
      </svg>

      <div className="absolute flex flex-col items-center justify-center">
        <p className="absolute bottom-full mb-2 text-sm text-[#94A3B8] whitespace-nowrap">
          {subStatusText}
        </p>
        <p className="text-6xl font-semibold tracking-wider font-mono leading-none m-0">
          {formatTime(timeLeft)}
        </p>
      </div>
    </div>
  );
}