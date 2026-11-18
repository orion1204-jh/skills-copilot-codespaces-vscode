// Grounds: terrain, drives and walks, fences, lamp posts, hedges, flower beds
// and the distant Washington Monument.
import * as THREE from 'three';
import { mat4 } from './builder.js';
import { HW, HD, NG, AREA, groundHeight, NORTH_FOUNTAIN, SOUTH_FOUNTAIN, NORTH_FENCE_Z } from './site.js';
import { rand } from './textures.js';

export const SOUTH_FENCE_Z = -232;

export function terrainHeight(x, z) {
  if (Math.abs(x) <= AREA.x && z <= AREA.z1 && z >= AREA.z0 - 0.6) return AREA.floor;
  return groundHeight(x, z);
}

function axis(min, max, bands, breaks) {
  // bands: [[limit, spacing], ...] by distance from 0
  const out = new Set();
  for (const sgn of [-1, 1]) {
    let v = 0;
    const lim = sgn < 0 ? -min : max;
    while (v <= lim) {
      out.add(+(sgn * v).toFixed(3));
      const sp = (bands.find(([l]) => v < l) || bands[bands.length - 1])[1];
      v += sp;
    }
    out.add(sgn < 0 ? min : max);
  }
  breaks.forEach((b) => out.add(b));
  return [...out].filter((v) => v >= min && v <= max).sort((a, b) => a - b);
}

