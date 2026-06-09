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

const MAX_ROUNDS_PER_ROW = 4;

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
  const currentRatio =
    totalDuration > 0
      ? ((totalDuration - displayTime) / totalDuration) * 100
      : 0;
  const sessionRows = Array.from(
    { length: Math.ceil(totalSessions / MAX_ROUNDS_PER_ROW) },
    (_, rowIndex) =>
      Array.from(
        {
          length: Math.min(
            MAX_ROUNDS_PER_ROW,
            totalSessions - rowIndex * MAX_ROUNDS_PER_ROW,
          ),
        },
        (_, index) => rowIndex * MAX_ROUNDS_PER_ROW + index + 1,
      ),
  );

  return (
    <div className="w-full max-w-md text-center mb-8">
      <div className="flex w-full flex-col gap-2">
        {sessionRows.map((row, rowIndex) => (
          <div
            key={`timer-progress-row-${rowIndex}`}
            className="flex h-1.5 w-full items-center gap-2"
          >
            {row.map((sessionNum) => {
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
                  className="flex min-w-0 flex-1 items-center gap-1.5"
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
            })}
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary"></span> 집중
          <span className="w-2 h-2 rounded-full bg-success"></span> 휴식
        </div>
        <div className="font-medium">{currentSession}/{totalSessions} 세션</div>
      </div>
    </div>
  );
}
