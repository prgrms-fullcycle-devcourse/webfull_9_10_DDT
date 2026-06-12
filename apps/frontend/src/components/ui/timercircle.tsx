"use client";

interface TimerCircleProps {
  timeLeft: number;
  totalDuration: number;
  strokeColor: string;
  subStatusText: string;
}

export function TimerCircle({
  timeLeft,
  totalDuration,
  strokeColor,
  subStatusText,
}: TimerCircleProps) {
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const displayTime = timeLeft > 0 ? timeLeft : 0;

  const strokeDashoffset = totalDuration > 0
    ? circumference - ((totalDuration - displayTime) / totalDuration) * circumference
    : circumference;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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