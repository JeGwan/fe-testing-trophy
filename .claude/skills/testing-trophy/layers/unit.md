# Layer 2: Unit — 서브에이전트 정의

## 환경 (Environment)

**Node.js, no DOM.** jsdom/happy-dom 부팅 *없음*. 가장 빠르고 안정적이라 트로피에서 두텁게 둘 가치가 있다.

이 레이어의 본질적 한계는 *환경*에서 온다 — DOM이 없으므로 컴포넌트나 브라우저 API를 검증할 수 없다.

## 잡는 것

- 도메인 순수 함수의 입출력 정확성
- 외부 의존성 주입(DI) 패턴: 함수 시그너처가 storage/clock/random/fetch 같은 외부 시스템을 인자로 받을 때 in-memory mock으로 round-trip 검증
- 직렬화/역직렬화, 깨진 입력에 대한 폴백 정책
- 알 수 없는 ID 등 *경계 케이스* — 명시화하면 회귀 방지
- 부작용 없는(deterministic) 동작의 immutability

## 못 잡는 것 (이 레이어가 *해선 안 되는* 것)

- 컴포넌트 렌더 (→ Component 레이어)
- DOM API 호출 (→ jsdom 부팅 → Component 레이어)
- 진짜 storage/network 동작 (→ E2E)
- 사용자 인터랙션

## 입력 계약

호출자(make.md)에게 받음:

```
{
  "scope_summary": { "kind": "...", "title": "...", "intent": "...", "surface_area": [...], "out_of_scope": [...] },
  "tool_matrix": { ... detect 결과 ... },
  "samples": { "unit": "src/lib/foo/foo.test.ts" | null }
}
```

## 출력 계약

마크다운 표 + 각 항목의 50줄 이내 preview snippet.

```markdown
| path | action | rationale | preview_snippet |
|---|---|---|---|
| src/lib/foo/foo.test.ts | create | foo가 합성 함수라 입출력만 검증 | (코드블록) |
```

scope이 이 레이어와 무관하면 빈 표 + `해당 없음: <이유>`.

**파일 작성 금지** — 메인 thread가 plan 표 받아서 직접 Write. 너는 표만 산출.

## 컨벤션 추출 규칙

`tool_matrix`로부터 다음 결정:

| 차원 | matrix 값 | 산출 |
|---|---|---|
| import | `test_runner.tool == "vitest"` | `import { describe, it, expect } from "vitest"` |
|  | `test_runner.tool == "jest"` | global describe/it/expect (또는 `import` from `@jest/globals` 명시 — 기존 sample이 어느 쪽인지 따른다) |
| 파일 위치 | `test_locations.unit_glob` 매칭되는 콜로케이션 | 같은 디렉토리, `<basename>.test.{ts,js}` |
| 파일 위치 | `test_locations.convention == "__tests__"` | 형제 `__tests__/<basename>.test.{ts,js}` |
| TS/JS | `type.tool == "tsc"` | `.ts` 확장 |
|  | tsc 없음 | `.js` |
| Path alias | `type.paths_alias` | 활성 시 `@/*` import 허용 |

samples.unit이 null이 아니면 그 파일을 *컨벤션의 정답*으로 본다 — describe 네이밍, factory 헬퍼 위치, assert 스타일 모두 거기서 카피.

samples.unit이 null이고 도구도 미감지면 → `@defaults.md` 의 권장(Vitest projects의 unit 환경, `environment: "node"`, `src/lib/**/*.test.ts` 콜로케이션)을 따라 plan 작성. 사용자 레포에 도구가 없는 *빈 셋업* 상황이라는 걸 plan rationale에 명시.

## 작성 패턴 (권장)

### 1) 도메인 순수 함수

```ts
import { describe, it, expect } from "vitest";  // 또는 jest 글로벌
import { addCard, createBoard } from "./board";

const card = (id: string, title: string) => ({ id, title });

describe("addCard", () => {
  it("appends a card to the target column", () => {
    const board = createBoard(["todo", "doing", "done"]);
    const next = addCard(board, "todo", card("c1", "Buy milk"));
    expect(next.columns.todo.cards).toEqual([card("c1", "Buy milk")]);
  });

  it("does not mutate the original board", () => {
    const board = createBoard(["todo"]);
    addCard(board, "todo", card("c1", "x"));
    expect(board.columns.todo.cards).toEqual([]);
  });

  it("returns the board unchanged when columnId is unknown", () => {
    const board = createBoard(["todo"]);
    const next = addCard(board, "missing", card("c1", "x"));
    expect(next).toBe(board);
  });
});
```

### 2) DI 주입형 — 외부 시스템을 *인자로 받게*

```ts
const makeStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
};

describe("saveBoard / loadBoard", () => {
  it("round-trips a board through storage", () => {
    const storage = makeStorage();
    const board = createBoard(["a", "b"]);
    saveBoard(storage, board);
    expect(loadBoard(storage)).toEqual(board);
  });

  it("returns null when storage has invalid JSON", () => {
    const storage = makeStorage();
    storage.setItem("kanban-board", "{not json");
    expect(loadBoard(storage)).toBeNull();
  });
});
```

### 핵심 원칙
- **factory 헬퍼**를 파일 상단에 — 테스트 데이터 생성 비용 절감.
- **immutability 단언**을 1개 이상 — 순수 함수 계약이 보장됨을 명시.
- **알 수 없는 입력**은 그대로 반환하는 정책을 단언으로 — *"카드를 잃어버리지 않는다"* 같은 안전성을 명시화.
- **외부 시스템은 인자로** — 모듈 mocking보다 시그너처로 의존성을 드러내는 게 명시적.

## 금지

- 컴포넌트 import (예: `import Foo from "./Foo.tsx"`) — 환경 위반
- `window` / `document` / `localStorage` 같은 브라우저 글로벌 직접 접근 — Node 환경에서 undefined
- `import "@testing-library/*"` — 컴포넌트 도구
- 파일시스템/네트워크 실 I/O — 단위 테스트가 환경에 의존하면 비결정적
- 외부 시스템 검증을 시도하는 시나리오 (예: 실제 storage flush) — *"이건 E2E로 위임"* 표기 후 plan에서 제외

## 한계 위반 시

scope에서 *jsdom이 필요한 시나리오*가 발견되면 (예: localStorage 부수효과 통합) plan에 포함하지 말고 출력 끝에 명시:

```
> 이 시나리오는 Component 레이어로 위임: <시나리오 한 줄>
```

scope에서 *실 브라우저가 필요한 시나리오*면 E2E로 위임.
