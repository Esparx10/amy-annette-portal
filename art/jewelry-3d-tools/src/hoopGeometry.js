import * as THREE from 'three';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ hoop geometry
// The body is swept along the inner edge of an oval; its section grows from a fine wire at the
// hinge to a deep, domed crescent at the bottom, with a soft channel on the inside face.
const AI = 0.40, BI = 0.62, OYI = -0.05;     // inner-edge oval
const T_END = 30 * DEG;                       // body ends either side of the top opening
const along = t => (1 - Math.cos(t)) / 2;     // 0 at the top, 1 at the bottom
const W = t => lerp(0.082, 0.37, Math.pow(along(t), 1.7));   // radial width
const D = t => lerp(0.085, 0.33, Math.pow(along(t), 1.2));  // front-to-back depth

const innerPt = t => V(AI * Math.sin(t), BI * Math.cos(t) + OYI, 0);
const outward = t => V(BI * Math.sin(t), AI * Math.cos(t), 0).normalize();

function section(t, k, NS) {
  const th = (k / NS) * TAU;
  const w = W(t), d = D(t), u = along(t);
  const c = Math.cos(th), s = Math.sin(th);
  let x = w / 2 + (w / 2) * spow(c, 0.82);
  const z = (d / 2) * spow(s, 0.8) * (s < 0 ? 0.78 : 1);
  x += w * 0.13 * smooth(0.15, 0.6, u) * Math.exp(-Math.pow((th - Math.PI) / 0.34, 2)); // inner channel
  return [x, z];
}

function bodyGeometry() {
  const NT = 420, NS = 72;
  const pos = [], uv = [], idx = [];
  const t0 = T_END, t1 = TAU - T_END;
  const ringCentre = [];
  for (let i = 0; i <= NT; i++) {
    const t = lerp(t0, t1, i / NT);
    const p = innerPt(t), n = outward(t);
    const cen = V(0, 0, 0);
    for (let k = 0; k < NS; k++) {
      const [x, z] = section(t, k, NS);
      const q = p.clone().addScaledVector(n, x); q.z += z;
      pos.push(q.x, q.y, q.z); uv.push(i / NT, k / NS);
      cen.add(q);
    }
    ringCentre.push(cen.multiplyScalar(1 / NS));
  }
  for (let i = 0; i < NT; i++) {
    for (let k = 0; k < NS; k++) {
      const a = i * NS + k, b = i * NS + ((k + 1) % NS), c = (i + 1) * NS + ((k + 1) % NS), d = (i + 1) * NS + k;
      idx.push(a, d, b, b, d, c);
    }
  }
  // end caps
  for (const [ring, flip] of [[0, true], [NT, false]]) {
    const ci = pos.length / 3;
    const cc = ringCentre[ring];
    pos.push(cc.x, cc.y, cc.z); uv.push(0, 0);
    for (let k = 0; k < NS; k++) {
      const a = ring * NS + k, b = ring * NS + ((k + 1) % NS);
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure faces point outward (flip if the sweep came out inside-out)
  const n = g.attributes.normal, p = g.attributes.position;
  const probeT = Math.PI, probe = innerPt(probeT).addScaledVector(outward(probeT), W(probeT));
  let best = 0, bd = Infinity;
  for (let i = 0; i < p.count; i++) { const dd = probe.distanceToSquared(V(p.getX(i), p.getY(i), p.getZ(i))); if (dd < bd) { bd = dd; best = i; } }
  if (V(n.getX(best), n.getY(best), n.getZ(best)).dot(outward(probeT)) < 0) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const tmp = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}

const centreAt = t => innerPt(t).addScaledVector(outward(t), W(t) / 2);

export function buildHoop(gold) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(bodyGeometry(), gold));

  // hinge knuckle at the left end, with its small lever tab
  const hingeT = TAU - T_END, hp = centreAt(hingeT);
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, D(hingeT) + 0.035, 28, 1), gold);
  knuckle.rotation.x = Math.PI / 2; knuckle.position.copy(hp);
  const kcapF = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 12, 0, TAU, 0, Math.PI / 2), gold);
  kcapF.rotation.x = Math.PI / 2; kcapF.position.copy(hp); kcapF.position.z += (D(hingeT) + 0.035) / 2; kcapF.scale.set(1, 0.35, 1);
  const kcapB = kcapF.clone(); kcapB.rotation.x = -Math.PI / 2; kcapB.position.z = hp.z - (D(hingeT) + 0.035) / 2;
  const tab = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.085, 6, 16), gold);
  tab.position.copy(hp).add(V(-0.05, 0.075, 0.02)); tab.rotation.z = 0.75;
  const tabTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), gold);
  tabTip.position.copy(hp).add(V(-0.085, 0.11, 0.02));
  g.add(knuckle, kcapF, kcapB, tab, tabTip);

  // catch at the right end: a small hood the post clicks into
  const catchT = T_END, cp = centreAt(catchT);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.062, 32, 20), gold);
  hood.scale.set(1.0, 1.15, 1.25); hood.position.copy(cp).add(V(0.005, 0.03, 0));
  const fin = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.05, 6, 12), gold);
  fin.position.copy(cp).add(V(0.045, 0.085, -0.01)); fin.rotation.z = -0.6;
  g.add(hood, fin);

  // post: a fine wire arcing over the top from the hinge into the catch
  const pts = [];
  for (let k = 0; k <= 30; k++) {
    const t = lerp(-T_END, T_END, k / 30);
    const c = centreAt(t);
    c.y += 0.03 * Math.cos((t / T_END) * Math.PI / 2);
    c.z = lerp(0.0, -0.025, k / 30);
    pts.push(c);
  }
  const post = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.026, 12, false), gold);
  g.add(post);
  return g;
}

