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

## CI Pipeline

`.github/workflows/ci.yml` — `push`/`pull_request` → `main` 시 트리거. 단일 job에서 **순차(fail-fast)** 로 실행한다. 같은 ref의 이전 실행은 `concurrency`로 자동 취소.

| 순서 | 검사 | 도구 | 로컬 명령 | 도입 단계 |
|---|---|---|---|---|
| 1 | Lint | ESLint (flat config, `eslint-config-next`) | `npm run lint` | Step 1 |
| 2 | Typecheck | `tsc --noEmit` | `npm run typecheck` | Step 1 |
| 3 | Test (unit + component) | Vitest (+ jsdom + RTL) | `npm run test` | Step 2 / Step 3 |
| 4 | Build | `next build` (Turbopack) | `npm run build` | Step 1 |

### 1. Lint — 가장 빠른 1차 방어선

- **무엇을 잡는가**: 잘못 import된 모듈, 안 쓰는 변수, React/Next 규칙 위반(예: `<Link>` 대신 `<a>` 등), 명백한 안티패턴
- **왜 먼저 도는가**: 가장 빠르고(수 초), fail-fast로 다음 단계 비용을 절약
- **잡지 못하는 것**: 타입 오류, 런타임 오류, 테스트 실패, 빌드 단계에서만 드러나는 라우팅/RSC 경계 위반

### 2. Typecheck — 정적 정합성 검증

- **무엇을 잡는가**: 타입 불일치, 존재하지 않는 속성/메서드 호출, 옵셔널 체이닝 누락, 함수 시그니처 위반
- **lint와의 차이**: ESLint는 *문법/패턴* 위주, tsc는 *타입 시스템* 위주. 영역이 겹치지 않으므로 둘 다 필요
- **부가 효과**: `tsc --noEmit`은 src 전체를 검사하므로 **테스트 파일의 타입 오류도 함께 잡힌다**
- **잡지 못하는 것**: 런타임 동작, 비즈니스 로직의 정확성

### 3. Test — 비즈니스 로직과 컴포넌트 출력의 정확성

CI 파이프라인 관점에선 한 step (`vitest run`)이지만, *테스트 대상의 레이어* 가 둘로 나뉜다. 새 레이어가 필요한 이유와 그 한계를 명확히 분리해서 본다.

- **왜 typecheck 다음, build 전인가**: build보다 빠르고, build보다 더 의미 있는 회귀를 잡을 수 있다 (정확성 ≫ 단순 컴파일 가능성).

#### 3-1. 단위 테스트 — 도메인 순수 함수 (Step 2 도입)

- **대상**: `src/lib/kanban/`의 순수 함수 (`createBoard`, `addCard`, `moveCard`, `removeCard`)
- **무엇을 잡는가**: 도메인 로직이 의도대로 동작하는지. 타입이 맞아도 로직이 틀리면 lint/typecheck/build 모두 통과한다.
- **설계 포인트**: 부수효과(id 생성 등)를 호출자에게 위임 → 함수가 결정적(deterministic)이 되어 테스트가 단순해진다. "unknown id면 board 그대로 반환" 같은 정책도 테스트로 명시화 (`moveCard`가 카드를 잃어버리지 않는 안전성).
- **다루지 못하는 것**: 컴포넌트 렌더링, 사용자 인터랙션, API 통신.

#### 3-2. 컴포넌트 테스트 — 가상 DOM 렌더 (Step 3 도입)

- **대상**: `src/components/`의 React 컴포넌트
- **실행 환경**: **jsdom** — Node.js 안에서 브라우저 DOM API를 JS로 흉내 낸 시뮬레이션. 진짜 브라우저는 안 뜬다. 컴포넌트를 렌더하고 DOM 노드를 쿼리/이벤트 발사할 수 있다.
- **도구**: Vitest + jsdom + `@testing-library/react` (RTL) + `@testing-library/jest-dom` (matchers)
- **무엇을 잡는가**: 컴포넌트의 렌더링 출력, prop 배선 (특정 컬럼에 특정 카드가 들어가는가), 조건부 렌더, 접근성 트리(`getByRole`로 쿼리 가능한가) 등.
- **테스트 작성 원칙 (RTL 철학)**: 구현 디테일(클래스명, 컴포넌트 내부 상태)이 아니라 **사용자가 인지하는 것** (역할/이름/텍스트)으로 쿼리한다. 그래서 `<Board />`도 `<section aria-label="Todo column">`처럼 의미 있는 마크업을 우선 설계.
- **다루지 못하는 것** (jsdom 시뮬레이션 한계 + 도구 선택의 결과):
  - 실제 CSS 레이아웃과 계산값 (`getBoundingClientRect`는 0을 반환)
  - 진짜 paint, 자연스러운 focus/scroll, 모션, 미디어 쿼리
  - `IntersectionObserver` / `ResizeObserver` / `Canvas` (없거나 모킹 필요)
  - 드래그앤드롭의 일부 실제 동작
  - 사용자 인터랙션 (클릭/입력 → 상태 변경) — 현재 정적 렌더만 검증. **`@testing-library/user-event`는 Step 4에서 추가 예정**.
  - 페이지 라우팅, 데이터 fetching, API 통합 — 풀 E2E의 영역

