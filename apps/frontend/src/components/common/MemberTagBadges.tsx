import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * 결과 화면(이탈 순위, 벌칙 목록)·계약서 서명 목록의 멤버 뱃지.
 *
 * 피그마 기준: 본인은 닉네임 대신 "나" 텍스트로 노출하므로 별도 '나' 뱃지는 없다.
 * - 방장 : primary(보라) 테두리 + 글자색, 배경 투명 — 닉네임/"나" 옆에 배치
 * - 탈옥 : destructive(빨강) 채움형 — 우측 이탈 시간 옆에 배치
 */
// 공통 크기/형태 (색상 제외)
const TAG_BADGE_BASE = 'h-5 shrink-0 px-1.5 text-[10px] font-bold';

/** 방장 뱃지 — 테두리 + 글자색(primary), 배경 투명 */
export function MemberTagBadges({ isHost }: { isHost: boolean }) {
  if (!isHost) return null;
  return (
    <Badge
      className={cn(
        TAG_BADGE_BASE,
        'border border-primary bg-transparent text-primary hover:bg-transparent',
      )}
    >
      방장
    </Badge>
  );
}

/** 상태 뱃지 (탈옥) — 채움형, 우측 이탈 시간 옆 */
export function GaveUpBadge() {
  return (
    <Badge
      className={cn(
        TAG_BADGE_BASE,
        'border-none bg-destructive text-white hover:bg-destructive',
      )}
    >
      탈옥
    </Badge>
  );
}
