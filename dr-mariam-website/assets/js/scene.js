/* Dr. Mariam Nasrallah — 3D particle sculpture
   One WebGL point cloud that morphs between ten medical shapes, one per chapter:
   heart (on her palm) → DNA → capsule → cross → family → knot → shield → ECG → bloom → heart (back on her palm).
   Smoothness: shapes are built in idle time after first paint, and quality steps down
   automatically (resolution, then particle count) if a device can't hold ~50 fps.
   No libraries. Exposes window.MedScene. */
(function () {
  "use strict";

  /* ---------- heartbeat (shared with the ECG strip) ---------- */
  const PERIOD = 60 / 72;
  const g = (x, c, w) => { const u = (x - c) / w; return Math.exp(-u * u); };
  const ecg = ph => .12*g(ph,.12,.025) - .12*g(ph,.215,.008) + 1*g(ph,.235,.01) - .26*g(ph,.258,.01) + .26*g(ph,.45,.045);
  const beatAt = ph => .07*g(ph,.245,.04) + .032*g(ph,.47,.05);

  const rnd = Math.random, TAU = Math.PI * 2;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const sphereDir = () => { const u = rnd()*2-1, t = rnd()*TAU, s = Math.sqrt(1-u*u); return [s*Math.cos(t), u, s*Math.sin(t)]; };

  /* ---------- shapes: each returns Float32Array(n*4) of x, y, z, tone (0 sage · .5 blush · 1 champagne) ---------- */
  function make(n, fn){ const A = new Float32Array(n*4); for (let i = 0; i < n; i++){ const r = fn(i); A[i*4]=r[0]; A[i*4+1]=r[1]; A[i*4+2]=r[2]; A[i*4+3]=r[3]; } return A; }

  const SHAPES = {
    heart(n){
      const F = (x,y,z) => { const a = x*x + 2.25*y*y + z*z - 1; return a*a*a - x*x*z*z*z - .1125*y*y*z*z*z; };
      return make(n, i => {
        const [dx, dz, dy] = sphereDir();
        let lo = 0, hi = 1.9;
        for (let it = 0; it < 20; it++){ const m = (lo+hi)/2; F(dx*m,dy*m,dz*m) < 0 ? lo = m : hi = m; }
        const r = i % 6 ? lo * (1 - rnd()*.03) : lo * Math.cbrt(rnd()) * .9;
        return [dx*r, dz*r - .08, dy*r, .5 + .5 * Math.min(1, Math.max(0, (dz*r + .9) / 2))];
      });
    },
    helix(n){
      return make(n, i => {
        const H = 2.8, turns = 2.1, R = .6;
        if (i % 10 < 7){
          const k = rnd(), st = i % 2, a = k*turns*TAU + st*Math.PI, j = .035;
          return [Math.cos(a)*R + (rnd()-.5)*j, (k-.5)*H + (rnd()-.5)*j, Math.sin(a)*R + (rnd()-.5)*j, st ? 1 : .02];
        }
        const steps = 26, k = (Math.floor(rnd()*steps)+.5)/steps, a = k*turns*TAU, l = rnd()*2-1;
        return [Math.cos(a)*R*l, (k-.5)*H, Math.sin(a)*R*l, .5];
      });
    },
    capsule(n){
      return make(n, i => {
        const L = 1.4, r = .46, ang = -.62; let x, y, z, tone;
        const shrink = i % 8 ? 1 : Math.cbrt(rnd());
        if (rnd() < .6){ const u = (rnd()-.5)*L, t = rnd()*TAU; x = u; y = Math.cos(t)*r*shrink; z = Math.sin(t)*r*shrink; tone = u < 0 ? .5 : 1; }
        else { const d = sphereDir(), c = d[0] < 0 ? -L/2 : L/2; x = c + d[0]*r*shrink; y = d[1]*r*shrink; z = d[2]*r*shrink; tone = c < 0 ? .5 : 1; }
        if (Math.abs(x) < .012) tone = 0;
        return [x*Math.cos(ang) - y*Math.sin(ang), x*Math.sin(ang) + y*Math.cos(ang), z, tone];
      });
    },
    cross(n){
      const B = [[.32,.98,.24],[.98,.32,.24]];
      const inBox = (p, h, m) => Math.abs(p[0]) < h[0]-m && Math.abs(p[1]) < h[1]-m && Math.abs(p[2]) < h[2]-m;
      return make(n, () => {
        for (;;){
          const h = rnd() < .5 ? B[0] : B[1], o = h === B[0] ? B[1] : B[0];
          const p = [(rnd()*2-1)*h[0], (rnd()*2-1)*h[1], (rnd()*2-1)*h[2]];
          const dd = [h[0]-Math.abs(p[0]), h[1]-Math.abs(p[1]), h[2]-Math.abs(p[2])];
          const ax = dd[0] < dd[1] ? (dd[0] < dd[2] ? 0 : 2) : (dd[1] < dd[2] ? 1 : 2);
          p[ax] = Math.sign(p[ax] || 1) * h[ax];
          if (inBox(p, o, .005)) continue;
          return [p[0], p[1], p[2], .5 + .5 * Math.min(1, Math.max(Math.abs(p[0]), Math.abs(p[1])) / .98)];
        }
      });
    },
    family(n){
      const O = [[-.55,.3,0,.64,.5],[.62,.18,.1,.52,1],[.06,-.64,.2,.34,.02]];
      return make(n, i => {
        const q = rnd(), o = q < .5 ? O[0] : q < .85 ? O[1] : O[2];
        const d = sphereDir(), r = o[3] * (i % 7 ? 1 - rnd()*.03 : Math.cbrt(rnd()));
        return [o[0] + d[0]*r, o[1] + d[1]*r, o[2] + d[2]*r, o[4]];
      });
    },
    knot(n){
      return make(n, () => {
        const phi = rnd()*TAU, rr = Math.cos(3*phi) + 2, s = .36;
        const c = [rr*Math.cos(2*phi)*s, rr*Math.sin(2*phi)*s, -Math.sin(3*phi)*s*1.2];
        const d = sphereDir(), tr = .1 * (.88 + rnd()*.12);
        return [c[0] + d[0]*tr, c[1] + d[1]*tr, c[2] + d[2]*tr, Math.sin(phi*2) * .5 + .5];
      });
    },
    shield(n){
      const inside = (x, y) => { if (y > .95 - .08*x*x) return false; if (y >= .12) return Math.abs(x) < .82; return Math.abs(x) < .82 * Math.sqrt(Math.max(0, (y + 1.06) / 1.18)); };
      const seg = [[-.38,.02],[-.1,-.3],[.42,.36]];
      return make(n, i => {
        if (i % 6 === 0){
          const t = rnd(), a = t < .35 ? 0 : 1, k = a ? (t - .35) / .65 : t / .35;
          const P = seg[a], Q = seg[a+1];
          return [P[0] + (Q[0]-P[0])*k + (rnd()-.5)*.05, P[1] + (Q[1]-P[1])*k + (rnd()-.5)*.05, .3 + (rnd()-.5)*.05, 1];
        }
        for (;;){
          const x = (rnd()*2-1)*.86, y = rnd()*2.05 - 1.08;
          if (!inside(x, y)) continue;
          const front = rnd() < .7, edge = !inside(x*1.07, y*1.04 + (y < 0 ? -.03 : .02));
          const z = front ? .22*(1 - (x/.86)*(x/.86)) : -.08;
          return [x, y, z, edge ? .5 : .02];
        }
      });
    },
    ecg(n){
      const M = 900, pts = [], cum = [0];
      for (let j = 0; j < M; j++){ const x = -1.75 + 3.5*j/(M-1), ph = ((x + 1.75) / 1.75) % 1; pts.push([x, ecg(ph)*1.05 - .28]); if (j) cum.push(cum[j-1] + Math.hypot(x - pts[j-1][0], pts[j][1] - pts[j-1][1])); }
      const total = cum[M-1];
      return make(n, i => {
        if (i % 7 === 0){ // faint monitor-grid floor
          const gx = (Math.floor(rnd()*18) / 17)*3.4 - 1.7, gz = (rnd()*2-1)*.6;
          return rnd() < .5 ? [gx, -.7, gz, .02] : [(rnd()*2-1)*1.7, -.7, Math.round(gz*5)/5, .02];
        }
        const s = rnd()*total; let lo = 0, hi = M-1;
        while (hi - lo > 1){ const m = (lo+hi) >> 1; cum[m] < s ? lo = m : hi = m; }
        const f = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
        const x = pts[lo][0] + (pts[hi][0]-pts[lo][0])*f, y = pts[lo][1] + (pts[hi][1]-pts[lo][1])*f;
        return [x, y + (rnd()-.5)*.02, (rnd()*2-1)*.32, .5 + .5*Math.min(1, Math.max(0, (y + .28) / .9))];
      });
    },
    bloom(n){
      return make(n, i => {
        if (i % 12 === 0){ const d = sphereDir(), r = .13*Math.cbrt(rnd()); return [d[0]*r, d[1]*r + .05, d[2]*r + .2, 1]; }
        const layer = i % 3, th = rnd()*TAU, edge = rnd() < .4;
        const rmax = (.4 + .64*Math.abs(Math.cos(2.5*th + layer*.63))) * (1 - layer*.2);
        const s = edge ? 1 : Math.sqrt(rnd()), r = s * rmax;
        const x = r*Math.cos(th), y = r*Math.sin(th), z = .7*r*r - .25 + layer*.1;
        const a = -1.05, yy = y*Math.cos(a) - z*Math.sin(a), zz = y*Math.sin(a) + z*Math.cos(a);
        return [x, yy - .05, zz, 1 - .5*s];
      });
    }
  };

  // one entry per chapter: shape, spin rate, faces front (1) or free-spins (0), scale, brightness
  const CHAPTERS = [
    {shape:"heart",   spin:0,   face:1, s:.47,  a:1,   palm:1},
    {shape:"helix",   spin:.5,  face:0, s:1.0,  a:.95},
    {shape:"capsule", spin:.38, face:0, s:1.05, a:.95},
    {shape:"cross",   spin:0,   face:1, s:.95,  a:.95},
    {shape:"family",  spin:.22, face:0, s:1.0,  a:.9},
    {shape:"knot",    spin:.3,  face:0, s:1.05, a:.95},
    {shape:"shield",  spin:0,   face:1, s:1.0,  a:.95},
    {shape:"ecg",     spin:0,   face:1, s:1.0,  a:1},
    {shape:"bloom",   spin:0,   face:1, s:1.05, a:1},
    {shape:"heart",   spin:0,   face:1, s:.47,  a:1,   palm:1}
  ];

  const VS = `
attribute vec4 a; attribute vec4 b; attribute vec2 s;
uniform float t, beat, k, rot, tiltX, tiltY, aspect, dpr, alpha, scale, mPow, gather;
uniform vec2 mouse, off;
varying float vA; varying vec3 vC;
mat3 ry(float r){float c=cos(r),n=sin(r);return mat3(c,0.,-n, 0.,1.,0., n,0.,c);}
mat3 rx(float r){float c=cos(r),n=sin(r);return mat3(1.,0.,0., 0.,c,n, 0.,-n,c);}
void main(){
  float sd = s.x; float dust = s.y;
  float km = clamp(k*1.7 - fract(sd*5.13)*.7, 0., 1.); km = km*km*(3.-2.*km);
  vec3 q = mix(a.xyz, b.xyz, km);
  float tone = mix(a.w, b.w, km);
  float ch = sin(km*3.14159) * (1. - dust);
  float sw = ch * (1.4 + fract(sd*9.7)*2.2);
  float cs = cos(sw), sn = sin(sw);
  q.xz = mat2(cs, -sn, sn, cs) * q.xz;
  vec3 rd = normalize(vec3(sin(sd*91.7)+.001, cos(sd*47.3), sin(sd*13.9+1.3)));
  q += rd * ch * .8 * fract(sd*7.31);
  q *= 1. + beat * (1. - dust);
  q = mix(rd * (2.4 + fract(sd*3.7)*2.8), q, mix(1., gather, 1. - dust));
  q += .017*vec3(sin(t*1.3+sd*40.), cos(t*1.1+sd*31.), sin(t*.9+sd*23.));
  if (dust > .5) { q.y += sin(t*.15 + sd*20.)*.15; q = rx(tiltX*.25) * ry(tiltY*.25 + t*.012) * q; }
  else q = rx(tiltX) * ry(rot + tiltY) * (q * scale);
  float z = q.z + 4.4;
  vec2 xy = q.xy * 2.7 / z;
  float S = min(1.0, aspect) * .9;
  vec2 ndc = vec2(xy.x / aspect * S, xy.y * S) + off * (1. - dust);
  vec2 dm = ndc - mouse; dm.x *= aspect;
  float push = mPow * smoothstep(.32, 0., length(dm)) * (1. - dust*.7);
  ndc += normalize(dm + 1e-4) * push * .1 * vec2(1. / aspect, 1.);
  gl_Position = vec4(ndc, 0., 1.);
  float near = 1. - smoothstep(3., 6.5, z);
  gl_PointSize = mix(2.5 * mix(1., clamp(scale * 1.6, .55, 1.), .6), 1.7, dust) * dpr * (4.4 / z) * (.85 + near*.7) * (1. + beat*2.*(1. - dust)) * (1. + push);
  vec3 sage = vec3(.50,.74,.68), blush = vec3(.93,.60,.53), gold = vec3(.96,.80,.52);
  vC = tone < .5 ? mix(sage, blush, tone*2.) : mix(blush, gold, tone*2.-1.);
  vC = mix(vC, vec3(1.,.95,.86), push*.6);
  float tw = .65 + .35*sin(t*1.7 + sd*60.);
  vA = alpha * mix((.3 + near*.85) * (.65 + .35*fract(sd*3.17)), .3*tw, dust) * (1. + push*1.5);
}`;
  const FS = `
precision mediump float; varying float vA; varying vec3 vC;
void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard;
  float a = smoothstep(.5, .0, d); a *= a * vA; gl_FragColor = vec4(vC * a, a); }`;

  function create(canvas, opts){
    const mobile = !!opts.mobile;
    const NS = mobile ? 4200 : 7200, ND = mobile ? 450 : 1100, NT = NS + ND;
    const baseDPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.6);
    // quality ladder: resolution first, then particle count
    const LEVELS = [
      {dpr: baseDPR,                 frac: 1},
      {dpr: Math.min(baseDPR, 1.25), frac: 1},
      {dpr: Math.min(baseDPR, 1),    frac: .78},
      {dpr: Math.min(baseDPR, .85),  frac: .58}
    ];
    let level = 0, DPR = LEVELS[0].dpr;
    const gl = canvas.getContext("webgl", {antialias:false, alpha:true, premultipliedAlpha:true, depth:false, stencil:false, powerPreference:"high-performance", desynchronized:true});
    if (!gl) return null;

    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    // ambient dust is identical in every shape buffer, so it never morphs
    const dust = new Float32Array(ND*4);
    for (let i = 0; i < ND; i++){ dust[i*4] = (rnd()*2-1)*5.5; dust[i*4+1] = (rnd()*2-1)*3.2; dust[i*4+2] = rnd()*5.5 - 2.4; dust[i*4+3] = rnd() < .5 ? 0 : rnd() < .5 ? .5 : 1; }
    const bufs = {};
    function ensure(name){
      if (bufs[name]) return bufs[name];
      const all = new Float32Array(NT*4); all.set(SHAPES[name](NS), 0); all.set(dust, NS*4);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, all, gl.STATIC_DRAW);
      return (bufs[name] = b);
    }
    ensure("heart");
    // build the other shapes in idle time, in chapter order, so the first paint stays instant
    const pending = [...new Set(CHAPTERS.map(c => c.shape))].filter(n => n !== "heart");
    const idle = window.requestIdleCallback ? cb => window.requestIdleCallback(cb, {timeout: 1200}) : cb => setTimeout(cb, 80);
    const pump = () => { const n = pending.shift(); if (!n) return; ensure(n); idle(pump); };
    setTimeout(() => idle(pump), 500);

    const seeds = new Float32Array(NT*2);
    for (let i = 0; i < NT; i++){ seeds[i*2] = rnd(); seeds[i*2+1] = i >= NS ? 1 : 0; }
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const L = {a: gl.getAttribLocation(prog, "a"), b: gl.getAttribLocation(prog, "b"), s: gl.getAttribLocation(prog, "s")};
    gl.enableVertexAttribArray(L.a); gl.enableVertexAttribArray(L.b); gl.enableVertexAttribArray(L.s);
    gl.vertexAttribPointer(L.s, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST); gl.clearColor(0,0,0,0);
    const U = {}; ["t","beat","k","rot","tiltX","tiltY","aspect","dpr","alpha","scale","mPow","gather","mouse","off"].forEach(n => U[n] = gl.getUniformLocation(prog, n));

    let boundA = null, boundB = null, rot = 0;
    function bind(nA, nB){
      const bA = ensure(nA), bB = ensure(nB);
      if (bA !== boundA){ gl.bindBuffer(gl.ARRAY_BUFFER, bA); gl.vertexAttribPointer(L.a, 4, gl.FLOAT, false, 0, 0); boundA = bA; }
      if (bB !== boundB){ gl.bindBuffer(gl.ARRAY_BUFFER, bB); gl.vertexAttribPointer(L.b, 4, gl.FLOAT, false, 0, 0); boundB = bB; }
    }
    function resize(){
      canvas.width = Math.round(window.innerWidth * DPR); canvas.height = Math.round(window.innerHeight * DPR);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();

    // frame-time watchdog: after warm-up, average 90 frames; step quality down if slower than ~48 fps
    let warm = 0, acc = 0, n = 0;
    function watch(ms){
      if (warm < 120){ warm++; return; }
      acc += ms; n++;
      if (n >= 90){
        const avg = acc / n; acc = 0; n = 0;
        if (avg > 21 && level < LEVELS.length - 1){ level++; DPR = LEVELS[level].dpr; resize(); warm = 60; }
      }
    }

    /* state: {t, dt, frameMs, p (0..9), intro, gather, tiltX, tiltY, mouse:[x,y], mPow, palm:[x,y] in NDC} */
    function render(st){
      if (st.frameMs) watch(st.frameMs);
      const last = CHAPTERS.length - 1;
      const p = Math.max(0, Math.min(last, st.p));
      const i0 = Math.min(last, Math.floor(p)), i1 = Math.min(last, i0 + 1);
      const k = sstep(.22, .78, p - i0);
      const A = CHAPTERS[i0], B = CHAPTERS[i1];
      const face = A.face + (B.face - A.face) * k;
      rot += (A.spin + (B.spin - A.spin) * k) * st.dt;
      if (face > .5){ const target = Math.round(rot / TAU) * TAU; rot += (target - rot) * .03; }
      const palm = st.palm || [0, 0];
      const pk = sstep(.1, .9, p - i0);            // heart glides between her palm and the centre
      const offA = A.palm ? palm : [0, 0], offB = B.palm ? palm : [0, 0];
      bind(A.shape, B.shape);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.t, st.t); gl.uniform1f(U.beat, beatAt((st.t % PERIOD) / PERIOD)); gl.uniform1f(U.k, k);
      gl.uniform1f(U.rot, rot + face * Math.sin(st.t * .5) * .42);
      gl.uniform1f(U.tiltX, -.08 + st.tiltX); gl.uniform1f(U.tiltY, st.tiltY);
      gl.uniform1f(U.aspect, canvas.width / canvas.height); gl.uniform1f(U.dpr, DPR);
      gl.uniform1f(U.alpha, (A.a + (B.a - A.a) * k) * (mobile ? (A.palm && B.palm ? .9 : .5) : 1) * (.25 + .75 * st.intro));
      gl.uniform1f(U.scale, (A.s + (B.s - A.s) * k) * (mobile ? .92 : .74));
      gl.uniform1f(U.gather, st.gather == null ? 1 : st.gather);
      gl.uniform1f(U.mPow, st.mPow); gl.uniform2f(U.mouse, st.mouse[0], st.mouse[1]);
      gl.uniform2f(U.off, offA[0] + (offB[0] - offA[0]) * pk, offA[1] + (offB[1] - offA[1]) * pk);
      const frac = LEVELS[level].frac;
      gl.drawArrays(gl.POINTS, 0, Math.floor(NS * frac));
      gl.drawArrays(gl.POINTS, NS, Math.floor(ND * Math.max(.5, frac)));
    }
    return {render, resize, get quality(){ return level; }};
  }

  /* ---------- small sweeping ECG trace for the HUD ---------- */
  function ecgStrip(canvas){
    const dpr = Math.min(window.devicePixelRatio || 1, 2), ctx = canvas.getContext("2d");
    canvas.width = 110 * dpr; canvas.height = 28 * dpr;
    return function draw(t){
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const sweep = 2.6, cur = ((t % sweep) / sweep) * W, step = 2 * dpr, gap = W * .08;
      const yOf = x => { let age = (cur - x) / W * sweep; if (age < 0) age += sweep; const ph = (((t - age) / PERIOD) % 1 + 1) % 1; return H * .74 - ecg(ph) * H * .62; };
      const seg = (x0, x1, al) => { if (x1 <= x0) return; ctx.beginPath(); ctx.strokeStyle = `rgba(216,181,122,${al})`; for (let x = x0; x <= x1; x += step){ const y = yOf(x); x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); };
      ctx.lineWidth = 1.4 * dpr; ctx.lineJoin = "round";
      seg(cur + gap, W, .3); seg(0, cur, .95);
      ctx.fillStyle = "#FFF3DC"; ctx.beginPath(); ctx.arc(cur, yOf(cur), 2 * dpr, 0, TAU); ctx.fill();
    };
  }

  window.MedScene = {create, ecgStrip, PERIOD, chapters: CHAPTERS.length};
})();
