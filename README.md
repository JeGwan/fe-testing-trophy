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
| 3 | Test (unit) | Vitest | `npm run test` | Step 2 |
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

### 3. Test (unit) — 비즈니스 로직의 정확성

- **무엇을 잡는가**: 도메인 함수(예: `moveCard`)가 실제로 의도한 동작을 하는지. 타입은 맞아도 로직이 틀리면 lint/typecheck/build 모두 통과한다.
- **왜 typecheck 다음, build 전인가**: build보다 빠르고, build보다 더 의미 있는 회귀를 잡을 수 있다 (정확성 ≫ 단순 컴파일 가능성)
- **현재 범위 (Step 2 기준)**: `src/lib/kanban/`의 순수 함수에 대한 단위 테스트 9개. 부수효과(id 생성 등)는 호출자에게 위임해서 함수를 결정적(deterministic)으로 유지 → 테스트가 단순해짐.
- **다루지 못하는 것**: 컴포넌트 렌더링, 사용자 인터랙션, API 라우트, 페이지 단위 통합 동작

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

| Step | 목표 | 도입한 도구/검사 | 추가된 테스트 수 |
|---|---|---|---|
| 0 | 보일러플레이트 | `create-next-app` 기본값 | 0 |
| 1 | 기본 CI 3종 | ESLint, tsc, `next build`, GitHub Actions | 0 |
| 2 | 도메인 + 단위 테스트 | Vitest, 칸반 순수 함수 | 9 |
| 3 | (예정) UI + 컴포넌트 테스트 | RTL, jsdom 등 | TBD |

---

## Project structure

```
src/
  app/                       # Next.js App Router (페이지)
  lib/
    kanban/
      types.ts               # Board / Column / Card 타입
      board.ts               # 순수 함수 (createBoard, addCard, moveCard, removeCard)
      board.test.ts          # Vitest 단위 테스트
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
| 단위 테스트 (1회) | `npm run test` |
| 단위 테스트 (watch) | `npm run test:watch` |
| Production 빌드 | `npm run build` |
| **CI 검사 전체** | `npm run ci` |
