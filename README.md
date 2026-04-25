# kanban-ci-study

팀 CI 케이스 스터디. 단순한 칸반 보드 앱을 보일러플레이트부터 시작해서 기능을 한 단계씩 늘리고, 그에 맞는 CI 검사를 같이 추가해 나간다. **검사의 종류가 늘어나는 이유와 각 검사가 책임지는 영역**을 학습 목표로 삼는다.

- Repo: https://github.com/JeGwan/kanban-ci-study (private)
- Stack: Next.js 16 (App Router, Turbopack) / React 19 / TypeScript / Tailwind v4

---

## Quick start

```bash
npm install
npm run dev          # 로컬 개발 서버
npm run ci           # CI에서 도는 검사 전체를 로컬에서 동일하게 실행
```

`npm run ci`는 GitHub Actions가 도는 명령과 같다. "내 로컬에선 되는데"가 발생할 여지를 줄이는 게 목적.

---

## 테스트 레이어 — Testing Trophy 관점

이 프로젝트의 검사들을 **무엇을 잡는 레이어인가** 로 묶으면 다음 트로피 모양이 된다. Mike Cohn의 고전 *Test Pyramid*에서 파생된, Kent C. Dodds (RTL 저자)의 프론트엔드 변형이다 — *통합/컴포넌트 층을 가장 두껍게* 두자는 게 핵심 주장.

```
            E2E   [real browser + prod build]      ← Step 6   (Playwright + Chromium, 2 테스트)
        ────────────────────────────────
    Component / Integration   [jsdom 시뮬레이션]    ← Step 3-5 (RTL + user-event, 10 테스트)
  ────────────────────────────────────────
            Unit   [Node, no DOM]                  ← Step 2/5 (pure 함수, 15 테스트)
        ─────────────────────────
        Static   [실행 안 함, 컴파일 타임만]        ← Step 1   (lint · typecheck · build)
```

각 레이어는 **위로 갈수록**:
- 사용자 시점에 가까워지고 → 잡을 수 있는 결함의 종류가 늘어나고
- 실제 환경을 더 많이 띄우므로 → 느리고 비싸지고
- 외부 요인 의존도가 높아 → 깨지기 쉽다 (flakiness)

따라서 *아래는 두텁게, 위는 핵심만 얇게* 가 비용 대비 신뢰도가 가장 좋다는 게 트로피의 원칙. 우리는 아래부터 한 층씩 쌓으면서, 각 층이 "왜 필요해졌는지"를 직접 부딪혀가며 배운다.

> **환경 표기를 같이 둔 이유** — "Component / Integration", "Unit" 같은 이름은 *테스트가 어떤 범위를 다루는가* (Kent C. Dodds의 트로피 표기) 를 강조하지만, *어떤 환경에서 도는가* 는 안 드러낸다. 그런데 각 레이어의 **본질적 한계는 보통 환경에서 온다** — 우리가 jsdom 층에서 페이지 reload 시나리오를 못 잡은 건 "컴포넌트 통합" 이라는 *범위* 의 문제가 아니라 *jsdom이 진짜 브라우저가 아니라는 환경* 의 문제였다. 그래서 두 축을 같이 표기하면 각 레이어가 무엇을 못 하는지가 다이어그램만 봐도 자명해진다.

---

### 1. Static analysis — 받침

- **환경**: 실행 안 함 (컴파일 타임만). build는 toolchain만 실행하고 사용자 코드/동작은 실행하지 않음.

코드를 *실행하지 않고* 결함을 잡는 검사들. 가장 빠르고, 가장 넓고, 가장 먼저 도는 1차 방어선. 우리 프로젝트엔 세 가지가 있다.

#### 1-1. Lint — 패턴/규칙 위반

- **도구**: ESLint (flat config, `eslint-config-next` — `core-web-vitals` + `typescript`)
- **로컬**: `npm run lint`
- **잡는 것**: 잘못 import된 모듈, 안 쓰는 변수, React/Next 규칙 위반(예: `<Link>` 대신 `<a>`), 명백한 안티패턴
- **못 잡는 것**: 타입 오류, 런타임 오류, 비즈니스 로직 오류

