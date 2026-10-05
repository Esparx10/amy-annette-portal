import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ utilities
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const G = new Float32Array(256);
  for (let i = 0; i < 256; i++) G[i] = rnd();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = G[P[P[X] + Y]], b = G[P[P[X + 1] + Y]], c = G[P[P[X] + Y + 1]], d = G[P[P[X + 1] + Y + 1]];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, oct = 5) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += amp * n2(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  }
  return { n2, fbm };
}

const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const C = {
  honey: hex(0xf7c35c), amber: hex(0xea9a32), ruby: hex(0xb01440), rubyPink: hex(0xe23a66),
  coral: hex(0xf2603f), peach: hex(0xffb487),
  leafDeep: hex(0x1f6a3e), leaf: hex(0x3f9a52), leafLight: hex(0x9cc95c), leafGold: hex(0xd9c463),
};

function makeCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ------------------------------------------------------------------ textures
// Glass textures live in the sheet's parameter space: u runs across (-1..1), v runs base -> tip (0..1).
function fieldToCanvas(M, N, fn) {
  const small = makeCanvas(M);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(M, M);
  for (let py = 0; py < M; py++) {
    const r = 1 - (py + 0.5) / M;
    for (let px = 0; px < M; px++) {
      const p = ((px + 0.5) / M) * 2 - 1;
      const c = fn(p, r);
      const i = (py * M + px) * 4;
      img.data[i] = clamp(c[0] * 255, 0, 255);
      img.data[i + 1] = clamp(c[1] * 255, 0, 255);
      img.data[i + 2] = clamp(c[2] * 255, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  const big = makeCanvas(N);
  const ctx = big.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, N, N);
  return big;
}

function strokeVariable(ctx, pts, w0, w1, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let k = 1; k < pts.length; k++) {
    const t = k / (pts.length - 1);
    ctx.lineWidth = lerp(w0, w1, t);
    ctx.beginPath();
    ctx.moveTo(pts[k - 1][0], pts[k - 1][1]);
    ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.stroke();
  }
}

function makePetalTextures(seed) {
  const N = 1024, M = 384;
  const nz = makeNoise(seed);
  const rnd = mulberry32(seed + 99);
  const tints = [...Array(6)].map(() => [1 + (rnd() - 0.5) * 0.1, 1 + (rnd() - 0.5) * 0.09, 1 + (rnd() - 0.5) * 0.12]);

  const color = fieldToCanvas(M, N, (p, r) => {
    const wx = nz.fbm(p * 2.2 + 3.1, r * 2.6 + 1.7, 4), wy = nz.fbm(p * 2.2 + 8.3, r * 2.6 + 5.2, 4);
    const m = nz.fbm(p * 1.7 + wx * 1.8, r * 2.3 + wy * 1.8, 5);
    const streak = nz.fbm(p * 16 + wx * 0.6, r * 1.4, 3);
    const cloud = nz.fbm(p * 7 + 11, r * 7 + 4, 3);
    let c = mix3(C.honey, C.amber, smooth(0.0, 0.1, r));
    c = mix3(c, C.ruby, smooth(0.07, 0.22, r + (streak - 0.5) * 0.22));
    c = mix3(c, C.coral, smooth(0.28, 0.56, r + (streak - 0.5) * 0.4 + (m - 0.5) * 0.35));
    c = mix3(c, C.rubyPink, smooth(0.45, 0.64, m) * smooth(0.3, 0.6, r) * 0.88);
    c = mix3(c, C.peach, smooth(0.74, 1.05, r + (m - 0.5) * 0.45) * 0.62);
    c = mix3(c, C.rubyPink, smooth(0.7, 1.0, Math.abs(p)) * smooth(0.4, 0.8, r) * 0.22);
    const piece = (r < 0.42 ? 0 : 3) + (p < -0.38 ? 0 : p < 0.38 ? 1 : 2);
    const t = tints[piece];
    const b = 0.9 + 0.2 * cloud;
    return [c[0] * t[0] * b, c[1] * t[1] * b, c[2] * t[2] * b];
  });

  const bump = fieldToCanvas(192, 512, (p, r) => {
    const v = 0.5 + (nz.fbm(p * 5 + 2, r * 5 + 9, 4) - 0.5) * 0.55 + (nz.fbm(p * 19, r * 19, 2) - 0.5) * 0.18;
    return [v, v, v];
  });

  // fine branching veins radiating from the base
  const cctx = color.getContext('2d');
  const bctx = bump.getContext('2d');
  const veins = [];
  const K = 30;
  for (let k = 0; k < K; k++) {
    const p0 = -0.97 + (1.94 * k) / (K - 1) + (rnd() - 0.5) * 0.02;
    const ph = rnd() * TAU, rs = 0.015 + rnd() * 0.04, re = 0.9 + rnd() * 0.08;
    const main = r => p0 + 0.01 * Math.sin(r * 11 + ph) + 0.006 * Math.sin(r * 27 + ph * 2);
    veins.push({ f: main, rs, re, w: 1 });
    const nb = rnd() < 0.65 ? 1 : 2;
    for (let b = 0; b < nb; b++) {
      const rb = 0.22 + rnd() * 0.5, dir = rnd() < 0.5 ? -1 : 1, dr = 0.025 + rnd() * 0.035;
      veins.push({ f: r => main(r) + dir * dr * smooth(rb, Math.min(1, rb + 0.45), r), rs: rb, re: re - rnd() * 0.06, w: 0.75 });
      if (rnd() < 0.6) {
        const rt = rb + 0.15 + rnd() * 0.2, d2 = (rnd() < 0.5 ? -1 : 1) * (0.012 + rnd() * 0.02);
        if (rt < 0.9) veins.push({ f: r => main(r) + dir * dr * smooth(rb, Math.min(1, rb + 0.45), r) + d2 * smooth(rt, rt + 0.2, r), rs: rt, re: re - 0.05, w: 0.5 });
      }
    }
  }
  for (const v of veins) {
    const pts = [], bpts = [];
    for (let r = v.rs; r <= v.re; r += 0.006) {
      const p = v.f(r);
      pts.push([((p + 1) / 2) * N, (1 - r) * N]);
      bpts.push([((p + 1) / 2) * 512, (1 - r) * 512]);
    }
    if (pts.length < 2) continue;
    const wBase = 2.6 * v.w, wTip = 0.8 * v.w;
    strokeVariable(cctx, pts, wBase, wTip, `rgba(112, 8, 40, ${0.42 * (0.6 + 0.4 * v.w)})`);
    strokeVariable(cctx, pts.map(q => [q[0] + 1.3, q[1]]), wBase * 0.4, wTip * 0.4, 'rgba(255, 222, 186, 0.2)');
    strokeVariable(bctx, bpts, 1.6 * v.w, 0.6 * v.w, 'rgba(255,255,255,0.55)');
  }
  return { color, bump };
}

function makeLeafTextures(seed) {
  const N = 512;
  const nz = makeNoise(seed);
  const color = fieldToCanvas(200, N, (p, r) => {
    const m = nz.fbm(p * 2 + nz.fbm(p * 3, r * 3) * 1.5, r * 3 + 4, 5);
    const cloud = nz.fbm(p * 8 + 5, r * 8, 3);
    let c = mix3(C.leafDeep, C.leaf, smooth(0.0, 0.55, Math.abs(p) + (m - 0.5) * 0.3));
    c = mix3(c, C.leafLight, smooth(0.55, 1.0, Math.abs(p) + (m - 0.5) * 0.4) * 0.65);
    c = mix3(c, C.leafGold, smooth(0.55, 0.75, m) * 0.25 + smooth(0.15, 0.0, r) * 0.35);
    const b = 0.9 + 0.2 * cloud;
    return [c[0] * b, c[1] * b, c[2] * b];
  });
  const bump = fieldToCanvas(128, 256, (p, r) => {
    const v = 0.5 + (nz.fbm(p * 5, r * 5 + 3, 4) - 0.5) * 0.5;
    return [v, v, v];
  });
  const cctx = color.getContext('2d'), bctx = bump.getContext('2d');
  const X = (p, n) => ((p + 1) / 2) * n, Y = (r, n) => (1 - r) * n;
  // midrib
  const mid = []; for (let r = 0; r <= 0.97; r += 0.01) mid.push([X(0, N), Y(r, N)]);
  strokeVariable(cctx, mid, 3.4, 1.0, 'rgba(214, 236, 160, 0.5)');
  strokeVariable(bctx, mid.map(q => [q[0] / 2, q[1] / 2]), 2.2, 0.8, 'rgba(255,255,255,0.6)');
  for (let k = 0; k < 8; k++) {
    const r0 = 0.07 + k * 0.105;
    for (const side of [-1, 1]) {
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const p = side * 0.96 * t * (1 - 0.15 * t), r = r0 + 0.2 * Math.pow(t, 1.3);
        pts.push([X(p, N), Y(r, N)]);
      }
      strokeVariable(cctx, pts, 1.9, 0.7, 'rgba(14, 58, 30, 0.5)');
      strokeVariable(cctx, pts.map(q => [q[0], q[1] - 1.2]), 0.8, 0.3, 'rgba(220, 245, 170, 0.22)');
      strokeVariable(bctx, pts.map(q => [q[0] / 2, q[1] / 2]), 1.2, 0.5, 'rgba(255,255,255,0.45)');
    }
  }
  return { color, bump };
}

