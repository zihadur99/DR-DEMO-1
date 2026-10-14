/* Dr. Mariam Nasrallah — hero DNA scroll sequence
   A pre-rendered DNA clip, cut into WebP frames, is drawn on a <canvas> and scrubbed by scroll
   while the hero is pinned. Smooth scrolling (Lenis, set up in main.js) feeds ScrollTrigger,
   so the frames glide with the page's momentum.

   Scroll length: frames × scroll-per-frame (data-sets "perFrame", a fraction of the viewport
   height). The pin releases on the last frame, so there is no dead scroll after the clip ends
   and a shorter or longer clip automatically gets a shorter or longer hero.

   Staying at 60 fps:
   - Frames arrive as compressed blobs (about 35 KB each) and are decoded off the main thread
     with createImageBitmap, so a scroll never waits on an image decode.
   - Only a window of frames around the playhead stays decoded (a decoded 1280×720 frame is
     3.7 MB; all 240 would be about 880 MB). The farthest frames are released first.
   - Frames load coarse-to-fine after the page has loaded (every 32nd, 16th … then every frame).
     Scrubbing works from the start; a frame that is not ready yet is replaced by the nearest one.
   - ScrollTrigger only moves a number. Drawing happens on gsap.ticker (requestAnimationFrame),
     only while the hero is on screen and only when the frame or canvas size changed.
   - Nothing reads layout during scroll: the canvas size comes from a ResizeObserver, the
     object-fit: cover crop is computed once per resize, and the canvas never holds more
     pixels than the frame has. */
