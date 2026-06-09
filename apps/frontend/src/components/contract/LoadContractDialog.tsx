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
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
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
    toast.success(`"${selected.title}" 불러왔어요.`);
  };

  const handleDelete = async (ruleId: string, title: string) => {
    const ok = await confirm({
      title: `${title}을 삭제하시겠습니까?`,
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
      toast.success('삭제됨');
    } catch {
      toast.error('삭제 실패');
    }
  };

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

  // 마스터 체크박스 상태 계산
  const allChecked = options.fields && options.tiers && options.penalties;
  const noneChecked = !options.fields && !options.tiers && !options.penalties;
  const masterState = allChecked ? true : noneChecked ? false : 'indeterminate';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>저장된 계약서 불러오기</DialogTitle>
          <DialogDescription className='text-xs'>
            현재 작성된 내용이 덮어씌워지고, 다른 멤버에게도 즉시 반영됩니다.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <div className='py-8 text-center'>로딩 중...</div>}

        {!isLoading && list?.length === 0 && (
          <div className='py-8 text-center text-muted-foreground'>
            저장된 계약서가 없어요.
          </div>
        )}

        {!isLoading && list && list.length > 0 && (
          <div className='space-y-2 max-h-80 overflow-y-auto'>
            <Accordion
              type='single'
              collapsible
              value={selectedId ?? ''}
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
                  <AccordionTrigger className='flex-1 p-3 hover:no-underline'>
                    <div className='flex-1 text-left'>
                      <p className='font-medium'>{item.title}</p>
                      <DialogDescription className='text-xs mt-1'>
                        집중 {item.focusMin}분 · 휴식 {item.breakMin}분 ·{' '}
                        {item.rounds}회 · 벌칙 {item.penalties.length}개
                      </DialogDescription>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className='px-3 pb-3'>
                    <div className='space-y-2 pt-2 border-t border-border/50'>
                      <div className='flex w-full py-0 px-1 items-center justify-between'>
                        <span className='text-xs font-medium text-muted-foreground'>
                          벌칙 목록
                        </span>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.ruleId, item.title);
                          }}
                        >
                          <Trash2 className='w-4 h-4 text-destructive' />
                        </Button>
                      </div>
                      {item.penalties.length === 0 ? (
                        <p className='text-xs text-muted-foreground'>
                          등록된 벌칙이 없어요.
                        </p>
                      ) : (
                        <ul className='flex flex-wrap text-sm space-y-1 max-h-32 overflow-y-auto p-1 gap-1.5'>
                          {item.penalties.map((p) => (
                            <li
                              key={p.itemId}
                              className='text-foreground/80 px-3 py-1.5 border border-white/20 rounded-sm bg-white/5'
                            >
                              {p.content}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
        {selectedId && (
          <div className='space-y-3 mt-4 pt-4 border-t'>
            <DialogDescription>가져오기 옵션</DialogDescription>
            <div className='flex items-center gap-2'>
              <Checkbox
                id='opt-all'
                checked={masterState}
                onCheckedChange={(checked) => handleToggleAll(!!checked)}
              />
              <Label htmlFor='opt-all' className='cursor-pointer font-medium'>
                전체 불러오기
              </Label>
            </div>

            <div className='ml-6 space-y-2 border-l-2 pl-4 border-border'>
              {/* 시간 */}
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='opt-fields'
                  checked={options.fields}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, fields: !!checked }))
                  }
                />
                <Label htmlFor='opt-fields' className='cursor-pointer'>
                  시간 설정 (집중/휴식/반복)
                </Label>
              </div>

              {/* 강도 */}
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='opt-tiers'
                  checked={options.tiers}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, tiers: !!checked }))
                  }
                />
                <Label htmlFor='opt-tiers' className='cursor-pointer'>
                  벌칙 강도
                </Label>
              </div>

              {/* 벌칙 */}
              <div className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='opt-penalties'
                    checked={options.penalties}
                    onCheckedChange={(checked) =>
                      setOptions((o) => ({ ...o, penalties: !!checked }))
                    }
                  />
                  <Label htmlFor='opt-penalties' className='cursor-pointer'>
                    벌칙 목록
                  </Label>
                </div>

                {options.penalties && (
                  <RadioGroup
                    value={options.penaltyMode}
                    onValueChange={(val) =>
                      setOptions((o) => ({
                        ...o,
                        penaltyMode: val as 'replace' | 'append',
                      }))
                    }
                    className='ml-6'
                  >
                    <div className='flex items-center gap-2'>
                      <RadioGroupItem value='replace' id='mode-replace' />
                      <Label
                        htmlFor='mode-replace'
                        className='cursor-pointer text-sm'
                      >
                        기존 삭제 후 적용
                      </Label>
                    </div>
                    <div className='flex items-center gap-2'>
                      <RadioGroupItem value='append' id='mode-append' />
                      <Label
                        htmlFor='mode-append'
                        className='cursor-pointer text-sm'
                      >
                        기존에 추가
                      </Label>
                    </div>
                  </RadioGroup>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className='flex w-full'>
          <Button
            type='button'
            variant='ghost'
            onClick={onClose}
            className='flex-1 py-6! border border-white/20'
          >
            취소
          </Button>
          <Button
            type='button'
            onClick={handleLoad}
            disabled={!canLoad}
            className='flex-1 py-6!'
          >
            불러오기
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog {...confirmProps} />
    </Dialog>
  );
}
