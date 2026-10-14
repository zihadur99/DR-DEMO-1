/* Dr. Mariam Nasrallah — page engine
   One vertical page: Hero (DNA sequence) → About → Services → Doctor → Contact.
   - Lenis gives the wheel momentum: the page keeps gliding after the wheel stops. It runs on
     gsap.ticker, so Lenis, ScrollTrigger and the hero canvas all share one requestAnimationFrame.
     Touch keeps the phone's own native momentum.
   - Reveals are class toggles (.in) from ScrollTrigger.batch. They replay every time a block
     scrolls back into view (the class is removed once it is fully off screen). The motion itself
     is CSS transitions on transform and opacity, so it runs on the GPU compositor.
   Visitors with "reduce motion" get native scrolling and no reveals. */
(function () {
  "use strict";
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const {gsap, ScrollTrigger, Lenis} = window;
  const GS = !!(gsap && ScrollTrigger);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();
  if (GS) gsap.registerPlugin(ScrollTrigger);

  /* ---------- split headings into masked words ---------- */
  $$("[data-split]").forEach(el => {
    let n = 0;
    const walk = node => [...node.childNodes].forEach(c => {
      if (c.nodeType === 3){
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(" ")); return; }
          const w = document.createElement("span"); w.className = "w";
          const s = document.createElement("span"); s.textContent = p; s.style.setProperty("--w", n++);
          w.appendChild(s); frag.appendChild(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && c.tagName !== "BR") walk(c);
    });
    walk(el);
  });

  /* ---------- smooth scroll with momentum ---------- */
  let lenis = null;
  if (!RM && Lenis){
    lenis = new Lenis({
      lerp: .085,              // lower = longer, softer glide after the wheel stops
      wheelMultiplier: .9,
      smoothWheel: true,
      syncTouch: false,        // phones keep their native momentum, which is already smooth
      autoRaf: !GS
    });
    if (GS){
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);           // never skip time after a slow frame: no jumps
    }
  }
  if (GS) ScrollTrigger.config({ignoreMobileResize: true});

  /* ---------- in-page links ---------- */
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  function scrollToTarget(hash, immediate){
    const el = hash === "#home" || hash === "#" ? 0 : $(hash);
    if (el === null) return false;
    if (lenis) lenis.scrollTo(el, {duration: immediate ? 0 : 1.6, easing: easeOut, immediate: !!immediate});
    else if (el === 0) window.scrollTo({top: 0, behavior: RM || immediate ? "auto" : "smooth"});
    else el.scrollIntoView({behavior: RM || immediate ? "auto" : "smooth"});
    return true;
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const h = a.getAttribute("href");
    if (scrollToTarget(h)){ e.preventDefault(); history.replaceState(null, "", h === "#home" ? location.pathname : h); }
  }));
  // deep link (#services etc.): jump once the pin spacer exists so the offset is right
  if (location.hash && location.hash !== "#home"){
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.addEventListener("load", () => requestAnimationFrame(() => scrollToTarget(location.hash, true)), {once: true});
  }

  /* ---------- reveals ---------- */
  const items = $$("[data-r], [data-split]");
  if (GS && !RM){
    const show = batch => batch.forEach((el, i) => { el.style.setProperty("--d", i * 90 + "ms"); el.classList.add("in"); });
    const hide = batch => batch.forEach(el => el.classList.remove("in"));
    ScrollTrigger.batch(items, {
      start: "top 92%",          // enters: a little above the bottom edge
      end: "bottom 8%",          // leaves: a little below the top edge
      onEnter: show, onEnterBack: show,
      onLeave: hide, onLeaveBack: hide   // reset while off screen, so it animates again next time
    });
  } else items.forEach(el => el.classList.add("in"));

  /* ---------- phone-number odometer ---------- */
  const odo = $("#odo");
  if (odo){
    odo.innerHTML = ""; let di = 0;
    for (const c of odo.dataset.number){
      if (/\d/.test(c)){
        const col = document.createElement("span"); col.className = "col"; col.setAttribute("aria-hidden", "true");
        const inner = document.createElement("span");
        for (let k = 0; k < 10; k++){ const s = document.createElement("span"); s.textContent = k; inner.appendChild(s); }
        inner.style.setProperty("--d", (300 + di++ * 80) + "ms"); inner.dataset.target = c;
        col.appendChild(inner); odo.appendChild(col);
      } else { const d = document.createElement("span"); d.className = "dash"; d.textContent = c; d.setAttribute("aria-hidden", "true"); odo.appendChild(d); }
    }
    const cols = $$(".col>span", odo);
    const roll = () => cols.forEach(s => { s.style.transition = ""; s.style.transform = `translate3d(0, ${-s.dataset.target}em, 0)`; });
    const reset = () => cols.forEach(s => { s.style.transition = "none"; s.style.transform = ""; });
    if (GS && !RM) ScrollTrigger.create({trigger: odo, start: "top 92%", end: "bottom 8%", onEnter: roll, onEnterBack: roll, onLeave: reset, onLeaveBack: reset});
    else roll();
  }

  /* ---------- nav: current section, solid bar after the hero starts moving, progress line ---------- */
  const nav = $("#nav"), navLinks = $$(".nav-links a"), progress = $("#progress");
  if (GS){
    $$("main > section[id]").forEach(sec => ScrollTrigger.create({
      trigger: sec, start: "top 45%", end: "bottom 45%",
      onToggle: self => { if (self.isActive) navLinks.forEach(a => a.classList.toggle("cur", a.getAttribute("href") === "#" + sec.id)); }
    }));
    ScrollTrigger.create({start: 40, end: "max", onToggle: self => nav && nav.classList.toggle("solid", self.isActive)});
    if (progress) ScrollTrigger.create({start: 0, end: "max", onUpdate: self => { progress.style.transform = `scaleX(${self.progress.toFixed(4)})`; }});
    // the portrait drifts a little slower than the page
    const photo = $(".doctor-photo img");
    if (photo && !RM) gsap.fromTo(photo, {yPercent: 6}, {yPercent: -6, ease: "none", scrollTrigger: {trigger: ".doctor-card", start: "top bottom", end: "bottom top", scrub: true}});
  }

  /* ---------- copy number ---------- */
  const copyBtn = $("#copyBtn");
  if (copyBtn) copyBtn.addEventListener("click", () => {
    const out = $("#copied"), num = "313-914-3666";
    const ok = () => { out.textContent = "Copied: " + num; setTimeout(() => out.textContent = "", 2600); };
    const no = () => { out.textContent = "Phone: " + num; };
    try { navigator.clipboard.writeText(num).then(ok, no); } catch (_) { no(); }
  });

  /* ---------- cursor: a glowing dot that sits exactly on the pointer, and a thin halo that
     follows it closely and opens up over links and buttons ---------- */
  if (FINE && !RM){
    const halo = document.createElement("div"), dot = document.createElement("div");
    halo.className = "cursor off"; halo.innerHTML = "<i></i>"; dot.className = "cursor-dot off";
    halo.setAttribute("aria-hidden", "true"); dot.setAttribute("aria-hidden", "true");
    document.body.append(halo, dot);
    document.documentElement.classList.add("has-cursor");
    let cX = -100, cY = -100, hX = -100, hY = -100, moved = false, still = true;
    const setOff = off => { halo.classList.toggle("off", off); dot.classList.toggle("off", off); };
    window.addEventListener("pointermove", e => {
      cX = e.clientX; cY = e.clientY; still = false;
      if (!moved){ moved = true; hX = cX; hY = cY; setOff(false); }
    }, {passive: true});
    document.addEventListener("pointerover", e => {
      const hot = !!(e.target.closest && e.target.closest("a, button"));
      halo.classList.toggle("hover", hot); dot.classList.toggle("hover", hot);
    });
    document.addEventListener("pointerdown", () => halo.classList.add("down"));
    document.addEventListener("pointerup", () => halo.classList.remove("down"));
    document.documentElement.addEventListener("pointerleave", () => { setOff(true); moved = false; });
    const tick = () => {
      if (!moved || still) return;
      // frame-rate independent follow: tight enough to feel attached, soft enough to feel smooth
      const k = 1 - Math.pow(1 - .32, GS ? gsap.ticker.deltaRatio(60) : 1);
      hX += (cX - hX) * k; hY += (cY - hY) * k;
      if (Math.abs(cX - hX) < .1 && Math.abs(cY - hY) < .1){ hX = cX; hY = cY; still = true; }   // rest: stop writing styles
      halo.style.transform = `translate3d(${hX.toFixed(2)}px, ${hY.toFixed(2)}px, 0)`;
      dot.style.transform = `translate3d(${cX}px, ${cY}px, 0)`;
    };
    if (GS) gsap.ticker.add(tick); else { const loop = () => { tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }

    // magnetic buttons: they lean toward the pointer
    $$(".btn").forEach(b => {
      b.addEventListener("pointermove", e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty("--mx", ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + "px");
        b.style.setProperty("--my", ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + "px");
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
    });
  }

  // fonts change heading heights: re-measure every trigger once they are in
  if (GS && document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  window.DrMariam = {lenis, scrollTo: scrollToTarget};
})();
