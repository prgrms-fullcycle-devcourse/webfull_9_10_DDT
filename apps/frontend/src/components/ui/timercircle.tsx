"use client";

interface TimerCircleProps {
  timeLeft: number;
  totalDuration: number;
  strokeColor: string; // 💡 이제 다시 'stroke-primary' 또는 'stroke-success' 클래스가 들어옵니다.
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
          // 💡 stroke 속성을 빼고 className에 strokeColor 클래스를 명확하게 결합합니다.
          className={`origin-center ${strokeColor} ${
            isResetMoment 
              ? "transition-none" 
              : "transition-[stroke-dashoffset] duration-1000 ease-linear"
          }`}
        />
      </svg>

      <div className="absolute text-center">
        <p className="text-sm text-[#94A3B8] mb-1">{subStatusText}</p>
        <p className="text-6xl font-semibold tracking-wider font-mono">
          {formatTime(timeLeft)}
        </p>
      </div>
    </div>
  );
}