#### 1-2. Typecheck — 타입 정합성

- **도구**: `tsc --noEmit`
- **로컬**: `npm run typecheck`
- **잡는 것**: 타입 불일치, 존재하지 않는 속성/메서드 호출, 함수 시그니처 위반, 옵셔널 체이닝 누락
- **lint와의 차이**: ESLint는 *문법/패턴* 위주, tsc는 *타입 시스템* 위주 — 영역이 겹치지 않으므로 둘 다 필요
- **부가 효과**: `tsc --noEmit`은 src 전체를 검사하므로 **테스트 파일의 타입 오류도 함께 잡힌다**
- **못 잡는 것**: 런타임 동작, 비즈니스 로직의 정확성

#### 1-3. Build — 프레임워크 수준의 정적 검증

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

### 2. Unit — 도메인 순수 함수 (Step 2 + Step 5 도입)

- **환경**: Node, DOM 없음 (`vitest.config.ts`의 unit 프로젝트가 `environment: 'node'`).

가장 작은 단위, 외부 의존 없이 함수 입출력만 검증. 가장 빠르고 안정적이라 트로피에서 두텁게 둘 가치가 있다. *DOM 시뮬레이션조차 부팅 안 함* — 측정상 환경 셋업 0ms.

- **도구**: Vitest
- **로컬**: `npm run test:unit` (unit만, 빠름) / `npm run test` (전체) / `npm run test:watch` (watch)
- **대상**:
  - `src/lib/kanban/board.ts` — 순수 함수 (`createBoard`, `addCard`, `moveCard`, `removeCard`)
  - `src/lib/kanban/storage.ts` (Step 5) — `serializeBoard`, `deserializeBoard`, `loadBoard`, `saveBoard`. *`Storage` 인터페이스를 인자로 받게 설계*해서 테스트에선 in-memory mock 주입, 런타임에선 `localStorage` 주입.
- **잡는 것**: 도메인 로직이 의도대로 동작하는지. *타입이 맞아도 로직이 틀리면 lint/typecheck/build 모두 통과한다.* 깨진 JSON / 스키마 mismatch 같은 영속성 경계 케이스도 여기서 명시화.
- **설계 포인트**: 부수효과(id 생성, storage 접근)를 호출자/매개변수로 위임 → 함수가 결정적(deterministic)이 되어 테스트가 단순해진다. "unknown id면 board 그대로 반환", "깨진 storage면 null 반환" 같은 정책도 테스트로 굳힘.
- **못 잡는 것**: 컴포넌트 렌더링, 사용자 인터랙션, 진짜 브라우저의 localStorage 동작 자체 (브라우저별 quota, 동시성, SecurityError 등).

---

### 3. Component / Integration — jsdom 시뮬레이션 (Step 3 + 4 + 5 도입)

- **환경**: **jsdom** — Node.js 안에서 브라우저 DOM API를 JS로 흉내 낸 *시뮬레이션*. 진짜 브라우저 프로세스는 안 뜸. 컴포넌트를 렌더하고 DOM 노드를 쿼리하거나 이벤트를 발사할 수 있지만, 진짜 paint/CSS 계산/reload 같은 건 일어나지 않는다.

이름의 두 축 — *Component* (컴포넌트 단위)와 *Integration* (여러 단위가 통합) — 은 둘 다 우리가 한 일을 묘사한다 (Kent C. Dodds 트로피 표기). 다만 그 이름들은 *환경이 시뮬레이션*이라는 사실을 안 드러내므로, 본 README에선 두 축을 같이 표기한다 — 이 층의 본질적 한계는 *통합 범위*가 아니라 *시뮬레이션*에서 온다.

