// Single source of truth for the visualization.
// "catches" / "misses" arrays mirror README's "잡는 것 / 못 잡는 것" lists verbatim.
// Edit README first, then sync here.

window.LAYERS = [
  {
    id: "1.1",
    label: "Lint",
    tool: "ESLint",
    shape: "circle",
    color: "#eab308",
    y: 140,
    catches: [
      "잘못 import된 모듈",
      "안 쓰는 변수",
      "React/Next 규칙 위반 (예: <Link> 대신 <a>)",
      "명백한 안티패턴",
    ],
    misses: ["타입 오류", "런타임 오류", "비즈니스 로직 오류"],
  },
  {
    id: "1.2",
    label: "Typecheck",
    tool: "tsc --noEmit",
    shape: "square",
    color: "#3b82f6",
    y: 260,
    catches: [
      "타입 불일치",
      "존재하지 않는 속성/메서드 호출",
      "함수 시그니처 위반",
      "옵셔널 체이닝 누락",
    ],
    misses: ["런타임 동작", "비즈니스 로직의 정확성"],
  },
  {
    id: "1.3",
    label: "Build",
    tool: "next build",
    shape: "hexagon",
    color: "#f97316",
    y: 380,
    catches: [
      "Server/Client Component 경계 위반 (RSC 직렬화 불가)",
      '"use client" 누락',
      "generateMetadata / generateStaticParams 시그니처 위반",
      "Edge runtime 비호환 API (fs, path 등)",
      "server-only / client-only 패키지 교차 import",
      "환경변수 누락, 정적 prerender fetch 실패",
    ],
    misses: ["런타임 동작", "외부 시스템 연동 (DB/API)", "사용자 인터랙션"],
  },
  {
    id: "2",
    label: "Unit",
    tool: "Vitest (Node)",
    shape: "triangle",
    color: "#22c55e",
    y: 500,
    catches: [
      "도메인 순수 함수의 입출력",
      "외부 의존성 주입형 함수 (storage, fetch, time...)",
      "직렬화 round-trip, 깨진 JSON 폴백, 스키마 mismatch",
    ],
    misses: [
      "컴포넌트 렌더링",
      "사용자 인터랙션",
      "진짜 브라우저의 storage 동작 자체",
    ],
  },
  {
    id: "3",
    label: "Component",
    tool: "Vitest + jsdom + RTL",
    shape: "diamond",
    color: "#a855f7",
    y: 620,
    catches: [
      "렌더링 출력 / prop 배선 / 조건부 렌더",
      "사용자 인터랙션 (클릭/타이핑/제출)",
      "useEffect로 외부와 read/write 사이클",
      "접근성 트리 (getByRole 쿼리)",
    ],
    misses: [
      "실제 CSS 레이아웃과 계산값",
      "진짜 paint, focus, 모션, 미디어 쿼리",
      "풀 페이지 reload 후 영속성",
      "페이지 라우팅, 데이터 fetching",
    ],
  },
  {
    id: "4",
    label: "E2E",
    tool: "Playwright + Chromium",
    shape: "star",
    color: "#ef4444",
    y: 740,
    catches: [
      "풀 페이지 reload 후 영속성",
      "진짜 CSS 레이아웃과 paint, focus 동작",
      "페이지 라우팅, 페이지 간 상태 흐름",
      "데이터 fetching, API 통합",
    ],
    misses: [
      "다른 브라우저(Safari/Firefox)에서만 발현되는 버그",
      "시각적 회귀 (색/픽셀 단위)",
      "테스트가 작성되지 않은 코드 경로",
    ],
  },
];

window.ESCAPE = {
  id: "escape",
  label: "트로피로도 못 잡는 것",
  y: 880,
  catches: [],
  misses: [
    "Chromium만 설치한 환경에선 다른 브라우저 quirks를 못 봄",
    "시각적 회귀 — Chromatic / Percy 같은 별도 도구 필요",
    "Coverage 구멍 — 어떤 레이어도 *없는 테스트*는 못 잡음",
  ],
  hint:
    "이 결함을 잡으려면? 멀티 브라우저 매트릭스 / 시각 회귀 도구 / coverage 추적 — 트로피 위에 추가 도구가 필요한 영역.",
};

