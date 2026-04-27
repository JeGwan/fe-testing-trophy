# defaults — 권장 도구 조합

스킬은 *구현-agnostic* 이라 cwd에서 감지된 도구를 따른다. 하지만 다음 두 경우엔 *권장 셋업*이 필요하다:

1. **빈 레포** — `detect.md` 결과 거의 모든 차원이 null. doctor가 "다음 액션 3개"를 제시하거나 사용자가 처음부터 시작할 때 어떤 도구로 갈지 안내해야 함.
2. **부분 미감지** — 일부 차원만 null (예: lint는 있는데 test runner는 없음). layer 에이전트가 컨벤션을 추측 *하지 않아야* 하지만, 사용자에게 "이거 도입하면 됨"으로 제시할 수 있어야 함.

이 권장은 레퍼런스 레포 `vault/10-워크스페이스/fe-testing-trophy`가 *학습 대화로 한 단계씩 결함을 부딪혀가며* 정착시킨 것 — 정답이 아니라 *방어 가능한 디폴트*.

## 권장 매트릭스 (React/Next 가정)

| 차원 | 권장 | 이유 |
|---|---|---|
| Lint | ESLint flat config + `eslint-config-next` (`core-web-vitals` + `typescript`) | flat config가 미래 표준. Next 프로젝트면 `eslint-config-next` 가 RSC/Link/Image 규칙까지 포함 |
| Type | TypeScript `strict: true` + `noEmit: true` | strict 미적용은 type system을 절반만 쓰는 것. noEmit으로 typecheck 전용 진입점 분리 |
| Test runner | **Vitest 4+** with `projects` | Vitest projects로 unit(node) / component(jsdom) 환경 분리하면 unit이 jsdom 부팅을 *전혀 안 함*. Jest 대비 ESM·TS·Vite 생태계 정합성 우월 |
| Unit env | `environment: "node"` + `include: ["src/lib/**/*.test.ts"]` | DOM 부팅 비용 0ms |
| Component env | `environment: "jsdom"` (happy-dom 아님) | jsdom이 스펙 충실도 더 높음. happy-dom은 빠르지만 일부 API 빠짐 → 학습/디버깅에서 헤맴 |
| Component setup | `@testing-library/jest-dom/vitest` matchers + `afterEach(cleanup)` + `localStorage.clear()` | RTL은 globals:false에서 자동 cleanup 안 됨. localStorage 누수는 비결정적 실패의 1순위 원인 |
| Component lib | **React Testing Library** + `@testing-library/user-event` | a11y role 쿼리가 마크업의 의미성을 강제함. user-event는 `pointerdown→focus→click` 같은 *연쇄*를 자동 생성 → 사용자 환경에서만 보이는 버그 줄임 |
| E2E | **Playwright** (Next 공식 권장) + Chromium만 (`npx playwright install chromium`) | 모든 브라우저 ~700MB → Chromium만 ~92MB. 멀티 브라우저는 진짜 가치 줄 때 추가 |
| E2E config | `webServer.reuseExistingServer: !process.env.CI` + `retries: CI ? 2 : 0` + `reporter: CI ? "github" : "list"` | 로컬은 dev 서버 재사용/즉시 실패, CI는 새 시작/flaky 흡수/PR UI 어노테이션 |
| 글로벌 | `globals: false` (vitest), 명시적 import | 보일러플레이트 살짝 늘지만 IDE 자동완성·타입 추론 명확해짐 |
| Path alias | `tsconfig.paths` + `vitest.config.resolve.alias` 동기화 | `@/*` → `./src/*` 두 군데 같이 |

## Vue / Svelte / Solid

레퍼런스가 React라 위 매트릭스는 React 가정. 다른 라이브러리면:

| 라이브러리 | testing-library |
|---|---|
| Vue 3 | `@testing-library/vue` |
| Svelte | `@testing-library/svelte` |
| Solid | `@solidjs/testing-library` |

E2E·러너·환경(jsdom/node)은 동일.

## 비-권장 (의도적으로 *안* 함)

- **Jest** 신규 도입 — 이미 잘 도는 jest 레포는 그대로. 신규 셋업이면 vitest. 이유: ESM·TS 첫 시민 지원, vite 생태계와 같은 transformer.
- **Cypress** 신규 도입 — Playwright가 multi-context, network mocking, trace viewer 등에서 유리. Cypress 레포는 그대로 유지.
- **happy-dom** — 위 이유.
- **`@testing-library/jasmine`** 등 — RTL은 jest-dom matchers 표준.
- **enzyme** — 더 이상 React 19 호환 아님. 내부 구현 의존 철학이 RTL과 정반대.
- **모든 브라우저 멀티 — Playwright** — 학습/소규모는 Chromium만. 진짜 Safari/Firefox 분기 버그가 나올 때 추가.

## 어떻게 참조되나

- `detect.md` — 감지 실패한 차원의 `recommended` 필드를 이 파일에서 가져와 채움 (단, *감지된 값* 과 혼동 안 되게 별도 키).
- `doctor.md` — 거의 빈 레포일 때 "다음 액션 3개"에서 이 권장을 인용. 또는 ❌ 항목의 "보강 방법" 한 줄.
- `make.md` — `tool_matrix.test_runner == null` 인 가드 분기에서 "vitest 도입 → /testing-trophy doctor 다시" 안내.
- `layers/*.md` — `samples`가 null일 때만 이 권장의 컨벤션을 *제시*. 감지된 도구가 다르면 *감지된 쪽* 우선 (사용자 레포 존중).

## 메타: 왜 권장이 *고정* 인가

도구는 매년 바뀐다. 이 파일은 *2026-04 기준 방어 가능한 디폴트* 며, 시간이 지나면 갱신 필요. last_updated 헤더가 6개월 이상이면 doctor가 stdout 끝에 "이 권장은 N개월 전 기준 — 검토 권장" 메시지 추가하라.

`last_updated: 2026-04-27`