트로피에서 **가장 두껍게 두라고 하는 층**. 컴포넌트가 React 트리 + DOM + 접근성 트리와 함께 엮여 동작하는 모습을 검증하므로, 한 번에 잡히는 결함의 범위가 unit보다 훨씬 넓다.

- **도구**: Vitest + jsdom + `@testing-library/react` (RTL) + `@testing-library/jest-dom` + `@testing-library/user-event`
- **대상**: `src/components/`의 React 컴포넌트 (Server Component / Client Component 모두)
- **잡는 것**:
  - **정적 렌더 (Step 3)** — 렌더링 출력, prop 배선 (특정 컬럼에 특정 카드가 들어가는가), 조건부 렌더, 접근성 트리 (`getByRole`로 쿼리 가능한가)
  - **상태 변경 인터랙션 (Step 4)** — 클릭/타이핑/제출/취소 같은 사용자 동작이 컴포넌트 상태를 의도대로 바꾸는가. 우리 칸반에선 *"+ Add card"* 흐름 (버튼 클릭 → 입력 → 제출 → 카드 추가, 공백 제출 무시, Cancel은 폼만 닫음).
  - **영속성 통합 (Step 5)** — `useEffect` + localStorage 흐름이 의도대로 동작하는가. 미리 store에 데이터를 심고 mount 시 화면에 나타나는지, 카드 추가 후 storage에 실제로 기록되는지, *깨진 JSON이 들어 있으면* initialBoard로 폴백하는지.
- **테스트 작성 원칙 (RTL 철학)**: 구현 디테일(클래스명, 컴포넌트 내부 상태)이 아니라 **사용자가 인지하는 것** (역할/이름/텍스트)으로 쿼리한다. 그래서 `<Board />`도 `<section aria-label="Todo column">`, 인풋도 `aria-label="New card title"`처럼 의미 있는 마크업을 우선 설계.
- **인터랙션 도구 — `user-event` vs `fireEvent`**: RTL에 내장된 `fireEvent.click()`은 *DOM 이벤트 한 번 발사*에 가깝다. `userEvent.click()`은 사용자 동작에 더 가까운 *연쇄*를 자동 생성한다 — pointerdown → mousedown → focus → pointerup → mouseup → click 같은 흐름을 차례로. 타이핑도 `userEvent.type('abc')`이면 키 한 글자씩 keydown/input/keyup이 진짜로 나가서 `onChange`/`onKeyDown` 핸들러가 *현실적으로* 호출된다. **버그가 진짜 사용자 환경에서만 보이는 케이스를 줄여줌.**
- **영속성 테스트 격리 (Step 5)**: jsdom의 `localStorage`는 같은 테스트 파일 안에서 인스턴스가 공유되므로, 테스트 간 누수를 막기 위해 `vitest.setup.ts`의 `afterEach`에서 `localStorage.clear()` 호출. 안 하면 한 테스트가 심은 데이터가 다음 테스트에 새어들어 *비결정적인 실패* 가 난다.
- **못 잡는 것** (jsdom 시뮬레이션의 한계):
  - 실제 CSS 레이아웃과 계산값 (`getBoundingClientRect`는 0을 반환)
  - 진짜 paint, 자연스러운 focus/scroll, 모션, 미디어 쿼리
  - `IntersectionObserver` / `ResizeObserver` / `Canvas` (없거나 모킹 필요)
  - 드래그앤드롭의 일부 실제 동작
  - **풀 페이지 새로고침 시 영속성이 진짜로 살아있는가** — 우리 테스트는 mount→unmount만 시뮬레이션. 진짜 reload는 jsdom에서 안 됨. 이게 곧 Step 6 (E2E) 의 정확한 도입 동기.
  - 페이지 라우팅, 데이터 fetching, API 통합 — E2E의 영역

#### 테스트 환경 설계 결정들

