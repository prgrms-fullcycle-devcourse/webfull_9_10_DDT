import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as Sentry from '@sentry/nestjs';
import { SESSION_QUEUE, SessionJob } from './timer.queue';
import { TimerService } from './timer.service';

@Processor(SESSION_QUEUE, { concurrency: 20 })
export class SessionProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionProcessor.name);

  constructor(private readonly timerService: TimerService) {
    super();
  }

  async process(job: Job<SessionJob>): Promise<void> {
    const data = job.data;
    try {
      if (data.kind === 'end') {
        await this.timerService.endSession(data.roomCode);
      } else {
        await this.timerService.sendBreakWarning(data.roomCode);
      }
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
