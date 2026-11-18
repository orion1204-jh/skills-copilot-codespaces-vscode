import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as TX from './textures.js';
import { Builder, mat4 } from './builder.js';
import { buildHouse } from './house.js';
import { buildTerrain, drives, fences, lampPosts, hedgeBlobs, hedgeLines, flowerBeds, monument, terrainHeight } from './grounds.js';
import { buildTrees, buildHedges, buildFlowers } from './nature.js';
import { fountain, sprayMaterial } from './water.js';
import { createSky } from './sky.js';
import { NORTH_FOUNTAIN, SOUTH_FOUNTAIN, NG, HD } from './site.js';
import { initHud } from './hud.js';

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const bar = document.getElementById('bar');
const progress = (p) => { bar.style.width = `${Math.round(p * 100)}%`; };

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 9000);
camera.position.set(150, 115, 230);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 6;
controls.maxDistance = 520;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 0.45;
controls.target.set(0, 6, 0);
controls.zoomSpeed = 0.9;

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(w, h);
  bloom.resolution.set(w * pixelRatio * 0.5, h * pixelRatio * 0.5);
  spray.uniforms.uScale.value = (h * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

// ------------------------------------------------------------------ sky & lights
const sky = createSky();
scene.add(sky.mesh);
const envScene = new THREE.Scene();
const envSky = new THREE.Mesh(sky.mesh.geometry, sky.material);
envSky.scale.setScalar(50);
envScene.add(envSky);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function updateEnv() {
  const prev = envRT;
  envRT = pmrem.fromScene(envScene, 0, 0.1, 200);
  scene.environment = envRT.texture;
  if (prev) prev.dispose();
}

scene.fog = new THREE.FogExp2(0xbfcbd8, 0.0009);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -115, right: 115, top: 115, bottom: -115, near: 1, far: 900 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.045;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbcd0e6, 0x4d5a36, 0.5);
scene.add(hemi);

// Night floodlights washing the facades from the lawns
const floods = [];
const flood = (px, py, pz, tx, ty, tz, angle = 0.55) => {
  const s = new THREE.SpotLight(0xfff1dc, 0, 140, angle, 0.75, 1.6);
  s.position.set(px, py, pz);
  s.target.position.set(tx, ty, tz);
  scene.add(s, s.target);
  floods.push(s);
};
flood(-17, NG + 6.5, 44, -10, 9.5, HD, 0.42);
flood(17, NG + 6.5, 44, 10, 9.5, HD, 0.42);
flood(0, NG + 7, 52, 0, 12, 20, 0.3);
flood(-19, 6.5, -50, -12, 9.5, -HD, 0.42);
flood(19, 6.5, -50, 12, 9.5, -HD, 0.42);
flood(0, 7, -56, 0, 11, -20, 0.3);
const lanternLight = new THREE.PointLight(0xffd9a0, 0, 16, 1.6);
scene.add(lanternLight);

// ------------------------------------------------------------------ materials
function std(opts) { return new THREE.MeshStandardMaterial(opts); }

// Foliage: triplanar leaf texture in object space (no UV seams on the
// displaced crowns) with baked occlusion in vertex colors.
function foliageMat(map, roughness, scale, env = 1.2) {
  const m = std({ color: 0xffffff, map, roughness, vertexColors: true, envMapIntensity: env });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\nvObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjN;')
      .replace('#include <map_fragment>', `
        vec3 tw = pow(abs(normalize(vObjN)), vec3(3.0));
        tw /= (tw.x + tw.y + tw.z);
        vec3 tp = vObjPos * ${scale.toFixed(2)};
        vec4 leafTex = texture2D(map, tp.zy) * tw.x + texture2D(map, tp.xz) * tw.y + texture2D(map, tp.xy) * tw.z;
        diffuseColor *= leafTex;`);
  };
  return m;
}
let M;
const spray = sprayMaterial();

