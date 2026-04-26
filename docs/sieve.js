// Trophy 6-sieve visualization.
// Vanilla JS, no modules — works on file:// and GH Pages identically.
// Reads window.LAYERS, window.ESCAPE, window.BALLS, window.SCHEDULE from data.js.

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const VIEW_W = 800;
  const VIEW_H = 1000;
  const SIEVE_X = 120;
  const SIEVE_W = 560;
  const SIEVE_H = 28;
  const BALL_R = 14;
  const GRAVITY = 1400; // px/s^2
  const MAX_FALL = 900; // px/s
  const SLIDE_DUR = 0.5; // seconds

  const layerById = new Map();
  const ballById = new Map();
  window.LAYERS.forEach((l) => layerById.set(l.id, l));
  window.BALLS.forEach((b) => ballById.set(b.id, b));
  layerById.set("escape", window.ESCAPE);

  // Each sieve gets settle slots above its top edge
  const settleSlotsByLayer = new Map();
  for (const layer of window.LAYERS) {
    const slots = [];
    const cols = 6;
    const colW = SIEVE_W / cols;
    for (let i = 0; i < cols; i++) {
      slots.push({
        x: SIEVE_X + colW * (i + 0.5),
        y: layer.y - BALL_R - 1,
        taken: false,
      });
    }
    settleSlotsByLayer.set(layer.id, slots);
  }
  // Escape zone slots — wider, two rows
  const escapeSlots = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 8; i++) {
      escapeSlots.push({
        x: SIEVE_X + (SIEVE_W / 8) * (i + 0.5),
        y: window.ESCAPE.y + 30 + row * (BALL_R * 2 + 6),
        taken: false,
      });
    }
  }
  settleSlotsByLayer.set("escape", escapeSlots);

  // Active ball state — only set during run
  // {ballData, x, y, vy, phase, target, slot, slideStart, slideFrom, el, labelEl}
  const activeBalls = [];
  let lastFrameTs = null;
  let runStartTs = null;
  let runId = 0;
  let scheduleTimers = [];

  // ---------- Build SVG ----------
  const stage = document.querySelector(".stage");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "viz");
  svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", "viz-title");
  const title = document.createElementNS(SVG_NS, "title");
  title.id = "viz-title";
  title.textContent = "트로피 6층 거름망 시각화";
  svg.appendChild(title);

  // <defs> with mesh pattern
  const defs = document.createElementNS(SVG_NS, "defs");
  const pattern = document.createElementNS(SVG_NS, "pattern");
  pattern.id = "mesh";
  pattern.setAttribute("x", "0");
  pattern.setAttribute("y", "0");
  pattern.setAttribute("width", "12");
  pattern.setAttribute("height", "12");
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  const meshBg = document.createElementNS(SVG_NS, "rect");
  meshBg.setAttribute("width", "12");
  meshBg.setAttribute("height", "12");
  meshBg.setAttribute("fill", "rgba(255,255,255,0.02)");
  pattern.appendChild(meshBg);
  const meshDot = document.createElementNS(SVG_NS, "circle");
  meshDot.setAttribute("cx", "6");
  meshDot.setAttribute("cy", "6");
  meshDot.setAttribute("r", "1.2");
  meshDot.setAttribute("fill", "#3a4453");
  pattern.appendChild(meshDot);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  // Render sieves
  for (const layer of window.LAYERS) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "sieve");
    g.setAttribute("data-layer", layer.id);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute(
      "aria-label",
      `레이어 ${layer.id} ${layer.label} — 호버하면 잡는 것/못 잡는 것 표시`,
    );

    const bar = document.createElementNS(SVG_NS, "rect");
    bar.setAttribute("class", "sieve-bar");
    bar.setAttribute("x", SIEVE_X);
    bar.setAttribute("y", layer.y);
    bar.setAttribute("width", SIEVE_W);
    bar.setAttribute("height", SIEVE_H);
    bar.setAttribute("rx", "4");
    g.appendChild(bar);

    // Left label box
    const labelBg = document.createElementNS(SVG_NS, "rect");
    labelBg.setAttribute("class", "sieve-label-bg");
    labelBg.setAttribute("x", 16);
    labelBg.setAttribute("y", layer.y - 4);
    labelBg.setAttribute("width", 92);
    labelBg.setAttribute("height", SIEVE_H + 8);
    labelBg.setAttribute("rx", "4");
    g.appendChild(labelBg);
    const lt = document.createElementNS(SVG_NS, "text");
    lt.setAttribute("class", "sieve-label-text");
    lt.setAttribute("x", 24);
    lt.setAttribute("y", layer.y + 10);
    lt.textContent = `${layer.id} ${layer.label}`;
    g.appendChild(lt);
    const tt = document.createElementNS(SVG_NS, "text");
    tt.setAttribute("class", "sieve-label-tool");
    tt.setAttribute("x", 24);
    tt.setAttribute("y", layer.y + 24);
    tt.textContent = layer.tool;
    g.appendChild(tt);

    // Right shape badge
    const badgeX = SIEVE_X + SIEVE_W + 24;
    const badgeY = layer.y + SIEVE_H / 2;
    const badge = makeShape(layer.shape, badgeX, badgeY, BALL_R, layer.color);
    badge.setAttribute("class", "shape-badge");
    g.appendChild(badge);

    svg.appendChild(g);
  }

  // Escape zone
  const eg = document.createElementNS(SVG_NS, "g");
  eg.setAttribute("class", "escape-zone");
  eg.setAttribute("data-layer", "escape");
  eg.setAttribute("tabindex", "0");
  eg.setAttribute("role", "button");
  eg.setAttribute("aria-label", "트로피로도 못 잡는 결함 영역");
  const erect = document.createElementNS(SVG_NS, "rect");
  erect.setAttribute("class", "escape-bar");
  erect.setAttribute("x", SIEVE_X);
  erect.setAttribute("y", window.ESCAPE.y);
  erect.setAttribute("width", SIEVE_W);
  erect.setAttribute("height", VIEW_H - window.ESCAPE.y - 20);
  erect.setAttribute("rx", "6");
  eg.appendChild(erect);
  const elabel = document.createElementNS(SVG_NS, "text");
  elabel.setAttribute("class", "escape-label");
  elabel.setAttribute("x", SIEVE_X + SIEVE_W / 2);
  elabel.setAttribute("y", window.ESCAPE.y + 18);
  elabel.setAttribute("text-anchor", "middle");
  elabel.textContent = "↓ 트로피로도 못 잡는 결함은 여기로 ↓";
  eg.appendChild(elabel);
  svg.appendChild(eg);

  // Layer for active balls (drawn last, on top)
  const ballLayer = document.createElementNS(SVG_NS, "g");
  ballLayer.setAttribute("class", "ball-layer");
  svg.appendChild(ballLayer);

  stage.appendChild(svg);

  // Hidden DOM mirror for SR
  const sr = document.createElement("div");
  sr.className = "sr-only";
  sr.setAttribute("aria-hidden", "false");
  let srHTML = "<h2>전체 결함 목록</h2>";
  for (const layer of window.LAYERS) {
    srHTML += `<h3>${layer.id} ${layer.label} (${layer.tool})</h3><ul>`;
    for (const ball of window.BALLS.filter((b) => b.target === layer.id)) {
      srHTML += `<li>${escape(ball.label)} — ${escape(ball.tooltip)}</li>`;
    }
    srHTML += "</ul>";
  }
  srHTML += `<h3>${window.ESCAPE.label}</h3><ul>`;
  for (const ball of window.BALLS.filter((b) => b.target === "escape")) {
    srHTML += `<li>${escape(ball.label)} — ${escape(ball.tooltip)}</li>`;
  }
  srHTML += "</ul>";
  sr.innerHTML = srHTML;
  document.body.appendChild(sr);

  // ---------- Shape factory ----------
  function makeShape(kind, cx, cy, r, color) {
    let el;
    if (kind === "circle") {
      el = document.createElementNS(SVG_NS, "circle");
      el.setAttribute("cx", cx);
      el.setAttribute("cy", cy);
      el.setAttribute("r", r);
    } else if (kind === "square") {
      el = document.createElementNS(SVG_NS, "rect");
      el.setAttribute("x", cx - r);
      el.setAttribute("y", cy - r);
      el.setAttribute("width", r * 2);
      el.setAttribute("height", r * 2);
      el.setAttribute("rx", "2");
    } else if (kind === "triangle") {
      el = document.createElementNS(SVG_NS, "polygon");
      const pts = [
        [cx, cy - r],
        [cx + r * 0.95, cy + r * 0.7],
        [cx - r * 0.95, cy + r * 0.7],
      ];
      el.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    } else if (kind === "diamond") {
      el = document.createElementNS(SVG_NS, "polygon");
      const pts = [
        [cx, cy - r],
        [cx + r, cy],
        [cx, cy + r],
        [cx - r, cy],
      ];
      el.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    } else if (kind === "hexagon") {
      el = document.createElementNS(SVG_NS, "polygon");
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      el.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    } else if (kind === "star") {
      el = document.createElementNS(SVG_NS, "polygon");
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
      el.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    }
    el.setAttribute("fill", color);
    el.setAttribute("style", `color:${color}`);
    return el;
  }

  // ---------- Spawn / animate ----------
  function spawnBall(ballData) {
    const layer = layerById.get(ballData.target);
    const shape = layer.shape || "circle";
    const color = layer.color || "#888";
    const x = SIEVE_X + 60 + Math.random() * (SIEVE_W - 120);
    const y = -BALL_R * 2;

    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "ball");
    g.setAttribute("data-target", ballData.target);
    g.setAttribute("data-id", ballData.id);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute(
      "aria-label",
      `${ballData.label} — ${layer.label}에서 잡힘`,
    );
    g.setAttribute("transform", `translate(${x}, ${y})`);

    const shapeEl = makeShape(shape, 0, 0, BALL_R, color);
    shapeEl.setAttribute("class", "ball-shape");
    g.appendChild(shapeEl);

    const t = document.createElementNS(SVG_NS, "title");
    t.textContent = `${ballData.label} — ${ballData.tooltip}`;
    g.appendChild(t);

    const labelEl = document.createElementNS(SVG_NS, "text");
    labelEl.setAttribute("class", "ball-label");
    labelEl.setAttribute("y", BALL_R + 10);
    labelEl.textContent = ballData.label;
    g.appendChild(labelEl);

    ballLayer.appendChild(g);

    activeBalls.push({
      data: ballData,
      target: ballData.target,
      x,
      y,
      vy: 0,
      phase: "falling",
      el: g,
      slot: null,
      slideStart: 0,
      slideFromX: x,
      slideFromY: y,
      passedSieves: new Set(),
    });
  }

  function tick(ts) {
    if (lastFrameTs == null) lastFrameTs = ts;
    const dt = Math.min(0.04, (ts - lastFrameTs) / 1000); // clamp to 25fps min
    lastFrameTs = ts;

    for (const b of activeBalls) {
      if (b.phase === "falling") {
        b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
        b.y += b.vy * dt;

        // Check sieves
        for (const layer of window.LAYERS) {
          if (b.passedSieves.has(layer.id)) continue;
          const top = layer.y;
          if (b.y + BALL_R >= top && b.y - BALL_R <= top + SIEVE_H) {
            if (layer.id === b.target) {
              // Caught — start sliding to a slot
              const slots = settleSlotsByLayer.get(layer.id);
              const slot = slots.find((s) => !s.taken) || slots[slots.length - 1];
              slot.taken = true;
              b.slot = slot;
              b.slideFromX = b.x;
              b.slideFromY = layer.y - BALL_R - 1;
              b.y = layer.y - BALL_R - 1;
              b.vy = 0;
              b.phase = "sliding";
              b.slideStart = ts / 1000;
              flashSieve(layer.id);
              break;
            } else if (b.y - BALL_R > top + SIEVE_H * 0.4) {
              // Passed through — mark as checked
              b.passedSieves.add(layer.id);
              b.el.classList.add("checked");
            }
          }
        }

        // Check escape zone
        if (b.phase === "falling" && b.y > window.ESCAPE.y) {
          if (b.target === "escape") {
            const slots = settleSlotsByLayer.get("escape");
            const slot = slots.find((s) => !s.taken) || slots[slots.length - 1];
            slot.taken = true;
            b.slot = slot;
            b.slideFromX = b.x;
            b.slideFromY = b.y;
            b.phase = "sliding";
            b.slideStart = ts / 1000;
            flashSieve("escape");
          }
        }

        // Off-screen failsafe
        if (b.y > VIEW_H + 50) {
          b.phase = "settled";
        }

        b.el.setAttribute("transform", `translate(${b.x}, ${b.y})`);
      } else if (b.phase === "sliding") {
        const elapsed = ts / 1000 - b.slideStart;
        const u = Math.min(1, elapsed / SLIDE_DUR);
        const eased = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        b.x = b.slideFromX + (b.slot.x - b.slideFromX) * eased;
        b.y = b.slideFromY + (b.slot.y - b.slideFromY) * eased;
        b.el.setAttribute("transform", `translate(${b.x}, ${b.y})`);
        if (u >= 1) {
          b.phase = "settled";
          b.el.classList.add("settled");
        }
      }
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Side panel ----------
  const panelTitle = document.getElementById("panel-title");
  const panelTool = document.getElementById("panel-tool");
  const panelTag = document.getElementById("panel-tag");
  const panelCatches = document.getElementById("panel-catches");
  const panelMisses = document.getElementById("panel-misses");
  const panelCatchesH = document.getElementById("panel-catches-h");
  const panelHint = document.getElementById("panel-hint");
  const panelDefault = document.getElementById("panel-default");

  function showPanel(layerId) {
    const layer = layerById.get(layerId);
    if (!layer) {
      panelDefault.style.display = "block";
      panelTag.style.display = "none";
      panelTitle.textContent = "호버해서 레이어를 살펴보세요";
      panelTool.textContent = "";
      panelCatches.innerHTML = "";
      panelMisses.innerHTML = "";
      panelCatchesH.style.display = "none";
      panelHint.style.display = "none";
      return;
    }
    panelDefault.style.display = "none";
    if (layerId === "escape") {
      panelTag.style.display = "inline-block";
      panelTag.textContent = "ESCAPE";
      panelTag.style.background = "var(--escape)";
      panelTag.style.color = "#fff";
    } else {
      panelTag.style.display = "inline-block";
      panelTag.textContent = `${layer.id} ${layer.label}`;
      panelTag.style.background = layer.color;
      panelTag.style.color = "#000";
    }
    panelTitle.textContent = layer.label || "트로피로도 못 잡는 것";
    panelTool.textContent = layer.tool || "";
    panelCatches.innerHTML = "";
    panelMisses.innerHTML = "";
    if (layer.catches && layer.catches.length) {
      panelCatchesH.style.display = "block";
      for (const item of layer.catches) {
        const li = document.createElement("li");
        li.textContent = item;
        panelCatches.appendChild(li);
      }
    } else {
      panelCatchesH.style.display = "none";
    }
    for (const item of layer.misses || []) {
      const li = document.createElement("li");
      li.textContent = item;
      panelMisses.appendChild(li);
    }
    if (layer.hint) {
      panelHint.style.display = "block";
      panelHint.textContent = layer.hint;
    } else {
      panelHint.style.display = "none";
    }
  }
  showPanel(null); // initial state

  // ---------- Hover / focus binding ----------
  function bindLayerInteractions(g, layerId) {
    g.addEventListener("mouseenter", () => {
      svg.querySelectorAll(".sieve.active, .escape-zone.active").forEach((el) =>
        el.classList.remove("active"),
      );
      g.classList.add("active");
      showPanel(layerId);
    });
    g.addEventListener("focus", () => {
      svg.querySelectorAll(".sieve.active, .escape-zone.active").forEach((el) =>
        el.classList.remove("active"),
      );
      g.classList.add("active");
      showPanel(layerId);
    });
  }
  svg.querySelectorAll(".sieve").forEach((g) =>
    bindLayerInteractions(g, g.getAttribute("data-layer")),
  );
  bindLayerInteractions(eg, "escape");

  function flashSieve(layerId) {
    const sel =
      layerId === "escape"
        ? '.escape-zone[data-layer="escape"]'
        : `.sieve[data-layer="${layerId}"]`;
    const el = svg.querySelector(sel);
    if (!el) return;
    el.classList.remove("flash");
    void el.getBoundingClientRect();
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 700);
  }

  // ---------- Schedule / replay ----------
  function play() {
    // Reset
    runId++;
    const myRunId = runId;
    scheduleTimers.forEach((t) => clearTimeout(t));
    scheduleTimers = [];
    activeBalls.forEach((b) => b.el.remove());
    activeBalls.length = 0;
    settleSlotsByLayer.forEach((slots) =>
      slots.forEach((s) => (s.taken = false)),
    );

    runStartTs = performance.now();
    for (const item of window.SCHEDULE) {
      const t = setTimeout(() => {
        if (runId !== myRunId) return;
        const ball = ballById.get(item.id);
        if (ball) {
          spawnBall(ball);
          if (item.highlight) {
            // Auto-focus the panel on highlighted layer at the ball's spawn
            showPanel(item.highlight);
            const sel =
              item.highlight === "escape"
                ? '.escape-zone[data-layer="escape"]'
                : `.sieve[data-layer="${item.highlight}"]`;
            const el = svg.querySelector(sel);
            if (el) {
              svg
                .querySelectorAll(".sieve.active, .escape-zone.active")
                .forEach((e) => e.classList.remove("active"));
              el.classList.add("active");
            }
          }
        }
      }, item.t);
      scheduleTimers.push(t);
    }
  }

  document.getElementById("replay").addEventListener("click", play);

  // Auto-start after a brief beat (only if anim tab is active at load)
  let initialAutoPlayed = false;
  setTimeout(() => {
    if (document.querySelector('[data-view="anim"]:not([hidden])')) {
      play();
      initialAutoPlayed = true;
    }
  }, 1200);

  // ---------- Tab switching ----------
  const tabBtns = document.querySelectorAll(".tab");
  const views = document.querySelectorAll("[data-view]");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
      });
      views.forEach((v) => {
        v.hidden = v.dataset.view !== target;
      });
      // If user lands on anim tab for the first time, auto-play
      if (target === "anim" && !initialAutoPlayed) {
        play();
        initialAutoPlayed = true;
      }
    });
  });

  // ---------- Step mode ----------
  const STEP_LAYERS = ["1.1", "1.2", "1.3", "2", "3", "4", "escape"];
  const STEP_LABELS = {
    "1.1": "1.1 Lint",
    "1.2": "1.2 Typecheck",
    "1.3": "1.3 Build",
    "2": "2 Unit",
    "3": "3 Component",
    "4": "4 E2E",
    escape: "→ 미커버",
  };
  const stepBody = document.getElementById("step-matrix-body");
  const stepNextBtn = document.getElementById("step-next");
  const stepResetBtn = document.getElementById("step-reset");
  const stepCurrentEl = document.getElementById("step-current");
  const stepStageLabel = document.getElementById("step-stage-label");
  let currentStep = 0;

  // Build matrix rows once
  for (const ball of window.BALLS) {
    const layer = layerById.get(ball.target);
    const tr = document.createElement("tr");
    tr.setAttribute("data-ball-id", ball.id);

    const labelTd = document.createElement("td");
    labelTd.className = "label-cell";
    // Shape icon (color-matched to target sieve)
    const iconSvg = document.createElementNS(SVG_NS, "svg");
    iconSvg.setAttribute("width", "16");
    iconSvg.setAttribute("height", "16");
    iconSvg.setAttribute("viewBox", "-9 -9 18 18");
    iconSvg.setAttribute("aria-hidden", "true");
    const iconShape = makeShape(layer.shape || "circle", 0, 0, 7, layer.color || "#888");
    iconSvg.appendChild(iconShape);
    labelTd.appendChild(iconSvg);
    const labelSpan = document.createElement("span");
    labelSpan.textContent = ball.label;
    labelSpan.title = ball.tooltip;
    labelTd.appendChild(labelSpan);
    tr.appendChild(labelTd);

    for (const layerId of STEP_LAYERS) {
      const td = document.createElement("td");
      td.setAttribute("data-layer", layerId);
      tr.appendChild(td);
    }
    stepBody.appendChild(tr);
  }

  function renderStep() {
    stepCurrentEl.textContent = currentStep;
    if (currentStep === 0) {
      stepNextBtn.textContent = "1.1 Lint 적용 →";
      stepStageLabel.textContent =
        "모든 결함이 아직 검증되지 않은 상태입니다 (`?`).";
    } else if (currentStep < STEP_LAYERS.length) {
      const next = STEP_LAYERS[currentStep];
      stepNextBtn.textContent = `${STEP_LABELS[next]} 적용 →`;
      stepStageLabel.textContent = `${STEP_LABELS[STEP_LAYERS[currentStep - 1]]} 까지 적용됨. 잡힌 결함은 ✓, 통과한 결함은 →.`;
    } else {
      stepNextBtn.textContent = "✓ 모든 단계 완료";
      stepNextBtn.disabled = true;
      stepStageLabel.textContent =
        "모든 레이어 적용 완료. 빨간색 셀은 트로피로도 못 잡는 결함 — 추가 도구가 필요합니다.";
    }
    stepResetBtn.disabled = currentStep === 0;

    // Update sticky header active state
    document
      .querySelectorAll(".step-matrix th[data-layer]")
      .forEach((th) => th.classList.remove("active-step"));
    if (currentStep > 0 && currentStep <= STEP_LAYERS.length) {
      const activeLayer = STEP_LAYERS[currentStep - 1];
      const th = document.querySelector(
        `.step-matrix th[data-layer="${activeLayer}"]`,
      );
      if (th) th.classList.add("active-step");
    }

    // Update each cell
    for (const ball of window.BALLS) {
      const tr = stepBody.querySelector(`tr[data-ball-id="${ball.id}"]`);
      const targetIdx = STEP_LAYERS.indexOf(ball.target);
      for (let i = 0; i < STEP_LAYERS.length; i++) {
        const layerId = STEP_LAYERS[i];
        const td = tr.querySelector(`td[data-layer="${layerId}"]`);
        td.className = "";
        if (i + 1 > currentStep) {
          // Not yet evaluated for this step
          td.textContent = "?";
          td.classList.add("cell-pending");
        } else if (targetIdx === i) {
          // Caught here
          if (layerId === "escape") {
            td.innerHTML = "↓ 빠짐";
            td.classList.add("cell-escaped");
          } else {
            td.innerHTML = "✓ 잡힘";
            td.classList.add("cell-caught");
          }
        } else if (targetIdx < i) {
          // Already caught at an earlier layer
          td.textContent = "—";
          td.classList.add("cell-done");
        } else {
          // Passed this layer (target is below)
          td.textContent = "→ 통과";
          td.classList.add("cell-pass");
        }
      }
    }
  }

  stepNextBtn.addEventListener("click", () => {
    if (currentStep < STEP_LAYERS.length) {
      currentStep++;
      renderStep();
      // Update side panel to current layer
      const justApplied = STEP_LAYERS[currentStep - 1];
      showPanel(justApplied);
      // Highlight that column header on hover state
    }
  });
  stepResetBtn.addEventListener("click", () => {
    currentStep = 0;
    stepNextBtn.disabled = false;
    renderStep();
    showPanel(null);
  });

  // Column header hover → preview side panel for that layer
  document.querySelectorAll(".step-matrix th[data-layer]").forEach((th) => {
    th.addEventListener("mouseenter", () => {
      showPanel(th.getAttribute("data-layer"));
    });
  });

  renderStep(); // initial render: all "?"

  // ---------- helpers ----------
  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
