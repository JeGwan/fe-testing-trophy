# fe-testing-trophy

FE 테스트 레이어 구성과 실제 예시 레퍼런스. Testing Trophy 모델을 따라 4개 레이어를 차례로 정리하면서, 각 레이어의 **환경 / 도구 / 잡는 것 / 못 잡는 것**을 단순한 칸반 보드 앱(Next.js 16 + React 19 + TypeScript) 위에서 실제 코드와 함께 보여준다.

- Repo: https://github.com/JeGwan/fe-testing-trophy (private)
- Stack: Next.js 16 (App Router, Turbopack) / React 19 / TypeScript / Tailwind v4

---

## Quick start

```bash
npm install
npm run dev          # 로컬 개발 서버
npm run ci           # Static + Unit + Component 검사를 로컬에서 실행
npm run build && npm run e2e   # E2E까지 포함
```

`npm run ci`는 GitHub Actions가 도는 명령과 같다 — "내 로컬에선 되는데"가 발생할 여지를 줄이는 게 목적. E2E는 prod 빌드를 띄워야 해서 의도적으로 분리.

> 🛠 이 레포의 패턴을 *다른 레포에 자동 적용*하려면 → 본문 끝 [`/testing-trophy` 스킬](#testing-trophy-스킬-claude-code) 섹션. doctor로 진단, make로 4 레이어 테스트 병렬 생성.

---

## 어떻게 읽을까

이 README는 트로피 모델의 4개 레이어를 차례로 다룬다. 각 레이어 안에는 세부 분류가 있고, 분류마다 무엇을 잡는지/못 잡는지를 분리해서 본다. 위에서 아래로 읽어도 되고, 관심 가는 레이어부터 골라봐도 된다.

| 레이어 | 환경 | 본 레포의 예시 코드 |
|---|---|---|
| **1. Static analysis** | 실행 안 함, 컴파일 타임만 | `.github/workflows/ci.yml`, `eslint.config.mjs`, `tsconfig.json` |
| **2. Unit** | Node, no DOM | `src/lib/kanban/board.test.ts`, `storage.test.ts` |
| **3. Component / Integration** | jsdom 시뮬레이션 | `src/components/Board.test.tsx`, `vitest.config.ts`, `vitest.setup.ts` |
| **4. E2E** | real browser + prod build | `e2e/board.spec.ts`, `playwright.config.ts` |

---

## 트로피 다이어그램

```
            E2E   [real browser + prod build]      ← 2 테스트
        ────────────────────────────────
    Component / Integration   [jsdom 시뮬레이션]    ← 10 테스트
  ────────────────────────────────────────
            Unit   [Node, no DOM]                  ← 15 테스트
        ─────────────────────────
        Static   [실행 안 함, 컴파일 타임만]        ← lint · typecheck · build
```

각 레이어는 **위로 갈수록**:
- 사용자 시점에 가까워지고 → 잡을 수 있는 결함의 종류가 늘어나고
- 실제 환경을 더 많이 띄우므로 → 느리고 비싸지고
- 외부 요인 의존도가 높아 → 깨지기 쉽다 (flakiness)

따라서 *아래는 두텁게, 위는 핵심만 얇게* 가 비용 대비 신뢰도가 가장 좋다는 게 트로피의 원칙. Mike Cohn의 고전 *Test Pyramid*에서 파생된, Kent C. Dodds (RTL 저자)의 프론트엔드 변형.

> 🎯 **시각화**: [트로피 6층 거름망](https://jegwan.github.io/fe-testing-trophy/) — 각 레이어가 어떤 결함을 잡는지 애니메이션으로. 로컬에선 `open docs/index.html`.

> **환경 표기를 같이 둔 이유** — "Component / Integration", "Unit" 같은 이름은 *테스트가 어떤 범위를 다루는가* 를 강조하지만, *어떤 환경에서 도는가* 는 안 드러낸다. 그런데 각 레이어의 **본질적 한계는 보통 환경에서 온다** — jsdom 층이 페이지 reload 시나리오를 못 잡는 건 "범위" 의 문제가 아니라 *jsdom이 진짜 브라우저가 아니라는 환경* 의 문제다. 두 축을 같이 표기하면 각 레이어가 무엇을 못 하는지가 다이어그램만 봐도 자명해진다.

---

## 1. Static analysis

- **환경**: 실행 안 함 (컴파일 타임만). build는 toolchain만 실행하고 사용자 코드/동작은 실행하지 않음.

코드를 *실행하지 않고* 결함을 잡는 검사들. 가장 빠르고, 가장 넓고, 가장 먼저 도는 1차 방어선. 세 가지가 있다.

### 1.1 Lint — 패턴/규칙 위반

- **도구**: ESLint (flat config, `eslint-config-next` — `core-web-vitals` + `typescript`)
- **로컬**: `npm run lint`
- **잡는 것**: 잘못 import된 모듈, 안 쓰는 변수, React/Next 규칙 위반(예: `<Link>` 대신 `<a>`), 명백한 안티패턴
- **못 잡는 것**: 타입 오류, 런타임 오류, 비즈니스 로직 오류

### 1.2 Typecheck — 타입 정합성

- **도구**: `tsc --noEmit`
- **로컬**: `npm run typecheck`
- **잡는 것**: 타입 불일치, 존재하지 않는 속성/메서드 호출, 함수 시그니처 위반, 옵셔널 체이닝 누락
- **lint와의 차이**: ESLint는 *문법/패턴* 위주, tsc는 *타입 시스템* 위주 — 영역이 겹치지 않으므로 둘 다 필요
- **부가 효과**: `tsc --noEmit`은 src 전체를 검사하므로 **테스트 파일의 타입 오류도 함께 잡힌다**
- **못 잡는 것**: 런타임 동작, 비즈니스 로직의 정확성

### 1.3 Build — 프레임워크 수준의 정적 검증

- **도구**: `next build` (Turbopack)
- **로컬**: `npm run build`
- **레이어 위치 메모**: build는 비용이 크지만 *사용자 동작이나 실제 데이터*를 검증하지 않으므로 여전히 정적 검증이다. 단, **lint/tsc로는 닿지 않는 "프레임워크 수준의 정합성"을 잡기 위해 가장 비싼 형태**. 그래서 받침의 가장 깊은 층.
- **잡는 것** (lint/tsc 통과인데 빌드에서만 터지는 대표적 결함):
  - **Server / Client Component 경계 위반** — Server Component에서 Client-only 훅 사용, 함수/클래스를 props로 전달 (RSC 직렬화 불가)
  - `"use client"` 누락 (이벤트 핸들러를 Server Component에 두는 경우 등)
  - `generateStaticParams` / `generateMetadata` 시그니처 위반 (Next의 generated route types와 어긋남)
  - `dynamic` / `revalidate` / `runtime` 조합 충돌
  - **Edge runtime 비호환 API** (`fs`, `path`를 edge route에서)
  - server-only / client-only 패키지 교차 import
  - 순환 import, 트리 셰이킹 / 외부 모듈 경로 오류
  - 환경변수 누락, 정적 prerender 시 호출되는 `fetch` 실패
  - `next-env.d.ts` 변경, CSS / Tailwind v4 설정 오류
- **못 잡는 것**: 런타임 동작, 외부 시스템 연동(DB/API), 사용자 인터랙션

---

## 2. Unit

- **환경**: Node, DOM 없음 (`vitest.config.ts`의 unit 프로젝트가 `environment: 'node'`).

가장 작은 단위, 외부 의존 없이 함수 입출력만 검증. 가장 빠르고 안정적이라 트로피에서 두텁게 둘 가치가 있다. *DOM 시뮬레이션조차 부팅 안 함* — 측정상 환경 셋업 0ms.

- **도구**: Vitest
- **로컬**: `npm run test:unit` (unit만, 빠름) / `npm run test` (전체) / `npm run test:watch` (watch)

### 2.1 도메인 순수 함수

비즈니스 로직을 외부 의존 없는 순수 함수로 분리하고 입출력만 검증.

- **본 레포 예시**: `src/lib/kanban/board.ts` — `createBoard`, `addCard`, `moveCard`, `removeCard`
- **잡는 것**: 도메인 로직이 의도대로 동작하는지. *타입이 맞아도 로직이 틀리면 lint/typecheck/build 모두 통과한다.*
- **설계 포인트**: 부수효과(id 생성 등)를 호출자에게 위임 → 함수가 결정적(deterministic)이 되어 테스트가 단순해진다. *"unknown id면 board 그대로 반환"* 같은 정책도 테스트로 명시화 (`moveCard`가 카드를 잃어버리지 않는 안전성).

### 2.2 외부 의존성 주입형 unit test

함수가 *외부 시스템* (storage, 시간, 랜덤, fetch, ...) 과 닿아야 해도 unit test는 가능하다 — **외부 시스템을 인자로 받게** 설계하면 된다. 테스트는 in-memory mock을 주입, 런타임은 진짜 시스템을 주입.

- **본 레포 예시**: `src/lib/kanban/storage.ts` — `Storage` 인터페이스를 인자로 받음
  ```ts
  export function loadBoard(storage: Storage, key = BOARD_STORAGE_KEY): Board | null
  export function saveBoard(storage: Storage, board: Board, key = BOARD_STORAGE_KEY): void
  ```
- **잡는 것**: 직렬화/역직렬화 round-trip, 깨진 JSON 폴백, 스키마 mismatch 처리, 기본 키 사용 같은 *경계 케이스*
- **일반화**: 같은 패턴을 `Date`, `crypto`, `fetch`, `process.env` 등 어떤 외부 의존성에도 적용 가능. 모듈 mocking보다 *함수 시그니처*로 의존성을 드러내는 게 더 명시적

### 못 잡는 것 (Unit 레이어 공통)

컴포넌트 렌더링, 사용자 인터랙션, 진짜 브라우저의 storage 동작 자체 (브라우저별 quota, 동시성, SecurityError 등). → Component / Integration 레이어 또는 E2E 레이어로.

---

## 3. Component / Integration

- **환경**: **jsdom** — Node.js 안에서 브라우저 DOM API를 JS로 흉내 낸 *시뮬레이션*. 진짜 브라우저 프로세스는 안 뜸. 컴포넌트를 렌더하고 DOM 노드를 쿼리하거나 이벤트를 발사할 수 있지만, 진짜 paint / CSS 계산 / reload 같은 건 일어나지 않는다.

이름의 두 축 — *Component* (컴포넌트 단위) 와 *Integration* (여러 단위가 통합) — 은 둘 다 우리가 한 일을 묘사한다 (Kent C. Dodds 트로피 표기). 다만 그 이름들은 *환경이 시뮬레이션* 이라는 사실을 안 드러내므로, 본 README에선 두 축을 같이 표기한다 — 이 레이어의 본질적 한계는 *통합 범위* 가 아니라 *시뮬레이션* 에서 온다.

트로피에서 **가장 두껍게 두라고 하는 층**. 컴포넌트가 React 트리 + DOM + 접근성 트리와 함께 엮여 동작하는 모습을 검증하므로, 한 번에 잡히는 결함의 범위가 unit보다 훨씬 넓다.

- **도구**: Vitest + jsdom + `@testing-library/react` (RTL) + `@testing-library/jest-dom` + `@testing-library/user-event`
- **로컬**: `npm run test:component` (component만) / `npm run test` (전체)
- **본 레포 예시**: `src/components/Board.tsx` + `Board.test.tsx`

이 레이어는 컴포넌트가 하는 *세 가지 책임* 에 따라 세부 분류가 나뉜다:

| 분류 | 컴포넌트 책임 | 테스트하는 것 |
|---|---|---|
| **3.1 렌더** | 상태 → DOM 출력 | prop이 의미적인 마크업으로 그려지는가 |
| **3.2 인터랙션** | 사용자 입력 → 상태 변경 | 클릭/타이핑이 의도대로 상태를 바꾸는가 |
| **3.3 부수효과 / 외부 시스템 통합** | 상태/이벤트 → 외부 세계 | useEffect로 외부와 주고받는 흐름이 의도대로 동작하는가 |

### 3.1 렌더 — 상태 → DOM 출력

- **잡는 것**: 렌더링 출력, prop 배선 (특정 컬럼에 특정 카드가 들어가는가), 조건부 렌더, 접근성 트리 (`getByRole`로 쿼리 가능한가)
- **본 레포 예시**: `<Board initialBoard={...} />` 가 컬럼 3개 헤딩과 카드를 올바른 컬럼에 배치하는가, 빈 컬럼은 listitem 없이 렌더되는가
- **테스트 작성 원칙 (RTL 철학)**: 구현 디테일(클래스명, 컴포넌트 내부 상태)이 아니라 **사용자가 인지하는 것** (역할/이름/텍스트)으로 쿼리한다. 그래서 `<Board />`도 `<section aria-label="Todo column">`, 인풋도 `aria-label="New card title"`처럼 의미 있는 마크업을 우선 설계 — *"테스트가 마크업의 의미성을 강제한다"* 는 게 RTL의 부수효과

### 3.2 인터랙션 — 사용자 입력 → 상태 변경

- **잡는 것**: 클릭/타이핑/제출/취소 같은 사용자 동작이 컴포넌트 상태를 의도대로 바꾸는가
- **본 레포 예시**: *"+ Add card"* 흐름 (버튼 클릭 → 입력 → 제출 → 카드 추가, 공백 제출은 무시, Cancel은 폼만 닫음)
- **`user-event` vs `fireEvent`**: RTL에 내장된 `fireEvent.click()`은 *DOM 이벤트 한 번 발사*에 가깝다. `userEvent.click()`은 사용자 동작에 더 가까운 *연쇄*를 자동 생성한다 — pointerdown → mousedown → focus → pointerup → mouseup → click 같은 흐름을 차례로. 타이핑도 `userEvent.type('abc')`이면 키 한 글자씩 keydown/input/keyup이 진짜로 나가서 `onChange`/`onKeyDown` 핸들러가 *현실적으로* 호출된다. 버그가 진짜 사용자 환경에서만 보이는 케이스를 줄여줌

### 3.3 부수효과 / 외부 시스템 통합 — 상태 → 외부 세계

useEffect로 외부와 닿는 컴포넌트는 *render → effect → 외부 시스템 read/write* 사이클이 정상 동작해야 한다. 이 분류의 테스트 패턴은:

1. 외부 상태 setup (mock 또는 jsdom의 내장 구현)
2. 컴포넌트 렌더
3. `findBy*` 로 effect 결과 대기
4. 인터랙션 트리거
5. 외부 상태 변화 검증

- **본 레포 예시**: `<Board />` 가 mount 시 `localStorage`에서 board를 로드하는가, 카드 추가 후 `localStorage`에 저장되는가, 깨진 JSON이 들어 있으면 `initialBoard`로 폴백하는가
- **본 레포가 다루지 않은 같은 카테고리** (같은 패턴으로 테스트 가능):
  - **API fetch** — `vi.fn()` 또는 MSW (Mock Service Worker) 로 네트워크 mock
  - **IndexedDB / sessionStorage / Cookie**
  - **WebSocket / BroadcastChannel** 구독
  - **URL / router 상태** — `next/navigation` mock
  - **IntersectionObserver / ResizeObserver** 훅
  - **Online/offline / focus/visibility** 이벤트
- **테스트 격리 주의사항**: jsdom의 외부 상태(특히 `localStorage`)는 같은 테스트 파일 안에서 인스턴스가 공유되므로, 테스트 간 누수를 막기 위해 `vitest.setup.ts`의 `afterEach`에서 정리. 본 레포는 `localStorage.clear()` 를 호출. 안 하면 한 테스트가 심은 데이터가 다음 테스트에 새어들어 *비결정적 실패* 가 난다

### 못 잡는 것 (Component / Integration 레이어 공통, jsdom의 한계)

- 실제 CSS 레이아웃과 계산값 (`getBoundingClientRect`는 0을 반환)
- 진짜 paint, 자연스러운 focus/scroll, 모션, 미디어 쿼리
- `IntersectionObserver` / `ResizeObserver` / `Canvas` (없거나 모킹 필요)
- 드래그앤드롭의 일부 실제 동작
- **풀 페이지 새로고침 시 영속성이 진짜로 살아있는가** — mount→unmount만 시뮬레이션 가능. 진짜 reload는 jsdom에서 안 됨. 이게 곧 E2E 레이어의 정확한 도입 동기
- 페이지 라우팅, 데이터 fetching, API 통합 (실제 흐름) — E2E의 영역

### 테스트 환경 설계 결정들

- **jsdom vs happy-dom**: 스펙 충실도가 더 높은 jsdom 선택. happy-dom이 더 빠르지만 일부 API가 빠져있어 학습/디버깅 단계에서 헤매기 쉬움
- **Vitest `projects`로 unit / component 분리**: unit (`src/lib/**/*.test.ts`)은 `environment: 'node'`, component (`src/components/**/*.test.tsx`)는 `environment: 'jsdom'` + setupFiles. 효과:
  - unit 테스트는 jsdom 부팅을 *전혀 하지 않음* — 측정상 환경 셋업 0ms (이전엔 ~200ms)
  - 도구가 어느 레이어에 속하는지가 *config에서 자명* 해짐
  - `npm run test:unit` 같은 분리 명령으로 타이트 루프 가능
  - **CI에선 두 프로젝트를 별도 step으로 실행** (`test:unit` → `test:component`) — 한 번의 `npm run test` 호출로 합치는 것보다 vitest 부팅이 한 번 더 들지만, GH Actions UI에서 *어느 레이어가 깨졌는지* 가 step 이름만 봐도 보이는 쪽을 택했다. 단일 `npm run test`는 로컬에서 두 레이어를 한 번에 돌리는 용도로 유지
- **명시적 `cleanup()` 등록**: `vitest.setup.ts`에서 `afterEach(cleanup)`을 직접 호출. RTL은 보통 자동 등록하지만 Vitest의 `globals: false` (기본값) 환경에선 자동 등록이 안 되므로 수동 등록 필요. *없으면 테스트들이 같은 `document.body`에 누적되어 `getByRole`가 "multiple elements" 에러를 낸다.* 이 setup은 component 프로젝트에만 연결됨
- **`resolve.alias`로 `@/*` 별칭 매칭**: tsconfig의 `paths`와 동일하게 Vitest도 `@/*`를 `src/*`로 해석하도록 `vitest.config.ts`에 명시 (두 프로젝트가 공유). 별도 플러그인 없이 한 줄로 끝
- **`globals: false` 유지**: `describe/it/expect`를 명시적으로 import. 보일러플레이트는 살짝 늘지만 IDE 자동완성/타입 추론이 더 명확하고, 어떤 테스트 러너의 API를 쓰는지가 코드에서 보인다

---

## 4. E2E

- **환경**: 진짜 Chromium 프로세스 + 진짜 prod 서버 (`next start`). 시뮬레이션이 아니라 실재 브라우저 — paint, CSS 계산, reload, 진짜 storage flush 모두 *진짜로* 일어남.

트로피의 꼭대기, 수가 적고 핵심 흐름만.

- **도구**: Playwright (Next.js 공식 권장) + Chromium
- **로컬**: `npm run build && npm run e2e` (build를 먼저, 그 다음 Playwright. webServer 설정이 자동으로 `npm start` 기동)
- **본 레포 예시**: `e2e/board.spec.ts` (vitest의 `src/**` 글롭과 분리되어 있어서 서로 안 섞임)

### 4.1 풀 사용자 흐름 + reload-persistence

- **시나리오 1**: 카드 추가 → 해당 컬럼에 보임 (정적 흐름 한 번 끝까지)
- **시나리오 2 (이 레포에서 E2E의 결정적 정당화)**: 카드 추가 → **페이지 reload** → 카드 살아있음. *jsdom 컴포넌트 테스트는 mount/unmount만 시뮬레이션할 수 있어서 실제 브라우저 reload 후에도 데이터가 살아있는지는 절대 검증 못 함.* localStorage write가 실제 stable storage에 flush되어 reload 후 다시 읽히는 풀 사이클은 진짜 브라우저에서만 검증 가능
- **잡는 것 (다른 레이어가 못 잡는 것)**:
  - 풀 페이지 reload 후 영속성
  - 진짜 CSS 레이아웃과 paint, focus 동작
  - 페이지 라우팅, 페이지 간 상태 흐름
  - 데이터 fetching, API 통합 (있을 경우)
  - 실제 브라우저 quirks (Safari/Chrome 차이는 멀티 브라우저 추가 시)

### E2E 환경 설계 결정들

- **Chromium만 설치** — `npx playwright install chromium` (모든 브라우저는 ~700MB; Chromium만은 ~92MB). 학습/소규모 단계에선 한 브라우저로 충분. 멀티 브라우저는 *그게 진짜 가치를 줄 때* 추가
- **Build 후 prod 서버 사용** — `next dev`(HMR + 디버깅 미들웨어)가 아닌 `next start`(prod 모드)로 테스트. 더 현실적이고 더 빠름
- **`webServer.reuseExistingServer: !process.env.CI`** — 로컬에선 이미 띄워둔 서버가 있으면 재사용 (`npm run dev` 띄워둔 상태에서 `npm run e2e` 가능). CI에선 항상 새로 시작
- **`workers: 1` + `fullyParallel: false`** — 테스트 2개에 병렬은 오버킬. 시나리오가 늘면 조정
- **CI에서 `retries: 2`** — E2E는 본질적으로 jsdom 테스트보다 시끄러움 (네트워크, 타이밍). flaky test를 한두 번 재시도해서 진짜 회귀와 우연한 실패를 분리. 로컬엔 retries 0 (즉시 실패)
- **`reporter: 'github'` (CI) vs `'list'` (로컬)** — `github` reporter는 GH Actions UI에 실패 어노테이션을 직접 다는 형태로 출력
- **Playwright 브라우저 캐시** — `actions/cache`로 `~/.cache/ms-playwright`를 캐싱. 키는 `@playwright/test` 버전. 첫 실행은 ~30s 다운로드, 이후는 즉시
- **실패 시 리포트 업로드** — `playwright-report/`를 GH Actions artifact로 업로드 (실패 시에만). 7일 보관. flaky 분석용

---

## CI Pipeline (실행 순서)

`.github/workflows/ci.yml` — `push`/`pull_request` → `main` 시 트리거. 단일 job에서 **순차(fail-fast)** 로 실행한다. 같은 ref의 이전 실행은 `concurrency`로 자동 취소.

순서는 트로피의 *아래에서 위로* — 빠르고 잡는 범위가 넓은 것부터 실행해서 fail-fast로 비싼 단계 비용을 절약.

| 순서 | step | 트로피 레이어 | 도구 |
|---|---|---|---|
| 1 | Lint | Static (1.1) | ESLint |
| 2 | Typecheck | Static (1.2) | `tsc --noEmit` |
| 3 | Unit | Unit (2) | Vitest (node) |
| 4 | Component | Component (3) | Vitest (+ jsdom + RTL) |
| 5 | Build | Static (1.3) | `next build` |
| 6 | Install Playwright (캐시) | E2E 준비 | `actions/cache` + `playwright install` |
| 7 | E2E | E2E (4) | Playwright + Chromium |

**Build이 마지막에 도는 이유**: 정적 검증의 한 형태이긴 하지만 가장 비용이 크기 때문. 앞 단계가 깨지면 build를 돌릴 의미가 없다 (fail-fast). 즉 *트로피 레이어 ≠ 실행 순서* — 트로피는 "무엇을 잡는가" 축, 파이프라인은 "어떻게 실행하는가" 축. 한 CI 파이프라인은 트로피의 한 *실행 단면(execution slice)* 일 뿐이고, 실무에선 보통 여러 파이프라인 (pre-commit / PR / main / nightly / release) 이 *각자 다른 단면* 을 구현한다.

### 워크플로우 디자인 결정들

- **단일 job + 순차 step**: 단순함이 우선. 검사가 늘어나거나 빌드가 무거워지면 병렬 job으로 분리
- **`npm ci`** (not `npm install`): lockfile 기반 결정적 설치
- **`actions/setup-node`의 npm 캐시**: 재실행 시 의존성 다운로드 시간 절약
- **`concurrency.cancel-in-progress`**: 같은 브랜치에 새 push가 오면 진행 중이던 이전 실행을 취소해서 러너 시간 낭비 방지

---

## 레이어 요약

| 레이어 | 환경 | 세부 분류 | 누적 테스트 수 |
|---|---|---|---|
| 1. Static | 실행 안 함, 컴파일 타임만 | 1.1 Lint · 1.2 Typecheck · 1.3 Build | 0 |
| 2. Unit | Node, no DOM | 2.1 도메인 순수 함수 · 2.2 외부 의존성 주입형 | 15 |
| 3. Component / Integration | jsdom 시뮬레이션 | 3.1 렌더 · 3.2 인터랙션 · 3.3 부수효과 / 외부 시스템 통합 | 25 |
| 4. E2E | real browser + prod build | 4.1 풀 사용자 흐름 + reload-persistence | 27 |

---

## Project structure

```
src/
  app/
    page.tsx                 # 시드 보드를 만들어 <Board /> 렌더
    layout.tsx
  components/
    Board.tsx                # Client Component. initialBoard prop으로 시작,
                             #   useEffect로 mount 시 localStorage 로드,
                             #   변경 시 localStorage 저장.
                             #   + 컬럼별 "+ Add card" 폼 (AddCardForm)
    Board.test.tsx           # 컴포넌트 테스트 (3.1 렌더 + 3.2 인터랙션 + 3.3 부수효과)
  lib/
    kanban/
      types.ts               # Board / Column / Card 타입
      board.ts               # 순수 함수 (createBoard, addCard, moveCard, removeCard)
      board.test.ts          # 2.1 도메인 단위 테스트
      storage.ts             # 영속성 모듈 (Storage 인터페이스 주입)
      storage.test.ts        # 2.2 외부 의존성 주입형 단위 테스트
vitest.config.ts             # 두 프로젝트 (unit: node / component: jsdom + setup)
                             #   @/* alias 공유
vitest.setup.ts              # jest-dom matchers + RTL cleanup + localStorage.clear
                             #   (component 프로젝트에만 연결)
playwright.config.ts         # E2E 설정 (Chromium만, webServer로 next start 자동 기동)
e2e/
  board.spec.ts              # E2E 시나리오 (카드 추가, reload 후 영속성)
.github/workflows/
  ci.yml                     # CI 워크플로우 (lint → typecheck → test → build → e2e)
```

---

## 로컬 명령 모음

| 목적 | 명령 | 트로피 레이어 |
|---|---|---|
| 개발 서버 | `npm run dev` | — |
| Lint | `npm run lint` | Static |
| Typecheck | `npm run typecheck` | Static |
| 테스트 (전체) | `npm run test` | Unit + Component |
| 테스트 (unit만, 빠름) | `npm run test:unit` | Unit |
| 테스트 (component만) | `npm run test:component` | Component |
| 테스트 (watch) | `npm run test:watch` | Unit + Component |
| Production 빌드 | `npm run build` | Static |
| E2E (build 후) | `npm run e2e` | E2E |
| **CI 검사 (E2E 제외)** | `npm run ci` | Static + Unit + Component |

---

## 이 레포의 형성 과정 (참고)

위 문서는 *완성된 레퍼런스 형태* 로 정리된 것이다. 원래 이 레포는 한 번의 학습 대화로 만들어졌고 — 보일러플레이트에서 시작해 매 단계마다 *"기존 도구로 못 잡는 결함"* 을 직접 부딪힌 뒤 그것을 잡을 새 레이어/도구를 도입하는 식 — 그 인과 사슬은 git commit history에 그대로 남아 있다.

```bash
git log --oneline
```

각 커밋 메시지는 그 단계에서 *왜 그 도구가 필요해졌는지* 를 설명한다. 본문이 *"무엇"* 을 정리한 거라면 commit history는 *"왜"* 를 보여준다.

---

## /testing-trophy 스킬 (Claude Code)

이 레포의 패턴을 *다른 임의의 레포에 자동 적용*하는 [Claude Code](https://claude.com/claude-code) 스킬을 함께 제공한다. 본문은 *"무엇/왜"* 를 가르치고, 스킬은 *"어떻게 적용할지"* 를 자동화한다.

위치: `.claude/skills/testing-trophy/`

```
.claude/skills/testing-trophy/
├── SKILL.md          # 라우터: doctor | make 분기
├── detect.md         # cwd → tool matrix 감지
├── doctor.md         # 4 레이어 부울 체크리스트 진단
├── make.md           # 3-way 병렬 dry-run → 승인 → write
├── defaults.md       # 권장 도구 매트릭스 (감지 실패 시 폴백)
└── layers/
    ├── unit.md       # Node 환경 서브에이전트 정의
    ├── component.md  # jsdom 환경 서브에이전트 정의
    └── e2e.md        # 실 브라우저 서브에이전트 정의
```

### 두 명령

| 명령 | 동작 |
|---|---|
| `/testing-trophy doctor` | cwd 레포의 4 레이어 커버리지 진단. ✅/⚠️/❌ 부울 체크리스트 + 보강 액션. **읽기 전용** (로그 파일 1개 외 코드 0건 수정) |
| `/testing-trophy make` | 전체 src 대상 테스트 dry-run plan |
| `/testing-trophy make <path>` | 특정 파일/디렉토리 대상 |
| `/testing-trophy make <spec.md>` | 마크다운 스펙 문서 기반 |
| `/testing-trophy make <confluence-url>` | 사내 위키 페이지 기반 |

### 작동 방식

**구현-agnostic** — `detect.md`가 cwd의 도구를 매트릭스로 산출. ESLint/Biome, Vitest/Jest, RTL/Vue-TL/Svelte-TL, Playwright/Cypress 어느 조합이든 작동. `layers/*.md`는 *환경/책임/금지*만 정의하고 도구 컨벤션은 매트릭스에서 추출. 도구가 미감지면 `defaults.md`의 권장(이 레포의 셋업 = Vitest projects + jsdom + RTL + Playwright Chromium)을 폴백.

**3-way 병렬 fan-out** — make는 Unit/Component/E2E 3개 서브에이전트를 한 번에 호출. 각 에이전트는 *환경 위반 패턴*(예: Component가 `location.reload`, E2E가 마이크로 단언)을 거부하고 다른 레이어로 위임 표기. Static은 *코드 생성*이 아니라 *config 점검*이라 doctor 영역.

**dry-run → 승인 → write** — 서브에이전트는 plan 표(파일 경로 + 사유 + preview)만 산출, 메인이 사용자 승인 후 직접 Write. 테스트 코드는 *false-green*(잘못된 단언이 통과) 위험이 다른 코드보다 비싸기 때문.

### 안전장치 (의도적으로 *안* 함)

- **자동 의존성 설치 금지** (`npm i -D` 안 함) — 변경안만, install은 사람이.
- **자동 commit/push 금지** — Static 보강도 doctor 리포트의 *제안* 으로만.
- **기존 테스트 덮어쓰기 금지** — 동일 경로 충돌 시 `.new.{ext}` suffix.
- **자동 테스트 실행 금지** — write 후 사용자가 직접 검증.
- **커버리지 % 강제 금지** — 트로피 철학(*환경별로 무엇을 잡는가*) 위배.
- **doctor가 코드 변경 금지** — 로그 파일 1개만 (`.claude/testing-trophy/logs/<timestamp>.md`, gitignored).

### 다른 레포로 가져가기

```bash
# 1) 이 레포에서 .claude/skills/testing-trophy/ 만 가져간다
cp -r path/to/fe-testing-trophy/.claude/skills/testing-trophy \
      your-repo/.claude/skills/

# 2) Claude Code에서 자동 인식 — your-repo 안에서:
/testing-trophy doctor              # 진단
/testing-trophy make src/foo/bar.ts # 특정 파일 테스트 plan
```

스킬은 cwd의 도구 조합을 자동 감지하므로 다른 스택(Vue, Svelte, Jest, Cypress 등)에서도 시도 가능. 1차 권장은 이 레포와 동일한 Next/Vitest/Playwright 조합.

### 라이선스 / 기여

스킬 파일들은 MIT 같은 자유 재사용 가정 — 가져다 쓰고, 자기 레포 컨벤션에 맞게 고쳐도 OK. 개선안은 PR 환영.
