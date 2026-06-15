import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as Sentry from '@sentry/nestjs';
import { SESSION_QUEUE, SessionJob } from './timer.queue';
import { TimerService } from './timer.service';
import { TimerRepository } from './timer.repository';

@Processor(SESSION_QUEUE, { concurrency: 20 })
export class SessionProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionProcessor.name);

  constructor(
    private readonly timerService: TimerService,
    private readonly timerRepository: TimerRepository,
  ) {
    super();
  }

  async process(job: Job<SessionJob>): Promise<void> {
    const data = job.data;
    this.logger.log(
      `[BullMQ] 잡 실행 시작 (kind=${data.kind}, room=${data.roomCode})`,
    );

    const room = await this.timerRepository.findRoomPhase(data.roomCode);
    if (!room || ['closed', 'result'].includes(room.phase)) {
      this.logger.log(
        `[BullMQ] 잡 스킵 - 방 종료됨 (kind=${data.kind}, room=${data.roomCode}, phase=${room?.phase ?? 'not-found'})`,
      );
      return;
    }
    try {
      if (data.kind === 'end') {
        await this.timerService.endSession(data.roomCode);
      } else if (data.kind === 'break-start') {
        await this.timerService.emitEscapeSummary(data.roomCode);
      } else if (data.kind === 'break-warning') {
        await this.timerService.sendBreakWarning(data.roomCode);
      } else if (data.kind === 'reveal-penalties') {
        const { roomCode, memberId } = data;
        const { count } = await this.timerService.revealPenalties(memberId);
        if (count > 0) {
          this.logger.log(
            `[BullMQ] 벌칙 자동공개 ${count}건 (room=${roomCode}, member=${memberId})`,
          );
        }
      }
      this.logger.log(
        `[BullMQ] 잡 실행 완료 (kind=${data.kind}, room=${data.roomCode})`,
      );
    } catch (err: unknown) {
      Sentry.captureException(err);
      this.logger.error(
        `잡 처리 실패 (${job.name}/${String(job.id)})`,
        err as Error,
      );
      throw err;
    }
  }
}
