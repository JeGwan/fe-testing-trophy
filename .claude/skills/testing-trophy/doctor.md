# doctor — 트로피 레이어 커버리지 진단

cwd 레포의 4 레이어 상태를 부울 체크리스트로 진단한다. **읽기 전용** + 로그 파일 1개.

LoC %가 척도가 아니라 *환경별로 무엇을 잡고 있는가*가 척도다.

## Step A — tool matrix 산출

`@detect.md` 절차로 cwd의 tool matrix를 만든다. 결과를 `M`으로 부른다.

`M.test_runner == null && M.lint == null && M.type == null`이면 → "거의 빈 레포 — 처음부터 시작하시려면 fe-testing-trophy 같은 레퍼런스를 보고 직접 셋업 권장" 메시지 후 종료.

## Step B — 4 레이어 진단을 병렬로

한 메시지에서 Agent 도구 4개 호출 (sonnet 모델). **반드시 한 번의 응답에서 4개 모두 보낸다.**

각 Agent의 description / prompt:

### Agent 1: Static layer

- description: "Static 레이어 진단"
- prompt:

```
Testing Trophy의 Static 레이어(실행 안 함, 컴파일타임)를 진단해줘. 도구가 아닌 *환경적 책임*으로 평가:

cwd: {repo_root}
tool_matrix:
{M JSON 인라인}

체크 항목 (각각 ✅/⚠️/❌ + 한 줄 근거):
1. Lint: config 존재 + strict 룰셋 활성(예: eslint recommended/core-web-vitals 또는 biome recommended)
2. Type: tsconfig.json strict + noEmit (또는 별도 typecheck 진입점)
3. CI에 lint step 포함
4. CI에 typecheck step 포함
5. CI에 build step 포함 (build도 *정적 검증*에 속함 — 프레임워크 수준 정합성 잡음)

읽기만 해라. 파일 만들지 마. 결과는 마크다운 표로 반환.
```

### Agent 2: Unit layer

- description: "Unit 레이어 진단"
- prompt:

```
Testing Trophy의 Unit 레이어(Node, no DOM)를 진단해줘.

cwd: {repo_root}
tool_matrix:
{M JSON 인라인}

체크 항목:
1. unit-only 환경 분리 (vitest projects with environment:node, 또는 jest projects, 또는 별도 ts-node 단위 테스트 디렉토리)
2. 순수 함수 단위 테스트 파일 존재 (M.test_locations.unit_glob 위치에 *.test.{ts,js})
3. 외부 의존성 주입(DI) 패턴 흔적 — 함수 시그니처가 storage/clock/random/fetch 같은 외부 시스템을 인자로 받는지. 샘플 1~2개 grep으로 확인
4. CI에 unit step 분리 (또는 통합 test step에서 unit이 도는지)

읽기만. 결과는 마크다운 표.
```

### Agent 3: Component / Integration layer

- description: "Component 레이어 진단"
- prompt:

```
Testing Trophy의 Component/Integration 레이어(jsdom 또는 happy-dom 시뮬레이션)를 진단해줘.

cwd: {repo_root}
tool_matrix:
{M JSON 인라인}

체크 항목:
1. component 환경 (jsdom/happy-dom) 활성: vitest projects 또는 jest testEnvironment
2. setup 파일 존재 + afterEach cleanup + jest-dom matchers 등록 + storage isolation
3. 컴포넌트 테스트 파일 존재 (M.test_locations.component_glob)
4. a11y 쿼리 사용 (getByRole / findByRole / within) 흔적 — 1~2개 grep 샘플
5. userEvent 또는 동등 인터랙션 라이브러리 사용
6. CI에 component step 분리 또는 통합 test step에 포함

읽기만. 결과는 마크다운 표.
```

### Agent 4: E2E layer

- description: "E2E 레이어 진단"
- prompt:

```
Testing Trophy의 E2E 레이어(실 브라우저 + prod 빌드)를 진단해줘.

cwd: {repo_root}
tool_matrix:
{M JSON 인라인}

체크 항목:
1. e2e config 존재 (playwright/cypress)
2. webServer 자동 기동 + reuseExistingServer 분기
3. *환경 한계 정당화* 시나리오 존재 — reload-persistence, 진짜 라우팅, 진짜 네트워크 같이 *jsdom으로는 못 잡는* 시나리오. e2e 테스트 파일들 grep해서 page.reload / page.goto / network.* 같은 시그너처 1~2개 샘플
4. CI 분기 (retries: CI ? 2 : 0, reporter: github vs list)
5. CI에 e2e step

읽기만. 결과는 마크다운 표.
```

