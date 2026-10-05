import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import { MeshBVH } from 'three-mesh-bvh';
import studioHDR from '@pmndrs/assets/hdri/studio.exr.js';
import { buildHoop } from './hoopGeometry.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ------------------------------------------------------------------ renderer
const container = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; // keeps the gold's hue instead of drifting to olive
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// ------------------------------------------------------------------ lighting: photographed studio + crisp softboxes
function decodeDataURI(uri) {
  const bin = atob(uri.slice(uri.indexOf('base64,') + 7));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
function makeEnvironment() {
  const exr = new EXRLoader().parse(decodeDataURI(studioHDR));
  const hdr = new THREE.DataTexture(exr.data, exr.width, exr.height, exr.format, exr.type);
  hdr.colorSpace = THREE.LinearSRGBColorSpace;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  hdr.minFilter = THREE.LinearFilter; hdr.magFilter = THREE.LinearFilter; hdr.generateMipmaps = false;
  hdr.needsUpdate = true;
  const sc = new THREE.Scene();
  sc.background = hdr;
  sc.backgroundIntensity = 1.8;
  sc.backgroundRotation = new THREE.Euler(0, 1.9, 0);
  // the HDRI is small, so add a few sharp softboxes for the crisp highlight bands polished gold shows
  const panel = (w, h, col, k, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); sc.add(m);
  };
  // light-tent walls like a jewellery product shoot, with two dark flags for contrast
  panel(8, 2.2, 0xffffff, 3.2, [0, 9, 2]);
  panel(3, 8, 0xfff6ea, 2.6, [-8, 1, 4]);
  panel(2, 8, 0xffffff, 2.2, [8, 0.5, 3]);
  panel(9, 5, 0xfffaf2, 1.5, [0, 1.5, 9]);
  panel(6, 6, 0xfff3e4, 1.1, [-7, 2, -5]);
  panel(2.5, 7, 0x000000, 1, [5, 0, -7]);
  panel(2.5, 4, 0x000000, 1, [-4, -2, 7]);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(sc, 0, 0.1, 100).texture;
  pm.dispose();
  return env;
}

// ------------------------------------------------------------------ surface: polish marks and plating unevenness
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function makeSurfaceMaps() {
  const r = rng(7);
  // roughness (green channel): base ~0.43 so material.roughness 0.3 gives ~0.13
  const rc = makeCanvas(1024, 256), rx = rc.getContext('2d');
  rx.fillStyle = 'rgb(110,110,110)'; rx.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 70; i++) {
    const x = r() * 1024, y = r() * 256, rad = 20 + r() * 90, v = r() < 0.5 ? 0 : 255;
    const g = rx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${v},${v},${v},0.06)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    rx.fillStyle = g; rx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1024, y = r() * 256, len = 15 + r() * 220, v = Math.floor(70 + r() * 110);
    rx.strokeStyle = `rgba(${v},${v},${v},${0.06 + r() * 0.12})`; rx.lineWidth = r() < 0.85 ? 0.6 : 1.2;
    rx.beginPath(); rx.moveTo(x, y); rx.lineTo(x + len, y + (r() - 0.5) * 3); rx.stroke();
  }
  // bump: faint waviness of hand-finished plating
  const bc = makeCanvas(512, 128), bx = bc.getContext('2d');
  bx.fillStyle = 'rgb(128,128,128)'; bx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 160; i++) {
    const x = r() * 512, y = r() * 128, rad = 8 + r() * 40, v = r() < 0.5 ? 0 : 255;
    const g = bx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${v},${v},${v},0.12)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    bx.fillStyle = g; bx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const mk = (c, rep) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, 1);
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  return { rough: mk(rc, 5), bump: mk(bc, 4) };
}

