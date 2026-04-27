# make — scope 기반 트로피 테스트 생성

scope을 받아 Unit/Component/E2E 3개 레이어 서브에이전트를 **병렬로 fan-out** 한다. 각 에이전트는 *dry-run plan*만 산출하고, 메인 thread가 사용자 승인 후 **직접 Write** 한다.

> Static 레이어는 *코드 생성*이 아니라 *config 점검*이라 make에서 제외. 보강은 doctor 리포트의 "다음 액션"에서.

## Step A — scope 파싱

명령 인자를 확인:

| 인자 형태 | 분기 | scope_kind |
|---|---|---|
| 빈 값 | 전체 src 트리 | `full` |
| `https://...atlassian.net/...` 또는 사내 Confluence URL | `mcp__mcp-atlassian__confluence_get_page`로 fetch | `spec_confluence` |
| 다른 URL (https?://) | WebFetch로 텍스트 가져오기 | `spec_url` |
| 끝이 `.md` 인 파일 경로 | Read | `spec_md` |
| 그 외 파일 경로 (`.ts`, `.tsx`, `.js`, ...) | Read + 같은 디렉토리 형제 파일 1~2개 함께 읽음 | `code_file` |
| 디렉토리 경로 | `find` 로 트리 스캔 + 대표 파일 3개 Read | `code_dir` |

→ **scope_summary** 산출:
```
{
  "kind": "...",
  "raw_input": "...",
  "title": "한 줄 요약",
  "intent": "스펙/코드에서 *무엇을 검증해야 하는가*를 3~5줄로 요약",
  "surface_area": ["검증 대상 함수/컴포넌트/사용자 흐름 목록"],
  "out_of_scope": ["명시적으로 안 다룰 것"]
}
```

`spec_confluence`/`spec_url`/`spec_md`의 경우 사용자 시나리오·acceptance criteria가 강조되어야 한다. `code_file`/`code_dir`의 경우 함수 시그너처와 react/vue 컴포넌트의 props/emits/slots에 집중.

## Step B — 컨텍스트 빌드

1. `@detect.md` 절차로 tool matrix `M` 산출.
2. **샘플 테스트 추출** (각 레이어당 최대 1개):
   - Unit: `M.test_locations.unit_glob` 매칭 첫 파일
   - Component: `M.test_locations.component_glob` 매칭 첫 파일
   - E2E: `M.test_locations.e2e_glob` 매칭 첫 파일
   - 없으면 그 레이어 샘플은 `null` (에이전트가 컨벤션 없이 *기본 권장*으로 진행)

전체 컨텍스트 = `{scope_summary, M, samples: {unit, component, e2e}}`.

## Step C — 3-way fan-out

한 메시지에서 Agent 3개 호출 (sonnet 모델). **반드시 한 번의 응답에서 3개 모두.**

각 호출의 prompt 템플릿:

```
Testing Trophy {레이어명} 서브에이전트로 동작해라. 

지침 파일: `vault/.claude/skills/testing-trophy/layers/{레이어}.md`를 먼저 Read 해서 역할/금지/출력 계약을 정확히 따라라.

scope_summary:
{scope_summary JSON}

tool_matrix:
{M JSON}

samples:
- 기존 {레이어명} 테스트 1개: {samples.{레이어} 경로 또는 "없음"}

출력은 dry-run plan **표 + 각 항목별 50줄 이내 preview snippet**. 절대 파일 쓰지 마.

표 형식:
| path | action | rationale | preview_snippet |
|---|---|---|---|
| ... | create / modify | 한 줄 사유 | 작은 코드 미리보기 |

scope이 이 레이어와 무관하면 빈 표와 `해당 없음: <이유>`로 답해도 된다 (예: 순수 함수 1개에 e2e는 과함).
```

**3개 동시에 — 한 응답 내에서 다중 Agent 호출.**

| 레이어명 | layer 파일 |
|---|---|
| Unit | `layers/unit.md` |
| Component | `layers/component.md` |
| E2E | `layers/e2e.md` |

## Step D — plan 통합 + 사용자 승인

3개 결과를 통합해서 사용자에게 보여준다:

```markdown
# Dry-run plan: {scope_summary.title}

## Tool matrix (요약)
{M의 핵심 차원 1줄씩}

## Layer 2 (Unit) — Node, no DOM
{Unit Agent 표}

## Layer 3 (Component / Integration) — jsdom 시뮬레이션
{Component Agent 표}

## Layer 4 (E2E) — 실 브라우저 + prod 빌드
{E2E Agent 표}

## 충돌
{같은 path에 두 레이어가 쓰려 하면 여기 표시. 없으면 "없음"}

## 다음 액션 선택
- `yes` — 모두 적용
- `unit` / `component` / `e2e` — 특정 레이어만 적용
- `no` — 모두 취소
```

→ AskUserQuestion으로 4가지 선택지 제시 (yes / per-layer / no).

### 충돌 처리

같은 `path`에 두 레이어가 쓰려고 하면(드물다 — 경로 컨벤션상 자연 분리됨) 사용자에게 다음 분기 질문:
- 둘 다 만들기 (한쪽은 `.new.tsx` suffix 추가)
- 한 레이어만 선택
- 둘 다 취소

기존 파일과 같은 path에 `create`가 있으면 자동으로 `.new.{ext}` suffix 적용 후 plan에 표시. 절대 덮어쓰지 않는다.

## Step E — Write 실행

승인된 항목만 메인 thread가 직접 Write로 생성/수정.

- `create` → 신규 파일 작성
- `modify` → Edit 또는 Read 후 Write (변경 범위에 따라)

**서브에이전트가 Write를 실행하지 않는다.** Write 책임을 한 곳에 모아 변경 추적/롤백을 단순화.

작업 완료 후 stdout에 한 줄씩:
```
✅ created: src/lib/foo/foo.test.ts (Unit)
✅ created: src/components/Bar.test.tsx (Component)
✅ created: e2e/checkout.spec.ts (E2E)
```

## Step F — 사후 안내

생성된 레이어에 따라 다음 명령 안내:

```
다음 단계:
- Unit: `{M.scripts.test_unit}` 또는 `npm test`
- Component: `{M.scripts.test_component}` 또는 `npm test`
- E2E: `{M.scripts.e2e}` (build 먼저 필요)

생성된 테스트는 처음에 *실패해도 정상* — 검증 의도가 코드 동작과 일치하는지 확인하고 보정해라.
```

**자동 실행하지 않는다.** 의존성 미설치/스크립트 미정의 가능. 사용자가 직접 검증.

## 가드

- `M.test_runner == null` → "테스트 러너가 감지되지 않았다. `@defaults.md` 의 권장 셋업(Vitest projects + jsdom + RTL + Playwright Chromium) 도입 후 다시 시도하거나 `/testing-trophy doctor` 로 가이드 받아라" 메시지 후 종료. 자동 install 안 함.
- scope_summary.intent가 비어있음 → "scope을 더 구체적으로 — 빈 인자는 전체 src를 의미하는데 너무 광범위. 파일 경로나 스펙 문서를 권장" 후 종료.
- 3개 Agent 모두 빈 plan → "scope에서 검증 대상을 못 찾음. 코드 시그너처/스펙 본문을 확인" 후 종료.
