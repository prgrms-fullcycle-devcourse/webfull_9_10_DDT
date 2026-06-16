interface StatsSummaryProps {
  totalTime: string;
  completedSessions: string;
  penaltyMemberCount: number;
}

export function StatsSummary({
  totalTime,
  completedSessions,
  penaltyMemberCount,
}: StatsSummaryProps) {
  const items = [
    { label: '총 수감 시간', value: totalTime },
    { label: '완료한 반복 횟수', value: completedSessions },
    {
      label: '벌칙 대상자',
      value: penaltyMemberCount === 0 ? '0명' : `${penaltyMemberCount}명`,
    },
  ];

  return (
    <section className='grid grid-cols-3 overflow-hidden rounded-[14px] bg-[#1d1c31] text-center text-[11px] text-white/50'>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex min-w-0 flex-col items-center gap-1 px-2.5 py-3 ${i < 2 ? 'border-r border-white/10' : ''}`}
        >
          <span>{item.label}</span>
          <strong className='text-base text-white/85'>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
