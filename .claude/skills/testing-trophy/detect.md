# detect — cwd 레포의 도구 매트릭스 감지

doctor와 make가 공통으로 사용하는 전처리. **읽기 전용, 부수효과 없음.**

## 산출물 (tool matrix)

다음 JSON을 산출한다:

```json
{
  "repo_root": "/abs/path/to/repo",
  "package_manager": "npm" | "pnpm" | "yarn" | "bun" | null,
  "lint": {
    "tool": "eslint-flat" | "eslint-legacy" | "biome" | null,
    "config_path": "eslint.config.mjs" | ".eslintrc.json" | "biome.json" | null,
    "strict_signals": ["..."]
  },
  "type": {
    "tool": "tsc" | "flow" | null,
    "config_path": "tsconfig.json" | null,
    "strict": true | false,
    "noEmit": true | false,
    "paths_alias": { "@/*": ["./src/*"] } | null
  },
  "framework": "next" | "vite" | "astro" | "nuxt" | "remix" | "create-react-app" | null,
  "framework_version": "16.x" | null,
  "test_runner": {
    "tool": "vitest" | "jest" | null,
    "config_path": "vitest.config.ts" | "jest.config.js" | null,
    "has_projects": true | false,
    "projects": [
      { "name": "unit", "environment": "node", "include": ["src/lib/**/*.test.ts"] },
      { "name": "component", "environment": "jsdom", "setupFiles": ["./vitest.setup.ts"], "include": ["src/components/**/*.test.tsx"] }
    ]
  },
  "component_lib": "react" | "vue" | "svelte" | "solid" | null,
  "testing_library": "@testing-library/react" | "@testing-library/vue" | "@testing-library/svelte" | null,
  "e2e": {
    "tool": "playwright" | "cypress" | null,
    "config_path": "playwright.config.ts" | "cypress.config.ts" | null,
    "test_dir": "e2e" | "cypress/e2e" | "tests/e2e" | null
  },
  "ci": {
    "exists": true | false,
    "path": ".github/workflows/ci.yml" | null,
    "steps": ["lint", "typecheck", "test:unit", "test:component", "build", "e2e"],
    "trophy_layer_labels": true | false
  },
  "test_locations": {
    "unit_glob": "src/lib/**/*.test.ts",
    "component_glob": "src/components/**/*.test.tsx",
    "e2e_glob": "e2e/**/*.spec.ts",
    "convention": "colocated" | "__tests__" | "tests-dir" | "mixed"
  },
  "scripts": {
    "lint": "eslint" | null,
    "typecheck": "tsc --noEmit" | null,
    "test_unit": "vitest run --project unit" | null,
    "test_component": "vitest run --project component" | null,
    "test_all": "vitest run" | "jest" | null,
    "build": "next build" | "vite build" | null,
    "e2e": "playwright test" | "cypress run" | null,
    "ci": "npm run lint && ..." | null
  },
  "missing_dimensions": ["e2e", "ci", ...]
}
```

## 절차

1. **repo_root 결정** — `git rev-parse --show-toplevel` 시도. 실패하면 cwd.

2. **package.json 읽기** — 의존성으로 다음 추론:
   - `next` → framework=next, `react` 동반 시 component_lib=react
   - `vite` → framework=vite (단 `@vitejs/plugin-react` 등으로 component_lib 추론)
   - `vue` / `@vue/*` → component_lib=vue
   - `svelte` → component_lib=svelte
   - `vitest` → test_runner.tool=vitest
   - `jest` → test_runner.tool=jest
   - `@testing-library/react` / `vue` / `svelte` → testing_library 결정
   - `@playwright/test` → e2e.tool=playwright
   - `cypress` → e2e.tool=cypress
   - `eslint` → lint.tool=eslint-* (config 파일로 flat/legacy 구분)
   - `@biomejs/biome` → lint.tool=biome
   - `typescript` → type.tool=tsc

3. **lock 파일로 package_manager 결정** — `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb`.

