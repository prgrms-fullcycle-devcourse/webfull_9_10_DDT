import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

export interface RoomMember {
  nickname: string;
  isLoggedIn: boolean;
  isHost: boolean;
  connected: boolean;
  profileImage: string;
  socketId?: string;
  isSigned?: boolean;
  canEdit?: boolean;
  gaveUpAt?: string | null;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  phase: string;
  members: Record<string, RoomMember>;
}

const MAX_CODE_RETRIES = 5;
export const ROOM_STATE_TTL = 86400;

@Injectable()
export class RoomRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}
  findByCode(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      select: {
        code: true,
        passwordHash: true,
        phase: true,
        hostId: true,
        _count: { select: { roomMembers: true } },
      },
    });
  }

  findByCodeWithTitle(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      select: {
        code: true,
        title: true,
        phase: true,
        hostId: true,
        _count: { select: { roomMembers: true } },
      },
    });
  }

  findByCodeWithTemplate(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      include: { template: true },
    });
  }

  findPhaseByCode(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      select: { phase: true, hostId: true },
    });
  }

  findActiveRoomByHost(hostId: string) {
    return this.prisma.room.findFirst({
      where: {
        hostId,
        phase: { notIn: ['closed', 'result'] },
      },
      include: {
        roomMembers: {
          where: { userId: hostId },
          select: { gaveUpAt: true },
        },
      },
    });
  }

  findActiveRoomByUser(userId: string) {
    return this.prisma.room.findFirst({
      where: {
        phase: { notIn: ['closed', 'result'] },
        OR: [
          { roomMembers: { some: { userId, gaveUpAt: null } } },
          { hostId: userId, roomMembers: { none: { userId } } },
        ],
      },
      select: { code: true, phase: true, title: true },
    });
  }
  findActiveRoomByGuest(guestToken: string) {
    return this.prisma.room.findFirst({
      where: {
        phase: { notIn: ['closed', 'result'] },
        roomMembers: { some: { guestToken, gaveUpAt: null } },
      },
      select: { code: true, phase: true, title: true },
    });
  }

  findMember(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;
    return this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: guestToken } : { userId: userId! }),
      },
    });
  }

  findMemberInTimerRoom(userId: string) {
    return this.prisma.roomMember.findFirst({
      where: { userId, gaveUpAt: null, room: { phase: 'timer' } },
    });
  }

  countActiveMembers(roomCode: string) {
    return this.prisma.roomMember.count({
      where: { roomCode, gaveUpAt: null },
    });
  }

  /**
   * 중복되지 않는 방 코드를 생성하여 방을 DB에 저장합니다.
   * nanoid(8)로 코드를 생성하며, 중복 시 최대 5회 재시도합니다.
   *
   * @param data - 방 생성 데이터 (title, password, maxMembers 등)
   * @returns 생성된 Room 엔티티
   * @throws InternalServerErrorException 5회 재시도 후에도 중복 발생 시
   */
  async createWithUniqueCode(data: {
    title: string;
    hostId: string;
    passwordHash: string;
    phase: string;
  }) {
    for (let i = 0; i < MAX_CODE_RETRIES; i++) {
      const code = nanoid(8);
      try {
        return await this.prisma.room.create({
          data: { code, ...data },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        )
          continue;
        throw e;
      }
    }
    throw new ConflictException('방 코드 생성 실패.');
  }

  updatePhase(roomCode: string, phase: string) {
    return this.prisma.room.update({
      where: { code: roomCode },
      data: { phase },
    });
  }

  upsertUserMember(
    roomCode: string,
    userId: string,
    data: { nickname: string; profileImage: string; isHost: boolean },
  ) {
    return this.prisma.roomMember.upsert({
      where: { roomCode_userId: { roomCode, userId } },
      update: { nickname: data.nickname, profileImage: data.profileImage },
      create: {
        roomCode,
        userId,
        nickname: data.nickname,
        isHost: data.isHost,
        isLoggedIn: true,
        profileImage: data.profileImage,
      },
    });
  }

  createGuestMember(
    roomCode: string,
    guestToken: string,
    data: { nickname: string; profileImage: string },
  ) {
    return this.prisma.roomMember.create({
      data: {
        roomCode,
        guestToken,
        nickname: data.nickname,
        isHost: false,
        isLoggedIn: false,
        profileImage: data.profileImage,
      },
    });
  }

  deleteMemberById(id: string) {
    return this.prisma.roomMember.delete({
      where: { id },
    });
  }

  deleteMember(roomCode: string, targetId: string) {
    const isGuest = targetId.startsWith('guest_');
    return this.prisma.roomMember.deleteMany({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: targetId } : { userId: targetId }),
      },
    });
  }

  /**
   * Redis에서 방 상태를 조회합니다.
   * 방 상태에는 멤버 목록, 서명 상태, 편집 권한 등이 포함됩니다.
   *
   * @param roomCode - 방 코드
   * @returns 방 상태 객체 또는 null (방이 없거나 만료된 경우)
   */
  async getState(roomCode: string): Promise<RoomState | null> {
    const raw = await this.redis.instance.get(`room:state:${roomCode}`);
    return raw ? (JSON.parse(raw) as RoomState) : null;
  }

  /**
   * Redis에 방 상태를 저장합니다. TTL은 ROOM_STATE_TTL(24시간)입니다.
   *
   * @param roomCode - 방 코드
   * @param state - 저장할 방 상태 객체
   */
  async saveState(roomCode: string, state: RoomState): Promise<void> {
    await this.redis.instance.set(
      `room:state:${roomCode}`,
      JSON.stringify(state),
      'EX',
      ROOM_STATE_TTL,
    );
  }

  async deleteState(roomCode: string): Promise<void> {
    await this.redis.instance.del(`room:state:${roomCode}`);
  }

  /**
   * 특정 멤버가 방에서 강퇴(ban) 상태인지 확인합니다.
   *
   * @param roomCode - 방 코드
   * @param targetId - 확인할 userId 또는 guestToken
   * @returns 강퇴 상태이면 true
   */
  async isBanned(roomCode: string, targetId: string): Promise<boolean> {
    const result = await this.redis.instance.get(
      `room:ban:${roomCode}:${targetId}`,
    );
    return !!result;
  }

  async setBan(roomCode: string, targetId: string): Promise<void> {
    await this.redis.instance.set(
      `room:ban:${roomCode}:${targetId}`,
      '1',
      'EX',
      ROOM_STATE_TTL,
    );
  }
}