// ------------------------------------------------------------------ ambient occlusion baked into vertex colours
function bakeAO(group, floorY) {
  group.updateMatrixWorld(true);
  const parts = [];
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', o.geometry.attributes.position.clone());
    g.setIndex(o.geometry.index.clone());
    g.applyMatrix4(o.matrixWorld);
    parts.push(g);
  });
  const bvh = new MeshBVH(mergeGeometries(parts));
  const RAYS = 18, MAXD = 0.32;
  const dirs = [];
  for (let k = 0; k < RAYS; k++) { // cosine-weighted hemisphere, Fibonacci spiral
    const u = (k + 0.5) / RAYS, phi = k * 2.399963, rr = Math.sqrt(u);
    dirs.push([rr * Math.cos(phi), rr * Math.sin(phi), Math.sqrt(1 - u)]);
  }
  const ray = new THREE.Ray(), p = new THREE.Vector3(), n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  group.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal;
    nm.getNormalMatrix(o.matrixWorld);
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      t1.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0).cross(n).normalize();
      t2.crossVectors(n, t1);
      let occ = 0;
      for (const d of dirs) {
        ray.direction.set(0, 0, 0).addScaledVector(t1, d[0]).addScaledVector(t2, d[1]).addScaledVector(n, d[2]);
        ray.origin.copy(p).addScaledVector(n, 0.002);
        let dist = Infinity;
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
        if (hit) dist = hit.distance;
        if (ray.direction.y < -1e-4) dist = Math.min(dist, (floorY - ray.origin.y) / ray.direction.y);
        if (dist < MAXD) occ += 1 - dist / MAXD;
      }
      const ao = Math.pow(1 - 0.8 * (occ / RAYS), 1.15);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
    }
    o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
}

// ------------------------------------------------------------------ scene
const scene = new THREE.Scene();
scene.environment = makeEnvironment();
const camera = new THREE.PerspectiveCamera(28, container.clientWidth / container.clientHeight, 0.05, 60);
scene.add(camera);
const key = new THREE.DirectionalLight(0xfff4e6, 0.8); key.position.set(-3, 4, 4); camera.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(4, 2, -3); camera.add(rim);

const maps = makeSurfaceMaps();
const GOLD = {
  color: 0xffd384, metalness: 1, roughness: 0.2, roughnessMap: maps.rough,
  bumpMap: maps.bump, bumpScale: 0.12, envMapIntensity: 1.45, vertexColors: true,
};
const gold = new THREE.MeshPhysicalMaterial(GOLD);

const pair = new THREE.Group();
scene.add(pair);
const hoopL = buildHoop(gold);
{
  const b = new THREE.Box3().setFromObject(hoopL);
  bakeAO(hoopL, b.min.y);               // bake in the hoop's own frame, floor at its base
  hoopL.position.y -= b.min.y;          // then stand it on the floor (y = 0)
}
const SEP = 0.8;
hoopL.position.x = -SEP; hoopL.rotation.y = 0.22;
const hoopR = hoopL.clone();             // shares geometry, including the baked shading
hoopR.position.x = SEP;
pair.add(hoopL, hoopR);
const box0 = new THREE.Box3().setFromObject(pair);
pair.children.forEach(h => { h.position.x -= (box0.min.x + box0.max.x) / 2; });
const height = new THREE.Box3().setFromObject(pair).max.y;

// ------------------------------------------------------------------ glossy floor: blurred, fading reflection
const reflStrength = { value: 0.5 };
const reflMat = new THREE.MeshPhysicalMaterial({ ...GOLD, transparent: true, depthWrite: false });
reflMat.onBeforeCompile = sh => {
  sh.uniforms.uStrength = reflStrength;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vWY;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uStrength;')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.42, smoothstep(0.0, 0.9, -vWY));')
    .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= uStrength * exp(vWY * 2.4);');
};
const refl = pair.clone(true);
refl.traverse(o => { if (o.isMesh) { o.material = reflMat; o.renderOrder = -2; } });
refl.scale.y = -1;
scene.add(refl);

