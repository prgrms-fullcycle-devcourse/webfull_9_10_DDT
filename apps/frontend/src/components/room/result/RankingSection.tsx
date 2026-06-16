import { ThumbsUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getProfileImageSrc } from '@/lib/profileImage';
import { isMeMember } from '@/lib/member';
import { formatEscapeTime } from './utils';
import {
  MemberTagBadges,
  GaveUpBadge,
} from '@/components/common/MemberTagBadges';
import type { ResultMember } from './types';

interface RankingSectionProps {
  members: ResultMember[];
  me: { id: string; role: string } | null;
  isNoDisruption?: boolean;
  showEscapeTime?: boolean;
}

export function RankingSection({
  members,
  me,
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
          const showGaveUp = !!member.gaveUpAt && !isNoDisruption;
          // 이탈 시간 강조: 0초 초과면 bold/흰75%, 0분 00초면 regular
          const escapeTimeClass = !showEscapeTime
            ? 'font-medium text-slate-400'
            : member.totalEscapeMs > 0
              ? 'font-bold text-white/75'
              : 'font-normal text-slate-400';

          return (
            <div
              key={member.memberId}
              className='flex items-center justify-between gap-2 border-b border-slate-800/50 px-4 py-3 last:border-b-0'
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
                <div className='flex min-w-0 items-center gap-1'>
                  <span
                    className={`truncate text-sm ${isMe ? 'font-bold' : 'min-w-[3ch] font-normal'} ${member.gaveUpAt ? 'text-destructive' : 'text-slate-100'}`}
                  >
                    {isMe ? '나' : member.nickname}
                  </span>
                  {showGaveUp ? <GaveUpBadge /> : null}
                  <MemberTagBadges isHost={member.isHost} />
                </div>
              </div>
              <span className={`shrink-0 text-xs ${escapeTimeClass}`}>
                {showEscapeTime
                  ? formatEscapeTime(member.totalEscapeMs)
                  : !isNoDisruption && member.penalties.totalCount > 0
                    ? `벌칙 ${member.penalties.totalCount}개`
                    : ''}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