- **jsdom vs happy-dom**: 스펙 충실도가 더 높은 jsdom 선택. happy-dom이 더 빠르지만 일부 API가 빠져있어 학습 단계에서 헤매기 쉬움
- **Vitest `projects`로 unit / component 분리** (Step 5 끝에 도입): unit (`src/lib/**/*.test.ts`)은 `environment: 'node'`, component (`src/components/**/*.test.tsx`)는 `environment: 'jsdom'` + setupFiles. 효과:
  - unit 테스트는 jsdom 부팅을 *전혀 하지 않음* — 측정상 환경 셋업 0ms (이전엔 ~200ms)
  - 도구가 어느 레이어에 속하는지가 *config에서 자명* 해짐
  - `npm run test:unit` 같은 분리 명령으로 타이트 루프 가능
  - 단일 `npm run test`는 두 프로젝트를 한 vitest 호출로 처리 (CI엔 그대로 사용)
- **명시적 `cleanup()` 등록**: `vitest.setup.ts`에서 `afterEach(cleanup)`을 직접 호출. RTL은 보통 자동 등록하지만 Vitest의 `globals: false` (기본값) 환경에선 자동 등록이 안 되므로 수동 등록 필요. *없으면 테스트들이 같은 `document.body`에 누적되어 `getByRole`가 "multiple elements" 에러를 낸다* — 실제로 한 번 마주쳤음. 이 setup은 component 프로젝트에만 연결됨
- **`resolve.alias`로 `@/*` 별칭 매칭**: tsconfig의 `paths`와 동일하게 Vitest도 `@/*`를 `src/*`로 해석하도록 `vitest.config.ts`에 명시 (두 프로젝트가 공유). 별도 플러그인 없이 한 줄로 끝
- **`globals: false` 유지**: `describe/it/expect`를 명시적으로 import. 보일러플레이트는 살짝 늘지만 IDE 자동완성/타입 추론이 더 명확하고, 어떤 테스트 러너의 API를 쓰는지가 코드에서 보인다

---

### 4. E2E — 풀 사용자 흐름 (Step 6 도입)

- **환경**: 진짜 Chromium 프로세스 + 진짜 prod 서버 (`next start`). 시뮬레이션이 아니라 실재 브라우저 — paint, CSS 계산, reload, 진짜 storage flush 모두 *진짜로* 일어남.

트로피의 꼭대기, 수가 적고 핵심 흐름만.

- **도구**: Playwright (Next.js 공식 권장) + Chromium
- **로컬**: `npm run build && npm run e2e` (build를 먼저, 그 다음 Playwright. webServer 설정이 자동으로 `npm start` 기동)
- **대상**: `e2e/*.spec.ts` (vitest의 `src/**` 글롭과 분리되어 있어서 서로 안 섞임)
- **현재 시나리오 (2개)**:
  - 카드 추가 → 해당 컬럼에 보임
  - **카드 추가 → 페이지 reload → 카드 살아있음** ← *jsdom으로는 못 잡던 회귀.* 영속성 통합이 진짜로 동작하는지 검증.
- **두 번째 시나리오가 이 프로젝트에서 E2E의 결정적 정당화**: jsdom 컴포넌트 테스트는 mount/unmount만 시뮬레이션할 수 있어서 *실제 브라우저 reload* 후에도 데이터가 살아있는지는 절대 검증 못 함. localStorage write가 실제 stable storage에 flush되어 reload 후 다시 읽히는 풀 사이클은 진짜 브라우저에서만 검증 가능.
- **잡는 것 (다른 레이어가 못 잡는 것)**:
  - 풀 페이지 reload 후 영속성
  - 진짜 CSS 레이아웃과 paint, focus 동작
  - 페이지 라우팅, 페이지 간 상태 흐름
  - 데이터 fetching, API 통합 (있을 경우)
  - 실제 브라우저 quirks (Safari/Chrome 차이는 멀티 브라우저 추가 시)

#### E2E 환경 설계 결정들

- **Chromium만 설치** — `npx playwright install chromium` (모든 브라우저는 ~700MB; Chromium만은 ~92MB). 학습 단계에선 한 브라우저로 충분. 멀티 브라우저는 *그게 진짜 가치를 줄 때* 추가
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