## Step C — 리포트 합치기

4 Agent 결과를 합쳐 **stdout에 마크다운 리포트** + 동시에 `<repo>/.claude/testing-trophy/logs/<YYYYMMDDHHmmss>.md`에 저장.

```bash
mkdir -p {repo_root}/.claude/testing-trophy/logs
# 파일명: <YYYYMMDDHHmmss>.md (콜론·공백 없는 안전 포맷, 크로스플랫폼 호환)
```

### 리포트 포맷

```markdown
# Testing Trophy 진단 — {repo basename}

생성: {timestamp}  
경로: {repo_root}

## 감지된 도구 매트릭스

| 차원 | 값 |
|---|---|
| Framework | {M.framework} {M.framework_version} |
| Lint | {M.lint.tool} ({M.lint.config_path}) |
| Type | {M.type.tool} (strict={M.type.strict}, noEmit={M.type.noEmit}) |
| Test runner | {M.test_runner.tool} (projects={M.test_runner.has_projects}) |
| Component lib | {M.component_lib} + {M.testing_library} |
| E2E | {M.e2e.tool} ({M.e2e.config_path}) |
| CI | {M.ci.path} (트로피 라벨={M.ci.trophy_layer_labels}) |

미감지 차원: {M.missing_dimensions}

## 1. Static (실행 안 함, 컴파일타임)

{Agent 1 결과 표}

## 2. Unit (Node, no DOM)

{Agent 2 결과 표}

## 3. Component / Integration (jsdom 시뮬레이션)

{Agent 3 결과 표}

## 4. E2E (실 브라우저 + prod 빌드)

{Agent 4 결과 표}

## 결론

{보강 분기 또는 충분 분기 — 아래 규칙대로}
```

### 결론 분기 규칙

**모든 항목 ✅ (보강 권장 없음)** — 트로피 4 레이어 모두 통과:

```markdown
## 결론

✅ **충분합니다.** 트로피 4 레이어가 모두 갖춰져 있고 환경적 책임을 정확히 분담하고 있다. 추가 작업 없음.

> 새 기능을 추가할 때는 `/testing-trophy make <scope>` 로 레이어별 테스트 plan 받기.
```

이 분기에서 *시나리오 확장 권유*, *보강 항목 추가 발굴*, *"더 할 수 있는 것"* 같은 일감 던지기 **금지**. doctor의 목적은 *부족한 부분 식별*이지 *완벽한 레포에 일감 추가*가 아니다.

**부분 ❌/⚠️ (보강 권장 있음)** — 하나 이상 비어있는 레이어:

```markdown
## 다음 액션 {N}개

1. {가장 비어있는 레이어 + 권장 도구 + 시작점}
2. {두 번째}
3. {세 번째}

> 다음 단계: `/testing-trophy make <scope>` 로 dry-run plan 받기.
```

도구 권장은 `@defaults.md` 의 권장 매트릭스 인용. 감지된 도구가 권장과 다르면 *감지된 쪽 우선* — 권장은 *감지 실패 차원에서만* 적용. 우선순위 (트로피 *아래에서 위로* 실행 순서, 비어있는 레이어 우선):
- Static이 ❌면 1순위 (모든 레이어의 기반)
- Unit이 ❌면 2순위 (가장 두텁게 두는 층)
- Component가 ❌면 3순위
- E2E가 ❌면 4순위

액션 개수는 *비어있는 만큼* — 다 차있으면 0개(충분 분기), 하나 비어있으면 1개. *3개를 억지로 채우지 마.*

## Step D — gitignore 권유

`<repo>/.gitignore`에 `.claude/testing-trophy/` 가 없으면 stdout 끝에:

```
> 📝 권장: `.gitignore`에 `.claude/testing-trophy/` 추가 (자동 추가는 안 함)
```

자동으로 .gitignore를 수정하지 *않는다* — 임의 레포에 부수효과 금지.

## Step E — 종료

- stdout 출력 완료
- 로그 파일 경로 한 줄 안내: `📁 진단 로그: {repo_root}/.claude/testing-trophy/logs/{timestamp}.md`
