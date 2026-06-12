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
  const displayTime = Math.max(0, timeLeft);
  const currentRatio =
    totalDuration > 0
      ? ((totalDuration - displayTime) / totalDuration) * 100
      : 0;

  return (
    <div className="w-full max-w-md text-center mb-8">
      <div className="flex h-1.5 w-full items-center gap-0.4">
        {Array.from({ length: totalSessions }, (_, index) => index + 1).map(
          (sessionNum) => {
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
              <div
                key={sessionNum}
                className="flex min-w-0 items-center gap-0.4"
                style={{
                  flexGrow:
                    focusDuration +
                    (sessionNum < totalSessions ? breakDuration : 0),
                }}
              >
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  style={{ flexGrow: focusDuration }}
                >
                  <div
                    className="h-full origin-left rounded-full bg-primary transition-all duration-1000 ease-linear"
                    style={{ width: focusWidth }}
                  />
                </div>

                {sessionNum < totalSessions && (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    style={{ flexGrow: breakDuration }}
                  >
                    <div
                      className="h-full origin-left rounded-full bg-success transition-all duration-1000 ease-linear"
                      style={{ width: breakWidth }}
                    />
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary"></span> 집중
          <span className="w-2 h-2 rounded-full bg-success"></span> 휴식
        </div>
        <div className="font-medium">
          {currentSession}/{totalSessions} 세션
        </div>
      </div>
    </div>
  );
}