import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  getEffectiveFocusEscapeMs,
  mergeIntervals,
} from '../penalty/penalty.util';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EscapeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 멤버의 생존 신호(heartbeat)를 Redis에 15초 TTL로 갱신합니다.
   * @param {string} roomCode - 방 코드
   * @param {string} identifier - 사용자 ID 또는 게스트 토큰
   * @returns {Promise<void>}
   */
  async updateHeartbeat(roomCode: string, identifier: string) {
    await this.redis.instance.set(
      `heartbeat:${roomCode}:${identifier}`,
      Date.now().toString(),
      'EX',
      15,
    );
  }

  /**
   * 멤버의 heartbeat 키를 즉시 제거합니다. (정상 종료/명시적 복귀 시)
   * @param {string} roomCode - 방 코드
   * @param {string} identifier - 사용자 ID 또는 게스트 토큰
   * @returns {Promise<void>}
   */
  async clearHeartbeat(roomCode: string, identifier: string) {
    await this.redis.instance.del(`heartbeat:${roomCode}:${identifier}`);
  }

  /**
   * 이탈 시작을 기록합니다. timer phase에서만 ESCAPE_LOG를 생성하고 이탈 시작 이벤트를 발행합니다.
   * @param {string} roomCode - 방 코드
   * @param {string} identifier - 사용자 ID 또는 게스트 토큰
   * @returns {Promise<void>}
   */
  async logEscapeStart(roomCode: string, identifier: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
    });
    // 휴식(break) 구간 이탈은 면제 정책 → timer phase가 아니면 기록하지 않는다.
    if (!room || room.phase !== 'timer') return;

    // 게스트도 로그인 유저와 동일하게 벌칙 산정 대상 → guestToken 기준으로 멤버 조회
    const isGuest = identifier.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: identifier } : { userId: identifier }),
      },
    });

    // 이미 중도 포기한 멤버는 별도로 산정되므로 이탈 기록 대상에서 제외
    if (!member || member.gaveUpAt) return;

    const activeEscape = await this.prisma.escapeLog.findFirst({
      where: { roomMemberId: member.id, returnedAt: null },
    });

    if (!activeEscape) {
      await this.prisma.escapeLog.create({
        data: { roomMemberId: member.id, escapedAt: new Date() },
      });

      // 직접 호출 대신 이벤트 발행으로 escape ↔ timer 간 순환 참조를 원천 차단
      this.eventEmitter.emit('escape.started', {
        roomCode,
        userId: identifier,
      });
    }
  }

  /**
   * 이탈 종료(복귀)를 기록합니다. 진행 중인 ESCAPE_LOG에 복귀 시각과 지속 시간을 채웁니다.
   * @param {string} roomCode - 방 코드
   * @param {string} identifier - 사용자 ID 또는 게스트 토큰
   * @returns {Promise<void>}
   */
  async logEscapeEnd(roomCode: string, identifier: string) {
    const isGuest = identifier.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: identifier } : { userId: identifier }),
      },
    });

    if (!member || member.gaveUpAt) return;

    const activeEscape = await this.prisma.escapeLog.findFirst({
      where: { roomMemberId: member.id, returnedAt: null },
    });

    if (activeEscape) {
      const now = new Date();
      const durationMs = now.getTime() - activeEscape.escapedAt.getTime();
      await this.prisma.escapeLog.update({
        where: { id: activeEscape.id },
        data: { returnedAt: now, durationMs },
      });
    }
  }

  /**
   * 방의 현재 멤버별 누적 이탈 시간(집중 구간 기준)을 실시간 산정해 반환합니다.
   * @param {string} roomCode - 방 코드
   * @returns {Promise<Array<{ identifier: string | null; totalEscapeMs: number }>>} 멤버별 누적 이탈 시간 목록
   */
  async getCurrentSummary(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        template: true,
        roomMembers: {
          include: { escapeLogs: { where: { deletedAt: null } } },
        },
      },
    });
    if (!room?.template || !room.startedAt) return [];

    const { focusMin, breakMin, rounds } = room.template;
    const sessionStartMs = room.startedAt.getTime();
    const now = Date.now();

    return room.roomMembers.map((member) => {
      const intervals = member.escapeLogs.map((log) => ({
        start: log.escapedAt.getTime(),
        // 아직 복귀하지 않은 이탈은 '지금'까지로 보고 진행 중 이탈 시간을 합산
        end: log.returnedAt ? log.returnedAt.getTime() : now,
      }));

      const merged = mergeIntervals(intervals);
      let totalEscapeMs = 0;

      for (const { start, end } of merged) {
        totalEscapeMs += getEffectiveFocusEscapeMs(
          start,
          end,
          sessionStartMs,
          focusMin,
          breakMin,
          rounds,
        );
      }
      return { identifier: member.userId ?? member.guestToken, totalEscapeMs };
    });
  }
}