#### 테스트 환경 설계 결정들

- **jsdom vs happy-dom**: 스펙 충실도가 더 높은 jsdom 선택. happy-dom이 더 빠르지만 일부 API가 빠져있어 학습 단계에서 헤매기 쉬움. 이 트레이드오프는 [vitest 환경 비교 문서](https://vitest.dev/config/#environment) 참고.
- **`environment: 'jsdom'`을 글로벌 기본값**: 순수 함수 테스트도 같이 jsdom에서 도는데 오버헤드가 미미하다 (jsdom 셋업은 한 번). 파일별로 `// @vitest-environment node`로 분리할 수 있지만 학습 단계에선 단순함이 더 가치 있음.
- **명시적 `cleanup()` 등록**: `vitest.setup.ts`에서 `afterEach(cleanup)`을 직접 호출. RTL은 보통 자동 등록하지만 Vitest의 `globals: false` (기본값) 환경에선 자동 등록이 안 되므로 수동 등록 필요. *없으면 테스트들이 같은 `document.body`에 누적되어 `getByRole`가 "multiple elements" 에러를 낸다* — 실제로 한 번 마주쳤음.
- **`resolve.alias`로 `@/*` 별칭 매칭**: tsconfig의 `paths`와 동일하게 Vitest도 `@/*`를 `src/*`로 해석하도록 `vitest.config.ts`에 명시. 별도 플러그인 없이 한 줄로 끝.
- **`globals: false` 유지**: `describe/it/expect`를 명시적으로 import. 보일러플레이트는 살짝 늘지만 IDE 자동완성/타입 추론이 더 명확하고, 어떤 테스트 러너의 API를 쓰는지가 코드에서 보인다.

### 4. Build — 마지막 통합 검증

- **무엇을 잡는가**: Next.js 컴파일 오류, RSC/Client Component 경계 위반, 라우트 설정 오류, 정적 생성 실패, `next-env.d.ts` 변경 등 프레임워크 수준의 정합성
- **왜 마지막인가**: 가장 비용이 크고(수십 초~수 분), 앞 단계가 모두 통과해야 의미가 있다
- **잡는 것의 일부**: `next build`는 내부적으로 한 번 더 타입체크를 돌리므로 typecheck와 일부 중복되지만, **Next.js가 자동 생성하는 타입(예: 라우트 타입)** 에 대한 검증은 build에서만 가능
- **다루지 못하는 것**: 런타임 동작, 외부 시스템 연동 (DB/API)

### 워크플로우 디자인 결정들

- **단일 job + 순차 step**: 단순함이 우선. 나중에 검사가 늘어나거나 빌드가 무거워지면 병렬 job으로 분리하는 학습 단계를 따로 두기로 함.
- **`npm ci`** (not `npm install`): lockfile 기반 결정적 설치
- **`actions/setup-node`의 npm 캐시**: 재실행 시 의존성 다운로드 시간 절약
- **`concurrency.cancel-in-progress`**: 같은 브랜치에 새 push가 오면 진행 중이던 이전 실행을 취소해서 러너 시간 낭비 방지

### 알려진 경고 (TODO)

- GH Actions가 `actions/checkout@v4`, `actions/setup-node@v4` 내부에서 사용하는 Node.js 20이 deprecated. 2026-06-02부터 기본값이 Node 24로 강제됨. 액션의 다음 메이저 버전이 나오면 갱신 예정.

---

## Steps (학습 진행)

각 단계는 별도 커밋이며, 커밋 히스토리가 그대로 학습 트레이스가 된다.

| Step | 목표 | 도입한 도구/검사 | 누적 테스트 수 |
|---|---|---|---|
| 0 | 보일러플레이트 | `create-next-app` 기본값 | 0 |
| 1 | 기본 CI 3종 | ESLint, tsc, `next build`, GitHub Actions | 0 |
| 2 | 도메인 + 단위 테스트 | Vitest, 칸반 순수 함수 | 9 |
| 3 | UI 정적 렌더 + 컴포넌트 테스트 | jsdom, `@testing-library/react`, `@testing-library/jest-dom` | 12 |
| 4 | (예정) 사용자 인터랙션 | `@testing-library/user-event` | TBD |

---

## Project structure

```
src/
  app/
    page.tsx                 # 시드 보드를 만들어 <Board /> 렌더
    layout.tsx
  components/
    Board.tsx                # Server Component, board prop을 받아 컬럼/카드 렌더
    Board.test.tsx           # 컴포넌트 테스트 (jsdom + RTL)
  lib/
    kanban/
      types.ts               # Board / Column / Card 타입
      board.ts               # 순수 함수 (createBoard, addCard, moveCard, removeCard)
      board.test.ts          # 도메인 단위 테스트
vitest.config.ts             # jsdom 환경, @/* alias, setupFiles
vitest.setup.ts              # jest-dom matchers + RTL cleanup 등록
.github/workflows/
  ci.yml                     # CI 워크플로우
```

---

## 로컬 명령 모음

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| 테스트 (1회, 단위 + 컴포넌트) | `npm run test` |
| 테스트 (watch) | `npm run test:watch` |
| Production 빌드 | `npm run build` |
| **CI 검사 전체** | `npm run ci` |