function makeColumnTexture() {
  const c = makeCanvas(256, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#f6c35e'); g.addColorStop(0.3, '#f47a4e'); g.addColorStop(0.7, '#e2456a'); g.addColorStop(1, '#b3173f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
  ctx.globalAlpha = 0.18;
  for (let y = 0; y < 64; y += 4) { ctx.fillStyle = y % 8 ? '#ffffff' : '#7a0a2a'; ctx.fillRect(0, y, 256, 1); }
  return c;
}

// ------------------------------------------------------------------ glass sheet geometry
// mid(a, r) gives the mid-surface; the sheet gets real thickness, a bevelled rim and outward-facing walls.
function buildSheet(mid, thick, { nU, nV, r0, s }) {
  const W = nU + 1, H = nV + 1;
  const id = (i, j) => j * W + i;
  const P = [], Nn = [], T = [], UV = [];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const a = -1 + (2 * i) / nU, r = r0 + ((1 - r0) * j) / nV;
      P.push(mid(a, r)); T.push(thick(a, r)); UV.push([(a + 1) / 2, r]);
    }
  }
  const du = new THREE.Vector3(), dv = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      du.subVectors(P[id(Math.min(nU, i + 1), j)], P[id(Math.max(0, i - 1), j)]);
      dv.subVectors(P[id(i, Math.min(nV, j + 1))], P[id(i, Math.max(0, j - 1))]);
      const n = new THREE.Vector3().crossVectors(du, dv);
      if (n.lengthSq() < 1e-14) n.set(0, 0, 1); else n.normalize().multiplyScalar(s);
      Nn.push(n);
    }
  }
  const pos = [], uv = [], index = [];
  const addV = (v, t) => { pos.push(v.x, v.y, v.z); uv.push(t[0], t[1]); return pos.length / 3 - 1; };
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), fn = new THREE.Vector3();
  const addTri = (a, b, c, want) => {
    va.fromArray(pos, a * 3); vb.fromArray(pos, b * 3); vc.fromArray(pos, c * 3);
    fn.crossVectors(vb.sub(va), vc.sub(va));
    if (fn.lengthSq() < 1e-16) return;
    if (fn.dot(want) >= 0) index.push(a, b, c); else index.push(a, c, b);
  };
  const tmp = new THREE.Vector3();
  const top = [], bot = [];
  for (let k = 0; k < P.length; k++) {
    top.push(addV(tmp.copy(P[k]).addScaledVector(Nn[k], T[k] / 2), UV[k]));
  }
  for (let k = 0; k < P.length; k++) {
    bot.push(addV(tmp.copy(P[k]).addScaledVector(Nn[k], -T[k] / 2), UV[k]));
  }
  const neg = new THREE.Vector3();
  for (let j = 0; j < nV; j++) {
    for (let i = 0; i < nU; i++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
      const want = Nn[a];
      addTri(top[a], top[b], top[c], want); addTri(top[a], top[c], top[d], want);
      neg.copy(want).negate();
      addTri(bot[a], bot[b], bot[c], neg); addTri(bot[a], bot[c], bot[d], neg);
    }
  }
  // boundary loop (counter-clockwise in the unmirrored frame)
  const loop = [];
  for (let i = 0; i <= nU; i++) loop.push(id(i, 0));
  for (let j = 1; j <= nV; j++) loop.push(id(nU, j));
  for (let i = nU - 1; i >= 0; i--) loop.push(id(i, nV));
  for (let j = nV - 1; j >= 1; j--) loop.push(id(0, j));
  const L = loop.length;
  const rows = [];
  let lastOut = new THREE.Vector3(1, 0, 0);
  for (let k = 0; k < L; k++) {
    const q = loop[k];
    const tan = new THREE.Vector3().subVectors(P[loop[(k + 1) % L]], P[loop[(k - 1 + L) % L]]);
    let out = new THREE.Vector3().crossVectors(tan, Nn[q]).multiplyScalar(s);
    if (out.lengthSq() < 1e-12) out = lastOut.clone(); else out.normalize();
    lastOut = out;
    const tt = T[q];
    rows.push({
      out,
      t: addV(tmp.copy(P[q]).addScaledVector(Nn[q], tt / 2), UV[q]),
      m: addV(tmp.copy(P[q]).addScaledVector(out, tt * 0.42), UV[q]),
      b: addV(tmp.copy(P[q]).addScaledVector(Nn[q], -tt / 2), UV[q]),
    });
  }
  for (let k = 0; k < L; k++) {
    const A = rows[k], B = rows[(k + 1) % L];
    const want = tmp.copy(A.out).add(B.out).clone();
    addTri(A.t, B.t, B.m, want); addTri(A.t, B.m, A.m, want);
    addTri(A.m, B.m, B.b, want); addTri(A.m, B.b, A.b, want);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function tubeAlong(points, radius, segs, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, segs, radius, radial, false);
}

