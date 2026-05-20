# webfull_9_10_DDT
DDT(디지털 디톡스 타이머) 통합 레포지토리 입니다. 

### 📂 프로젝트 디렉토리 구조 (Directory Structure)

```text
ddt-workspace/
├── .github/
│   └── workflows/
│       └── ci.yml                  # PR 생성 시 실행될 CI 파이프라인
│
├── apps/
│   ├── backend/                    # NestJS + Prisma + Redis + Socket.IO + Sentry
│   │   ├── prisma/
│   │   │   └── schema.prisma       
│   │   ├── src/
│   │   │   ├── common/             
│   │   │   ├── modules/            
│   │   │   ├── instrument.ts       # Sentry 초기화 설정 파일 (최상단 실행)
│   │   │   └── main.ts
│   │   ├── .env                    # 로컬용 환경변수 (SENTRY_DSN 등)
│   │   ├── .env.example            # 팀원 공유용 빈 환경변수 템플릿
│   │   └── package.json
│   │
│   └── frontend/                   # Next.js + Zustand + Tailwind + Orval + Sentry
│       ├── public/
│       ├── src/
│       │   ├── app/                
│       │   ├── components/         
│       │   ├── hooks/              
│       │   ├── store/              
│       │   └── api/                
│       ├── orval.config.ts         # js 대신 ts로 설정 (TypeScript 환경 통일)
│       ├── sentry.client.config.ts # Sentry 클라이언트(브라우저) 설정
│       ├── sentry.server.config.ts # Sentry 서버(Next.js SSR) 설정
│       ├── instrumentation.ts      # Next.js 서버 모니터링 훅
│       ├── tailwind.config.ts
│       ├── .env.local              # 로컬용 환경변수 
│       └── package.json
│
├── packages/
│   ├── shared/                     # (프론트/백엔드 공통 구역)
│   │   ├── src/
│   │   │   ├── constants/          # Socket 이벤트명 ('JOIN_ROOM' 등)
│   │   │   └── types/              # HTTP 타입은 Orval이 자동 생성하므로, 여기엔 'Socket 통신용 페이로드 타입' 위주로 작성!
│   │   ├── package.json            
│   │   └── tsconfig.json
│   │
│   ├── eslint-config/              
│   └── typescript-config/          
│
├── package.json                    
├── pnpm-workspace.yaml             
└── turbo.json
