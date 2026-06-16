import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RoomGateway } from '../gateway/room/room.gateway';
import { PenaltyService } from '../penalty/penalty.service';
import { ROULETTE_TIMEOUT_MS } from '../result/result.service';

/**
 * 결정적 셔플 — 같은 seed면 항상 같은 순열을 반환한다.
 * 룰렛 노출 순서를 '무작위처럼' 보이게 하되, 동일 spinIndex 재호출 시 결과가 흔들리지 않도록(멱등)
 * spinIndex ↔ 벌칙 1:1 대응을 보장한다. (FNV-1a 해시로 문자열 seed→32bit, mulberry32 PRNG로 Fisher-Yates)
 *
 * @param {T[]} arr - 섞을 원본 배열 (원본은 변경하지 않음)
 * @param {string} seed - 순열을 결정하는 시드 문자열(보통 member.id)
 * @returns {T[]} seed에 따라 결정적으로 섞인 새 배열
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 벌칙 룰렛 도메인 서비스 — 스핀(개별 공개)·이탈(일괄 공개)·
 * 중도포기자 결과 조회를 처리하고 결과를 방 전체에 브로드캐스트합니다.
 */
@Injectable()
export class RouletteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomGateway: RoomGateway,
    private readonly penaltyService: PenaltyService,
  ) {}

  /**
   * 한 번의 스핀을 처리해 해당 순번(spinIndex)의 벌칙 하나를 공개합니다.
   * 마지막 스핀에서 남은 벌칙을 전체 공개하고 방 전체에 브로드캐스트합니다.
   *
   * @param {string} roomCode - 방 코드
   * @param {number} spinIndex - 전역 스핀 순번(1부터 총 벌칙 수까지)
   * @param {string | null} userId - 회원 id (게스트면 null)
   * @param {string | null} guestToken - 게스트 토큰 (회원이면 null)
   * @returns 공개된 벌칙 정보와 남은 스핀 수·종료 여부
   * @throws 룰렛 정보 없음/순번 범위 밖이면 400, 이미 완료면 409
   */
  async spinRoulette(
    roomCode: string,
    spinIndex: number,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;

    const member = await this.prisma.roomMember.findFirst({
      where: { roomCode, ...(isGuest ? { guestToken } : { userId }) },
      include: {
        result: {
          include: { penalties: { orderBy: { content: 'asc' } } },
        },
        room: { include: { template: { include: { penalties: true } } } },
      },
    });

    if (!member || !member.result)
      throw new BadRequestException('룰렛 정보가 없습니다.');

    const penalties = member.result.penalties;

    if (penalties.length > 0 && penalties.every((p) => p.isRevealed))
      throw new ConflictException('이미 완료된 룰렛입니다.');

    // spinIndex = count만큼 펼친 인스턴스의 '전역 스핀 순번'(1..총합)
    const totalSpins = penalties.reduce((acc, p) => acc + p.count, 0);
    if (spinIndex < 1 || spinIndex > totalSpins)
      throw new BadRequestException('해당 스핀의 벌칙이 존재하지 않습니다.');

    // count만큼 펼친 인스턴스 시퀀스를 member.id seed로 결정적 셔플 → 노출 순서를 무작위처럼 섞되,
    // 같은 spinIndex 재호출은 항상 동일 결과(멱등). 중간 상태 DB 미저장.
    const flat = penalties.flatMap((p) =>
      Array.from({ length: p.count }, () => p),
    );
    const target = seededShuffle(flat, member.id)[spinIndex - 1];
    if (!target)
      throw new BadRequestException('해당 스핀의 벌칙이 존재하지 않습니다.');

    const remainingSpins = totalSpins - spinIndex;
    const isFinished = remainingSpins === 0;

    // 마지막 스핀에서만 전체 공개. updateMany count=0이면 동시 호출 패자로 broadcast 생략.
    if (isFinished) {
      const { count } = await this.prisma.resultPenalty.updateMany({
        where: { roomMemberId: member.id, isRevealed: false },
        data: { isRevealed: true },
      });
      if (count > 0) await this.broadcastRevealed(roomCode, member);
    }

    // content → PENALTY_ITEM.id 매핑 (휠 정지 위치 식별용)
    const penaltyItemMap = this.buildPenaltyItemMap(member);

    return {
      spinIndex,
      penaltyItemId: penaltyItemMap.get(target.content) ?? null,
      penaltyContent: target.content,
      remainingSpins,
      isFinished,
    };
  }

  /**
   * 룰렛 도중 이탈(X 버튼/시간 만료) 시 남은 미공개 벌칙을 일괄 자동 공개합니다.
   * 동시 호출은 트랜잭션으로 1회만 처리되며, 처리 후 방 전체에 브로드캐스트합니다.
   *
   * @param {string} roomCode - 방 코드
   * @param {string | null} userId - 회원 id (게스트면 null)
   * @param {string | null} guestToken - 게스트 토큰 (회원이면 null)
   * @returns 이번에 자동 공개된 벌칙 목록
   * @throws 멤버 없음/이미 전부 공개면 400
   */
  async exitRoulette(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;

    const member = await this.prisma.roomMember.findFirst({
      where: { roomCode, ...(isGuest ? { guestToken } : { userId }) },
      include: {
        room: { include: { template: { include: { penalties: true } } } },
      },
    });

    if (!member) throw new BadRequestException('멤버 정보를 찾을 수 없습니다.');

    // 미공개 목록 확보 + 일괄 공개를 트랜잭션으로 처리. count=0이면 동시 호출 패자로 차단.
    const unrevealed = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.resultPenalty.findMany({
        where: { roomMemberId: member.id, isRevealed: false },
        select: { content: true, count: true },
        orderBy: { content: 'asc' },
      });
      if (rows.length === 0) {
        // 0건은 '이미 전부 공개됨'(result 존재)과 '미산정'(result 부재) 두 경우 → 구분.
        const result = await tx.roomResult.findUnique({
          where: { roomMemberId: member.id },
          select: { roomMemberId: true },
        });
        throw new BadRequestException(
          result
            ? '벌칙 룰렛이 이미 완료되었습니다.'
            : '아직 결과가 산정되지 않았습니다. 잠시 후 다시 시도해주세요.',
        );
      }
      const { count } = await tx.resultPenalty.updateMany({
        where: { roomMemberId: member.id, isRevealed: false },
        data: { isRevealed: true },
      });
      if (count === 0) {
        throw new BadRequestException('벌칙 룰렛이 이미 완료되었습니다.');
      }
      return rows;
    });

    const penaltyItemMap = this.buildPenaltyItemMap(member);
    const revealedPenalties = unrevealed.map((p) => ({
      id: penaltyItemMap.get(p.content) ?? null,
      content: p.content,
      count: p.count,
    }));

    await this.broadcastRevealed(roomCode, member);

    return { autoRevealed: true, revealedPenalties };
  }

  /**
   * 중도포기(give-up)한 본인의 룰렛 화면 데이터를 조회합니다.
   * 결과가 아직 없으면 fallback으로 재산정 후 다시 조회합니다(멱등).
   *
   * @param {string} roomCode - 방 코드
   * @param {string | null} userId - 회원 id (게스트면 null)
   * @param {string | null} guestToken - 게스트 토큰 (회원이면 null)
   * @returns 포기 시각·누적 이탈 시간·벌칙 풀·확정 벌칙·타이머 정보
   * @throws 멤버 없음/포기자 아님이면 400, 재산정 실패 시 500
   */
  async getGiveUpResult(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;
    const where: Prisma.RoomMemberWhereInput = {
      roomCode,
      ...(isGuest ? { guestToken } : { userId }),
    };

    let member = await this.fetchGiveUpMember(where);

    if (!member) throw new BadRequestException('멤버 정보를 찾을 수 없습니다.');
    // 포기자 전용 — gaveUpAt 없으면 차단(일반 유저는 GET /result 사용)
    if (!member.gaveUpAt)
      throw new BadRequestException('탈옥한 유저만 조회할 수 있습니다.');

    // fallback: give-up 시점 산정 실패로 result 미존재 시 재산정 후 재조회.
    if (!member.result) {
      try {
        await this.penaltyService.calculateAndSaveForGiveUp(
          roomCode,
          member.id,
        );
      } catch (err) {
        Sentry.captureException(err);
        throw new InternalServerErrorException(
          '결과 데이터를 생성하는 중 오류가 발생했습니다.',
        );
      }
      member = await this.fetchGiveUpMember(where);
      if (!member)
        throw new BadRequestException('멤버 정보를 찾을 수 없습니다.');
    }

    // 재산정 후에도 결과가 없으면(이론상 도달 불가) 빈 결과 무음 반환 대신 명시적 실패.
    if (!member.result)
      throw new InternalServerErrorException('결과 데이터를 찾을 수 없습니다.');

    const penaltyItemMap = this.buildPenaltyItemMap(member);
    const penaltyPool = (member.room.template?.penalties ?? []).map((p) => ({
      itemId: p.id,
      content: p.content,
    }));
    const penalties = (member.result?.penalties ?? []).map((p) => ({
      itemId: penaltyItemMap.get(p.content) ?? null,
      content: p.content,
      count: p.count,
    }));

    return {
      gaveUpAt: member.gaveUpAt,
      totalEscapeMs: member.result?.totalEscapeMs ?? 0,
      penaltyPool,
      penalties,
      rouletteEndsAt: new Date(
        member.gaveUpAt!.getTime() + ROULETTE_TIMEOUT_MS,
      ),
      serverTime: new Date(),
    };
  }

  /**
   * 중도포기 조회용 멤버를 로드합니다. (result/penalties + template/penalties 포함)
   *
   * @param {Prisma.RoomMemberWhereInput} where - 멤버 조회 조건
   * @returns 조건에 맞는 멤버(없으면 null)
   */
  private fetchGiveUpMember(where: Prisma.RoomMemberWhereInput) {
    return this.prisma.roomMember.findFirst({
      where,
      include: {
        result: {
          include: { penalties: { orderBy: { content: 'asc' } } },
        },
        room: { include: { template: { include: { penalties: true } } } },
      },
    });
  }

  /**
   * 벌칙 content를 PENALTY_ITEM.id로 매핑하는 테이블을 만듭니다. (휠 정지 위치 식별용)
   *
   * @param member - room.template.penalties를 포함한 멤버 객체
   * @returns {Map<string, string>} content → PENALTY_ITEM.id 매핑
   */
  private buildPenaltyItemMap(member: {
    room: { template: { penalties: { content: string; id: string }[] } | null };
  }): Map<string, string> {
    // 동일 content가 풀에 중복되면 '첫 항목' id를 유지한다 (DTO 명세 일치).
    const map = new Map<string, string>();
    for (const p of member.room.template?.penalties ?? []) {
      if (!map.has(p.content)) {
        map.set(p.content, p.id);
      }
    }
    return map;
  }

  /**
   * 룰렛 완료 시 공개된 벌칙 결과를 방 전체에 소켓으로 브로드캐스트합니다.
   *
   * @param {string} roomCode - 방 코드(소켓 룸 식별자)
   * @param member - 공개 주체 멤버(id·userId·nickname)
   * @returns {Promise<void>}
   */
  private async broadcastRevealed(
    roomCode: string,
    member: { id: string; userId: string | null; nickname: string },
  ): Promise<void> {
    const penalties = await this.prisma.resultPenalty.findMany({
      where: { roomMemberId: member.id, isRevealed: true },
      select: { content: true, count: true },
    });
    this.roomGateway.server.to(roomCode).emit('result:revealed', {
      memberId: member.id,
      userId: member.userId,
      nickname: member.nickname,
      penalties,
    });
  }
}
