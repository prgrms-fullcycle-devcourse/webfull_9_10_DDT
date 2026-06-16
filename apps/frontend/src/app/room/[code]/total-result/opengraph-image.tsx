import { ImageResponse } from 'next/og';

export const alt = '수감 결과 | 감옥';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 시간 포맷 (TotalResult 페이지와 동일)
const formatSessionTime = (totalMs: number | null) => {
  if (totalMs === null) return '-';
  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes <= 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
};

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resultData: any = null;

  try {
    // 실시간 결과 반영을 위해 캐시 방지(no-store)
    const res = await fetch(`${apiUrl}/rooms/${code}/result`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      resultData = json.data;
    }
  } catch (e) {
    console.error('OG Image fetch error:', e);
  }

  const totalTime = formatSessionTime(resultData?.totalSessionMs ?? null);
  const completedSessions = resultData?.rule
    ? `${resultData.completedRounds ?? 0} / ${resultData.rule.rounds}`
    : '-';
  const penaltyCount = resultData?.penaltyMemberCount ?? 0;
  const isNoDisruption = penaltyCount === 0;

  // 공간의 한계로 순위는 상위 3명까지만 보여줍니다.
  const topMembers = resultData?.members?.slice(0, 3) || [];

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0F111A',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: 'white',
          padding: '40px',
        }}
      >
        {/* 상단 타이틀 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '60px', marginBottom: '10px' }}>{isNoDisruption ? '👍' : '🏆'}</div>
          <h2 style={{ fontSize: '48px', fontWeight: 'bold', color: '#FBBF24', margin: 0 }}>
            {resultData?.roomTitle ? `[${resultData.roomTitle}] 수감 결과` : '모두 고생했어요!'}
          </h2>
          <p style={{ fontSize: '24px', color: '#A5A3AF', marginTop: '10px' }}>
            {isNoDisruption ? '이탈한 수감자가 아무도 없네요! 최고에요!' : '약속한 수감 시간을 완료했어요.'}
          </p>
        </div>

        {/* 3단 요약 카드 */}
        <div
          style={{
            display: 'flex',
            width: '85%',
            background: '#1A1F31',
            borderRadius: '24px',
            padding: '30px',
            justifyContent: 'space-between',
            marginBottom: '40px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '20px', color: '#9CA3AF', marginBottom: '10px' }}>총 수감 기간</span>
            <strong style={{ fontSize: '32px', color: 'white' }}>{totalTime}</strong>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '100%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '20px', color: '#9CA3AF', marginBottom: '10px' }}>완료한 반복 횟수</span>
            <strong style={{ fontSize: '32px', color: 'white' }}>{completedSessions}</strong>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '100%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '20px', color: '#9CA3AF', marginBottom: '10px' }}>벌칙 대상자</span>
            <strong style={{ fontSize: '32px', color: 'white' }}>{penaltyCount}명</strong>
          </div>
        </div>

        {/* 이탈 순위 리스트 (상위 3명) */}
        {topMembers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '85%', background: '#151926', borderRadius: '24px', padding: '10px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {topMembers.map((member: any, idx: number) => {
              const rankColor = idx === 0 ? '#F85A5A' : idx === 1 ? '#F59E0B' : idx === 2 ? '#FBBF24' : '#9CA3AF';
              return (
                <div
                  key={member.memberId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 10px',
                    borderBottom: idx !== topMembers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px' }}>
                      {member.isAllClear || isNoDisruption ? (
                        <span style={{ fontSize: '28px' }}>👍</span>
                      ) : (
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: rankColor }}>{member.rank}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '28px', color: member.gaveUpAt ? '#F85A5A' : 'white', marginLeft: '16px', fontWeight: 'bold' }}>
                      {member.nickname} {member.gaveUpAt ? '(탈옥)' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '24px', color: '#9CA3AF' }}>
                    {isNoDisruption ? '-' : `벌칙 ${member.penalties?.totalCount ?? 0}개`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}