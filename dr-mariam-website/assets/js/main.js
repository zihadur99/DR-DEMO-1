/* Dr. Mariam Nasrallah — chapter engine
   The page itself never scrolls. Wheel, touch, keyboard and the nav move one
   "progress" value (0 → 9).
   - The 3D sculpture (scene.js) follows that value every frame, so its morph is scrubbed.
   - Text never animates per frame: when a new chapter becomes current it gets the class
     .active and CSS transitions (transform + opacity, GPU-composited) play the reveal.
   That split keeps the main thread nearly idle, which is what makes it smooth.
   Works the same in a normal tab, inside an iframe, and on phones. */
(function () {
  "use strict";
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOBILE = matchMedia("(max-width: 760px)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  const CH = $$(".ch");
  const LAST = CH.length - 1;
  const PORTRAIT = new Set([0, LAST]);          // chapters where the doctor is on screen
  const clampP = v => Math.max(0, Math.min(LAST, v));
  // the DNA scroll sequence (sequence.js) runs before the stage; while it is active, native scroll belongs to it
  const SEQ = window.HeroSequence || {available: false, active: false, skip(){}, reenter(){}};
  const inIntro = () => SEQ.active;

  /* ---------- split headings into masked words ---------- */
  $$("[data-split]").forEach(el => {
    const words = [];
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3){
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(" ")); return; }
          const w = document.createElement("span"); w.className = "w";
          const s = document.createElement("span"); s.textContent = p; w.appendChild(s); frag.appendChild(w); words.push(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
    walk(el);
    el._words = words;
  });
  // stagger order (0..1) of every animated item inside its chapter
  CH.forEach(ch => {
    const items = $$("[data-r], [data-split]", ch), n = items.length;
    items.forEach((it, i) => {
      const base = n > 1 ? i / (n - 1) * .75 : 0;
      if (it._words){
        const m = it._words.length;
        it._words.forEach((s, j) => s.style.setProperty("--k", Math.min(1, base + (m > 1 ? j / (m - 1) * .25 : 0)).toFixed(3)));
      } else it.style.setProperty("--k", base.toFixed(3));
    });
  });

  /* ---------- phone-number odometer ---------- */
  const odo = $("#odo");
  if (odo){
    odo.innerHTML = ""; let di = 0;
    for (const ch of odo.dataset.number){
      if (/\d/.test(ch)){
        const col = document.createElement("span"); col.className = "col"; col.setAttribute("aria-hidden", "true");
        const inner = document.createElement("span");
        for (let k = 0; k < 10; k++){ const s = document.createElement("span"); s.textContent = k; inner.appendChild(s); }
        inner.style.setProperty("--d", (400 + di++ * 80) + "ms"); inner.dataset.target = ch;
        col.appendChild(inner); odo.appendChild(col);
      } else { const d = document.createElement("span"); d.className = "dash"; d.textContent = ch; d.setAttribute("aria-hidden", "true"); odo.appendChild(d); }
    }
  }
  const setOdo = on => odo && $$(".col>span", odo).forEach(s => s.style.transform = on ? `translateY(${-s.dataset.target}em)` : "");

  /* ================= progress controller ================= */
  let pT = 0, pS = 0, settled = 0, snapTimer = 0, touching = false;
  const VH = () => window.innerHeight || 800;
  function go(i){ pT = clampP(Math.round(i)); settled = pT; clearTimeout(snapTimer); }
  function snap(){ const d = pT - settled; const t = clampP(Math.round(pT + Math.sign(d) * .38)); pT = t; settled = t; }
  function nudge(dc){ pT = clampP(pT + dc); clearTimeout(snapTimer); snapTimer = setTimeout(snap, 170); }
  // resting on the first chapter: scrolling further up goes back into the DNA sequence
  const atTop = () => settled === 0 && pT <= 0 && pS < .25;

  let lastWheelT = 0, guardUntil = 0, guardHard = 0;
  window.addEventListener("wheel", e => {
    if (e.ctrlKey) return;
    const now = performance.now(), gap = now - lastWheelT; lastWheelT = now;
    if (inIntro()) return;
    e.preventDefault();
    // swallow trackpad inertia carried over from the sequence until a new gesture starts
    if (now < guardHard) return;
    if (now < guardUntil){ if (gap > 160) guardUntil = 0; else return; }
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? VH() : 1;
    const dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (dy < 0 && gap > 160 && atTop() && SEQ.available){ SEQ.reenter(); return; }
    nudge(Math.max(-.6, Math.min(.6, dy * unit / (VH() * .5))));
  }, {passive: false});

  let ty0 = 0, tp0 = 0, tLastY = 0, tLastT = 0, tVel = 0, tTop = false;
  window.addEventListener("touchstart", e => {
    if (e.touches.length !== 1 || inIntro()) return;
    touching = true; tTop = atTop(); clearTimeout(snapTimer);
    ty0 = tLastY = e.touches[0].clientY; tp0 = pT; tLastT = performance.now(); tVel = 0;
  }, {passive: true});
  window.addEventListener("touchmove", e => {
    if (!touching || e.touches.length !== 1) return;
    e.preventDefault();
    const y = e.touches[0].clientY, now = performance.now();
    tVel = (tLastY - y) / Math.max(1, now - tLastT); tLastY = y; tLastT = now;
    pT = clampP(tp0 + (ty0 - y) / (VH() * .55));
  }, {passive: false});
  window.addEventListener("touchend", () => {
    if (!touching) return; touching = false;
    if (tTop && tLastY - ty0 > 60 && SEQ.available){ SEQ.reenter(); return; }
    const d = pT - settled;
    go(Math.abs(tVel) > .35 ? settled + Math.sign(tVel) * Math.max(1, Math.round(Math.abs(d))) : Math.round(pT + Math.sign(d) * .38));
  });

  window.addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (inIntro()) return;
    const k = e.key;
    if (["ArrowDown", "PageDown", " ", "Spacebar"].includes(k)){ e.preventDefault(); go(settled + 1); }
    else if (["ArrowUp", "PageUp"].includes(k)){ e.preventDefault(); if (atTop() && SEQ.available) SEQ.reenter(); else go(settled - 1); }
    else if (k === "Home"){ e.preventDefault(); go(0); }
    else if (k === "End"){ e.preventDefault(); go(LAST); }
  });

  $$("[data-go]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); if (inIntro()) SEQ.skip(); go(+a.dataset.go); }));
  const dotsEl = $("#dots");
  if (dotsEl) CH.forEach((ch, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" aria-label="Go to ${ch.dataset.name}"><span>${ch.dataset.name}</span><i></i></button>`;
    li.firstChild.addEventListener("click", () => go(i));
    dotsEl.appendChild(li);
  });
  const dotBtns = dotsEl ? $$("button", dotsEl) : [];
  const navLinks = $$(".nav-links a");
  CH.forEach((ch, i) => ch.addEventListener("focusin", () => { if (cur !== i) go(i); }));

  const HASH = {home: 0, about: 1, care: 5, contact: 9};
  const fromHash = () => { const h = location.hash.slice(1); if (h in HASH){ if (inIntro()) SEQ.skip(); go(HASH[h]); pS = pT; } };
  fromHash(); window.addEventListener("hashchange", fromHash);

  /* ================= chapter switching (class-based) ================= */
  const doc = $("#doc"), chName = $("#chName"), chNum = $("#chNum"), progress = $("#progress"), hint = $("#hint");
  let cur = -1, started = false;
  const leaveTimers = new Map();

  function setChapter(i){
    if (i === cur) return;
    const prev = cur; cur = i;
    const back = prev > i ? 1 : -1;               // leaving upward when moving forward, downward when moving back
    if (prev >= 0){
      const old = CH[prev];
      old.classList.remove("active"); old.classList.add("leaving");
      old.style.setProperty("--back", back);
      old.setAttribute("aria-hidden", "true");
      clearTimeout(leaveTimers.get(old));
      leaveTimers.set(old, setTimeout(() => old.classList.remove("leaving"), 850));
    }
    const el = CH[i];
    clearTimeout(leaveTimers.get(el));
    el.classList.remove("leaving"); el.classList.add("active"); el.setAttribute("aria-hidden", "false");
    if (doc) doc.classList.toggle("show", PORTRAIT.has(i));
    setOdo(i === LAST);
    if (chName) chName.textContent = el.dataset.name;
    if (chNum) chNum.textContent = String(i + 1).padStart(2, "0") + " / " + (LAST + 1);
    dotBtns.forEach((b, k) => b.classList.toggle("cur", k === i));
    navLinks.forEach(a => { const [a0, a1] = a.dataset.group.split("-").map(Number); a.classList.toggle("cur", i >= a0 && i <= a1); });
    if (hint) hint.style.opacity = i === 0 ? 1 : 0;
  }
  CH.forEach(c => c.setAttribute("aria-hidden", "true"));

  /* ---------- hand-off with the DNA sequence ---------- */
  window.addEventListener("seq:exit", () => { go(0); pS = 0; const t = performance.now(); guardHard = t + 700; guardUntil = t + 1500; });
  window.addEventListener("seq:enter", () => {
    // put the stage to sleep so the hero reveal plays again on the way back down
    if (cur >= 0){ CH[cur].classList.remove("active"); CH[cur].setAttribute("aria-hidden", "true"); }
    cur = -1;
    if (doc) doc.classList.remove("show");
    setOdo(false);
  });

  /* ---------- copy number ---------- */
  const copyBtn = $("#copyBtn");
  if (copyBtn) copyBtn.addEventListener("click", () => {
    const out = $("#copied"), num = "313-914-3666";
    const ok = () => { out.textContent = "Copied: " + num; setTimeout(() => out.textContent = "", 2600); };
    const no = () => { out.textContent = "Phone: " + num; };
    try { navigator.clipboard.writeText(num).then(ok, no); } catch (_) { no(); }
  });

  /* ================= pointer: parallax and particle push ================= */
  let mX = 0, mY = 0, mNX = 9, mNY = 9, mPow = 0, mTarget = 0, lastMove = 0, tX = 0, tY = 0;
  window.addEventListener("pointermove", e => {
    mX = e.clientX / innerWidth - .5; mY = e.clientY / innerHeight - .5;
    if (FINE){ mNX = mX * 2; mNY = -mY * 2; mTarget = 1; lastMove = performance.now(); }
    cX = e.clientX; cY = e.clientY;
  }, {passive: true});

  /* ---------- premium cursor: a dot plus a lagging ring that swells over links ---------- */
  let cX = -100, cY = -100, rX = -100, rY = -100;
  const cursor = FINE && !RM ? document.createElement("div") : null, cDot = cursor ? document.createElement("div") : null;
  if (cursor){
    cursor.className = "cursor off"; cDot.className = "cursor-dot off";
    cursor.setAttribute("aria-hidden", "true"); cDot.setAttribute("aria-hidden", "true");
    document.body.append(cursor, cDot);
    document.documentElement.classList.add("has-cursor");
    const HOT = "a, button";
    document.addEventListener("pointerover", e => cursor.classList.toggle("hover", !!(e.target.closest && e.target.closest(HOT))));
    document.addEventListener("pointerdown", () => cursor.classList.add("down"));
    document.addEventListener("pointerup", () => cursor.classList.remove("down"));
    document.addEventListener("pointerleave", () => { cursor.classList.add("off"); cDot.classList.add("off"); });
    document.addEventListener("pointerenter", () => { cursor.classList.remove("off"); cDot.classList.remove("off"); });
    window.addEventListener("pointermove", () => { cursor.classList.remove("off"); cDot.classList.remove("off"); }, {passive: true, once: true});
  }

  /* ---------- magnetic buttons: they lean toward the pointer ---------- */
  if (FINE && !RM) $$(".btn").forEach(b => {
    b.addEventListener("pointermove", e => {
      const r = b.getBoundingClientRect();
      b.style.setProperty("--mx", ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + "px");
      b.style.setProperty("--my", ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + "px");
    });
    b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
  });

  /* ================= 3D scene + single loop ================= */
  let scene = null;
  try { scene = window.MedScene && window.MedScene.create($("#scene"), {mobile: MOBILE}); }
  catch (err) { console.warn("3D scene unavailable:", err); }
  const ecgCanvas = $("#ecg");
  const drawECG = ecgCanvas && !MOBILE && window.MedScene ? window.MedScene.ecgStrip(ecgCanvas) : null;

  // palm anchor (where the heart rests) — measured on resize, then shifted by parallax in JS (no layout reads per frame)
  const palmEl = $("#palm"), docIn = $("#docIn");
  let palmBase = [0, 0];
  function measurePalm(){
    if (!palmEl || !doc) return;
    const prevT = doc.style.transform, prevIn = docIn ? docIn.style.transform : "";
    doc.style.transition = "none"; doc.style.transform = "none"; if (docIn) docIn.style.transform = "none";
    const r = palmEl.getBoundingClientRect();
    palmBase = [r.left / innerWidth * 2 - 1, -(r.top / innerHeight * 2 - 1)];
    doc.style.transform = prevT; if (docIn) docIn.style.transform = prevIn;
    void doc.offsetWidth; doc.style.transition = "";
  }
  window.addEventListener("resize", () => { scene && scene.resize(); measurePalm(); });

  const bpmEl = $("#bpm"), PERIOD = window.MedScene ? window.MedScene.PERIOD : .8333;
  let t0 = 0, lastT = 0, lastNow = 0, lastBeat = -1, running = true, intro = 0;

  function frame(now){
    if (!running) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000, dt = Math.min(.05, t - lastT), frameMs = lastNow ? now - lastNow : 16.7;
    lastT = t; lastNow = now;
    if (intro < 1) intro = RM ? 1 : Math.min(1, t / 2.2);
    const gather = RM ? 1 : 1 - Math.pow(1 - Math.min(1, t / 2.4), 3);

    const bi = Math.floor(t / PERIOD);
    if (bi !== lastBeat && bpmEl){ lastBeat = bi; if (bi % 6 === 0) bpmEl.textContent = 70 + Math.round(Math.random() * 4); }

    if (cursor){
      rX += (cX - rX) * .18; rY += (cY - rY) * .18;
      cursor.style.transform = `translate3d(${rX.toFixed(1)}px, ${rY.toFixed(1)}px, 0)`;
      cDot.style.transform = `translate3d(${cX}px, ${cY}px, 0)`;
    }
    // during the DNA sequence the stage is covered: skip all of its work so the canvas owns the frame budget
    if (inIntro()){ requestAnimationFrame(frame); return; }

    const gap = Math.abs(pT - pS);
    pS += (pT - pS) * (RM ? 1 : touching ? .25 : gap > 1.5 ? .14 : .085);
    if (gap < .0004) pS = pT;
    if (started) setChapter(Math.round(pS));
    if (progress) progress.style.transform = `scaleX(${(pS / LAST).toFixed(4)})`;

    tX += (mY * .3 - tX) * .06; tY += (mX * .45 - tY) * .06;
    if (now - lastMove > 900) mTarget = 0;
    mPow += (mTarget - mPow) * .06;

    // portrait parallax: she drifts opposite the pointer; the palm anchor follows exactly
    const px = -tY * 22, py = -tX * 14;
    if (docIn && !RM) docIn.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
    const palm = [palmBase[0] + px / innerWidth * 2, palmBase[1] - py / innerHeight * 2];


    if (scene) scene.render({t, dt, frameMs, p: pS, intro, gather, tiltX: tX, tiltY: tY, mouse: [mNX, mNY], mPow, palm});
    if (drawECG) drawECG(t);
    requestAnimationFrame(frame);
  }

  // start once fonts are ready (so headings don't re-flow mid-animation), but never wait more than 1.2 s
  function start(){
    if (started) return; started = true;
    measurePalm();
    document.documentElement.classList.add("ready");
    if (!inIntro()) setChapter(Math.round(pS));
  }
  // the preloader stays at least 700 ms so its line finishes drawing
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]) : Promise.resolve();
  Promise.all([fontsReady, new Promise(r => setTimeout(r, RM ? 0 : 700))]).then(start);
  requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else if (!running){ running = true; lastNow = 0; t0 = performance.now() - lastT * 1000; requestAnimationFrame(frame); }
  });

  window.DrMariam = {go, get progress(){ return pS; }, get quality(){ return scene ? scene.quality : -1; }};
})();
