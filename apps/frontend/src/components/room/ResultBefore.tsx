'use client';

import { ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useResultData } from '@/hooks/useResultData';

export function ResultBefore() {
  const { 
    summary, 
    members, 
    penaltyUsersCount, 
    isNoDisruption, 
    shouldShowRoulette 
  } = useResultData();

  const HeaderComponent = (
    <div className='w-full text-center py-2'>
      <h1 className='text-base font-medium text-white tracking-tight'>결과</h1>
    </div>
  );

  const BottomButtonComponent = (
    <Button 
      onClick={() => console.log(shouldShowRoulette ? '룰렛 시작' : '다음 프로세스 이동')}
      className='w-full py-6 text-base font-bold bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl border-none shadow-lg transition-colors'
    >
      {shouldShowRoulette ? '룰렛 돌리기' : '다음'}
    </Button>
  );

  return (
    <div className='min-h-screen bg-[#0F111A] text-slate-100 font-sans antialiased'>
      <MobileLayout header={HeaderComponent} bottomButton={BottomButtonComponent}>
        <div className='flex flex-col items-center w-full px-1 pt-4 pb-8 space-y-6'>
          
          <div className='text-center space-y-1.5 py-4'>
            {isNoDisruption ? (
              <>
                <div className='text-3xl mb-1 animate-bounce'>👍</div>
                <h2 className='text-xl font-bold tracking-tight text-[#FBBF24]'>
                  이탈 유저가 아무도 없어요!
                </h2>
                <p className='text-xs text-slate-400 font-medium'>오늘 집중력은 최고네요.</p>
              </>
            ) : (
              <>
                <div className='text-3xl mb-1 animate-pulse'>🎉</div>
                <h2 className='text-xl font-bold tracking-tight text-[#10B981]'>
                  집중시간이 종료되었습니다.
                </h2>
                <p className='text-xs text-slate-400 font-medium'>결과를 확인해 주세요.</p>
              </>
            )}
          </div>

          <div className='grid grid-cols-3 w-full bg-[#1A1F31] border border-slate-800/60 rounded-2xl p-4 text-center items-center divide-x divide-slate-800'>
            <div className='space-y-1.5'>
              <p className='text-[10px] font-medium text-slate-400'>총 진행 시간</p>
              <p className='text-sm font-bold text-slate-200'>{summary.totalTime}</p>
            </div>
            <div className='space-y-1.5'>
              <p className='text-[10px] font-medium text-slate-400'>완료한 반복</p>
              <p className='text-sm font-bold text-slate-200'>{summary.completedSessions}</p>
            </div>
            <div className='space-y-1.5'>
              <p className='text-[10px] font-medium text-slate-400'>벌칙 수행자</p>
              <p className='text-sm font-bold text-slate-200'>
                {isNoDisruption ? '0명' : `${penaltyUsersCount}명`}
              </p>
            </div>
          </div>

          <div className='w-full text-left pl-1'>
            <p className='text-xs font-semibold text-slate-400 tracking-wider'>
              {isNoDisruption ? '참여 멤버' : '이탈 시간 순위'}
            </p>
          </div>

          <div className='w-full bg-[#151926] border border-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-800/40'>
            {members.map((member) => {
              const isTopRank = member.rank <= 3;
              const isNoPenaltyUser = member.rank === 999;

              let rankColor = 'text-slate-500';
              if (isTopRank && !isNoDisruption) {
                if (member.rank === 1) rankColor = 'text-[#F85A5A] font-bold';
                else if (member.rank === 2) rankColor = 'text-[#F59E0B] font-bold';
                else if (member.rank === 3) rankColor = 'text-[#FBBF24] font-bold';
              }

              return (
                <div key={member.id} className='flex items-center justify-between px-4 py-3.5 hover:bg-slate-800/20 transition-colors'>
                  <div className='flex items-center gap-3.5'>
                    {isNoPenaltyUser || isNoDisruption ? (
                      <ThumbsUp className='w-4 h-4 text-[#FBBF24] fill-[#FBBF24]/20 flex-shrink-0' />
                    ) : (
                      <span className={`text-xs w-4 text-center ${rankColor}`}>
                        {member.rank}
                      </span>
                    )}

                    <Avatar className='w-8 h-8 bg-[#22293F] border border-slate-800'>
                      <AvatarFallback className='bg-transparent' />
                    </Avatar>

                    <div className='flex items-center gap-1.5'>
                      <span className={`text-xs font-semibold tracking-tight ${member.isForfeit ? 'text-[#F85A5A]' : 'text-slate-200'}`}>
                        {member.name}
                        {member.isHost && ' (방장)'}
                      </span>

                      {member.isForfeit && !isNoDisruption && (
                        <Badge className='bg-[#F85A5A] hover:bg-[#F85A5A] text-[9px] px-1.5 py-0 rounded-full font-bold border-none text-white h-4'>
                          중도 포기
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className='text-right'>
                    <span className='text-xs font-medium text-slate-400'>
                      {!isNoDisruption && member.penaltyCount > 0 ? `벌칙 ${member.penaltyCount}개` : '-'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </MobileLayout>
    </div>
  );
}