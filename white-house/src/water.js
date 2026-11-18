// Fountains: carved stone basins, rippling water and GPU-animated jets.
import * as THREE from 'three';
import { mat4 } from './builder.js';
import { terrainHeight } from './grounds.js';
import { rand } from './textures.js';

const sprayVS = /* glsl */`
  uniform float uTime;
  uniform float uScale;
  attribute vec4 aJet;    // vx, vy, vz, phase
  attribute vec3 aLife;   // life seconds, size, water level
  varying float vAlpha;
  void main() {
    float t = mod(uTime + aJet.w * aLife.x, aLife.x);
    vec3 p = position + aJet.xyz * t + vec3(0.0, -4.9, 0.0) * t * t;
    float life = t / aLife.x;
    vAlpha = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.75, 1.0, life));
    if (p.y < aLife.z) { vAlpha = 0.0; }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aLife.y * uScale / -mv.z;
  }
`;
const sprayFS = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float a = (1.0 - r * 4.0) * vAlpha * uOpacity;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

export function sprayMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 300 },
      uColor: { value: new THREE.Color(0xf4f8ff) },
      uOpacity: { value: 0.55 },
    },
    vertexShader: sprayVS,
    fragmentShader: sprayFS,
    transparent: true,
    depthWrite: false,
  });
}

function jets(origin, specs) {
  const pos = [], jet = [], life = [];
  for (const s of specs) {
    for (let i = 0; i < s.count; i++) {
      const a = s.ring ? (i / s.count) * Math.PI * 2 * s.ring + rand() * 0.05 : rand() * Math.PI * 2;
      const spread = s.spread * (0.6 + rand() * 0.4);
      const ox = s.radius ? Math.cos(Math.floor(a / (Math.PI * 2) * s.jets) * (Math.PI * 2 / s.jets)) * s.radius : 0;
      const oz = s.radius ? Math.sin(Math.floor(a / (Math.PI * 2) * s.jets) * (Math.PI * 2 / s.jets)) * s.radius : 0;
      const dir = s.radius ? Math.atan2(oz, ox) + Math.PI + (rand() - 0.5) * 0.06 : a;
      pos.push(origin.x + ox, origin.y + s.y, origin.z + oz);
      const vy = s.vy * (0.93 + rand() * 0.1);
      jet.push(Math.cos(dir) * spread, vy, Math.sin(dir) * spread, rand());
      life.push(s.life * (0.9 + rand() * 0.2), s.size * (0.7 + rand() * 0.6), origin.y + 0.42);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aJet', new THREE.Float32BufferAttribute(jet, 4));
  g.setAttribute('aLife', new THREE.Float32BufferAttribute(life, 3));
  g.boundingSphere = new THREE.Sphere(origin.clone().add(new THREE.Vector3(0, 4, 0)), 14);
  return g;
}

// basin: stone curb + water + central bowl. Adds stone to builder `b`.
export function fountain(b, { x, z, r, tall }, waterMat, spray) {
  const y = terrainHeight(x, z);
  const curb = new THREE.LatheGeometry([
    [r - 0.35, 0.0], [r - 0.35, 0.55], [r - 0.3, 0.62], [r + 0.05, 0.66], [r + 0.3, 0.6], [r + 0.38, 0.48],
    [r + 0.32, 0.4], [r + 0.4, 0.12], [r + 0.48, 0.0],
  ].map(([a, c]) => new THREE.Vector2(a, c)), 96);
  b.add('trim', curb, mat4(x, y, z), [2 * Math.PI * r, 1]);
  const floor = new THREE.CircleGeometry(r - 0.3, 64);
  floor.rotateX(-Math.PI / 2);
  b.add('basin', floor, mat4(x, y + 0.05, z));
  // central pedestal and bowl(s)
  const tiers = tall ? [[1.5, 0.95]] : [[1.25, 0.85], [0.6, 1.65]];
  b.add('trim', new THREE.LatheGeometry([
    [0, 0], [0.7, 0], [0.55, 0.3], [0.3, 0.45], [0.28, tiers[0][1] - 0.25], [0.45, tiers[0][1] - 0.1], [0, tiers[0][1] - 0.1],
  ].map(([a, c]) => new THREE.Vector2(a, c)), 24), mat4(x, y, z), [4, 1]);
  for (const [tr, ty] of tiers) {
    b.add('trim', new THREE.LatheGeometry([
      [0.25, ty - 0.12], [tr * 0.55, ty - 0.08], [tr, ty + 0.12], [tr + 0.08, ty + 0.22], [tr - 0.06, ty + 0.24], [0.3, ty + 0.08],
    ].map(([a, c]) => new THREE.Vector2(a, c)), 40), mat4(x, y, z), [4, 1]);
    if (ty > 1) {
      b.add('trim', new THREE.CylinderGeometry(0.16, 0.24, ty - 0.9, 12), mat4(x, y + 0.9 + (ty - 0.9) / 2, z));
    }
  }
  // water surface
  const w = new THREE.Mesh(new THREE.CircleGeometry(r - 0.32, 72), waterMat);
  w.rotation.x = -Math.PI / 2;
  w.position.set(x, y + 0.45, z);
  w.receiveShadow = true;
  const top = tiers[tiers.length - 1][1] + 0.2;
  const specs = tall
    ? [
        { count: 2600, y: top, vy: 11.5, spread: 0.42, life: 2.4, size: 0.26 },
        { count: 1800, y: 0.5, vy: 4.6, spread: 1.9, life: 1.05, size: 0.18, radius: r - 1.0, jets: 16, ring: 1 },
        { count: 600, y: top - 0.1, vy: 0.6, spread: 1.15, life: 0.55, size: 0.24 },
      ]
    : [
        { count: 2200, y: top, vy: 7.8, spread: 0.38, life: 1.65, size: 0.2 },
        { count: 900, y: top, vy: 1.0, spread: 0.9, life: 0.5, size: 0.2 },
        { count: 900, y: tiers[0][1] + 0.2, vy: 0.4, spread: 1.4, life: 0.5, size: 0.18 },
      ];
  const pts = new THREE.Points(jets(new THREE.Vector3(x, y, z), specs), spray);
  pts.frustumCulled = true;
  // falling-water rings where the jets land
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.4, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.set(x, y + 0.47, z);
  return { water: w, spray: pts, ripple };
}
