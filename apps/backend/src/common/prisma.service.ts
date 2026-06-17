import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaClient를 확장한 DB 접근 서비스입니다.
 * pg 커넥션 풀 기반 어댑터를 사용하고, 모듈 생명주기에 맞춰 연결을 관리합니다.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 서버리스/다중 인스턴스 환경의 커넥션 고갈을 막기 위해 pg 풀 어댑터를 사용한다.
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  /**
   * 모듈 기동 시 데이터베이스 연결을 수립합니다.
   * @returns {Promise<void>}
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * 모듈 종료 시 데이터베이스 연결을 정리합니다.
   * @returns {Promise<void>}
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
