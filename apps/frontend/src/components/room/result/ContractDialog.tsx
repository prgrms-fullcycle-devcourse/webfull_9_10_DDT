'use client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatTierRange } from './utils';
import type { ResultRule } from './types';

interface ContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTitle: string;
  rule: ResultRule | null;
}

/**
 * 완료된 세션의 각서(계약서) 내용을 확인하는 다이얼로그.
 * 타이머 설정(집중/휴식/반복), 벌칙 목록, 벌칙 강도(등급별 이탈 구간 + 개수)를 표시합니다.
 * TotalResult 화면의 "각서 확인하기" 버튼으로 열립니다.
 *
 * @param open - 다이얼로그 열림 상태
 * @param onOpenChange - 열림 상태 변경 콜백
 * @param roomTitle - 방 제목 (다이얼로그 타이틀에 표시)
 * @param rule - 세션에 사용된 규칙 정보. null이면 각 섹션에 빈 상태 표시
 */
export function ContractDialog({
  open,
  onOpenChange,
  roomTitle,
  rule,
}: ContractDialogProps) {
  const tiers = rule?.tierConfig?.tiers ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[82vh] w-[calc(100%-36px)] max-w-88.5 overflow-y-auto rounded-[18px] border border-white/10 bg-[#0f0d1a] p-4.5 pt-12 text-left text-white/85'>
        <DialogClose asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='닫기'
            className='absolute right-3 top-3 h-8 w-8 rounded-full text-white/70 hover:bg-white/10 hover:text-white'
          >
            <X className='h-4 w-4' />
          </Button>
        </DialogClose>
        <div className='flex flex-col gap-4'>
          <div className='flex items-center'>
            <div className='flex min-w-0 items-center pr-5'>
              <DialogTitle className='truncate text-lg font-medium text-white/85'>
                {roomTitle}의 각서
              </DialogTitle>
              <DialogDescription className='sr-only'>
                완료된 집중 세션에서 사용한 계약서의 타이머, 벌칙 목록, 벌칙
                강도 설정을 확인할 수 있습니다.
              </DialogDescription>
            </div>
          </div>

          <section className='flex flex-col gap-3'>
            <h3 className='text-sm font-medium text-white/45'>타이머</h3>
            <div className='grid grid-cols-3 overflow-hidden rounded-[14px] bg-[#1A1F31] text-center text-[11px] text-white/40'>
              {[
                { label: '집중 시간', value: `${rule?.focusMin ?? '-'}분` },
                { label: '휴식 시간', value: `${rule?.breakMin ?? '-'}분` },
                { label: '반복 횟수', value: `${rule?.rounds ?? '-'}회` },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={`flex h-15.25 flex-col items-center justify-center gap-1 px-2.5 ${i < 2 ? 'border-r border-white/10' : ''}`}
                >
                  <span>{item.label}</span>
                  <strong className='text-base text-white/85'>
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <section className='flex flex-col gap-3'>
            <h3 className='text-sm font-medium text-white/45'>벌칙 목록</h3>
            <div className='overflow-hidden rounded-[14px] bg-[#1A1F31] text-sm font-medium text-white/85'>
              {(rule?.penalties ?? []).length > 0 ? (
                rule!.penalties.map((penalty, i) => (
                  <div
                    key={penalty.itemId}
                    className={`flex min-h-11.5 items-center px-4 py-3.5 ${i > 0 ? 'border-t border-white/5' : ''}`}
                  >
                    {penalty.content}
                  </div>
                ))
              ) : (
                <div className='flex min-h-11.5 items-center px-4 py-3.5 text-white/50'>
                  벌칙 목록이 없습니다.
                </div>
              )}
            </div>
          </section>

          <section className='flex flex-col gap-3'>
            <h3 className='text-sm font-medium text-white/45'>벌칙 강도</h3>
            <div className='overflow-hidden rounded-[14px] bg-[#1A1F31] text-sm font-medium text-white/85'>
              {tiers.length > 0 ? (
                tiers.map((tier, i) => (
                  <div
                    key={`${tier.tier}-${tier.minPct}`}
                    className={`flex items-center gap-2 px-4 py-3.5 ${i > 0 ? 'border-t border-white/5' : ''}`}
                  >
                    <div className='flex min-w-0 flex-1 items-center gap-1.25'>
                      <span className='flex h-5.5 w-[42.6px] shrink-0 items-center justify-center rounded-[20px] bg-[rgba(124,77,255,0.15)] text-[11px] font-bold leading-[120%] text-[#7c4dff]'>
                        {tier.tier}단계
                      </span>
                      <span className='truncate'>
                        {formatTierRange(tier.minPct, tier.maxPct)}
                      </span>
                    </div>
                    <span className='shrink-0'>{tier.count}개</span>
                  </div>
                ))
              ) : (
                <div className='flex min-h-11.5 items-center px-4 py-3.5 text-white/50'>
                  벌칙 강도 설정이 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
