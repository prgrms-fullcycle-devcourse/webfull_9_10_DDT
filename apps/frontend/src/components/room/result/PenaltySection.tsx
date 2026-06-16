'use client';
import { useCallback, useState } from 'react';
import { ChevronDown, ThumbsUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getProfileImageSrc } from '@/lib/profileImage';
import { isMeMember } from '@/lib/member';
import { getMemberLabel, getUnknownPenaltyCount } from './utils';
import type { ResultMember } from './types';

interface PenaltySectionProps {
  members: ResultMember[];
  me: { id: string; role: string } | null;
  isSolo: boolean;
}

export function PenaltySection({ members, me, isSolo }: PenaltySectionProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggle = useCallback((memberId: string) => {
    setExpandedIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  }, []);

  const penaltyMembers = members.filter((m) => m.penalties.totalCount > 0);

  return (
    <section className='flex flex-col gap-2'>
      <h3 className='px-1 text-xs font-semibold text-muted-foreground'>
        멤버별 벌칙 결과
      </h3>
      <div className='overflow-hidden rounded-[14px] bg-[#1d1c31]'>
        {penaltyMembers.length > 0 ? (
          penaltyMembers.map((member) => {
            const isMe = isMeMember(me, member);
            const unknownCount = getUnknownPenaltyCount(member);
            const isPending = unknownCount > 0;
            const isExpanded = expandedIds.includes(member.memberId);
            const profileImageSrc = getProfileImageSrc(member.profileImage);

            return (
              <section
                key={member.memberId}
                className='border-t border-white/5 first:border-t-0'
              >
                <button
                  type='button'
                  onClick={() => toggle(member.memberId)}
                  aria-expanded={isExpanded}
                  className='flex w-full items-center gap-2.5 px-4 py-[9px] text-left transition-colors hover:bg-white/[0.03]'
                >
                  <Avatar className='h-9 w-9 shrink-0 border border-white/10 bg-[#2a2a3e]'>
                    {profileImageSrc ? (
                      <AvatarImage
                        src={profileImageSrc}
                        alt={`${member.nickname} 프로필`}
                      />
                    ) : null}
                    <AvatarFallback className='bg-transparent text-xs text-white/70'>
                      {member.nickname.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-medium text-white/85'>
                      {getMemberLabel(member.nickname, {
                        isMe,
                        isHost: member.isHost,
                        isSolo,
                      })}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-sm ${isPending ? 'text-white/45' : 'text-white/75'}`}
                  >
                    {isPending
                      ? '벌칙 뽑는 중'
                      : `벌칙 ${member.penalties.totalCount}개`}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-white/35 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {isExpanded ? (
                  <div className='bg-[#0f0f1a] px-4 py-3.5'>
                    {isPending ? (
                      <p className='text-center text-sm text-white/70'>
                        벌칙을 뽑고 있어요.
                      </p>
                    ) : (
                      <ul className='flex list-disc flex-col gap-2 pl-7 text-sm text-white/70 marker:text-white/70'>
                        {member.penalties.items.map((penalty, i) => (
                          <li key={`${member.memberId}-${i}`}>
                            <div className='flex items-center justify-between gap-2'>
                              <span>{penalty.content}</span>
                              <span className='shrink-0 text-white/50'>
                                ×{penalty.count}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <div className='flex items-center gap-3 px-4 py-4 text-sm text-slate-300'>
            <ThumbsUp className='h-4 w-4 text-[#FBBF24]' />
            벌칙 결과가 없어요.
          </div>
        )}
      </div>
    </section>
  );
}
