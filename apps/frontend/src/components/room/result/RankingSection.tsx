import { ThumbsUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getProfileImageSrc } from '@/lib/profileImage';
import { isMeMember } from '@/lib/member';
import { formatEscapeTime, getMemberLabel } from './utils';
import type { ResultMember } from './types';

interface RankingSectionProps {
  members: ResultMember[];
  me: { id: string; role: string } | null;
  isSolo: boolean;
  isNoDisruption?: boolean;
  showEscapeTime?: boolean;
}

export function RankingSection({
  members,
  me,
  isSolo,
  isNoDisruption = false,
  showEscapeTime = true,
}: RankingSectionProps) {
  return (
    <section className='flex flex-col gap-2'>
      <h3 className='px-1 text-xs font-semibold text-muted-foreground'>
        {isNoDisruption ? '참여 멤버' : '이탈 시간 순위'}
      </h3>
      <div className='overflow-hidden rounded-[14px] bg-[#1d1c31]'>
        {members.map((member) => {
          const isMe = isMeMember(me, member);
          const profileImageSrc = getProfileImageSrc(member.profileImage);

          return (
            <div
              key={member.memberId}
              className='flex items-center justify-between border-b border-slate-800/50 px-4 py-3 last:border-b-0'
            >
              <div className='flex min-w-0 items-center gap-3'>
                {member.isAllClear || isNoDisruption ? (
                  <ThumbsUp className='h-4 w-7 shrink-0 text-[#FBBF24]' />
                ) : (
                  <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-xs font-bold text-destructive'>
                    {member.rank}
                  </div>
                )}
                <Avatar className='h-9 w-9 border border-slate-700 bg-[#22293F]'>
                  {profileImageSrc ? (
                    <AvatarImage
                      src={profileImageSrc}
                      alt={`${member.nickname} 프로필`}
                    />
                  ) : null}
                  <AvatarFallback className='bg-transparent text-xs text-slate-300'>
                    {member.nickname.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0'>
                  <div className='flex min-w-0 items-center gap-1.5'>
                    <span
                      className={`truncate text-sm font-semibold ${member.gaveUpAt ? 'text-destructive' : 'text-slate-100'}`}
                    >
                      {getMemberLabel(member.nickname, {
                        isMe,
                        isHost: member.isHost,
                        isSolo,
                      })}
                    </span>
                    {member.gaveUpAt && !isNoDisruption ? (
                      <Badge className='h-5 shrink-0 border-none bg-destructive px-1.5 text-[10px] font-bold text-white hover:bg-destructive'>
                        탈옥
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <span className='shrink-0 text-xs font-medium text-slate-400'>
                {showEscapeTime
                  ? formatEscapeTime(member.totalEscapeMs)
                  : !isNoDisruption && member.penalties.totalCount > 0
                    ? `벌칙 ${member.penalties.totalCount}개`
                    : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
