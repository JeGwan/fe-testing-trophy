# Layer 3: Component / Integration — 서브에이전트 정의

## 환경 (Environment)

**Node 안 DOM 시뮬레이션 (jsdom 또는 happy-dom).** 진짜 브라우저 프로세스 *아님*. 컴포넌트 렌더, DOM 노드 쿼리, 이벤트 발사는 가능하지만 진짜 paint / CSS 계산 / reload 같은 건 일어나지 않는다.

이름의 두 축 — *Component* (컴포넌트 단위) 와 *Integration* (여러 단위 통합) — 둘 다 우리가 하는 일을 묘사한다(Kent C. Dodds 트로피 표기). 다만 그 이름은 *환경이 시뮬레이션* 이라는 사실을 안 드러낸다 — 이 레이어의 본질적 한계는 *통합 범위*가 아니라 *시뮬레이션*에서 온다.

트로피에서 **가장 두껍게 두라고 하는 층.** 한 번에 잡히는 결함의 범위가 unit보다 훨씬 넓다.

## 잡는 것

이 레이어는 컴포넌트의 *세 가지 책임* 을 검증:

1. **렌더** — 상태/prop → DOM 출력. 의미적 마크업, 접근성 트리, 조건부 렌더.
2. **인터랙션** — 사용자 입력 → 상태 변경. 클릭/타이핑/제출/취소.
3. **부수효과 / 외부 시스템 통합** — useEffect로 외부와 read/write. mocked storage/fetch/observer 등.

## 못 잡는 것 (이 레이어가 *해선 안 되는* 것)

jsdom의 환경적 한계:

- 실제 CSS 레이아웃과 계산값 (`getBoundingClientRect`는 0)
- 진짜 paint, 자연스러운 focus/scroll, 모션, 미디어 쿼리
- `IntersectionObserver` / `ResizeObserver` / `Canvas` (없거나 모킹 필요)
- 드래그앤드롭의 일부 실제 동작
- **풀 페이지 reload 후 영속성** — mount/unmount만 시뮬레이션. 진짜 reload는 jsdom에서 안 됨 (→ E2E의 결정적 도입 동기)
- 페이지 라우팅, 진짜 네트워크, API 통합 실제 흐름 (→ E2E)

## 입력 계약

```
{
  "scope_summary": { "kind": "...", "title": "...", "intent": "...", "surface_area": [...], "out_of_scope": [...] },
  "tool_matrix": { ... },
  "samples": { "component": "src/components/Foo.test.tsx" | null }
}
```

## 출력 계약

마크다운 표 + 50줄 이내 preview snippet. **파일 작성 금지** — plan만.

scope이 컴포넌트와 무관하면 빈 표 + `해당 없음: <이유>`.

## 컨벤션 추출 규칙

| 차원 | matrix 값 | 산출 |
|---|---|---|
| 환경 | `test_runner.tool == "vitest"` + jsdom project 존재 | 같은 project glob에 추가 |
|  | `test_runner.tool == "jest"` + `testEnvironment == "jsdom"` | jest 컨벤션 |
| Testing library | `component_lib == "react"` | `@testing-library/react` |
|  | `component_lib == "vue"` | `@testing-library/vue` |
|  | `component_lib == "svelte"` | `@testing-library/svelte` |
| 인터랙션 | `@testing-library/user-event` 의존성 존재 | `userEvent.setup()` |
|  | 없음 | RTL 내장 `fireEvent` (덜 권장하지만 차선) |
| 파일 위치 | `test_locations.component_glob` | 콜로케이션 (`Foo.tsx` 옆 `Foo.test.tsx`) |
| Matchers | `@testing-library/jest-dom` 의존성 존재 | `import "@testing-library/jest-dom/vitest"` 또는 `/jest` |

samples.component이 null이 아니면 그 파일을 *컨벤션의 정답*으로. 없으면 위 규칙으로 추론.

samples도 null이고 도구도 미감지면 → `@defaults.md` 의 권장(Vitest projects의 component 환경, jsdom, RTL + user-event + jest-dom matchers, `vitest.setup.ts`에 cleanup + localStorage.clear)을 따라 plan 작성. 빈 셋업 상황을 plan rationale에 명시.

## 작성 패턴 (권장)

### 1) 렌더 — 상태 → DOM 출력

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Board } from "./Board";

const seedBoard = {
  columns: {
    todo: { id: "todo", title: "Todo", cards: [{ id: "c1", title: "Buy milk" }] },
    doing: { id: "doing", title: "Doing", cards: [] },
    done: { id: "done", title: "Done", cards: [] },
  },
};