순서는 위 트로피의 *아래에서 위로* — 빠르고 잡는 범위가 넓은 것부터 실행해서 fail-fast로 비싼 단계 비용을 절약.

| 순서 | step | 트로피 레이어 | 도구 | 도입 |
|---|---|---|---|---|
| 1 | Lint | Static (1-1) | ESLint | Step 1 |
| 2 | Typecheck | Static (1-2) | `tsc --noEmit` | Step 1 |
| 3 | Test | Unit (2) + Component (3) | Vitest (+ jsdom + RTL) | Step 2 / 3 |
| 4 | Build | Static (1-3) | `next build` | Step 1 |
| 5 | Install Playwright (캐시) | E2E 준비 | `actions/cache` + `playwright install` | Step 6 |
| 6 | E2E | E2E (4) | Playwright + Chromium | Step 6 |

**Build이 마지막에 도는 이유**: 정적 검증의 한 형태이긴 하지만 가장 비용이 크기 때문. 앞 단계가 깨지면 build를 돌릴 의미가 없다 (fail-fast). 즉 *트로피 레이어 ≠ 실행 순서* — 트로피는 "무엇을 잡는가" 축, 파이프라인은 "어떻게 실행하는가" 축.

### 워크플로우 디자인 결정들

- **단일 job + 순차 step**: 단순함이 우선. 검사가 늘어나거나 빌드가 무거워지면 병렬 job으로 분리하는 학습 단계를 따로 두기로 함
- **`npm ci`** (not `npm install`): lockfile 기반 결정적 설치
- **`actions/setup-node`의 npm 캐시**: 재실행 시 의존성 다운로드 시간 절약
- **`concurrency.cancel-in-progress`**: 같은 브랜치에 새 push가 오면 진행 중이던 이전 실행을 취소해서 러너 시간 낭비 방지

---

## Steps (학습 진행)

각 단계는 별도 커밋이며, 커밋 히스토리가 그대로 학습 트레이스가 된다.

| Step | 목표 | 추가된 트로피 레이어 | 도입한 도구 | 누적 테스트 수 |
|---|---|---|---|---|
| 0 | 보일러플레이트 | — | `create-next-app` 기본값 | 0 |
| 1 | 기본 CI 3종 | Static (lint, tsc, build) | ESLint, tsc, `next build`, GitHub Actions | 0 |
| 2 | 도메인 + 단위 테스트 | Unit | Vitest | 9 |
| 3 | UI 정적 렌더 + 컴포넌트 테스트 | Component / Integration | jsdom, `@testing-library/react`, `@testing-library/jest-dom` | 12 |
| 4 | 사용자 인터랙션 (+ Add card) | Component / Integration 확장 | `@testing-library/user-event`, Client Component 전환 | 16 |
| 5 | localStorage 영속성 | Unit (storage) + Component (영속성 통합) | `useEffect` load/save, `Storage` 인터페이스 주입형 모듈 | 25 |
| 6 | 풀 사용자 흐름 + reload 영속성 검증 | E2E | Playwright + Chromium, GH Actions 브라우저 캐시 | 27 |

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
    Board.test.tsx           # 컴포넌트 테스트 (정적 렌더 + 인터랙션 + 영속성)
  lib/
    kanban/
      types.ts               # Board / Column / Card 타입
      board.ts               # 순수 함수 (createBoard, addCard, moveCard, removeCard)
      board.test.ts          # 도메인 단위 테스트
      storage.ts             # 영속성 모듈 (Storage 인터페이스 주입)
      storage.test.ts        # 직렬화/역직렬화/round-trip/스키마 검증 단위 테스트
vitest.config.ts             # 두 프로젝트 (unit: node / component: jsdom + setup),
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
| **CI 검사 전체 (E2E 제외)** | `npm run ci` | Static + Unit + Component |
