/* Dr. Mariam Nasrallah — hero scroll sequence ("scrollytelling")
   A pre-rendered DNA video, cut into WebP frames, is scrubbed by native scroll on a <canvas>
   before the cinematic chapter stage (main.js) takes over.

   How it stays at 60 fps:
   - Frames arrive as compressed blobs (about 35 KB each) and are decoded off the main thread
     with createImageBitmap, so scrolling never waits on a JPEG/WebP decode.
   - Only a window of frames around the playhead is kept decoded, evicting the farthest first,
     so memory stays bounded (a decoded 1280×720 frame is 3.7 MB; all 240 would be ~880 MB).
   - Frames load coarse-to-fine (every 32nd, then 16th … then every frame). Scrubbing works
     from the first second; until a frame is ready, the nearest decoded one is drawn.
   - GSAP ScrollTrigger only moves a number (state.frame). Drawing happens once per tick on
     gsap.ticker (requestAnimationFrame), and only when the frame or canvas size changed.
   - The canvas is sized from a ResizeObserver, never measured inside the loop, and its backing
     store never holds more pixels than the source frame can fill.

   Hand-off: when the sequence reaches its last frame the page locks and main.js's chapter stage
   fades in. Scrolling up from the first chapter comes back here (HeroSequence.reenter).
   Exposes window.HeroSequence. */
