interface StatsSummaryProps {
  totalTime: string;
  completedSessions: string;
  penaltyMemberCount: number;
}

/**
 * 세션 통계 요약 카드. 3칸 그리드로 총 수감 시간, 완료한 반복 횟수, 벌칙 대상자 수를 표시합니다.
 * SemiResult와 TotalResult에서 공통으로 사용됩니다.
 *
 * @param totalTime - 포맷된 총 수감 시간 문자열 (예: "1시간 30분")
 * @param completedSessions - 완료한 반복 문자열 (예: "3 / 5")
 * @param penaltyMemberCount - 벌칙 대상자 수
 */
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