export function buildTerrain() {
  const xs = axis(-900, 900, [[110, 2], [260, 5], [500, 14], [1e9, 30]],
    [AREA.x, AREA.x + 0.03, -AREA.x, -AREA.x - 0.03]);
  const zs = axis(-1500, 700, [[120, 2], [260, 5], [500, 14], [1e9, 30]],
    [AREA.z1, AREA.z1 + 0.03, AREA.z0 - 0.62]);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j], k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = terrainHeight(x, z); pos[k + 2] = z;
    // contact darkening near the house walls
    const dx = Math.max(0, Math.abs(x) - HW), dz = Math.max(0, Math.abs(z) - HD);
    const d = Math.hypot(dx, dz);
    const ao = 1 - 0.38 * Math.exp(-d / 2.2);
    col[k] = col[k + 1] = col[k + 2] = ao;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uv = new Float32Array(nx * nz * 2);
  for (let k = 0; k < nx * nz; k++) { uv[k * 2] = pos[k * 3]; uv[k * 2 + 1] = pos[k * 3 + 2]; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A flat strip following a smooth path, draped on the terrain.
export function ribbon(points, width, { lift = 0.04, step = 0.8, closed = false, curbs = null } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal');
  const n = Math.ceil(curve.getLength() / step);
  const pos = [], uv = [], idx = [];
  let dist = 0, prev = null;
  const P = new THREE.Vector3(), T = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, P);
    curve.getTangentAt(i / n, T);
    if (prev) dist += P.distanceTo(prev);
    prev = P.clone();
    const nx = -T.z, nz = T.x;
    for (const s of [-1, 1]) {
      const x = P.x + nx * s * width / 2, z = P.z + nz * s * width / 2;
      pos.push(x, terrainHeight(x, z) + lift, z);
      uv.push(s * width / 2, dist);
    }
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (curbs) {
    // a slim stone edge on both sides
    const edges = [];
    for (const s of [-1, 1]) {
      const ep = [], ei = [];
      for (let i = 0; i <= n; i++) {
        curve.getPointAt(i / n, P);
        curve.getTangentAt(i / n, T);
        const nx = -T.z, nz = T.x;
        for (const o of [0, 0.22]) {
          const x = P.x + nx * s * (width / 2 + o), z = P.z + nz * s * (width / 2 + o);
          ep.push(x, terrainHeight(x, z) + lift + 0.05, z);
        }
        if (i < n) { const a = i * 2; ei.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
      eg.setIndex(ei);
      eg.computeVertexNormals();
      edges.push(eg);
    }
    return { surface: g, edges, curve };
  }
  return { surface: g, curve };
}

export const NORTH_DRIVE = [[-63, 104], [-60, 90], [-50, 62], [-34, 38], [-16, 24.5], [0, 20.5], [16, 24.5], [34, 38], [50, 62], [60, 90], [63, 104]];
export const SOUTH_DRIVE = [[-82, -236], [-80, -190], [-66, -110], [-46, -58], [-26, -34], [-9, -27.4], [0, -26.6], [9, -27.4], [26, -34], [46, -58], [66, -110], [80, -190], [82, -236]];

export function drives(b) {
  const out = [];
  for (const [pts, w] of [[NORTH_DRIVE, 6.5], [SOUTH_DRIVE, 5.6]]) {
    const r = ribbon(pts, w, { curbs: true });
    b.add('drive', r.surface, null, 'keep');
    r.edges.forEach((e) => b.add('curb', e, null));
    out.push(r.curve);
  }
  // walks: around the house, to the north fountain and across the plaza
  const walks = [
    [[[-HW - 2.2, -HD - 2.0], [-HW - 2.2, HD + 1.0]], 2.2],
    [[[HW + 2.2, -HD - 2.0], [HW + 2.2, HD + 1.0]], 2.2],
    [[[-HW - 3.3, -HD - 2.0], [-12.8, -HD - 2.0]], 2.4],
    [[[12.8, -HD - 2.0], [HW + 3.3, -HD - 2.0]], 2.4],
    [[[0, 104], [0, NORTH_FOUNTAIN.z + 10.2]], 3.2],
    [[[-150, 112], [150, 112]], 14],
  ];
  for (const [pts, w] of walks) {
    const r = ribbon(pts, w, { step: 1.2, lift: 0.03 });
    b.add('walk', r.surface, null, 'keep');
  }
  // apron in front of the Diplomatic Reception Room entrance
  const apron = new THREE.CircleGeometry(15.5, 48, Math.PI * 1.17, Math.PI * 0.66);
  apron.rotateX(-Math.PI / 2);
  b.add('walk', apron, mat4(0, 0.035, -HD));
  return out;
}

// -------------------------------------------------------------- fences
export function fences(b) {
  const picket = new THREE.CylinderGeometry(0.018, 0.018, 1.9, 4, 1, true);
  const tip = new THREE.ConeGeometry(0.04, 0.16, 4, 1, true);
  const runs = [
    { z: NORTH_FENCE_Z, x0: -150, x1: 150, gaps: [[-67, -59], [-3.5, 3.5], [59, 67]] },
    { z: SOUTH_FENCE_Z, x0: -150, x1: 150, gaps: [[-86, -78], [78, 86]] },
  ];
  for (const { z, x0, x1, gaps } of runs) {
    const y0 = terrainHeight(0, z);
    const inGap = (x) => gaps.some(([a, c]) => x > a && x < c);
    // stone base wall in segments between gaps
    let segStart = x0;
    const xsPier = [];
    for (let x = x0; x <= x1 + 0.01; x += 0.5) {
      const end = x >= x1 || inGap(x + 0.5);
      if (inGap(x)) { segStart = x + 0.5; continue; }
      if (end) {
        const L = x - segStart;
        if (L > 0.5) {
          b.box('stone', (segStart + x) / 2, y0 + 0.3, z, L, 0.6, 0.55);
          b.box('trim', (segStart + x) / 2, y0 + 0.64, z, L, 0.08, 0.66);
          b.box('iron', (segStart + x) / 2, y0 + 0.95, z, L, 0.05, 0.05);
          b.box('iron', (segStart + x) / 2, y0 + 2.35, z, L, 0.05, 0.05);
        }
        segStart = x + 0.5;
      }
    }
    for (let x = x0; x <= x1; x += 0.15) {
      if (inGap(x)) continue;
      b.instance('fencePicket', picket, 'iron', mat4(x, y0 + 0.68 + 0.95, z));
      b.instance('fenceTip', tip, 'iron', mat4(x, y0 + 0.68 + 1.95, z));
    }
    for (let x = x0; x <= x1; x += 10) if (!inGap(x) && !inGap(x + 1) && !inGap(x - 1)) xsPier.push(x);
    gaps.forEach(([a, c]) => xsPier.push(a, c));
    for (const x of xsPier) {
      const big = gaps.some(([a, c]) => x === a || x === c);
      const w = big ? 1.4 : 0.8, h = big ? 3.4 : 2.6;
      b.box('stone', x, y0 + h / 2, z, w, h, w);
      b.box('trim', x, y0 + h + 0.08, z, w + 0.2, 0.16, w + 0.2);
      if (big) {
        b.add('iron', new THREE.SphereGeometry(0.28, 12, 8), mat4(x, y0 + h + 0.45, z));
      }
    }
  }
}

// -------------------------------------------------------------- lamp posts
export function lampPosts(b, curves) {
  const glows = [];
  const post = new THREE.LatheGeometry([
    [0, 0], [0.24, 0], [0.24, 0.3], [0.16, 0.42], [0.12, 0.6], [0.08, 0.7], [0.07, 2.8], [0.1, 2.9], [0.1, 3.0], [0, 3.0],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 10);
  const add = (x, z) => {
    const y = terrainHeight(x, z);
    b.add('iron', post, mat4(x, y, z), 'world');
    b.add('lampGlass', new THREE.CylinderGeometry(0.22, 0.15, 0.6, 6), mat4(x, y + 3.32, z));
    b.add('iron', new THREE.ConeGeometry(0.32, 0.32, 6), mat4(x, y + 3.78, z));
    b.add('iron', new THREE.SphereGeometry(0.06, 6, 4), mat4(x, y + 3.98, z));
    glows.push(new THREE.Vector3(x, y + 3.35, z));
  };
  const P = new THREE.Vector3(), T = new THREE.Vector3();
  for (const c of curves) {
    const L = c.getLength();
    for (let d = 10; d < L - 6; d += 17) {
      const t = d / L;
      c.getPointAt(t, P);
      c.getTangentAt(t, T);
      if (Math.abs(P.x) < 12 && Math.abs(P.z) < 30) continue;
      const side = 4.2;
      add(P.x - T.z * side, P.z + T.x * side);
    }
  }
  // along the plaza on Pennsylvania Avenue
  for (let x = -140; x <= 140; x += 20) add(x, 106);
  return glows;
}

// -------------------------------------------------------------- hedges & beds
export function hedgeBlobs(list) {
  // returns positions for blob instances along polylines; list of [[x0,z0],[x1,z1], height]
  const out = [];
  for (const [[x0, z0], [x1, z1], h, w = 1.1] of list) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(L / 0.75));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      out.push({ x, z, y: terrainHeight(x, z), s: [w * (0.85 + rand() * 0.2), h * (0.9 + rand() * 0.2), w * (0.85 + rand() * 0.2)] });
    }
  }
  return out;
}

