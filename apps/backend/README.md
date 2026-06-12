# ⚙️ 감옥 - Backend (NestJS)

**Backend** 디렉토리는 서비스의 핵심 비즈니스 로직과 데이터를 처리하는 서버 영역입니다. **NestJS** 기반의 탄탄한 아키텍처 위에서 비동기 큐 처리, 실시간 웹소켓 통신, 관계형 데이터베이스 관리를 수행하며 확장성 높고 안정적인 API를 제공합니다.

---

## 🛠 기술 스택

* **Framework** : NestJS 11
* **Language** : TypeScript
* **Database** : PostgreSQL, Prisma ORM
* **Cache & Queue** : Redis, BullMQ
* **Realtime** : Socket.io, y-websocket (Yjs)
* **Auth & Security** : Passport (Google OAuth, JWT), bcrypt
* **Infra & External** : AWS SNS (푸시 알림), Swagger (API 문서), Sentry

---

## 💡 주요 구현 포인트

* **비동기 타이머 세션 제어 (BullMQ)** : 서버 재시작이나 부하에도 타이머가 유실되지 않도록 **BullMQ** 와 **Redis** 를 활용해 세션 시작, 휴식 경고, 세션 종료 작업을 백그라운드 큐(Queue)로 예약하고 정확한 타이밍에 처리(`SessionProcessor`)합니다.
* **하이브리드 웹소켓 아키텍처** : 일반적인 방 상태 동기화 및 채팅은 **Socket.io** 기반의 `RoomGateway` 에서 처리하고, 계약서 동시 편집은 성능 최적화를 위해 네이티브 WebSockets 기반의 `YjsGateway` (`y-websocket`)로 분리하여 처리 효율성을 높였습니다.
* **정교한 벌칙 산정 시스템 (PenaltyService)** : 유저가 화면을 이탈하거나 중도 포기(`gaveUpAt`)할 때, 집중 시간(Focus Time)과 이탈 시간을 교차 계산하여 비율을 산출하고 지정된 티어(Tier)에 따라 룰렛 벌칙 개수를 결정하는 로직을 트랜잭션으로 안전하게 구현했습니다.
* **결정적 룰렛 시드 처리** : 클라이언트에서 룰렛 애니메이션을 그릴 때, 스핀 위치를 멱등성 있게 반환하기 위해 `seed` 기반의 `mulberry32` PRNG 셔플 알고리즘을 백엔드에 직접 구현하여 공정한 결과를 보장합니다.
* **Redis 기반 상태 관리 및 Keyspace Notification** : 휘발성 방 상태 데이터는 DB 대신 Redis에 임시 저장하며, 클라이언트의 하트비트(Heartbeat) 만료를 Redis의 `Keyspace Notification` 기능으로 감지하여 비정상 종료 시에도 이탈을 정확히 기록합니다.

---

## 📂 디렉토리 구조 상세

```text
src/
 ├── common/               # 전역에서 사용되는 공통 모듈 및 유틸리티
 │    ├── adapters/        # 다중 서버 확장을 위한 RedisIoAdapter
 │    ├── filters/         # 전역 에러 핸들링 (HttpExceptionFilter)
 │    ├── interceptors/    # 통일된 응답 포맷(표준 봉투) 변환 인터셉터
 │    ├── redis/           # Redis 클라이언트 싱글톤 모듈
 │    └── prisma/          # Prisma ORM 서비스 모듈
 ├── modules/              # 도메인별 비즈니스 로직 (Controller, Service, Module)
 │    ├── auth/            # Google OAuth 소셜 로그인 및 JWT / 게스트 토큰 발급
 │    ├── escape/          # 화면 이탈 시간 누적, 하트비트 추적 및 병합 로직
 │    ├── gateway/         # 실시간 소켓 게이트웨이 (RoomGateway, YjsGateway)
 │    ├── penalty/         # 이탈 비율에 따른 벌칙 등급 및 개수 산정 유틸리티
 │    ├── result/          # 세션 종료 후 최종 결과 화면 집계 API
 │    ├── room/            # 방 생성, 입장, 퇴장 및 Redis 상태 동기화
 │    ├── roulette/        # 결정적 셔플 알고리즘 기반 룰렛 당첨 인덱스 추첨
 │    ├── rule/            # 방장이 설정한 계약서 템플릿의 검증 및 DB 저장
 │    ├── sns/             # AWS SNS 연동 안드로이드 엔드포인트 관리
 │    ├── timer/           # BullMQ 큐 등록, 세션 시작/종료, 중도 포기 트랜잭션 처리
 │    └── user/            # 내 정보 조회, 수정, 탈퇴 및 과거 히스토리 통계
 ├── app.module.ts         # 최상위 애플리케이션 모듈 (환경변수, Sentry 초기화)
 └── main.ts               # NestJS 서버 부트스트랩, CORS 설정 및 Swagger 연결

```