// ------------------------------------------------------------------ contact shadow (rendered from below, blurred)
const SH = { size: 3.6, res: 512, height: 0.9, opacity: 0.62 };
const shadowRT = new THREE.WebGLRenderTarget(SH.res, SH.res); shadowRT.texture.generateMipmaps = false;
const shadowBlurRT = new THREE.WebGLRenderTarget(SH.res, SH.res); shadowBlurRT.texture.generateMipmaps = false;
const shadowCam = new THREE.OrthographicCamera(-SH.size / 2, SH.size / 2, SH.size / 2, -SH.size / 2, 0, SH.height);
shadowCam.rotation.x = Math.PI / 2; // looking up from the floor
scene.add(shadowCam);
const depthMat = new THREE.MeshDepthMaterial();
depthMat.onBeforeCompile = sh => {
  sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
    'float k = 1.0 - fragCoordZ; gl_FragColor = vec4(vec3(0.0), k * k * 1.6);');
};
depthMat.depthTest = false; depthMat.depthWrite = false;
const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader); hBlur.depthTest = false;
const vBlur = new THREE.ShaderMaterial(VerticalBlurShader); vBlur.depthTest = false;
const fsq = new FullScreenQuad(hBlur);
const floorMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { tShadow: { value: shadowRT.texture }, uMat: { value: new THREE.Matrix4() }, uOpacity: { value: SH.opacity } },
  vertexShader: `uniform mat4 uMat; varying vec4 vS;
    void main(){ vec4 w = modelMatrix * vec4(position,1.0); vS = uMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D tShadow; uniform float uOpacity; varying vec4 vS;
    void main(){ vec2 uv = vS.xy / vS.w * 0.5 + 0.5; float a = texture2D(tShadow, uv).a;
      vec2 e = smoothstep(0.0, 0.08, uv) * smoothstep(1.0, 0.92, uv);
      gl_FragColor = vec4(0.06, 0.045, 0.03, a * uOpacity * e.x * e.y); }`,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(SH.size, SH.size).rotateX(-Math.PI / 2), floorMat);
floor.position.y = 0.0005; floor.renderOrder = -1;
scene.add(floor);
function blurShadow(amount) {
  hBlur.uniforms.tDiffuse.value = shadowRT.texture; hBlur.uniforms.h.value = amount / 256;
  fsq.material = hBlur; renderer.setRenderTarget(shadowBlurRT); fsq.render(renderer);
  vBlur.uniforms.tDiffuse.value = shadowBlurRT.texture; vBlur.uniforms.v.value = amount / 256;
  fsq.material = vBlur; renderer.setRenderTarget(shadowRT); fsq.render(renderer);
}
const tmpColor = new THREE.Color();
function renderShadow() {
  const bg = scene.background;
  scene.background = null; scene.overrideMaterial = depthMat;
  refl.visible = false; floor.visible = false;
  renderer.getClearColor(tmpColor); const ca = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.render(scene, shadowCam);
  blurShadow(1.6); blurShadow(0.6);
  renderer.setRenderTarget(null);
  renderer.setClearColor(tmpColor, ca);
  scene.overrideMaterial = null; scene.background = bg;
  refl.visible = true; floor.visible = true;
  shadowCam.updateMatrixWorld();
  floorMat.uniforms.uMat.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
}

// ------------------------------------------------------------------ camera, framing, controls
pair.updateMatrixWorld(true);
const samples = []; let reach = 0;
pair.traverse(o => {
  if (!o.isMesh) return;
  const p = o.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 4) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const rho = Math.hypot(v.x, v.z); reach = Math.max(reach, rho); samples.push(v.y, rho); }
});
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.8;
controls.maxPolarAngle = Math.PI / 2 - 0.04;
const TARGET_Y = height * 0.44;
controls.target.set(0, TARGET_Y, 0);
const ELEV = 9 * DEG;
function fitDistance() {
  const vf = (camera.fov * DEG) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
  let dV = 0;
  for (let i = 0; i < samples.length; i += 2) {
    const dy = Math.max(samples[i] - TARGET_Y, (TARGET_Y - samples[i]) * 0.7 + 0.25);
    dV = Math.max(dV, dy / Math.tan(vf) + samples[i + 1]);
  }
  return Math.max(reach / Math.sin(hf), dV) * 1.05;
}