function sample(mid, from, to, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) { const t = k / n; pts.push(mid(lerp(from[0], to[0], t), lerp(from[1], to[1], t))); }
  return pts;
}

// ------------------------------------------------------------------ petal
const PETAL_T = 0.02;

function petalMid({ L, Phi, asym, ph1, ph2, k1, k2, lift, cup, ruff, twist, s, nz }) {
  const R = a => L * (0.4 + 0.6 * Math.pow(Math.max(0, 1 - a * a), 0.42)) * (1 + asym * a) * (1 + 0.022 * Math.sin(a * k1 + ph1 + 1.3));
  return (a, r) => {
    const Ra = R(a), ang = a * Phi, d0 = (r * Ra) / L;
    const claw = 0.3 + 0.7 * smooth(0, 0.5, d0);
    const x = Ra * r * Math.sin(ang) * claw, y = Ra * r * Math.cos(ang);
    const d = Math.hypot(x, y) / L;
    let z = lift * Math.sin(Math.min(d, 1.1) * Math.PI * 0.55);
    z += (cup * (1 - d) * 1.5 - 0.22 * d) * x * x;
    const w = smooth(0.55, 1.0, r) * smooth(0.3, 0.75, d);
    z += ruff * w * (0.7 * Math.sin(k1 * a + ph1) + 0.3 * Math.sin(k2 * a + ph2) + 0.6 * (nz.n2(a * 3 + 5, r * 3) - 0.5));
    const tw = twist * smooth(0, 1, d), c = Math.cos(tw), sn = Math.sin(tw);
    return new THREE.Vector3((x * c - z * sn) * s, y, x * sn + z * c);
  };
}