(function () {
  "use strict";
  const hero = document.getElementById("home");
  const canvas = document.getElementById("seqCanvas");
  if (!hero || !canvas) return;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const {gsap, ScrollTrigger} = window;
  const animated = !RM && gsap && ScrollTrigger;

  /* ================= frame source ================= */
  const conn = navigator.connection || {};
  const SMALL = matchMedia("(max-width: 760px)").matches || conn.saveData || /(^|-)2g$|3g/.test(conn.effectiveType || "");
  const SET = SMALL ? "sm" : "lg";
  const {frames: N, w: SRC_W, h: SRC_H, perFrame: PER} = JSON.parse(canvas.dataset.sets)[SET];
  const url = i => canvas.dataset.src.replace("{set}", SET).replace("{n}", String(i + 1).padStart(4, "0"));

  // decoded-frame budget: about 150 MB on desktop, 60 MB on phones
  const CAP = Math.max(12, Math.floor((SMALL ? 60e6 : 150e6) / (SRC_W * SRC_H * 4)));
  const blobs = new Array(N);                  // compressed, kept for every frame
  const decoded = new Map();                   // index -> ImageBitmap | HTMLImageElement
  const decoding = new Set();
  const hasBitmap = typeof createImageBitmap === "function";

  let want = 0, drawn = -1, dirty = true;

  function decodeBlob(blob){
    if (hasBitmap) return createImageBitmap(blob);
    const img = new Image(), u = URL.createObjectURL(blob);   // Safari < 15
    img.src = u;
    return img.decode().then(() => { URL.revokeObjectURL(u); return img; });
  }
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

  let next = 0, inflight = 0;
  const PARALLEL = SMALL ? 4 : 6;
  function pump(limit){
    while (inflight < PARALLEL && next < Math.min(limit, order.length)){
      const i = order[next++];
      if (blobs[i]) continue;
      inflight++;
      // force-cache: repeat visits read straight from the HTTP cache (frames are served immutable)
      fetch(url(i), {cache: "force-cache", priority: i === 0 ? "high" : "low"})
        .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(b => { blobs[i] = b; if (Math.abs(i - want) <= 12 || drawn < 0) decode(i); })
        .catch(() => {})
        .finally(() => { inflight--; pump(limit); });
    }
  }
  pump(1);                                     // first frame now (also <link rel=preload>-ed)
  if (animated){                               // the rest once the page itself has finished loading
    const later = window.requestIdleCallback ? cb => requestIdleCallback(cb, {timeout: 800}) : cb => setTimeout(cb, 200);
    const all = () => later(() => pump(Infinity));
    if (document.readyState === "complete") all(); else window.addEventListener("load", all, {once: true});
  }

  /* ================= canvas ================= */
  const ctx = canvas.getContext("2d", {alpha: false});
  let cw = 0, dx = 0, dy = 0, dw = 0, dh = 0;

  function layout(cssW, cssH){
    if (!cssW || !cssH) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cover = Math.max(cssW / SRC_W, cssH / SRC_H);
    const scale = Math.min(dpr, 1 / cover) || 1;            // never more canvas pixels than frame pixels
    cw = Math.max(1, Math.round(cssW * scale));
    const ch = Math.max(1, Math.round(cssH * scale));
    canvas.width = cw; canvas.height = ch;
    const s = Math.max(cw / SRC_W, ch / SRC_H);              // object-fit: cover
    dw = SRC_W * s; dh = SRC_H * s; dx = (cw - dw) / 2; dy = (ch - dh) / 2;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    dirty = true;
    if (!animated) render();
  }
  if (window.ResizeObserver) new ResizeObserver(e => { const r = e[0].contentRect; layout(r.width, r.height); }).observe(canvas);
  else { const fit = () => layout(innerWidth, innerHeight); window.addEventListener("resize", fit); fit(); }

  function nearest(i){
    if (decoded.has(i)) return i;
    let best = -1, bd = Infinity;
    for (const k of decoded.keys()){ const d = Math.abs(k - i); if (d < bd){ bd = d; best = k; } }
    return best;
  }

  const state = {frame: 0};
  let dir = 1, lastWant = 0, onScreen = true;

  function render(){
    if (!onScreen || !cw) return;
    const i = Math.max(0, Math.min(N - 1, Math.round(state.frame)));
    if (i !== lastWant){ dir = i > lastWant ? 1 : -1; lastWant = i; }
    want = i;
    // keep the frames just ahead of the playhead decoded, plus a few behind for direction changes
    for (let k = 0; k <= 10 && decoding.size < 4; k++) decode(i + dir * k);
    for (let k = 1; k <= 3 && decoding.size < 4; k++) decode(i - dir * k);
    const f = nearest(i);
    if (f < 0 || (f === drawn && !dirty)) return;
    ctx.drawImage(decoded.get(f), dx, dy, dw, dh);
    drawn = f; dirty = f !== i;                // keep trying until the exact frame is on screen
  }

  /* ================= reduced motion / no GSAP: a still hero ================= */
  if (!animated){
    document.documentElement.classList.add("seq-static");
    const wait = () => { render(); if (drawn < 0) requestAnimationFrame(wait); };
    requestAnimationFrame(wait);
    window.HeroSequence = {frames: N, set: SET, animated: false};
    return;
  }

  /* ================= scroll → frame ================= */
  gsap.registerPlugin(ScrollTrigger);
  const pin = hero.querySelector(".hero-pin");
  const bar = hero.querySelector(".seq-bar i");
  const beats = [...hero.querySelectorAll(".beat")];
  const LEN = () => Math.round(N * PER * window.innerHeight);   // exactly one clip of scroll

  const tl = gsap.timeline({
    defaults: {ease: "none"},
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: () => "+=" + LEN(),
      pin,
      anticipatePin: 1,
      scrub: true,                              // Lenis already supplies the momentum; no second lag
      invalidateOnRefresh: true,
      onUpdate(self){ if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; }
    }
  });
  tl.to(state, {frame: N - 1, duration: 1}, 0);
  // copy beats over the clip: two short lines, then the hero headline that stays as the pin releases
  const last = beats.length - 1, slot = 1 / (last + .6);
  beats.forEach((b, k) => {
    const at = k * slot;
    if (k) tl.fromTo(b, {autoAlpha: 0, y: 46}, {autoAlpha: 1, y: 0, duration: slot * .3, ease: "power2.out"}, at);
    if (k < last) tl.to(b, {autoAlpha: 0, y: -46, duration: slot * .3, ease: "power2.in"}, at + slot * .62);
  });

  // draw only while the hero is on screen
  ScrollTrigger.create({
    trigger: hero, start: "top bottom", end: "bottom top",
    onToggle: self => { onScreen = self.isActive; if (onScreen) dirty = true; }
  });
  gsap.ticker.add(render);

  window.HeroSequence = {frames: N, set: SET, animated: true, get progress(){ return tl.scrollTrigger ? tl.scrollTrigger.progress : 0; }};
})();