// ------------------------------------------------------------------ post: lens depth of field, highlight glow, grain
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 6, aperture: 0.0016, maxblur: 0.005 });
composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.09, 0.3, 6.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grain = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.018 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float n = h(gl_FragCoord.xy) - 0.5; c.rgb += n * uAmount; gl_FragColor = c; }`,
});
composer.addPass(grain);

let userZoomed = false;
function placeCamera(d) { camera.position.set(0, TARGET_Y + Math.sin(ELEV) * d, Math.cos(ELEV) * d); camera.lookAt(controls.target); }
function onResize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h); composer.setPixelRatio(DPR); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const d = fitDistance();
  if (!userZoomed) { const dir = camera.position.clone().sub(controls.target); if (dir.lengthSq() < 1e-6) placeCamera(d); else camera.position.copy(controls.target).addScaledVector(dir.normalize(), d); }
  controls.minDistance = 0.9; controls.maxDistance = d * 1.8;
}
camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
placeCamera(fitDistance());
onResize();
window.addEventListener('resize', onResize);
renderer.domElement.addEventListener('wheel', () => { userZoomed = true; }, { passive: true });

// ------------------------------------------------------------------ backdrop
// The backdrop goes through the same tone mapping as the jewellery, so solve for the input that lands on the exact colour.
function toneInverse(target) {
  const srgbToLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const neutral = v => { // Khronos PBR Neutral for a grey input
    v *= renderer.toneMappingExposure;
    const c = v - (v < 0.08 ? v - 6.25 * v * v : 0.04);
    return c < 0.76 ? c : 1 - 0.0576 / (c - 0.52);
  };
  return [target.r, target.g, target.b].map(ch => {
    const want = srgbToLin(ch);
    let lo = 0, hi = 64;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (neutral(mid) < want) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  });
}
const BACKDROPS = { light: 0xf4f4f3, dark: 0x131214 };
let backdrop = 'light';
try { backdrop = localStorage.getItem('hoops-backdrop') || 'light'; } catch (e) { /* storage unavailable */ }
const bdBtn = document.getElementById('backdrop');
function applyBackdrop() {
  const c = new THREE.Color().setHex(BACKDROPS[backdrop], THREE.LinearSRGBColorSpace); // raw sRGB-encoded components
  const lin = toneInverse(c);
  scene.background = new THREE.Color().setRGB(lin[0], lin[1], lin[2], THREE.LinearSRGBColorSpace);
  bloom.threshold = Math.max(...lin) * 1.5 + 3.0;
  bloom.strength = backdrop === 'light' ? 0.09 : 0.05;
  reflStrength.value = backdrop === 'light' ? 0.5 : 0.34;
  floorMat.uniforms.uOpacity.value = backdrop === 'light' ? SH.opacity : SH.opacity * 0.9;
  document.documentElement.dataset.backdrop = backdrop;
  bdBtn.querySelector('.label').textContent = backdrop === 'light' ? 'Dark' : 'Light';
  bdBtn.setAttribute('aria-label', `Switch to ${backdrop === 'light' ? 'dark' : 'light'} backdrop`);
}
bdBtn.addEventListener('click', () => {
  backdrop = backdrop === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('hoops-backdrop', backdrop); } catch (e) { /* ignore */ }
  applyBackdrop();
});
applyBackdrop();

// ------------------------------------------------------------------ motion
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let playing = !reduceMotion;
let angle = -0.45;
const SPEED = TAU / 40;
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
window.addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playing = !playing; syncButton(); } });
syncButton();

function draw() {
  pair.rotation.y = angle; refl.rotation.y = angle;
  controls.update();
  renderShadow();
  bokeh.uniforms.focus.value = camera.position.distanceTo(controls.target);
  grain.uniforms.uTime.value = (grain.uniforms.uTime.value + 0.618) % 100;
  composer.render();
}
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (playing && !dragging && performance.now() > resumeAt) angle += SPEED * dt;
  draw();
  requestAnimationFrame(frame);
}
frame();

window.__art = {
  setAngle(a) { angle = a; },
  setPlaying(p) { playing = p; syncButton(); },
  setBackdrop(b) { backdrop = b; applyBackdrop(); },
  setDist(d) { userZoomed = true; const dir = camera.position.clone().sub(controls.target).normalize(); camera.position.copy(controls.target).addScaledVector(dir, d); controls.update(); },
  render: draw,
  info() { return { reach, height }; },
};
document.documentElement.classList.add('ready');