function buildPetal(seed, s) {
  const rnd = mulberry32(seed);
  const mid = petalMid({
    L: 0.97 + rnd() * 0.08, Phi: 0.86, asym: (rnd() - 0.5) * 0.14,
    ph1: rnd() * TAU, ph2: rnd() * TAU, k1: 6.5 + rnd() * 2.5, k2: 13 + rnd() * 4,
    lift: 0.33 + rnd() * 0.06, cup: 0.55, ruff: 0.032 + rnd() * 0.01, twist: 0.3, s, nz: makeNoise(seed * 7 + 3),
  });
  const thick = (a, r) => PETAL_T * (0.42 + 0.58 * (1 - smooth(0.955, 1, r)) * (1 - smooth(0.93, 1, Math.abs(a))));
  const glass = buildSheet(mid, thick, { nU: 72, nV: 54, r0: 0.03, s });
  const rim = [...sample(mid, [-1, 0.03], [-1, 1], 30), ...sample(mid, [-1, 1], [1, 1], 120).slice(1), ...sample(mid, [1, 1], [1, 0.03], 30).slice(1)];
  const gold = mergeGeometries([
    tubeAlong(rim, 0.0118, 420),
    tubeAlong(sample(mid, [-0.38, 0.05], [-0.38, 1], 50), 0.0106, 120),
    tubeAlong(sample(mid, [0.38, 0.05], [0.38, 1], 50), 0.0106, 120),
    tubeAlong(sample(mid, [-1, 0.42], [1, 0.42], 60), 0.0106, 140),
  ]);
  return { glass, gold };
}

// ------------------------------------------------------------------ leaf / sepal
function leafMid({ L, W, fold, arch, droop, s, ph }) {
  return (a, r) => {
    let w = W * Math.pow(r, 0.55) * Math.pow(1 - r, 0.7) * 2.1;
    w *= 1 + 0.045 * Math.abs(Math.sin(r * Math.PI * 9 + ph)) * smooth(0.15, 0.4, r);
    const x = a * w, y = L * r;
    const z = fold * Math.abs(x) + arch * Math.sin(Math.PI * r) - droop * r * r * r;
    return new THREE.Vector3(x * s, y, z);
  };
}