export function hedgeLines() {
  const lines = [];
  // boxwood along the south facade
  for (const s of [-1, 1]) {
    lines.push([[s * 13.5, -HD - 0.9], [s * 24.8, -HD - 0.9], 0.9, 1.0]);
    lines.push([[s * (HW + 0.9), -HD + 0.5], [s * (HW + 0.9), 4], 0.8, 1.0]);
  }
  // garden parterres east and west (Rose Garden / Kennedy Garden)
  for (const s of [-1, 1]) {
    const cx = s * 45, cz = -10;
    lines.push([[cx - 9, cz - 7], [cx + 9, cz - 7], 0.7, 0.9]);
    lines.push([[cx - 9, cz + 7], [cx + 9, cz + 7], 0.7, 0.9]);
    lines.push([[cx - 9, cz - 7], [cx - 9, cz + 7], 0.7, 0.9]);
    lines.push([[cx + 9, cz - 7], [cx + 9, cz + 7], 0.7, 0.9]);
  }
  // north lawn: low hedges inside the fence
  for (const s of [-1, 1]) lines.push([[s * 10, NORTH_FENCE_Z - 3], [s * 52, NORTH_FENCE_Z - 3], 1.2, 1.2]);
  return lines;
}

export function flowerBeds(b) {
  const flowers = [];
  const ring = (cx, cz, r0, r1, palette, density = 9) => {
    const y = terrainHeight(cx, cz);
    const g = new THREE.RingGeometry(r0, r1, 64, 1);
    g.rotateX(-Math.PI / 2);
    b.add('soil', g, mat4(cx, y + 0.06, cz));
    const area = Math.PI * (r1 * r1 - r0 * r0);
    const n = Math.floor(area * density);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
      flowers.push({ x: cx + Math.cos(a) * r, y: y + 0.08, z: cz + Math.sin(a) * r, c: palette[Math.floor(rand() * palette.length)] });
    }
  };
  const rect = (cx, cz, w, d, palette, density = 9) => {
    const y = terrainHeight(cx, cz);
    b.box('soil', cx, y + 0.03, cz, w, 0.08, d);
    for (let i = 0; i < w * d * density; i++) {
      flowers.push({ x: cx + (rand() - 0.5) * w * 0.94, y: y + 0.08, z: cz + (rand() - 0.5) * d * 0.94, c: palette[Math.floor(rand() * palette.length)] });
    }
  };
  const red = [0xb3122a, 0xc8102e, 0xd62839, 0x9e0f22];
  const spring = [0xf1e9d8, 0xe8b4c8, 0xc8102e, 0xf6d55c];
  ring(NORTH_FOUNTAIN.x, NORTH_FOUNTAIN.z, NORTH_FOUNTAIN.r + 0.6, NORTH_FOUNTAIN.r + 3.4, red, 10);
  ring(SOUTH_FOUNTAIN.x, SOUTH_FOUNTAIN.z, SOUTH_FOUNTAIN.r + 0.7, SOUTH_FOUNTAIN.r + 3.0, spring, 7);
  for (const s of [-1, 1]) {
    rect(s * 45, -10, 16, 2.2, [0xe8b4c8, 0xf1e9d8, 0xb3122a], 8);
    rect(s * 45, -14.5, 16, 2.0, [0xe8b4c8, 0xf6d55c], 7);
    rect(s * 45, -5.5, 16, 2.0, [0xf1e9d8, 0xe8b4c8], 7);
    // beds at the foot of the north areaway railing
    rect(s * 17.5, AREA.z1 + 1.6, 16, 1.6, red, 9);
  }
  return flowers;
}

// -------------------------------------------------------------- monument
export function monument() {
  const g = new THREE.Group();
  const shaftH = 152.4, base = 16.8, top = 10.5;
  const shaft = new THREE.CylinderGeometry(top / Math.SQRT2, base / Math.SQRT2, shaftH, 4, 1);
  shaft.rotateY(Math.PI / 4);
  shaft.translate(0, shaftH / 2, 0);
  const cap = new THREE.ConeGeometry(top / Math.SQRT2, 16.8, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(0, shaftH + 8.4, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.6 });
  const m1 = new THREE.Mesh(shaft, mat), m2 = new THREE.Mesh(cap, mat);
  g.add(m1, m2);
  const x = 95, z = -1150;
  g.position.set(x, terrainHeight(x, z) - 0.5, z);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  lamp.position.set(0, shaftH - 4, 0);
  lamp.visible = false;
  g.add(lamp);
  g.userData.lamp = lamp;
  return g;
}
