# 🖥️ 감옥 - Frontend (Next.js)

**Frontend** 디렉토리는 사용자에게 직접 맞닿아 있는 웹 애플리케이션 영역입니다. **Next.js** (App Router) 를 기반으로 모바일 및 데스크톱 환경 모두에서 최적화된 사용자 경험(UX)을 제공하며, **Yjs** 와 **WebSocket** 을 활용해 팀원 간 실시간 동시 편집 기능을 완벽하게 지원합니다.

---

## 🛠 기술 스택

* **Framework** : Next.js 16 (App Router), React 19
* **Language** : TypeScript
* **Styling** : Tailwind CSS v4, Radix UI (shadcn/ui)
* **State Management** : Zustand (전역 상태), React Query (서버 상태)
* **Realtime & Collab** : Socket.io-client, Yjs, y-websocket
* **API & Error** : Axios, Orval (OpenAPI 자동 생성), Sentry
* **Etc** : JWT Decode, Web Push API, NoSleep.js

---

## 💡 주요 구현 포인트

* **OpenAPI 기반 API 자동화 (Orval)** : 백엔드의 Swagger(OpenAPI) 명세서를 바탕으로 **Orval** 을 활용해 API 클라이언트와 타입 정의(DTO)를 자동 생성(`src/api/generated`)하여, 백엔드와의 타입 불일치 문제를 원천 차단했습니다.
* **실시간 계약서 동시 편집 (Yjs)** : `useYjsContract` 훅을 구현하여, 사용자가 입력하는 포커스 상태(Awareness)와 집중 시간, 벌칙 목록 등의 데이터를 **Yjs** 문서로 동기화합니다. 팀원들이 동일한 화면을 보며 실시간으로 상호작용할 수 있습니다.
* **최적화된 타이머 및 화면 이탈 감지** : SVG `stroke-dashoffset` 을 활용해 부드러운 타이머 진행 바를 구현했으며, `useWakeLock` (NoSleep.js 폴백 포함)을 통해 세션 중 화면이 꺼지지 않도록 방지합니다. 또한 `visibilitychange` 이벤트를 통해 브라우저 이탈(딴짓)을 정확히 감지하여 백엔드로 전달합니다.
* **결정적(Deterministic) 룰렛 애니메이션** : 서버에서 결정된 스핀 결과를 바탕으로 `react-custom-roulette` 과 커스텀 애니메이션(`cubic-bezier`)을 결합하여 공정하면서도 긴장감 있는 룰렛 시각 효과를 연출합니다.
* **에러 바운더리와 모니터링** : `error.tsx` 와 `global-error.tsx` 를 통해 단계별 에러 바운더리를 구성하고, **Sentry** 에 예외를 실시간으로 보고하여 사용자 경험의 중단을 최소화합니다.

---

## 📂 디렉토리 구조 상세

```text
src/
 ├── api/
 │    └── generated/       # Orval을 통해 자동 생성된 API 클라이언트 및 타입 (수정 금지)
 ├── app/                  # Next.js App Router 진입점 (페이지, 레이아웃, 에러 핸들링)
 │    ├── auth/            # 소셜 로그인 콜백 처리
 │    ├── mypage/          # 내 정보, 통계, 참여 이력 확인
 │    ├── room/            # 방 생성, 입장, 타이머, 룰렛, 결과 화면
 │    └── terms/           # 서비스 이용약관 및 개인정보 처리방침
 ├── components/           # UI 및 도메인 컴포넌트
 │    ├── auth/            # 로그인, 약관 동의 관련 컴포넌트
 │    ├── contract/        # Yjs 연동 계약서 작성 폼, 타이머 설정, 벌칙 목록
 │    ├── layout/          # 헤더, 모바일 레이아웃 래퍼, 네비게이션 버튼
 │    ├── room/            # 방 상태별 화면 컴포넌트 (타이머, 룰렛, 결과)
 │    └── ui/              # 재사용 가능한 공통 디자인 시스템 (shadcn/ui 기반)
 ├── contexts/             # React Context API
 │    ├── RoomContext      # 현재 진입한 방의 기본 정보 제공
 │    └── SocketContext    # Socket.io 연결 관리 및 이벤트 리스너 통합
 ├── hooks/                # 커스텀 훅
 │    ├── useActiveRoom    # 유저가 현재 참여 중인 활성 방 감지 및 경로 계산
 │    ├── useAuth          # JWT 파싱 및 내 정보 전역 관리
 │    └── useYjsContract   # Yjs 문서 연결 및 데이터 트랜잭션 관리
 ├── lib/                  # 유틸리티 함수 및 상수
 │    ├── axiosClient      # 토큰 인터셉터가 포함된 Axios 인스턴스
 │    ├── profileImage     # 프로필 이미지 키 매핑 및 에셋 관리
 │    └── format           # 시간 및 날짜 포맷팅 유틸
 ├── store/                # Zustand 전역 상태 저장소
 │    └── useRoomStore     # 방 참여자 상태, 페이즈, 세션 정보(시간 보정 등) 관리
 └── types/                # 프론트엔드 전용 타입 정의 (Yjs 인터페이스 등)

```