function buildLeaf(opts, withGold = true) {
  const mid = leafMid(opts);
  const T = opts.T ?? 0.018;
  const thick = (a, r) => T * (0.45 + 0.55 * (1 - smooth(0.9, 1, Math.abs(a))) * smooth(0.0, 0.08, r) * (1 - smooth(0.92, 1, r)));
  const glass = buildSheet(mid, thick, { nU: 40, nV: 60, r0: 0.0, s: opts.s });
  let gold = null;
  if (withGold) {
    const rim = [...sample(mid, [-1, 0.001], [-1, 0.999], 80), ...sample(mid, [1, 0.999], [1, 0.001], 80).slice(1)];
    gold = mergeGeometries([
      tubeAlong(rim, opts.rim ?? 0.012, 300),
      tubeAlong(sample(mid, [0, 0.0], [0, 0.97], 40), (opts.rim ?? 0.012) * 0.85, 80),
    ]);
  }
  return { glass, gold };
}

// ------------------------------------------------------------------ materials
const BACK_DIR = new THREE.Vector3(0.22, 0.5, -1).normalize(); // view space: behind the object, slightly above

function glassMaterial(map, bump, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: opts.glow ?? 1.0,
    roughness: opts.rough ?? 0.07, metalness: 0, bumpMap: bump, bumpScale: opts.bump ?? 0.9,
    transparent: true, opacity: opts.opacity ?? 0.86, envMapIntensity: opts.env ?? 0.45,
    specularIntensity: 0.75, ior: 1.52, side: THREE.FrontSide,
  });
  m.color.setScalar(opts.diffuse ?? 0.1);
  const base = opts.base ?? 0.55, back = opts.back ?? 0.62;
  m.onBeforeCompile = sh => {
    sh.uniforms.uBackDir = { value: BACK_DIR };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBackDir;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // warm backlight transmitted through the coloured glass; thicker optical path at grazing angles deepens the colour
          float nb = abs(dot(normal, uBackDir));
          float nv = abs(dot(normal, normalize(vViewPosition)));
          float trans = ${base.toFixed(3)} + ${back.toFixed(3)} * pow(nb, 0.8);
          vec3 deep = totalEmissiveRadiance * totalEmissiveRadiance * 1.3;
          totalEmissiveRadiance = mix(totalEmissiveRadiance, deep, (1.0 - nv) * 0.55) * trans;
        }`);
  };
  return m;
}

// ------------------------------------------------------------------ environment (generated studio)
function makeEnvironment(renderer) {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.018, 0.017), side: THREE.BackSide })));
  const box = (w, h, col, k, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); sc.add(m);
  };
  box(8, 5, 0xffb46a, 2.0, [0, 1.5, -9]);    // warm backlight
  box(5, 3.5, 0xfff0de, 1.7, [-7, 4, 6]);    // soft key
  box(0.7, 7, 0xe6ecff, 1.6, [8, 1, -3]);    // restrained rim strip
  box(3, 1, 0xffe3c2, 1.1, [3, 8, 2]);       // top strip
  box(12, 12, 0x3a2a20, 0.3, [0, -9, 0]);    // floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0).texture;
  pm.dispose();
  return tex;
}

// ------------------------------------------------------------------ earring
function buildEarring({ s, seed, mats }) {
  const rnd = mulberry32(seed);
  const root = new THREE.Group();     // hook is fixed in the lobe
  const swing = new THREE.Group();    // everything below the hook eye sways
  root.add(swing);

  const yb = 1.03;                    // bail centre
  const ra = 0.085, rb = 0.115;       // bail and jump ring radii
  const yj = yb + 0.15;               // jump ring centre
  const yc = yb + 0.285;              // hook eye centre (pivot)
  const flower = new THREE.Group();

  // petals
  for (let i = 0; i < 5; i++) {
    let th = (54 + 72 * i + (rnd() - 0.5) * 7) * DEG;
    if (s < 0) th = Math.PI - th;
    const { glass, gold } = buildPetal(seed * 31 + i * 101, s);
    const g = new THREE.Group();
    const gm = new THREE.Mesh(glass, mats.petals[(i + (s < 0 ? 2 : 0)) % mats.petals.length]);
    const au = new THREE.Mesh(gold, mats.gold);
    g.add(gm, au);
    g.rotation.z = th - Math.PI / 2;
    g.position.z = 0.004 * i;
    flower.add(g);
  }

  // centre hub where the seams meet
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 12), mats.gold);
  hub.scale.set(1, 1, 0.55); hub.position.z = 0.02;
  flower.add(hub);

  // staminal column
  const colCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(0.0, 0.03, 0.25), new THREE.Vector3(0.04 * s, 0.1, 0.5),
    new THREE.Vector3(0.09 * s, 0.2, 0.71), new THREE.Vector3(0.12 * s, 0.28, 0.83),
  ]);
  const segs = 72, colR = u => lerp(0.03, 0.017, u);
  const colGeo = new THREE.TubeGeometry(colCurve, segs, 1, 14, false);
  {
    const p = colGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const c = colCurve.getPointAt(i / segs);
      for (let k = 0; k <= 14; k++) {
        const idx = i * 15 + k;
        v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(colR(i / segs)).add(c);
        p.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    colGeo.computeVertexNormals();
  }
  flower.add(new THREE.Mesh(colGeo, mats.column));

  // anthers on fine filaments, stigma pads at the tip
  const nA = 30;
  const fil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5).translate(0, 0.5, 0), mats.gold, nA + 5);
  const anth = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0145, 10, 8), mats.anther, nA);
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), mtx = new THREE.Matrix4();
  const frame = u => {
    const P = colCurve.getPointAt(u), Tg = colCurve.getTangentAt(u);
    const Nr = new THREE.Vector3(1, 0, 0).cross(Tg).normalize(); const B = new THREE.Vector3().crossVectors(Tg, Nr);
    return { P, Tg, Nr, B };
  };
  for (let k = 0; k < nA; k++) {
    const u = 0.56 + (0.36 * k) / nA + (rnd() - 0.5) * 0.015;
    const { P, Tg, Nr, B } = frame(u);
    const ang = k * 2.39996 + rnd() * 0.3;
    const dir = Nr.clone().multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang)).addScaledVector(Tg, 0.45).normalize();
    const len = 0.035 + rnd() * 0.035, r0 = colR(u);
    const base = P.clone().addScaledVector(dir, r0 * 0.8);
    q.setFromUnitVectors(up, dir);
    mtx.compose(base, q, new THREE.Vector3(1, len, 1)); fil.setMatrixAt(k, mtx);
    mtx.compose(base.clone().addScaledVector(dir, len + 0.008), q, new THREE.Vector3(1.25, 0.8, 1.25)); anth.setMatrixAt(k, mtx);
  }
  const stig = new THREE.InstancedMesh(new THREE.SphereGeometry(0.019, 12, 10), mats.ruby, 5);
  {
    const { P, Tg, Nr, B } = frame(1);
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * TAU + 0.4;
      const dir = Nr.clone().multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang)).multiplyScalar(0.75).addScaledVector(Tg, 0.8).normalize();
      q.setFromUnitVectors(up, dir);
      mtx.compose(P, q, new THREE.Vector3(1, 0.055, 1)); fil.setMatrixAt(nA + k, mtx);
      mtx.compose(P.clone().addScaledVector(dir, 0.066), q, new THREE.Vector3(1, 0.85, 1)); stig.setMatrixAt(k, mtx);
    }
  }
  flower.add(fil, anth, stig);

  // calyx: small green sepals and a gold cap on the reverse side
  for (let i = 0; i < 5; i++) {
    let th = (90 + 72 * i + (rnd() - 0.5) * 10) * DEG;
    if (s < 0) th = Math.PI - th;
    const { glass, gold } = buildLeaf({ L: 0.34, W: 0.07, fold: 0.25, arch: 0.02, droop: 0.04, s, ph: rnd() * 6, T: 0.014, rim: 0.008 });
    const outer = new THREE.Group(), inner = new THREE.Group();
    inner.add(new THREE.Mesh(glass, mats.sepal), new THREE.Mesh(gold, mats.gold));
    inner.rotation.x = -0.75;
    outer.add(inner); outer.rotation.z = th - Math.PI / 2; outer.position.z = -0.05;
    flower.add(outer);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 28, 12, 0, TAU, 0, Math.PI / 2), mats.gold);
  cap.rotation.x = -Math.PI / 2; cap.position.z = -0.05;
  flower.add(cap);

  // gold stem from the calyx up to the bail
  const stemPts = [
    new THREE.Vector3(0, 0, -0.14), new THREE.Vector3(0, 0.25, -0.24), new THREE.Vector3(0, 0.6, -0.24),
    new THREE.Vector3(0, 0.84, -0.15), new THREE.Vector3(0, yb - ra - 0.04, -0.03), new THREE.Vector3(0, yb - ra, 0),
  ];
  flower.add(new THREE.Mesh(tubeAlong(stemPts, 0.021, 80, 10), mats.gold));

  // leaf above the bloom, attached to the stem
  {
    const { glass, gold } = buildLeaf({ L: 0.6, W: 0.15, fold: 0.18, arch: 0.05, droop: 0.06, s, ph: rnd() * 6 });
    const outer = new THREE.Group(), inner = new THREE.Group();
    inner.add(new THREE.Mesh(glass, mats.leaf), new THREE.Mesh(gold, mats.gold));
    inner.rotation.x = -0.25;
    outer.add(inner);
    outer.position.set(0, 0.72, -0.215);
    outer.rotation.z = 0.75 * s;
    flower.add(outer);
  }

  // bail + jump ring
  const bail = new THREE.Mesh(new THREE.TorusGeometry(ra, 0.02, 12, 48), mats.gold);
  bail.rotation.y = Math.PI / 2; bail.position.set(0, yb, 0);
  const jump = new THREE.Mesh(new THREE.TorusGeometry(rb, 0.017, 12, 56), mats.gold);
  jump.position.set(0, yj, 0);

  const body = new THREE.Group();
  body.add(flower, bail, jump);
  body.position.y = -yc;           // pivot at the hook eye
  swing.add(body);
  swing.position.y = yc;

  // French hook ear wire
  const hook = new THREE.Group();
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.021, 12, 48), mats.gold);
  eye.rotation.y = Math.PI / 2; eye.position.y = yc;
  const hp = [
    [0, 0.07, 0], [0, 0.4, 0], [0, 0.75, -0.01], [0, 0.95, -0.08], [0, 1.06, -0.22], [0, 1.05, -0.38],
    [0, 0.95, -0.52], [0, 0.75, -0.6], [0, 0.35, -0.64], [0, -0.05, -0.62], [0, -0.26, -0.56],
  ].map(p => new THREE.Vector3(p[0], p[1] + yc, p[2]));
  const wire = new THREE.Mesh(tubeAlong(hp, 0.021, 200, 10), mats.gold);
  const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 8), mats.gold); endCap.position.copy(hp[hp.length - 1]);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), mats.gold); ball.position.set(0, yc + 0.31, 0);
  hook.add(eye, wire, endCap, ball);
  for (let k = 0; k < 3; k++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.011, 8, 28), mats.gold);
    coil.rotation.x = Math.PI / 2; coil.position.set(0, yc + 0.21 + k * 0.024, 0);
    hook.add(coil);
  }
  root.add(hook);
  return { root, swing };
}

// ------------------------------------------------------------------ app
const container = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.sortObjects = true;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x131214);
scene.environment = makeEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.05, 100);
scene.add(camera);
// camera-relative studio lights so the balance holds while orbiting
const key = new THREE.DirectionalLight(0xfff3e4, 1.5); key.position.set(-3, 3.5, 4); camera.add(key);
const rim = new THREE.DirectionalLight(0xe6ecff, 0.9); rim.position.set(4, 1.5, -3); camera.add(rim);
const back = new THREE.DirectionalLight(0xffb56e, 1.3); back.position.set(0.8, 2, -4); camera.add(back);
scene.add(new THREE.HemisphereLight(0xffeedd, 0x1a1210, 0.35));

const aniso = renderer.capabilities.getMaxAnisotropy();
const tex = (canvas, srgb) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};

const petalMats = [11, 23, 37, 41, 59].map(sd => {
  const { color, bump } = makePetalTextures(sd);
  return glassMaterial(tex(color, true), tex(bump, false), { bump: 1.0 });
});
const leafTex = makeLeafTextures(7);
const leafColor = tex(leafTex.color, true), leafBump = tex(leafTex.bump, false);
const mats = {
  petals: petalMats,
  leaf: glassMaterial(leafColor, leafBump, { opacity: 0.84, glow: 0.95 }),
  sepal: glassMaterial(leafColor, leafBump, { opacity: 0.88, glow: 0.7 }),
  column: glassMaterial(tex(makeColumnTexture(), true), null, { opacity: 0.93, glow: 1.0, base: 0.7, back: 0.4 }),
  gold: new THREE.MeshPhysicalMaterial({ color: 0xc29a55, metalness: 1, roughness: 0.3, envMapIntensity: 1.0 }),
  anther: new THREE.MeshPhysicalMaterial({ color: 0xe8bd5a, metalness: 1, roughness: 0.34, envMapIntensity: 1.25 }),
  ruby: new THREE.MeshPhysicalMaterial({ color: 0x8e0d30, emissive: 0x4a0414, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }),
};

const pair = new THREE.Group();
scene.add(pair);
const left = buildEarring({ s: 1, seed: 3, mats });
const right = buildEarring({ s: -1, seed: 8, mats });
const SEP = 1.18;
left.root.position.x = -SEP; left.root.rotation.y = 0.16;
right.root.position.x = SEP; right.root.rotation.y = -0.16;
pair.add(left.root, right.root);

// centre the pair on the turntable axis
const bbox = new THREE.Box3().setFromObject(pair);
const centre = bbox.getCenter(new THREE.Vector3());
left.root.position.y -= centre.y; right.root.position.y -= centre.y;
left.root.position.x -= centre.x; right.root.position.x -= centre.x;
// worst case under rotation about Y: horizontal reach of every vertex
let reach = 0, vNeed = 0; // vNeed = max(|y| + rho * tan(vf)) for the vertical fit
pair.updateMatrixWorld(true);
const samples = [];
{
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  pair.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const count = o.isInstancedMesh ? o.count : 1;
    for (let c = 0; c < count; c++) {
      if (o.isInstancedMesh) { o.getMatrixAt(c, m); m.premultiply(o.matrixWorld); } else m.copy(o.matrixWorld);
      for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(m); const rho = Math.hypot(v.x, v.z); reach = Math.max(reach, rho); samples.push(Math.abs(v.y), rho); }
    }
  });
}
const pairBox = new THREE.Box3().setFromObject(pair);
const halfHeight = Math.max(pairBox.max.y, -pairBox.min.y);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.target.set(0, 0, 0);

const ELEV = 7 * DEG;
let fitDist = 8;
function fitDistance() {
  const vf = (camera.fov * DEG) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  // the turntable sweeps a cylinder of radius `reach`; keep all of it inside the frame
  const dH = reach / Math.sin(hf);
  let dV = 0;
  for (let i = 0; i < samples.length; i += 2) dV = Math.max(dV, samples[i] / Math.tan(vf) + samples[i + 1]);
  return Math.max(dH, dV) * 1.03;
}
function placeCamera(dist) {
  camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
  camera.lookAt(controls.target);
}
let userZoomed = false;
function onResize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const nd = fitDistance();
  if (!userZoomed) {
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) placeCamera(nd); else camera.position.copy(controls.target).addScaledVector(dir.normalize(), nd);
  }
  fitDist = nd;
  controls.minDistance = 1.1;
  controls.maxDistance = nd * 1.8;
}
window.addEventListener('resize', onResize);
camera.aspect = container.clientWidth / container.clientHeight;
camera.updateProjectionMatrix();
fitDist = fitDistance();
placeCamera(fitDist);
onResize();
renderer.domElement.addEventListener('wheel', () => { userZoomed = true; }, { passive: true });

// ------------------------------------------------------------------ motion + controls
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let playing = !reduceMotion;
let angle = -0.62;                 // flattering three-quarter start
const SPEED = TAU / 46;            // one turn every 46 s
let swayT = 0;
let dragging = false, resumeAt = 0;
controls.addEventListener('start', () => { dragging = true; });
controls.addEventListener('end', () => { dragging = false; resumeAt = performance.now() + 1800; });

const btn = document.getElementById('pause');
function syncButton() {
  btn.setAttribute('aria-pressed', String(!playing));
  btn.querySelector('.label').textContent = playing ? 'Pause' : 'Play';
  btn.querySelector('.ico').innerHTML = playing
    ? '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2" width="2.4" height="8" rx="0.6"/><rect x="7.1" y="2" width="2.4" height="8" rx="0.6"/></svg>'
    : '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6a.5.5 0 0 0 .76.43l6.1-3.8a.5.5 0 0 0 0-.86l-6.1-3.8a.5.5 0 0 0-.76.43z"/></svg>';
}
btn.addEventListener('click', () => { playing = !playing; syncButton(); });
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playing = !playing; syncButton(); }
});
syncButton();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const turning = playing && !dragging && performance.now() > resumeAt;
  if (turning) angle += SPEED * dt;
  if (playing) swayT += dt;
  pair.rotation.y = angle;
  left.swing.rotation.z = 0.035 * Math.sin(swayT * 1.9);
  left.swing.rotation.x = 0.02 * Math.sin(swayT * 1.3 + 0.8);
  right.swing.rotation.z = 0.035 * Math.sin(swayT * 1.9 + 1.7);
  right.swing.rotation.x = 0.02 * Math.sin(swayT * 1.3 + 2.6);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// hooks for automated inspection
window.__art = {
  setAngle(a) { angle = a; },
  setPlaying(p) { playing = p; syncButton(); },
  render() { controls.update(); renderer.render(scene, camera); },
  setDist(d) { userZoomed = true; camera.position.setLength(d); controls.update(); },
  orbit(az, el) { const d = camera.position.length(); camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d); controls.update(); },
  info() { return { reach, halfHeight, fitDist, triangles: renderer.info.render.triangles }; },
};
document.documentElement.classList.add('ready');
