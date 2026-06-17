'use client';

import { getRuleApi } from '@/api/generated/rule-api-계약서-관리/rule-api-계약서-관리';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toYjsFormat, type SavedRule } from '@/lib/contractTransform';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { ApplyData, ApplyOptions } from '@/types/yjs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { useConfirm } from '@/hooks/useConfirm';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { queryKeys } from '@/lib/queryKeys';

interface LoadContractDialogProps {
  open: boolean;
  onClose: () => void;
  onLoad: (rule: ApplyData) => void;
}

// 가져오기 옵션 토글 칩 (선택 시 보라 채움)
const chipClass = (active: boolean) =>
  `inline-flex w-full justify-center items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm cursor-pointer select-none transition-colors ${
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-accent/40 text-muted-foreground hover:bg-accent/70'
  }`;

// 적용 방식 세그먼트 (덮어쓰기 / 추가)
const segClass = (active: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-xs text-center cursor-pointer select-none transition-colors ${
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:text-foreground'
  }`;

/**
 * 저장된 각서 불러오기 다이얼로그.
 * 저장된 각서 목록을 라디오 + 아코디언으로 표시하며,
 * 가져오기 옵션(시간 설정/벌칙 단계/벌칙 목록)과 적용 방식(덮어쓰기/추가)을 선택할 수 있습니다.
 * 선택한 각서는 Yjs 형식으로 변환되어 실시간 반영됩니다.
 *
 * @param open - 다이얼로그 열림 상태
 * @param onClose - 닫기 콜백
 * @param onLoad - 선택된 각서 데이터를 부모(ContractActions)에 전달하는 콜백
 */
export function LoadContractDialog({
  open,
  onClose,
  onLoad,
}: LoadContractDialogProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [options, setOptions] = useState<ApplyOptions>({
    fields: true,
    tiers: true,
    penalties: true,
    penaltyMode: 'replace',
  });

  const { confirm, confirmProps } = useConfirm();

  /**
   * 다이얼로그 닫힘 시 선택 상태와 옵션을 초기화합니다.
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedId(null);
      setOptions({
        fields: true,
        tiers: true,
        penalties: true,
        penaltyMode: 'replace',
      });
      onClose();
    }
  };

  const { data: list, isLoading } = useQuery({
    queryKey: queryKeys.rules.saved(),
    queryFn: async () => {
      const res = await getRuleApi().ruleControllerGetSavedRules();
      return res.data as unknown as SavedRule[];
    },
    enabled: open,
  });

  /**
   * 선택된 각서를 옵션에 따라 Yjs 형식으로 변환하고 부모에 전달합니다.
   * 적용 항목이 하나도 선택되지 않으면 toast로 안내합니다.
   */
  const handleLoad = () => {
    if (!selectedId) {
      return;
    }
    const selected = list?.find((r) => r.ruleId === selectedId);
    if (!selected) {
      return;
    }

    const yjsData = toYjsFormat(selected);
    const applyData: ApplyData = {};

    if (options.fields) {
      applyData.fields = yjsData.fields;
    }
    if (options.tiers) {
      applyData.tiers = yjsData.tiers;
    }
    if (options.penalties) {
      applyData.penalties = yjsData.penalties;
      applyData.penaltyMode = options.penaltyMode;
    }

    if (
      applyData.fields === undefined &&
      applyData.tiers === undefined &&
      applyData.penalties === undefined
    ) {
      toast.error('적용할 항목을 선택해주세요.');
      return;
    }

    onLoad(applyData);
    onClose();
    toast.success(`"${selected.title}"을(를) 불러왔어요.`);
  };

  /**
   * 저장된 각서를 삭제합니다.
   * 확인 다이얼로그를 거친 후 API 호출 → 쿼리 캐시 무효화.
   * 현재 선택된 각서를 삭제하면 선택 상태도 초기화합니다.
   *
   * @param ruleId - 삭제할 각서 ID
   * @param title - 확인 다이얼로그에 표시할 각서 제목
   */
  const handleDelete = async (ruleId: string, title: string) => {
    const ok = await confirm({
      title: `${title}을 삭제하시겠어요?`,
      confirmText: '삭제',
      variant: 'destructive',
    });
    if (!ok) {
      return;
    }

    try {
      await getRuleApi().ruleControllerDeleteRuleTemplate(ruleId);
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.saved() });
      if (selectedId === ruleId) {
        setSelectedId(null);
      }
      toast.success('삭제 성공');
    } catch {
      toast.error('삭제 실패');
    }
  };

  /**
   * 가져오기 옵션(시간/단계/벌칙) 전체 선택/해제를 토글합니다.
   *
   * @param checked - true면 전체 선택, false면 전체 해제
   */
  const handleToggleAll = (checked: boolean) => {
    setOptions((o) => ({
      ...o,
      fields: checked,
      tiers: checked,
      penalties: checked,
    }));
  };
  const canLoad =
    selectedId && (options.fields || options.tiers || options.penalties);

  // 전체 선택 여부 (전체 선택/해제 버튼용)
  const allChecked = options.fields && options.tiers && options.penalties;

  // 벌칙이 없는 계약서는 펼치지 않음 (선택·옵션 표시는 가능)
  const selectedRule = list?.find((r) => r.ruleId === selectedId);
  // 벌칙이 없는 각서는 아코디언을 펼치지 않음 (목록이 비어있으므로)
  const expandedValue =
    selectedRule && selectedRule.penalties.length > 0
      ? selectedRule.ruleId
      : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90dvh] flex flex-col'>
        <DialogHeader className='shrink-0'>
          <DialogTitle>저장된 각서 불러오기</DialogTitle>
          <DialogDescription className='text-xs'>
            현재 작성된 내용이 덮어씌워지고,
            <br />
            다른 멤버에게도 즉시 반영돼요.
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 min-h-0 overflow-y-auto overflow-x-hidden'>
          {isLoading && <div className='py-8 text-center'>로딩 중...</div>}

          {!isLoading && list?.length === 0 && (
            <div className='py-8 text-center text-muted-foreground'>
              저장된 각서가 없어요.
            </div>
          )}

          {!isLoading && list && list.length > 0 && (
            <RadioGroup
              value={selectedId ?? ''}
              onValueChange={(val) => setSelectedId(val || null)}
              className='gap-2'
            >
              <Accordion
                type='single'
                collapsible
                value={expandedValue}
                onValueChange={(val) => setSelectedId(val || null)}
                className='space-y-2'
              >
                {list.map((item) => (
                  <AccordionItem
                    key={item.ruleId}
                    value={item.ruleId}
                    className={`rounded-sm border bg-accent transition-colors ${
                      selectedId === item.ruleId
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className='relative p-3'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={`${item.title} 삭제`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.ruleId, item.title);
                        }}
                        className='absolute right-1 top-1'
                      >
                        <Trash2 className='w-4 h-4 text-destructive' />
                      </Button>
                      <div className='flex items-start gap-2 pr-9'>
                        <RadioGroupItem
                          value={item.ruleId}
                          aria-label={`${item.title} 선택`}
                          className='mt-1 shrink-0'
                        />
                        <div className='min-w-0 flex-1'>
                          <AccordionTrigger className='w-full min-w-0 p-0 hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden'>
                            <div className='min-w-0 flex-1 text-left'>
                              <p className='min-w-0 truncate font-medium'>
                                {item.title}
                              </p>
                              <DialogDescription className='mt-1 text-xs'>
                                집중 {item.focusMin}분 · 휴식 {item.breakMin}분
                                · {item.rounds}회 · 벌칙 {item.penalties.length}
                                개
                              </DialogDescription>
                            </div>
                          </AccordionTrigger>
                        </div>
                      </div>
                    </div>

                    <AccordionContent className='px-3 pb-3'>
                      <div className='space-y-2 pt-2 border-t border-border/50'>
                        <ul className='flex flex-wrap text-sm space-y-1 p-1 gap-1.5'>
                          {item.penalties.map((p) => (
                            <li
                              key={p.itemId}
                              className='text-foreground/80 px-3 py-1.5 border border-white/20 rounded-sm bg-white/5'
                            >
                              {p.content}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </RadioGroup>
          )}
        </div>

        {selectedId && (
          <div className='space-y-2 mt-3 pt-3 border-t shrink-0'>
            {/* 헤더 줄: 라벨 + 전체 선택/해제 */}
            <div className='flex items-center justify-between'>
              <DialogDescription>가져오기 옵션</DialogDescription>
              <button
                type='button'
                onClick={() => handleToggleAll(!allChecked)}
                className='text-xs text-violet-500 hover:underline'
              >
                {allChecked ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            {/* 토글 칩 한 줄: 시간 · 강도 · 벌칙 */}
            <div className='flex flex-row w-full gap-2'>
              <button
                type='button'
                aria-pressed={options.fields}
                onClick={() => setOptions((o) => ({ ...o, fields: !o.fields }))}
                className={chipClass(options.fields)}
              >
                시간 설정
              </button>
              <button
                type='button'
                aria-pressed={options.tiers}
                onClick={() => setOptions((o) => ({ ...o, tiers: !o.tiers }))}
                className={chipClass(options.tiers)}
              >
                벌칙 단계
              </button>
              <button
                type='button'
                aria-pressed={options.penalties}
                onClick={() =>
                  setOptions((o) => ({ ...o, penalties: !o.penalties }))
                }
                className={chipClass(options.penalties)}
              >
                벌칙 목록
              </button>
            </div>

            {/* 적용 방식 세그먼트 (높이 고정: 벌칙 OFF여도 자리만 유지, 시각적 미노출) */}
            <div
              aria-hidden={!options.penalties}
              className={`flex items-center gap-2 ${
                options.penalties ? '' : 'invisible'
              }`}
            >
              <div className='flex flex-1 rounded-lg border border-border bg-accent/40 p-0.5'>
                <button
                  type='button'
                  disabled={!options.penalties}
                  tabIndex={options.penalties ? 0 : -1}
                  aria-pressed={options.penaltyMode === 'replace'}
                  onClick={() =>
                    setOptions((o) => ({ ...o, penaltyMode: 'replace' }))
                  }
                  className={segClass(options.penaltyMode === 'replace')}
                >
                  덮어쓰기
                </button>
                <button
                  type='button'
                  disabled={!options.penalties}
                  tabIndex={options.penalties ? 0 : -1}
                  aria-pressed={options.penaltyMode === 'append'}
                  onClick={() =>
                    setOptions((o) => ({ ...o, penaltyMode: 'append' }))
                  }
                  className={segClass(options.penaltyMode === 'append')}
                >
                  추가하기
                </button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className='flex w-full shrink-0'>
          <Button
            type='button'
            variant='secondary'
            onClick={onClose}
            className='flex-1 h-12 rounded-lg'
          >
            취소
          </Button>
          <Button
            type='button'
            onClick={handleLoad}
            disabled={!canLoad}
            className='flex-1 h-12 rounded-lg font-bold'
          >
            불러오기
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog {...confirmProps} />
    </Dialog>
  );
}
