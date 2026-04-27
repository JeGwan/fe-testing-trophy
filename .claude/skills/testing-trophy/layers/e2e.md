# Layer 4: E2E — 서브에이전트 정의

## 환경 (Environment)

**진짜 브라우저 프로세스 + 진짜 prod 서버.** 시뮬레이션이 아니라 실재 브라우저 — paint, CSS 계산, reload, 진짜 storage flush 모두 *진짜로* 일어남.

트로피의 꼭대기. 수가 적고 핵심 흐름만.

## 잡는 것

- **풀 페이지 reload 후 영속성** — *jsdom 컴포넌트 테스트는 mount/unmount만 시뮬레이션할 수 있어서 실제 브라우저 reload 후에도 데이터가 살아있는지 절대 검증 못 한다.* localStorage write가 stable storage로 flush되어 reload 후 다시 읽히는 풀 사이클은 진짜 브라우저에서만 검증 가능.
- 진짜 CSS 레이아웃과 paint, focus 동작
- 페이지 라우팅, 페이지 간 상태 흐름
- 데이터 fetching, API 통합 (있을 경우)
- 실제 브라우저 quirks (Safari/Chrome 차이는 멀티 브라우저 추가 시)

## 못 잡는 것 / 안 잡아야 하는 것

- *순수 함수의 마이크로 단언* (→ Unit, 100배 빠르고 안정적)
- *단일 컴포넌트의 prop 분기 매트릭스* (→ Component, jsdom으로 충분)
- 아주 사소한 인터랙션 (예: 버튼 hover 색상) — 비용 대비 가치 낮음

E2E는 본질적으로 jsdom보다 시끄럽다(네트워크, 타이밍, paint 차이). flaky를 줄이려면 *시나리오 수를 적게 + 핵심만*.

## 입력 계약

```
{
  "scope_summary": { "kind": "...", "title": "...", "intent": "...", "surface_area": [...], "out_of_scope": [...] },
  "tool_matrix": { ... },
  "samples": { "e2e": "e2e/foo.spec.ts" | null }
}
```

## 출력 계약

마크다운 표 + 50줄 이내 preview snippet. **파일 작성 금지.**

scope이 E2E와 무관하면 빈 표 + `해당 없음: <이유>`.

## 컨벤션 추출 규칙

| 차원 | matrix 값 | 산출 |
|---|---|---|
| 러너 | `e2e.tool == "playwright"` | `@playwright/test`의 `test`/`expect` |
|  | `e2e.tool == "cypress"` | Cypress `cy.*` 체이닝 |
| 위치 | `e2e.test_dir` | 그 디렉토리 안 `*.spec.ts` (playwright) 또는 `*.cy.ts` (cypress) |
| 파일명 | scope 제목 → kebab-case `<feature>.spec.ts` |
| baseURL | `playwright.config.ts`의 `use.baseURL` 또는 `webServer.url` | `page.goto("/")` 상대경로 사용 |

samples.e2e가 null이 아니면 그 파일을 *컨벤션의 정답*으로.

samples도 null이고 도구도 미감지면 → `@defaults.md` 의 권장(Playwright + Chromium만 + `webServer.reuseExistingServer: !CI` + `retries: CI ? 2 : 0` + `e2e/` 디렉토리)을 따라 plan 작성. 빈 셋업 상황을 plan rationale에 명시.

## 작성 패턴 (권장)

### 1) 풀 사용자 흐름

```ts
import { test, expect } from "@playwright/test";

test.describe("Kanban board", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("user can add a card and see it appear in the column", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add card to Todo" }).click();
    await page.getByRole("textbox", { name: "New card title" }).fill("Walk dog");
    await page.getByRole("button", { name: "Add" }).click();

    const todo = page.getByRole("region", { name: "Todo column" });
    await expect(todo.getByText("Walk dog")).toBeVisible();
  });
});
```

### 2) **reload-persistence — 이 레이어의 결정적 정당화**

```ts
test("card persists across full page reload", async ({ page }) => {
  await page.getByRole("button", { name: "+ Add card to Todo" }).click();
  await page.getByRole("textbox", { name: "New card title" }).fill("Walk dog");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Walk dog")).toBeVisible();

  await page.reload();

  await expect(page.getByText("Walk dog")).toBeVisible();
});
```

이 시나리오가 *왜 E2E에만 가능한가* — jsdom은 `page.reload()` 같은 풀 페이지 reload 동작 자체가 없다. localStorage write가 진짜 stable storage로 flush되어 reload 후에도 동일 origin에서 읽히는 풀 사이클은 실 브라우저에서만 검증 가능하다.

### 3) 라우팅 / 페이지 간 흐름 (있으면)

```ts
test("navigating to detail page preserves selected card", async ({ page }) => {
  await page.getByRole("link", { name: "Walk dog" }).click();
  await expect(page).toHaveURL(/\/cards\/[a-z0-9-]+/);
  await expect(page.getByRole("heading", { name: "Walk dog" })).toBeVisible();
});
```

## E2E 환경 설계 결정 (스킬이 *제안*은 하되 자동 수정 안 함)

`samples.e2e`나 기존 config가 다음을 충족 안 하면 plan에 *주석으로* 메모:

- **브라우저 1개 우선** — Chromium만 (`npx playwright install chromium`). 멀티 브라우저는 그게 진짜 가치를 줄 때 추가
- **Build 후 prod 서버** — `next dev`(HMR + 디버깅 미들웨어) 아닌 `next start`(prod 모드)로 테스트
- **`webServer.reuseExistingServer: !process.env.CI`** — 로컬 재사용, CI 새 시작
- **`workers: 1` + `fullyParallel: false`** — 시나리오 수가 적을 때
- **CI에서 `retries: 2`, 로컬은 0** — flaky 분리
- **`reporter: 'github'` (CI) vs `'list'` (로컬)**

> 이건 *제안*이지 자동 수정이 아니다. config 파일 변경은 plan에 명시적으로 포함될 때만 수행 (사용자 승인 필수).

## 금지

- **순수 함수 단위 검증** — 비싸고 느림. Unit으로 위임.
- **단일 컴포넌트 micro 단언** — Component로 위임.
- **선택자에 CSS 클래스/internal id** 사용 — `getByRole`/`getByLabel`/`getByText` 같은 a11y 쿼리 우선. 브리틀하지 않다.
- **API 모킹 없는 외부 의존** — *진짜* 외부 호출은 비결정적. 가능하면 prod 서버에 fixture/시드 데이터로.
- **`waitForTimeout(...)` 같은 임의 대기** — `expect(...).toBeVisible()` 같은 polling assertion 사용.

## 한계 위반 시 (위쪽 레이어로 위임)

scope이 *순수 로직 단위 검증* 이거나 *jsdom으로 충분한 시나리오*이면 plan에서 제외하고:

```
> 이 시나리오는 Unit 또는 Component 레이어로 위임: <시나리오 한 줄>
```

## 첫 plan에 포함할 것 (없으면 추가 권유)

- *풀 사용자 흐름* 1개 (정적 흐름 한 번 끝까지)
- **reload-persistence** 1개 (이 레이어의 결정적 정당화)
- 라우팅/네트워크가 있으면 1개

E2E는 *가장 적게, 가장 핵심만*. 한 시나리오를 더 추가하기 전에 "이게 진짜 다른 레이어로는 못 잡나?" 자문.