4. **lint config 파일 존재 확인** — `eslint.config.{js,mjs,cjs,ts}` 우선(flat), 없으면 `.eslintrc.{js,json,yml,cjs}` (legacy), 그 외 `biome.json`. `strict_signals`는 config 안의 `strict`/`recommended`/`core-web-vitals` 등 키워드 골라 담기 (한 번 read해서 토큰 매칭).

5. **tsconfig.json 읽기** — `compilerOptions.strict`, `noEmit`, `paths` 추출. JSONC 주석 허용.

6. **framework config 존재 확인** — `next.config.{ts,js,mjs}`, `vite.config.{ts,js}`, `astro.config.*`, `nuxt.config.*`. 동시에 존재하면 의존성 우선.

7. **test_runner config 읽기** — vitest config가 있으면:
   - `defineConfig` 안 또는 별도 export로 `projects` 배열이 있는지
   - 각 project의 `name`, `environment`(node/jsdom/happy-dom), `include`, `setupFiles`
   - 직접 정규식이나 간단한 AST 파싱으로 충분(완벽할 필요 없음 — 못 읽으면 `null` + missing_dimensions에 추가)
   - jest는 `testEnvironment`, `projects`, `setupFilesAfterEach` 등.

8. **e2e config 읽기** — playwright는 `webServer`, `retries`, `reporter`, `use.baseURL`, `testDir`. cypress는 `e2e.specPattern`, `baseUrl`.

9. **CI 워크플로우 스캔** — `.github/workflows/*.yml` 파일들의 step `name` 수집. 트로피 번호 prefix(`1.x`, `2`, `3`, `4`)가 보이면 `trophy_layer_labels=true`.

10. **테스트 파일 위치 추정** — `git ls-files` 또는 `find`로 다음 패턴 매칭:
    - `**/*.test.{ts,tsx,js,jsx}` 콜로케이션
    - `**/__tests__/**`
    - `tests/**/*.{test,spec}.*`
    - `e2e/**/*.spec.*` 또는 `cypress/e2e/**/*.cy.*`
    
    가장 많이 매칭되는 컨벤션을 `convention`으로. unit/component/e2e glob은 *기존 파일이 어디 있는지*로 추정 (없으면 framework 기본값).

11. **scripts 추출** — `package.json`의 `scripts` 그대로.

12. **missing_dimensions** — 위 단계에서 결정 못 한 차원 모두 나열. 이게 *"모르는 건 추론 안 한다"*의 근거.

13. **recommended (감지 실패 차원만)** — `null`로 떨어진 차원에 대해 `@defaults.md` 의 권장 매트릭스를 참조해 별도 키 `recommended.<차원>` 에 채워라 (감지된 값과 절대 같은 키에 넣지 마). 예: `lint.tool == null` 이면 `recommended.lint = "eslint-flat + eslint-config-next"`. 자동 적용 안 함 — 사용자 안내 전용.

## 출력 방식

이 detect 단계는 stdout에 매트릭스를 *직접 노출하지 않는다*. 호출자(doctor.md / make.md)에게 객체로 전달. 사용자가 보고 싶으면 doctor 리포트에 요약된 형태로 포함.

## 실패 모드

- `package.json` 자체가 없음 → "여기 JS/TS 프로젝트 아닌 것 같다. /testing-trophy는 JS/TS 레포에서만 동작" 메시지 후 종료.
- 어느 차원도 감지 안 됨(전부 null) → doctor는 "거의 빈 레포 — 처음부터 시작" 분기, make는 거부.

## 구현 노트

- 가능하면 한 번의 패스로 끝낸다. Bash `find`/`cat`/`grep` 조합이면 충분. AST 파서 도입 안 함(과한 의존성).
- vitest config의 `projects`는 TypeScript라서 정확한 파싱이 어렵다 — 정규식으로 `name:`/`environment:`/`include:`/`setupFiles:` 라인을 긁어내는 best-effort. 못 잡으면 missing_dimensions에 `test_runner.projects` 추가.