(function () {
  "use strict";
  const root = document.documentElement;
  const section = document.getElementById("seq");
  const canvas = document.getElementById("seqCanvas");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mode = root.classList.contains("intro") ? "intro" : "stage";
  const emit = name => window.dispatchEvent(new CustomEvent(name));

  function enterStage(){
    if (mode === "stage") return;
    mode = "stage";
    root.classList.remove("intro");
    emit("seq:exit");
  }

  // no canvas, no GSAP, or reduced motion: go straight to the stage and never come back
  if (!section || !canvas || RM || !window.gsap || !window.ScrollTrigger){
    if (section) section.hidden = true;
    root.classList.remove("intro");
    mode = "stage";
    window.HeroSequence = {available: false, get active(){ return false; }, skip(){}, reenter(){}};
    return;
  }

  /* ================= frame source ================= */
  const conn = navigator.connection || {};
  const SMALL = matchMedia("(max-width: 760px)").matches || conn.saveData || /(^|-)2g$|3g/.test(conn.effectiveType || "");
  const SETS = JSON.parse(canvas.dataset.sets);
  const SET = SMALL ? "sm" : "lg";
  const {frames: N, w: SRC_W, h: SRC_H} = SETS[SET];
  const url = i => canvas.dataset.src.replace("{set}", SET).replace("{n}", String(i + 1).padStart(4, "0"));

  // decoded-frame budget: about 150 MB on desktop, 60 MB on phones
  const FRAME_BYTES = SRC_W * SRC_H * 4;
  const CAP = Math.max(12, Math.floor((SMALL ? 60e6 : 150e6) / FRAME_BYTES));

  const blobs = new Array(N);                 // compressed, kept for every frame (small)
  const decoded = new Map();                  // index -> ImageBitmap | HTMLImageElement
  const decoding = new Set();
  const hasBitmap = typeof createImageBitmap === "function";

  function decodeBlob(blob){
    if (hasBitmap) return createImageBitmap(blob);
    // Safari < 15 fallback: <img> + decode(), still off the critical path
    const img = new Image(), u = URL.createObjectURL(blob);
    img.src = u;
    return img.decode().then(() => { URL.revokeObjectURL(u); return img; });
  }

  let want = 0;                                // frame the playhead wants right now
  function evict(){
    while (decoded.size > CAP){
      let far = -1, farD = -1;
      for (const k of decoded.keys()){ const d = Math.abs(k - want); if (d > farD){ farD = d; far = k; } }
      const bmp = decoded.get(far);
      if (bmp && bmp.close) bmp.close();
      decoded.delete(far);
    }
  }
  function decode(i){
    if (i < 0 || i >= N || decoded.has(i) || decoding.has(i) || !blobs[i]) return;
    decoding.add(i);
    decodeBlob(blobs[i]).then(bmp => {
      decoding.delete(i);
      decoded.set(i, bmp); evict();
      if (Math.abs(i - want) <= 2 || drawn < 0) dirty = true;
    }, () => decoding.delete(i));
  }

  // coarse-to-fine download order: 0, then every 32nd, 16th, 8th, 4th, 2nd, 1st frame
  const order = [0];
  const queued = new Uint8Array(N); queued[0] = 1;
  for (const step of [32, 16, 8, 4, 2, 1]) for (let i = 0; i < N; i += step) if (!queued[i]){ queued[i] = 1; order.push(i); }
  order.push(N - 1);

  let next = 0, inflight = 0;
  const PARALLEL = SMALL ? 4 : 6;
  function pump(){
    while (inflight < PARALLEL && next < order.length){
      const i = order[next++];
      if (blobs[i]) continue;
      inflight++;
      // force-cache: repeat visits read straight from the HTTP cache (frames are served immutable)
      fetch(url(i), {cache: "force-cache", priority: i === 0 ? "high" : "low"})
        .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(b => { blobs[i] = b; if (Math.abs(i - want) <= 12 || drawn < 0) decode(i); })
        .catch(() => {})
        .finally(() => { inflight--; pump(); });
    }
  }
  // first frame now (it is also <link rel=preload>-ed), the rest after the page has loaded
  pump();
  const later = window.requestIdleCallback ? cb => requestIdleCallback(cb, {timeout: 800}) : cb => setTimeout(cb, 200);
  if (document.readyState === "complete") later(pump); else window.addEventListener("load", () => later(pump), {once: true});

  /* ================= canvas ================= */
  const ctx = canvas.getContext("2d", {alpha: false});
  let cw = 0, ch = 0, dirty = true, drawn = -1;
  let dx = 0, dy = 0, dw = 0, dh = 0;           // cover rectangle, computed on resize only

  function layout(cssW, cssH){
    if (!cssW || !cssH) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // never allocate more canvas pixels than the source frame can fill (CSS scales the rest on the GPU)
    const cover = Math.max(cssW / SRC_W, cssH / SRC_H);
    const scale = Math.min(dpr, 1 / cover) || 1;
    cw = Math.max(1, Math.round(cssW * scale)); ch = Math.max(1, Math.round(cssH * scale));
    canvas.width = cw; canvas.height = ch;
    // object-fit: cover, done once here instead of per frame
    const s = Math.max(cw / SRC_W, ch / SRC_H);
    dw = SRC_W * s; dh = SRC_H * s; dx = (cw - dw) / 2; dy = (ch - dh) / 2;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    dirty = true;
  }
  if (window.ResizeObserver){
    new ResizeObserver(e => { const r = e[0].contentRect; layout(r.width, r.height); }).observe(canvas);
  } else {
    const fit = () => layout(innerWidth, innerHeight);
    window.addEventListener("resize", fit); fit();
  }

  function nearest(i){
    if (decoded.has(i)) return i;
    let best = -1, bd = Infinity;
    for (const k of decoded.keys()){ const d = Math.abs(k - i); if (d < bd){ bd = d; best = k; } }
    return best;
  }

  /* ================= scroll → frame ================= */
  const state = {frame: 0};
  let dir = 1, lastWant = 0;

  function render(){
    if (mode !== "intro" || !cw) return;
    const i = Math.max(0, Math.min(N - 1, Math.round(state.frame)));
    if (i !== lastWant){ dir = i > lastWant ? 1 : -1; lastWant = i; }
    want = i;
    // keep the frames just ahead of the playhead decoded (a few behind for direction changes)
    for (let k = 0; k <= 10 && decoding.size < 4; k++) decode(i + dir * k);
    for (let k = 1; k <= 3 && decoding.size < 4; k++) decode(i - dir * k);
    const f = nearest(i);
    if (f < 0 || (f === drawn && !dirty)) return;
    ctx.drawImage(decoded.get(f), dx, dy, dw, dh);
    drawn = f; dirty = f !== i;                  // keep trying until the exact frame is on screen
  }

  const {gsap, ScrollTrigger} = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ignoreMobileResize: true});
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (mode === "intro") window.scrollTo(0, 0);

  const pin = section.querySelector(".seq-pin");
  const bar = section.querySelector(".seq-bar i");
  const beats = [...section.querySelectorAll(".beat")];
  const LEN = () => window.innerHeight * (SMALL ? 3.2 : 4);   // scroll distance of the whole sequence

  const tl = gsap.timeline({
    defaults: {ease: "none"},
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => "+=" + LEN(),
      pin,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 0.2,                                // light damping: tracks the wheel without stepping
      invalidateOnRefresh: true,
      fastScrollEnd: true,
      onUpdate(self){
        if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
        if (self.progress > .998 && self.direction > 0) enterStage();
      }
    }
  });
  tl.to(state, {frame: N - 1, duration: 1}, 0);
  // copy beats: the first is visible on load, the others fade through with the scroll
  beats.forEach((b, k) => {
    const at = k * .34;
    if (k) tl.fromTo(b, {autoAlpha: 0, y: 50}, {autoAlpha: 1, y: 0, duration: .09, ease: "power2.out"}, at);
    if (k < beats.length - 1) tl.to(b, {autoAlpha: 0, y: -50, duration: .09, ease: "power2.in"}, at + .22);
  });
  gsap.ticker.add(render);

  // already at the bottom and still pushing down (no scroll left to fire onUpdate): hand off
  const atEnd = () => tl.scrollTrigger && window.scrollY >= tl.scrollTrigger.end - 2;
  window.addEventListener("wheel", e => { if (mode === "intro" && e.deltaY > 0 && atEnd()) enterStage(); }, {passive: true});
  window.addEventListener("keydown", e => { if (mode === "intro" && ["ArrowDown", "PageDown", " ", "End"].includes(e.key) && atEnd()) enterStage(); });
  let ty = 0;
  window.addEventListener("touchstart", e => { ty = e.touches[0].clientY; }, {passive: true});
  window.addEventListener("touchmove", e => { if (mode === "intro" && ty - e.touches[0].clientY > 30 && atEnd()) enterStage(); }, {passive: true});

  /* ================= public API (used by main.js) ================= */
  function skip(){
    if (mode !== "intro") return;
    window.scrollTo(0, tl.scrollTrigger.end);
    enterStage();
  }
  function reenter(){
    if (mode !== "stage") return;
    mode = "intro";
    root.classList.remove("no-intro");
    root.classList.add("intro");
    dirty = true; drawn = -1;
    // step back a little so the next scroll keeps travelling up through the sequence
    const st = tl.scrollTrigger;
    window.scrollTo(0, Math.max(0, st.end - window.innerHeight * .08));
    ScrollTrigger.update();
    // jump the scrub straight to the new position instead of sweeping through every frame
    const tw = st.getTween && st.getTween();
    if (tw) tw.progress(1);
    emit("seq:enter");
  }
  const skipBtn = document.getElementById("seqSkip");
  if (skipBtn) skipBtn.addEventListener("click", skip);

  window.HeroSequence = {available: true, get active(){ return mode === "intro"; }, skip, reenter, frames: N, set: SET};
})();