function makeMaterials() {
  const stone = TX.stone();
  const smooth = TX.stone({ plain: true });
  const rustic = TX.stone({ rustic: true });
  const grass = TX.grass();
  const paving = TX.pavement({ base: [218, 211, 198], meters: 2.4, joints: true });
  const walk = TX.pavement({ base: [210, 200, 182], meters: 1.8, joints: true });
  const drive = TX.pavement({ base: [138, 134, 128], meters: 5 });
  const roof = TX.roof();
  const interior = TX.windowInterior();
  const bark = TX.bark();
  const leaf = TX.foliage();
  const water = TX.waterNormal();
  water.repeat.set(0.25, 0.25);

  const glass = () => std({
    color: 0x9aa6ad, map: interior, emissive: 0xffc98a, emissiveMap: interior, emissiveIntensity: 0,
    roughness: 0.06, metalness: 0.55, envMapIntensity: 1.3,
  });
  M = {
    stone: std({ color: 0xe6e3da, ...stone, roughness: 1, normalScale: new THREE.Vector2(0.5, 0.5) }),
    rustic: std({ color: 0xe3e0d6, ...rustic, roughness: 1, normalScale: new THREE.Vector2(1.1, 1.1) }),
    trim: std({ color: 0xeeebe3, map: smooth.map, roughnessMap: smooth.roughnessMap, roughness: 0.92, normalMap: smooth.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) }),
    soffit: std({ color: 0xeeeae1, map: smooth.map, roughness: 0.95, envMapIntensity: 0.45 }),
    glassA: glass(), glassB: glass(), glassC: glass(),
    sash: std({ color: 0xf2f0ea, roughness: 0.45 }),
    door: std({ color: 0x3d2a1d, roughness: 0.38, metalness: 0.05 }),
    brass: std({ color: 0xd2ad62, roughness: 0.28, metalness: 1 }),
    roof: std({ color: 0x9aa1a5, ...roof, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }),
    paving: std({ color: 0xffffff, ...paving, roughness: 1 }),
    walk: std({ color: 0xffffff, ...walk, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    drive: std({ color: 0xffffff, ...drive, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    curb: std({ color: 0xd9d3c6, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    iron: std({ color: 0x1a1c1f, roughness: 0.42, metalness: 0.65 }),
    dark: std({ color: 0x25221f, roughness: 0.9 }),
    basin: std({ color: 0x4f625f, roughness: 0.8 }),
    soil: std({ color: 0x3a2b20, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    lampGlass: std({ color: 0xfff4dc, emissive: 0xffd49a, emissiveIntensity: 0, roughness: 0.2 }),
    leaves: foliageMat(leaf.map, 0.88, 0.42, 1.5),
    magnolia: foliageMat(leaf.map, 0.5, 0.6, 1.6),
    bark: std({ color: 0x8a7c6c, ...bark, roughness: 0.95 }),
    hedge: foliageMat(leaf.map, 0.85, 0.9),
    flowers: std({ color: 0xffffff, roughness: 0.75 }),
    water: std({ color: 0x23464d, roughness: 0.05, metalness: 0.25, normalMap: water, normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.4 }),
    grass: std({ color: 0xffffff, map: grass.map, normalMap: grass.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, vertexColors: true }),
  };
  // lawn: mowing stripes and large-scale tonal variation without visible tiling
  M.grass.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float lawn = (1.0 - smoothstep(130.0, 140.0, abs(vWPos.x))) * step(-231.0, vWPos.z) * step(vWPos.z, 95.0);
          float coord = vWPos.z > 0.0 ? vWPos.x : vWPos.z;
          float s = sin(coord * 3.14159 / 4.0);
          float aa = fwidth(coord) * 0.9 + 0.02;
          float stripe = smoothstep(-aa, aa, s) - 0.5;
          float fade = 1.0 - smoothstep(60.0, 220.0, length(vWPos.xz - cameraPosition.xz));
          diffuseColor.rgb *= 1.0 + lawn * stripe * 0.13 * (0.4 + 0.6 * fade);
          float m = n2(vWPos.xz * 0.025) * 0.6 + n2(vWPos.xz * 0.11) * 0.4;
          diffuseColor.rgb *= mix(0.84, 1.1, m);
          float outside = 1.0 - lawn;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.0, 0.82), outside * 0.6);
        }`);
  };
  return M;
}

// ------------------------------------------------------------------ build
const world = { flag: null, waters: [], sprays: [], glows: null, monument: null, lanternPos: null };

function addLantern(b, p) {
  b.add('iron', new THREE.CylinderGeometry(0.03, 0.03, 15.3 - 0.2 - (p.y + 0.9), 6), mat4(p.x, (15.3 + p.y + 0.9) / 2, p.z));
  b.add('lampGlass', new THREE.CylinderGeometry(0.42, 0.34, 1.2, 6), mat4(p.x, p.y, p.z));
  b.add('iron', new THREE.CylinderGeometry(0.5, 0.4, 0.14, 6), mat4(p.x, p.y + 0.66, p.z));
  b.add('iron', new THREE.ConeGeometry(0.46, 0.4, 6), mat4(p.x, p.y + 0.92, p.z));
  b.add('iron', new THREE.CylinderGeometry(0.36, 0.2, 0.18, 6), mat4(p.x, p.y - 0.68, p.z));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    b.add('iron', new THREE.BoxGeometry(0.04, 1.24, 0.04), mat4(p.x + Math.cos(a) * 0.4, p.y, p.z + Math.sin(a) * 0.4));
  }
}

function makeFlag(top) {
  const geo = new THREE.PlaneGeometry(4.2, 2.2, 28, 14);
  geo.translate(2.1, -1.1, 0);
  const mat = std({ map: TX.flag(), side: THREE.DoubleSide, roughness: 0.8 });
  const flag = new THREE.Mesh(geo, mat);
  flag.position.copy(top);
  flag.rotation.y = -0.45;
  flag.castShadow = true;
  flag.userData.base = geo.attributes.position.array.slice();
  return flag;
}

async function build() {
  progress(0.05);
  await frame();
  makeMaterials();
  progress(0.25);
  await frame();

  const b = new Builder();
  const info = buildHouse(b);
  addLantern(b, info.lantern);
  world.lanternPos = info.lantern;
  progress(0.45);
  await frame();

  const curves = drives(b);
  fences(b);
  const glowPts = lampPosts(b, curves);
  const nf = fountain(b, { ...NORTH_FOUNTAIN, tall: false }, M.water, spray);
  const sf = fountain(b, { ...SOUTH_FOUNTAIN, tall: true }, M.water, spray);
  const flowers = flowerBeds(b);
  const built = b.build(M);
  built.traverse((o) => {
    if (['drive', 'walk', 'curb', 'soil', 'paving', 'basin'].includes(o.name)) o.castShadow = o.name === 'paving';
  });
  scene.add(built);
  for (const f of [nf, sf]) { scene.add(f.water, f.spray, f.ripple); world.waters.push(f.water); }
  progress(0.62);
  await frame();

  const terrain = new THREE.Mesh(buildTerrain(), M.grass);
  terrain.receiveShadow = true;
  scene.add(terrain);
  scene.add(buildHedges(M.hedge, hedgeBlobs(hedgeLines())));
  scene.add(buildFlowers(M.flowers, flowers));
  progress(0.78);
  await frame();

  scene.add(buildTrees(M));
  world.monument = monument();
  scene.add(world.monument);
  world.flag = makeFlag(info.flagTop);
  scene.add(world.flag);

  // warm halos around lamp heads at night
  const gg = new THREE.BufferGeometry().setFromPoints([...glowPts, info.lantern]);
  world.glows = new THREE.Points(gg, new THREE.PointsMaterial({
    map: TX.glow(), size: 2.6, color: 0xffd8a8, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: true,
  }));
  scene.add(world.glows);
  lanternLight.position.copy(info.lantern);
  progress(0.95);
  await frame();
}

// ------------------------------------------------------------------ lighting presets
const LIGHTS = {
  day: {
    el: 36, az: 42, sun: [1.0, 0.95, 0.88], sunI: 3.3, hemiSky: [0.62, 0.72, 0.86], hemiGround: [0.32, 0.31, 0.22], hemiI: 0.45, env: 0.85,
    zenith: [0.09, 0.26, 0.66], horizon: [0.6, 0.74, 0.9], ground: [0.36, 0.4, 0.36], fog: [0.64, 0.74, 0.86], fogD: 0.0008,
    glow: 1.0, disc: 26, size: 0.014, clouds: 0.5, cloudLit: [1.25, 1.25, 1.27], cloudShade: [0.66, 0.72, 0.82], stars: 0,
    exposure: 0.92, bloom: 0.14, thresh: 0.92, windows: 0, flood: 0, lamps: 0, spray: [0.94, 0.97, 1.0], sprayA: 0.34,
  },
  golden: {
    el: 9, az: 38, sun: [1.0, 0.6, 0.32], sunI: 3.1, hemiSky: [0.52, 0.52, 0.66], hemiGround: [0.33, 0.24, 0.18], hemiI: 0.42, env: 0.75,
    zenith: [0.12, 0.2, 0.42], horizon: [1.08, 0.62, 0.38], ground: [0.28, 0.22, 0.2], fog: [0.82, 0.62, 0.5], fogD: 0.001,
    glow: 1.7, disc: 30, size: 0.02, clouds: 0.62, cloudLit: [1.3, 0.78, 0.5], cloudShade: [0.4, 0.34, 0.42], stars: 0,
    exposure: 1.0, bloom: 0.3, thresh: 0.85, windows: 0.22, flood: 0.0, lamps: 0.35, spray: [1.0, 0.86, 0.72], sprayA: 0.34,
  },
  night: {
    el: 34, az: -55, sun: [0.55, 0.66, 0.98], sunI: 0.3, hemiSky: [0.1, 0.13, 0.24], hemiGround: [0.04, 0.04, 0.05], hemiI: 0.3, env: 0.3,
    zenith: [0.004, 0.008, 0.022], horizon: [0.055, 0.06, 0.085], ground: [0.02, 0.02, 0.025], fog: [0.035, 0.042, 0.065], fogD: 0.0011,
    glow: 0.22, disc: 5, size: 0.011, clouds: 0.35, cloudLit: [0.07, 0.08, 0.11], cloudShade: [0.025, 0.03, 0.045], stars: 1,
    exposure: 1.1, bloom: 0.55, thresh: 0.72, windows: 1, flood: 1, lamps: 1, spray: [0.5, 0.54, 0.62], sprayA: 0.3,
  },
};
const cur = structuredClone(LIGHTS.day);
let lightFrom = null, lightTo = null, lightT = 1;
// The sun's azimuth is set relative to the viewpoint, so each view gets a
// raking three-quarter light. It only moves while flying between views.
let sunView = Math.atan2(camera.position.z, camera.position.x);
let envDirty = true, envCountdown = 0;

function applyLight(p) {
  const el = THREE.MathUtils.degToRad(p.el), az = sunView + THREE.MathUtils.degToRad(p.az);
  const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  sun.position.copy(dir).multiplyScalar(420);
  sun.target.position.set(0, 0, 0);
  sun.color.setRGB(...p.sun);
  sun.intensity = p.sunI;
  hemi.color.setRGB(...p.hemiSky);
  hemi.groundColor.setRGB(...p.hemiGround);
  hemi.intensity = p.hemiI;
  const u = sky.uniforms;
  u.uSunDir.value.copy(dir);
  u.uZenith.value.setRGB(...p.zenith);
  u.uHorizon.value.setRGB(...p.horizon);
  u.uGround.value.setRGB(...p.ground);
  u.uSunColor.value.setRGB(...p.sun);
  u.uCloudLit.value.setRGB(...p.cloudLit);
  u.uCloudShade.value.setRGB(...p.cloudShade);
  u.uGlow.value = p.glow;
  u.uSunDisc.value = p.disc;
  u.uSunSize.value = p.size;
  u.uClouds.value = p.clouds;
  u.uStars.value = p.stars;
  scene.fog.color.setRGB(...p.fog);
  scene.fog.density = p.fogD;
  renderer.toneMappingExposure = p.exposure;
  bloom.strength = p.bloom;
  bloom.threshold = p.thresh;
  if (M) {
    M.glassA.emissiveIntensity = p.windows * 2.4;
    M.glassB.emissiveIntensity = p.windows * 1.1;
    M.glassC.emissiveIntensity = p.windows * 0.12;
    M.lampGlass.emissiveIntensity = p.lamps * 6;
    for (const m of Object.values(M)) if (m.isMeshStandardMaterial) m.envMapIntensity = (m.userData.env ??= m.envMapIntensity) * p.env;
    spray.uniforms.uColor.value.setRGB(...p.spray);
    spray.uniforms.uOpacity.value = p.sprayA;
  }
  floods.forEach((f, i) => { f.intensity = p.flood * (i % 3 === 2 ? 120 : 190); });
  lanternLight.intensity = p.lamps * 60;
  if (world.glows) world.glows.material.opacity = p.lamps * 0.85;
  if (world.monument) world.monument.userData.lamp.visible = p.windows > 0.6;
  renderer.shadowMap.needsUpdate = true;
}

function setLight(name, instant = false) {
  lightFrom = structuredClone(cur);
  lightTo = LIGHTS[name];
  lightT = instant ? 0.999 : 0;
  document.body.classList.toggle('night', name === 'night');
}

function stepLight(dt) {
  if (lightT >= 1) return;
  lightT = Math.min(1, lightT + dt / 1.8);
  const k = lightT < 0.5 ? 4 * lightT ** 3 : 1 - (-2 * lightT + 2) ** 3 / 2;
  for (const key of Object.keys(lightTo)) {
    const a = lightFrom[key], c = lightTo[key];
    cur[key] = Array.isArray(a) ? a.map((v, i) => v + (c[i] - v) * k) : a + (c - a) * k;
  }
  applyLight(cur);
  envCountdown--;
  if (envCountdown <= 0 || lightT >= 1) { envDirty = true; envCountdown = 5; }
}

// ------------------------------------------------------------------ camera presets
export const VIEWS = [
  { id: 'north', pos: [0, NG + 5.6, 90], target: [0, 9.5, 14] },
  { id: 'fountain', pos: [9, NG + 1.9, 67], target: [0, 10, 18] },
  { id: 'portico', pos: [13, NG + 3.2, 33], target: [0, 12.5, 17] },
  { id: 'northeast', pos: [64, 24, 70], target: [0, 8, 2] },
  { id: 'west', pos: [-72, 9, -25], target: [0, 9, -4] },
  { id: 'aerial', pos: [-92, 92, -88], target: [0, 4, -4] },
  { id: 'south', pos: [-5, 5.5, -74], target: [0, 10.5, -14] },
  { id: 'balcony', pos: [21, 13.5, -40], target: [0, 12.5, -20] },
];

let fly = null;
function flyTo(view, dur = 2.4) {
  const from = { pos: camera.position.clone(), target: controls.target.clone() };
  const to = { pos: new THREE.Vector3(...view.pos), target: new THREE.Vector3(...view.target) };
  const az0 = sunView;
  let az1 = Math.atan2(view.pos[2], view.pos[0]);
  while (az1 - az0 > Math.PI) az1 -= Math.PI * 2;
  while (az1 - az0 < -Math.PI) az1 += Math.PI * 2;
  fly = { from, to, t: 0, dur, az0, az1 };
  hud.setView(view.id);
}

function stepFly(dt) {
  if (!fly) return;
  fly.t = Math.min(1, fly.t + dt / fly.dur);
  const t = fly.t, k = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  const a = fly.from.pos, c = fly.to.pos;
  // travel around the house in cylindrical coordinates so paths never cut through it
  const ra = Math.hypot(a.x, a.z), rc = Math.hypot(c.x, c.z);
  let ta = Math.atan2(a.z, a.x), tc = Math.atan2(c.z, c.x);
  let d = tc - ta;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  const th = ta + d * k;
  const r = Math.max(ra + (rc - ra) * k, 40 * Math.sin(Math.PI * k) * Math.min(1, Math.abs(d)));
  const lift = Math.sin(Math.PI * k) * Math.min(28, Math.abs(d) * 14 + a.distanceTo(c) * 0.05);
  camera.position.set(Math.cos(th) * r, a.y + (c.y - a.y) * k + lift, Math.sin(th) * r);
  controls.target.lerpVectors(fly.from.target, fly.to.target, k);
  const sk = Math.min(1, t * 1.15), se = sk * sk * (3 - 2 * sk);
  sunView = fly.az0 + (fly.az1 - fly.az0) * se;
  if (lightT >= 1) applyLight(cur);
  if (t >= 1) { fly = null; envDirty = true; }
}

// ------------------------------------------------------------------ hud
const hud = initHud({
  views: VIEWS,
  onView: (v) => flyTo(v),
  onLight: (name) => setLight(name),
  onOrbit: (on) => { controls.autoRotate = on; },
  camera, controls,
});
controls.addEventListener('start', () => { fly = null; hud.setView(null); });

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let elapsed = 0, perfAcc = 0, perfFrames = 0, perfChecked = false;

function animateFlag(t) {
  const f = world.flag;
  if (!f) return;
  const pos = f.geometry.attributes.position, base = f.userData.base;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    const k = x / 4.2;
    const w = Math.sin(x * 1.6 - t * 5.2 + y * 0.4) * 0.32 * k + Math.sin(x * 3.1 - t * 8.0) * 0.06 * k;
    pos.setXYZ(i, x - k * k * 0.3, y - k * 0.25 + Math.sin(x * 1.2 - t * 3.0) * 0.05 * k, w);
  }
  pos.needsUpdate = true;
  f.geometry.computeVertexNormals();
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  stepFly(dt);
  stepLight(dt);
  controls.update();
  // keep the eye above the ground
  const gy = terrainHeight(camera.position.x, camera.position.z) + 1.4;
  if (camera.position.y < gy) camera.position.y = gy;
  if (envDirty) { updateEnv(); envDirty = false; }

  sky.mesh.position.copy(camera.position);
  sky.uniforms.uTime.value = elapsed;
  spray.uniforms.uTime.value = elapsed;
  if (M) M.water.normalMap.offset.set(elapsed * 0.03, elapsed * 0.018);
  animateFlag(elapsed);
  hud.update(camera, controls);

  composer.render();

  if (!perfChecked && elapsed > 5) {
    perfAcc += dt; perfFrames++;
    if (perfFrames > 90) {
      perfChecked = true;
      const avg = perfAcc / perfFrames;
      if (avg > 0.03 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio * 0.72); resize(); }
    }
  }
}

async function start() {
  resize();
  window.addEventListener('resize', resize);
  applyLight(cur);
  await build();
  applyLight(cur);
  updateEnv();
  renderer.shadowMap.needsUpdate = true;
  progress(1);
  renderer.setAnimationLoop(tick);
  await frame();
  await frame();
  document.getElementById('veil').classList.add('gone');
  hud.ready();
  flyTo(VIEWS[0], 4.2);
}

start();

// handle for automated screenshots
window.__wh = { flyTo, setLight, VIEWS };
