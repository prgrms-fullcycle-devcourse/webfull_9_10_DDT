"use client";

type TimerMode = "FOCUS" | "BREAK";

interface TimerProgressBarProps {
  mode: TimerMode;
  currentSession: number;
  totalSessions: number;
  timeLeft: number;
  totalDuration: number;
  focusDuration: number;
  breakDuration: number;
}

export function TimerProgressBar({
  mode,
  currentSession,
  totalSessions,
  timeLeft,
  totalDuration,
  focusDuration,
  breakDuration,
}: TimerProgressBarProps) {
  const isFocus = mode === "FOCUS";
  const displayTime = timeLeft > 0 ? timeLeft : 0;

  return (
    <div className="w-full max-w-md text-center mb-8">
      <div className="w-full flex items-center gap-2 h-1.5">
        {Array.from({ length: totalSessions }).map((_, index) => {
          const sessionNum = index + 1;
          const currentRatio = totalDuration > 0 ? ((totalDuration - displayTime) / totalDuration) * 100 : 0;

          let focusWidth = "0%";
          if (sessionNum < currentSession) {
            focusWidth = "100%";
          } else if (sessionNum === currentSession) {
            focusWidth = isFocus ? `${currentRatio}%` : "100%";
          }

          let breakWidth = "0%";
          if (sessionNum < currentSession) {
            breakWidth = "100%";
          } else if (sessionNum === currentSession) {
            breakWidth = isFocus ? "0%" : `${currentRatio}%`;
          }

          return (
            <div key={sessionNum} className="flex-1 flex items-center gap-1.5 h-full">
              <div
                className="h-full bg-[#1F1E29] rounded-full overflow-hidden relative"
                style={{ flexGrow: focusDuration }}
              >
                <div
                  className="h-full bg-[#A855F7] rounded-full transition-all duration-1000 ease-linear origin-left"
                  style={{ width: focusWidth }}
                />
              </div>

              {sessionNum < totalSessions && (
                <div
                  className="h-full bg-[#1F1E29] rounded-full overflow-hidden relative"
                  style={{ flexGrow: breakDuration }}
                >
                  <div
                    className="h-full bg-[#22C55E] rounded-full transition-all duration-1000 ease-linear origin-left"
                    style={{ width: breakWidth }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-[#64748B] mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#A855F7]"></span> 집중
          <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span> 휴식
        </div>
        <div className="font-medium">{currentSession}/{totalSessions} 세션</div>
      </div>
    </div>
  );
}