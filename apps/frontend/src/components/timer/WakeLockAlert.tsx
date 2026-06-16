'use client';

interface WakeLockAlertProps {
  isSupported: boolean;
}

export function WakeLockAlert({ isSupported }: WakeLockAlertProps) {
  if (isSupported) return null;

  return (
    <div className='text-center mt-4 w-full max-w-sm px-4'>
      <div className='flex items-start justify-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-xs text-destructive'>
        <span>
          현재 기기에서 화면 꺼짐 방지가 지원되지 않아요.
          <br />
          원활한 집중을 위해 기기의 <b>자동 화면 꺼짐 시간</b>을
          늘려주세요.
        </span>
      </div>
    </div>
  );
}
