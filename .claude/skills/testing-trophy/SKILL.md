---
name: testing-trophy
description: Testing Trophy 레이어로 cwd 레포 진단/생성. /testing-trophy doctor → 레이어별 부울 체크리스트, /testing-trophy make <scope> → Unit/Component/E2E 3-way 병렬 dry-run → 승인 → write. 구현-agnostic(ESLint/Biome, Vitest/Jest, RTL/Vue-TL, Playwright/Cypress 자동 감지).
---

# /testing-trophy

Kent C. Dodds의 **Testing Trophy** 4 레이어를 cwd의 임의 레포에 적용하는 도구.

레이어 = 환경(environment)으로 구분된다:

| 레이어 | 환경 | 잡는 것 | 못 잡는 것 |
|---|---|---|---|
| 1. Static | 실행 안 함, 컴파일타임 | 타입/린트/빌드 정합성 | 동작·로직 |
| 2. Unit | Node, no DOM | 순수 함수 입출력, DI 주입 | 컴포넌트, DOM |
| 3. Component / Integration | jsdom 시뮬레이션 | 렌더, 사용자 이벤트, 부수효과 | reload, 진짜 paint, 라우팅 |
| 4. E2E | 실 브라우저 + prod 빌드 | reload-persistence, 라우팅, 진짜 네트워크 | (없음 — 가장 현실적이지만 비싸고 시끄러움) |

레퍼런스 구현: `vault/10-워크스페이스/fe-testing-trophy`.

---

## 사용법

| 명령 | 동작 |
|---|---|
| `/testing-trophy doctor` | cwd 레포의 4 레이어 커버리지 진단 (읽기 전용 + 로그 1개) |
| `/testing-trophy make` | 전체 src 대상 테스트 생성 plan |
| `/testing-trophy make <path>` | 특정 파일/디렉토리 대상 |
| `/testing-trophy make <spec.md>` | 마크다운 스펙 문서 기반 |
| `/testing-trophy make <confluence-url>` | Confluence 페이지 기반 |

> **헤드리스 아님**: make는 dry-run plan을 보여주고 사용자 승인을 받는다.

---

## 분기

### 입력 파싱

첫 인자를 보고 분기:

| 첫 인자 | 분기 |
|---|---|
| `doctor` | @doctor.md |
| `make` (이후 인자 없음/있음 모두) | @make.md |
| 그 외 / 없음 | 짧은 도움말 출력 후 종료 |

### 공통 전처리

doctor와 make 모두 가장 먼저 **@detect.md** 를 실행해서 *tool matrix*를 산출한다. 이 matrix를 두 흐름의 입력으로 사용한다.

---

## 핵심 원칙 (어겨선 안 됨)

1. **구현-agnostic** — 트로피의 본질은 *환경*(실행 안 함 / Node / jsdom / 실 브라우저)이다. 도구(Vitest/Jest, ESLint/Biome, RTL/Vue-TL, Playwright/Cypress)는 감지된 것을 따른다. 모르면 추론하지 말고 plan에 "해당 차원 미감지" 명시.
2. **doctor는 읽기 전용** — 로그 파일 1개(`.claude/testing-trophy/logs/<timestamp>.md`) 외 어떤 코드/설정도 건드리지 않는다.
3. **make는 dry-run → 승인 → write** — 서브에이전트는 plan만 산출, 실제 Write는 메인 thread가 사용자 승인 후 수행. 테스트 코드의 *false-green* 위험 때문.
4. **자동 install/실행 금지** — `npm i`, `npm test` 자동 호출 금지. 변경안과 후속 명령 안내만.
5. **기존 테스트 덮어쓰기 금지** — 동일 경로 충돌 시 `.new.tsx` suffix.
6. **커버리지 % 강제 금지** — 트로피 철학 위배. LoC %가 아니라 *환경별로 무엇을 잡는가*가 척도.

---

## 파일 구성

```
testing-trophy/
├── SKILL.md          # 이 파일 (라우터)
├── detect.md         # cwd → tool matrix
├── doctor.md         # 진단 흐름
├── make.md           # 생성 흐름 (3-way fan-out)
└── layers/
    ├── unit.md       # Node 환경 서브에이전트
    ├── component.md  # jsdom 시뮬레이션 서브에이전트
    └── e2e.md        # 실 브라우저 서브에이전트
```

Static 레이어는 별도 layer 파일이 없다 — 코드 생성이 아니라 config 점검 영역이라 doctor.md 안에서 처리.

## 권장 도구 (감지 실패 시 폴백)

스킬은 *감지된 도구를 따른다* 가 1순위. 하지만 빈 레포이거나 일부 차원이 미감지일 때는 `@defaults.md` 의 권장 매트릭스(Vitest projects + jsdom + RTL + Playwright Chromium 등)를 폴백으로 참조한다. 감지된 도구가 권장과 다르면 *감지된 쪽 우선*(사용자 레포 존중) — 권장은 *처음부터 시작할 때*만 적용.
