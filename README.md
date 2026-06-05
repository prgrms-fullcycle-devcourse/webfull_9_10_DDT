# DDT (Digital Detox Timer) ⏳

> "남들이 딴짓할 때, 우리는 서로를 가두고 집중한다."

DDT는 팀원, 친구들과 함께 집중할 시간을 정하고, 화면을 이탈(딴짓)할 경우 이탈한 시간에 비례하여 벌칙을 부여하는 **실시간 디지털 디톡스 서비스**입니다.

## 🌟 주요 기능
* **실시간 계약서 작성:** Yjs를 활용한 노션/구글 Docs 스타일의 실시간 동시 편집
* **엄격한 타이머 & 화면 이탈 감지:** 브라우저 Visibility API와 웹소켓 Heartbeat를 이용한 화면 이탈 추적
* **벌칙 룰렛:** 이탈 시간 비례 다중 티어(Tier) 벌칙 시스템 및 실시간 룰렛 공개
* **PWA & 푸시 알림:** 데스크톱/모바일 앱처럼 설치 가능하며, 휴식 종료 전 푸시 알림 제공

## 🛠 기술 스택

### Backend
* **Framework:** NestJS
* **Database:** PostgreSQL, Prisma ORM
* **Cache & Real-time:** Redis, Socket.io
* **CRDT (동시 편집):** Yjs, y-websocket
* **Auth:** Google OAuth 2.0, JWT (Passport)

### Frontend
* **Framework:** Next.js (App Router), React 19
* **Styling:** Tailwind CSS, Radix UI (Shadcn/ui)
* **State Management:** Zustand, React Query (@tanstack/react-query)
* **API Generation:** Orval (Axios)
* **PWA:** next-pwa, Service Worker

## 📂 프로젝트 구조 상세

본 프로젝트는 **pnpm workspace**를 이용한 Monorepo 구조로 구성되어 있으며, 프론트엔드와 백엔드가 분리되어 있습니다.

```text
ddt-workspace/
├── 📦 packages/shared/             # 공통 패키지 (Monorepo)
│   ├── socket-events.ts          # WebSocket 이벤트명 및 Payload 타입 (오타 방지용)
│   └── socket-data.ts            # 공통 도메인 인터페이스 (RoomState 등)
│
├── 🖥️ apps/backend/                # NestJS 백엔드
│   ├── prisma/                   # 데이터베이스 스키마 및 마이그레이션
│   │   └── schema.prisma         # 사용자, 방, 계약서, 이탈 로그, 결과 테이블 정의
│   └── src/
│       ├── common/               # 전역 예외 처리, 인터셉터, Redis/Prisma 어댑터
│       └── modules/              # 도메인별 기능 모듈
│           ├── auth/             # Google OAuth 및 게스트 로그인, JWT 발급
│           ├── escape/           # 화면 이탈(딴짓) 감지 및 시간 계산 로직
│           ├── gateway/          # Socket.io(채팅/상태) 및 Yjs(동시 편집) 웹소켓 게이트웨이
│           ├── penalty/          # 세션 종료 시 이탈 시간에 따른 티어/벌칙 정산 알고리즘
│           ├── result/           # 랭킹, 통계, 최종 결과 조회 API
│           ├── room/             # 방 생성/입장/퇴장/상태 관리
│           ├── roulette/         # 벌칙 룰렛 스핀 및 남은 벌칙 처리
│           ├── rule/             # 방장이 설정하는 계약서 템플릿(규칙) CRUD
│           ├── timer/            # 집중 세션 진행 (Start, Force-start, Give up)
│           └── user/             # 마이페이지, 내 통계, 참여 히스토리
│
└── 📱 apps/frontend/               # Next.js 프론트엔드 (App Router)
    ├── public/                   # PWA 아이콘, SVG, 배경 이미지 세트
    └── src/
        ├── api/generated/        # Orval을 이용해 백엔드 Swagger에서 자동 생성된 Axios API
        ├── app/                  # Next.js App Router 기반 라우팅
        │   ├── room/[code]/      # 방 입장, 계약서 작성, 타이머, 룰렛, 결과 페이지
        │   ├── mypage/           # 내 정보 수정 및 히스토리 조회
        │   └── terms/            # 서비스 이용약관 및 개인정보처리방침
        ├── components/           # UI 컴포넌트
        │   ├── auth/             # 소셜 로그인 및 약관 동의 팝업 핸들러
        │   ├── contract/         # Yjs를 활용한 실시간 계약서 동시 편집 컴포넌트
        │   ├── room/             # 대기실, 타이머, 룰렛 등 도메인 컴포넌트
        │   └── ui/               # Shadcn/ui 기반 공통 디자인 시스템 (Button, Dialog 등)
        ├── contexts/             # Socket, Room 전역 상태 Context Provider
        ├── hooks/                # 커스텀 훅 (Yjs 연결, Timer 동기화 로직 등)
        ├── lib/                  # 유틸리티 함수 (Axios 설정, 시간 포맷팅 등)
        ├── store/                # Zustand 기반 전역 상태 관리 (useAuthStore, useRoomStore)
        └── types/                # 프론트엔드 전용 타입 정의 (Yjs Doc 스키마 등)

## 🚀 시작하기

### 1. 환경 변수 설정
`apps/backend` 및 `apps/frontend` 디렉토리에 `.env.example`을 참고하여 `.env` 파일을 구성합니다.

**Backend (.env)**
\`\`\`env
DATABASE_URL="postgresql://user:password@localhost:5432/ddtdb"
REDIS_URL="redis://localhost:6379"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:8080/auth/google/callback"
JWT_SECRET="your-super-secret-key"
FRONTEND_URL="http://localhost:3000"
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:your-email@domain.com"
\`\`\`

### 2. 패키지 설치
이 프로젝트는 **pnpm workspace**를 사용합니다. 루트 디렉토리에서 패키지를 설치합니다.
\`\`\`bash
pnpm install
\`\`\`

### 3. 데이터베이스 세팅 (Prisma)
\`\`\`bash
cd apps/backend
pnpm prisma generate
pnpm prisma db push
\`\`\`

### 4. 개발 서버 실행
루트 디렉토리에서 Turborepo를 활용해 프론트엔드와 백엔드를 동시에 실행합니다.
\`\`\`bash
pnpm dev
\`\`\`

* **Frontend:** http://localhost:3000
* **Backend API & Swagger:** http://localhost:8080/api/docs