// Each ball: id, label (6~12 char), tooltip (one sentence), target (sieve id), shape (matches target sieve)
window.BALLS = [
  // 1.1 Lint × 4
  {
    id: "b01",
    label: "잘못된 import 경로",
    tooltip: "존재하지 않는 모듈을 import. ESLint가 정적 분석으로 잡음.",
    target: "1.1",
  },
  {
    id: "b02",
    label: "안 쓰는 변수",
    tooltip: "선언만 하고 사용하지 않은 변수. no-unused-vars 룰.",
    target: "1.1",
  },
  {
    id: "b03",
    label: "<Link> 대신 <a>",
    tooltip: "Next 규칙 위반 — core-web-vitals 룰셋이 잡음.",
    target: "1.1",
  },
  {
    id: "b04",
    label: "Hook 규칙 위반",
    tooltip: "조건부 useState 호출 등. react-hooks/rules-of-hooks.",
    target: "1.1",
  },
  // 1.2 Typecheck × 3
  {
    id: "b05",
    label: "오타 속성 접근",
    tooltip: "board.colums (오타). 존재하지 않는 속성 — tsc가 잡음.",
    target: "1.2",
  },
  {
    id: "b06",
    label: "함수 시그니처 위반",
    tooltip: "addCard 인자 타입이 맞지 않음. tsc가 잡음.",
    target: "1.2",
  },
  {
    id: "b07",
    label: "옵셔널 체이닝 누락",
    tooltip: "user.profile.name 인데 profile이 undefined일 수 있음.",
    target: "1.2",
  },
  // 1.3 Build × 4 ★ primary aha
  {
    id: "b08",
    label: "Server에 onClick",
    tooltip: 'Server Component에 이벤트 핸들러. "use client" 누락 — build에서만 폭발.',
    target: "1.3",
  },
  {
    id: "b09",
    label: "RSC 직렬화 불가",
    tooltip: "Server→Client에 함수 prop 전달. RSC 경계 위반 — build에서만 잡힘.",
    target: "1.3",
  },
  {
    id: "b10",
    label: "Edge에서 fs",
    tooltip: "edge runtime route에서 Node-only API 사용. build에서 검증.",
    target: "1.3",
  },
  {
    id: "b11",
    label: "Metadata 시그니처",
    tooltip: "generateMetadata 반환 타입이 Next의 generated route types와 어긋남.",
    target: "1.3",
  },
  // 2 Unit × 4
  {
    id: "b12",
    label: "moveCard 카드 유실",
    tooltip: "도메인 로직 결함. 타입은 통과지만 카드를 잃어버림.",
    target: "2",
  },
  {
    id: "b13",
    label: "addCard 빈값 통과",
    tooltip: "공백 문자열을 카드로 추가. 입력 검증 정책 위반.",
    target: "2",
  },
  {
    id: "b14",
    label: "JSON 파싱 throw",
    tooltip: "loadBoard가 깨진 JSON에 대해 폴백 없이 throw — round-trip 결함.",
    target: "2",
  },
  {
    id: "b15",
    label: "unknown id 처리",
    tooltip: "removeCard에 없는 id를 줬을 때 보드를 망가뜨림.",
    target: "2",
  },
  // 3 Component × 5
  {
    id: "b16",
    label: "잘못된 컬럼 렌더",
    tooltip: "카드가 의도와 다른 컬럼에 그려짐. prop 배선 결함 (3.1).",
    target: "3",
  },
  {
    id: "b17",
    label: "빈 컬럼 listitem",
    tooltip: "0개 카드인데 빈 listitem이 남아 있음. 조건부 렌더 결함 (3.1).",
    target: "3",
  },
  {
    id: "b18",
    label: "공백 제출 허용",
    tooltip: "+ Add card 폼이 빈 값도 카드로 추가. 인터랙션 결함 (3.2).",
    target: "3",
  },
  {
    id: "b19",
    label: "mount 로드 실패",
    tooltip: "useEffect로 localStorage 로드가 동작하지 않음. 부수효과 결함 (3.3).",
    target: "3",
  },
  {
    id: "b20",
    label: "aria-label 누락",
    tooltip: "getByRole 쿼리가 깨짐. 접근성 트리 누락 — 의미적 마크업 결함.",
    target: "3",
  },
  // 4 E2E × 3
  {
    id: "b21",
    label: "reload 후 사라짐",
    tooltip: "localStorage flush 미동작. jsdom은 절대 못 잡는 결함.",
    target: "4",
  },
  {
    id: "b22",
    label: "prod 라우팅 깨짐",
    tooltip: "next dev에선 동작, next start에서만 발현되는 라우팅 버그.",
    target: "4",
  },
  {
    id: "b23",
    label: "focus 안 감",
    tooltip: "진짜 브라우저 focus 동작. jsdom은 흉내만 냄.",
    target: "4",
  },
  // Escape × 2 ★ secondary aha
  {
    id: "b24",
    label: "Safari quota 에러",
    tooltip: "다른 브라우저에서만 발현. Chromium만 설치한 본 레포는 못 잡음.",
    target: "escape",
  },
  {
    id: "b25",
    label: "테스트 없는 경로",
    tooltip: "어떤 레이어도 *없는 테스트*는 못 잡음. coverage 도구의 영역.",
    target: "escape",
  },
];

// Three-act schedule: ball id → spawn time (ms from start)
window.SCHEDULE = [
  // Act 1 (0 ~ 7s) — set up the metaphor with easy balls
  { id: "b01", t: 200 },
  { id: "b02", t: 600 },
  { id: "b05", t: 1000 },
  { id: "b12", t: 1400 },
  { id: "b16", t: 1800 },
  { id: "b03", t: 2300 },
  { id: "b06", t: 2700 },
  { id: "b13", t: 3100 },
  { id: "b17", t: 3500 },
  { id: "b21", t: 4000 },
  { id: "b04", t: 4500 },
  { id: "b07", t: 4900 },
  { id: "b14", t: 5300 },
  { id: "b18", t: 5700 },
  { id: "b15", t: 6100 },
  { id: "b19", t: 6500 },
  { id: "b22", t: 6900 },
  { id: "b20", t: 7200 },
  { id: "b23", t: 7500 },
  // Act 2 (8 ~ 11s) — Build-only barrage ★ primary aha
  { id: "b08", t: 8000, highlight: "1.3" },
  { id: "b09", t: 8500, highlight: "1.3" },
  { id: "b10", t: 9000, highlight: "1.3" },
  { id: "b11", t: 9500, highlight: "1.3" },
  // Act 3 (11 ~ 14s) — escape balls fall through everything ★ secondary aha
  { id: "b24", t: 11500, highlight: "escape" },
  { id: "b25", t: 12500, highlight: "escape" },
];