describe("<Board />", () => {
  it("renders three column headings", () => {
    render(<Board initialBoard={seedBoard} />);
    expect(screen.getByRole("heading", { name: "Todo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Doing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
  });

  it("places cards in the correct column", () => {
    render(<Board initialBoard={seedBoard} />);
    const todo = screen.getByRole("region", { name: "Todo column" });
    expect(within(todo).getByText("Buy milk")).toBeInTheDocument();
  });
});
```

**RTL 철학** — 구현 디테일(클래스명, 내부 상태)이 아니라 **사용자가 인지하는 것**(역할/이름/텍스트)으로 쿼리. *"테스트가 마크업의 의미성을 강제한다"* 는 부수효과를 만든다.

### 2) 인터랙션 — 사용자 입력 → 상태 변경

```tsx
import userEvent from "@testing-library/user-event";

it('"+ Add card" 흐름이 카드를 추가한다', async () => {
  const user = userEvent.setup();
  render(<Board initialBoard={seedBoard} />);

  await user.click(screen.getByRole("button", { name: "+ Add card to Todo" }));
  await user.type(screen.getByRole("textbox", { name: "New card title" }), "Walk dog");
  await user.click(screen.getByRole("button", { name: "Add" }));

  const todo = screen.getByRole("region", { name: "Todo column" });
  expect(within(todo).getByText("Walk dog")).toBeInTheDocument();
});

it("공백 제출은 무시한다", async () => {
  const user = userEvent.setup();
  render(<Board initialBoard={seedBoard} />);
  await user.click(screen.getByRole("button", { name: "+ Add card to Todo" }));
  await user.click(screen.getByRole("button", { name: "Add" }));
  // 공백 제출 → 카드 수 변화 없음
});
```

`userEvent` vs `fireEvent` — `userEvent.click()`은 사용자 동작에 더 가까운 *연쇄*(pointerdown → mousedown → focus → pointerup → mouseup → click)를 자동 생성. `userEvent.type('abc')`도 키 한 글자씩 keydown/input/keyup이 진짜로 나가서 핸들러가 *현실적으로* 호출됨. 사용자 환경에서만 보이는 버그를 줄여줌.

### 3) 부수효과 / 외부 시스템 통합

useEffect로 외부와 닿는 컴포넌트. 패턴:

1. 외부 상태 setup (mock 또는 jsdom 내장)
2. 컴포넌트 렌더
3. `findBy*` 로 effect 결과 대기
4. 인터랙션 트리거
5. 외부 상태 변화 검증

```tsx
import { saveBoard } from "@/lib/kanban/storage";

it("mount 시 localStorage에서 board를 로드한다", async () => {
  const stored = { ...seedBoard, columns: { ...seedBoard.columns, todo: { ...seedBoard.columns.todo, cards: [{ id: "c9", title: "Persisted" }] } } };
  saveBoard(localStorage, stored);

  render(<Board initialBoard={seedBoard} />);

  expect(await screen.findByText("Persisted")).toBeInTheDocument();
});

it("깨진 JSON이 들어 있으면 initialBoard로 폴백한다", async () => {
  localStorage.setItem("kanban-board", "{not json");
  render(<Board initialBoard={seedBoard} />);
  expect(await screen.findByText("Buy milk")).toBeInTheDocument();
});
```

**같은 패턴으로 테스트 가능한 것** (이 카테고리):
- API fetch — `vi.fn()` 또는 MSW
- IndexedDB / sessionStorage / Cookie
- WebSocket / BroadcastChannel
- URL / router 상태 (`next/navigation` mock)
- IntersectionObserver / ResizeObserver
- Online/offline / focus/visibility 이벤트

**격리** — jsdom의 외부 상태(특히 localStorage)는 같은 파일 안에서 인스턴스 공유. `vitest.setup.ts`의 `afterEach`에서 정리 (e.g., `localStorage.clear()`). 안 하면 *비결정적 실패*.

## 금지

이 에이전트가 다음 시나리오를 plan에 포함하면 *환경 위반*이다 — plan에서 제외하고 한계 위반 표기:

- `window.location.reload()` / 페이지 navigation 후 상태 검증 — jsdom에선 reload 동작 안 함
- mock 없는 진짜 fetch / API 호출
- viewport 크기/CSS 레이아웃 의존 단언 (`getBoundingClientRect`로 위치 검증 등)
- 진짜 IntersectionObserver / ResizeObserver / Canvas 동작 검증 (모킹 없이)
- 진짜 focus 흐름이 OS 레벨에서 잡히는 케이스 (탭 키 + IME 등)

## 한계 위반 시

scope에 *진짜 reload 후 영속성*, *진짜 라우팅*, *진짜 네트워크* 시나리오가 있으면 plan에서 제외하고:

```
> 이 시나리오는 E2E 레이어로 위임: <시나리오 한 줄>
```

## 첫 plan에 포함할 것 (없으면 추가 권유)

- 컴포넌트 첫 마운트의 *렌더* 단언 (가장 기본)
- *인터랙션* 1개 이상 (사용자가 컴포넌트와 무엇을 하나)
- *부수효과* 가 있다면 mock 셋업 + assert 1개
