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
import { Checkbox } from '../ui/checkbox';
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
import { getErrorMessage } from '@/lib/error';

interface LoadContractDialogProps {
  open: boolean;
  onClose: () => void;
  onLoad: (rule: ApplyData) => void;
}

// 벌칙 목록 적용 방식 라디오 옵션 (덮어쓰기 / 추가)
const PENALTY_MODE_OPTIONS = [
  { value: 'replace', label: '덮어쓰기' },
  { value: 'append', label: '추가하기' },
] as const;

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
    handleOpenChange(false);
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
    } catch (err) {
      toast.error(getErrorMessage(err, '삭제 실패'));
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

  // 현재 선택된 각서 (목록에서 조회)
  const selectedRule = list?.find((r) => r.ruleId === selectedId);
  // 벌칙이 없는 각서는 펼칠 내용이 없어 아코디언을 닫아 둔다
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
            기존 내용을 덮어쓰며, 모두에게 즉시 반영돼요.
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
                      <div className='flex items-start gap-2'>
                        <RadioGroupItem
                          value={item.ruleId}
                          aria-label={`${item.title} 선택`}
                          className='mt-1 shrink-0'
                        />
                        <div className='min-w-0 flex-1'>
                          <AccordionTrigger className='w-full min-w-0 p-0 hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden'>
                            <div className='min-w-0 flex-1 text-left'>
                              <p className='min-w-0 line-clamp-2 wrap-break-word pr-9 font-medium'>
                                {item.title}
                              </p>
                              <DialogDescription className='mt-1 whitespace-nowrap text-xs'>
                                집중 {item.focusMin}분, 휴식 {item.breakMin}분,{' '}
                                {item.rounds}회, 벌칙 {item.penalties.length}개
                              </DialogDescription>
                            </div>
                          </AccordionTrigger>
                        </div>
                      </div>
                    </div>

                    <AccordionContent className='px-3 pb-3'>
                      <div className='space-y-2 pt-2 border-t border-border/50'>
                        <ul className='flex flex-wrap text-sm p-1 gap-1.5'>
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
          <div className='space-y-2 mt-3  shrink-0'>
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

            {/* 가져오기 옵션: 박스형 체크박스 (탭 영역=박스 전체, 모바일 터치영역 확보) */}
            <div className='space-y-2'>
              {/* 시간 설정 · 벌칙 단계 (2열) */}
              <div className='grid grid-cols-2 gap-2'>
                <label className='flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-3 cursor-pointer select-none'>
                  <Checkbox
                    checked={options.fields}
                    onCheckedChange={(c) =>
                      setOptions((o) => ({ ...o, fields: c === true }))
                    }
                    className='shrink-0'
                  />
                  <span className='text-sm'>시간 설정</span>
                </label>

                <label className='flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-3 cursor-pointer select-none'>
                  <Checkbox
                    checked={options.tiers}
                    onCheckedChange={(c) =>
                      setOptions((o) => ({ ...o, tiers: c === true }))
                    }
                    className='shrink-0'
                  />
                  <span className='text-sm'>벌칙 단계</span>
                </label>
              </div>

              {/* 벌칙 목록 + 적용 방식: 하나의 박스로 감싸 그룹화. 라디오는 좌측 여백(pl-9)으로 하위 항목 표시 */}
              <div className='rounded-lg bg-muted/40'>
                <label className='flex items-center gap-2 px-3 py-3 cursor-pointer select-none'>
                  <Checkbox
                    checked={options.penalties}
                    onCheckedChange={(c) =>
                      setOptions((o) => ({ ...o, penalties: c === true }))
                    }
                    className='shrink-0'
                  />
                  <span className='text-sm'>벌칙 목록</span>
                </label>

                {options.penalties && (
                  <>
                    {/* 벌칙 목록과 하위 적용 방식 구분선 (다른 화면과 동일한 회색 라인) */}
                    <div className='mx-3 border-t border-border/50' />
                    <RadioGroup
                      value={options.penaltyMode}
                      onValueChange={(val) =>
                        setOptions((o) => ({
                          ...o,
                          penaltyMode: val as ApplyOptions['penaltyMode'],
                        }))
                      }
                      className='grid grid-cols-2 gap-2 pl-9 pr-3'
                    >
                      {PENALTY_MODE_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className='flex items-center gap-2 py-2.5 cursor-pointer select-none'
                        >
                          <RadioGroupItem
                            value={opt.value}
                            className='shrink-0'
                          />
                          <span
                            className={`text-sm transition-colors ${
                              options.penaltyMode === opt.value
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className='flex w-full shrink-0'>
          <Button
            type='button'
            variant='secondary'
            onClick={() => handleOpenChange(false)}
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
