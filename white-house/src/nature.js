// Trees, hedges and flowers as instanced meshes.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from './textures.js';
import { terrainHeight, NORTH_DRIVE, SOUTH_DRIVE, SOUTH_FENCE_Z } from './grounds.js';
import { NORTH_FOUNTAIN, SOUTH_FOUNTAIN, NORTH_FENCE_Z, HW, HD } from './site.js';

const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x, y, z) => {
  // smooth-ish 3D noise from summed sines; cheap and seamless
  return (Math.sin(x * 1.7 + Math.sin(z * 1.3)) + Math.sin(y * 2.1 + Math.sin(x * 1.1)) + Math.sin(z * 1.9 + Math.sin(y * 1.5))) / 3;
};

function blob(detail, rough, seed) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = vnoise(x * 2.3 + seed, y * 2.3 - seed, z * 2.3 + seed * 0.5) * 0.6
      + vnoise(x * 6 + seed, y * 6, z * 6 - seed) * 0.25
      + (hash(x, y, z) - 0.5) * 0.35;
    const k = 1 + n * rough;
    p.setXYZ(i, x * k, y * k * 0.92, z * k);
  }
  return g;
}

// Canopy made of clustered, displaced blobs. Normals blend toward the canopy
// center's radial direction so the crown shades like a soft volume.
function canopy(spec, detail) {
  const parts = [];
  const center = new THREE.Vector3(0, spec.cy, 0);
  const core = blob(detail, spec.rough, rand() * 10);
  core.scale(spec.spread * 0.78, spec.h * 0.42, spec.spread * 0.78);
  core.translate(0, spec.cy, 0);
  parts.push(core);
  for (let i = 0; i < spec.blobs; i++) {
    // clumps scattered near the surface of the crown envelope
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    const rr = 0.62 + 0.38 * Math.sqrt(rand());
    const taper = spec.cone ? 1 - spec.cone * (u + 1) / 2 : 1;
    const x = sq * Math.cos(th) * rr * spec.spread * taper;
    const z = sq * Math.sin(th) * rr * spec.spread * taper;
    let y = spec.cy + u * rr * spec.h * 0.5 - (1 - u * u) * spec.droop * 0.5;
    y = Math.max(y, spec.cy - spec.h * 0.36);
    const r = spec.r * (0.7 + rand() * 0.55);
    const g = blob(detail, spec.rough, rand() * 10);
    g.scale(r, r * spec.flat, r);
    g.rotateY(rand() * 6);
    g.translate(x, y, z);
    parts.push(g);
  }
  const m = mergeGeometries(parts);
  m.computeVertexNormals();
  const p = m.attributes.position, n = m.attributes.normal;
  const v = new THREE.Vector3(), r = new THREE.Vector3();
  const col = new Float32Array(p.count * 3);
  const fn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    r.copy(v).sub(center).multiply(new THREE.Vector3(1, 1.4, 1)).normalize();
    fn.fromBufferAttribute(n, i);
    const outward = Math.max(0, fn.dot(r));
    const nn = fn.clone().multiplyScalar(0.45).addScaledVector(r, 0.55).normalize();
    n.setXYZ(i, nn.x, nn.y, nn.z);
    // baked occlusion: darker low in the crown and in creases between blobs
    const t = THREE.MathUtils.smoothstep(v.y, spec.cy - spec.h * 0.65, spec.cy + spec.h * 0.55);
    const ao = (0.58 + 0.42 * t) * (0.74 + 0.26 * outward);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return m;
}

function trunk(spec) {
  const parts = [];
  const t = new THREE.CylinderGeometry(spec.trunk * 0.6, spec.trunk, spec.cy, 9, 3);
  t.translate(0, spec.cy / 2, 0);
  parts.push(t);
  for (let i = 0; i < spec.limbs; i++) {
    const a = (i / spec.limbs) * Math.PI * 2 + rand();
    const len = spec.spread * 0.9;
    const l = new THREE.CylinderGeometry(spec.trunk * 0.18, spec.trunk * 0.38, len, 6);
    l.translate(0, len / 2, 0);
    l.rotateZ(-0.75);
    l.rotateY(a);
    l.translate(0, spec.cy * (0.55 + rand() * 0.25), 0);
    parts.push(l);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  g.computeVertexNormals();
  return g;
}

const SPECS = {
  elm: { cy: 12, h: 10, r: 2.3, spread: 6.6, blobs: 30, flat: 0.8, droop: 2.4, rough: 0.42, trunk: 0.55, limbs: 5 },
  oak: { cy: 9, h: 9, r: 2.2, spread: 5.6, blobs: 26, flat: 0.85, droop: 1.4, rough: 0.42, trunk: 0.5, limbs: 4 },
  magnolia: { cy: 5.6, h: 9.5, r: 1.6, spread: 3.4, blobs: 26, flat: 1.0, droop: 0, rough: 0.38, trunk: 0.3, limbs: 3, cone: 0.55 },
  small: { cy: 3.8, h: 4, r: 1.3, spread: 2.6, blobs: 16, flat: 0.85, droop: 0.6, rough: 0.4, trunk: 0.22, limbs: 3 },
};

function distToCurvePts(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// camera viewpoints (x, z) that should not sit inside a crown
const VIEW_SPOTS = [[0, 90], [9, 67], [13, 33], [64, 70], [-72, -25], [-5, -74], [21, -40], [52, 58], [-60, -20]];

function placements() {
  const list = [];
  const ok = (x, z, clear = 8) => {
    if (distToCurvePts(x, z, NORTH_DRIVE) < clear || distToCurvePts(x, z, SOUTH_DRIVE) < clear) return false;
    if (Math.hypot(x - NORTH_FOUNTAIN.x, z - NORTH_FOUNTAIN.z) < 18) return false;
    if (Math.hypot(x - SOUTH_FOUNTAIN.x, z - SOUTH_FOUNTAIN.z) < 22) return false;
    if (Math.abs(x) < HW + 10 && Math.abs(z) < HD + 14) return false;
    if (Math.abs(Math.abs(x) - 45) < 12 && z > -20 && z < 0) return false;   // gardens
    if (Math.abs(z - NORTH_FENCE_Z) < 4 || Math.abs(z - SOUTH_FENCE_Z) < 4) return false;
    if (z > NORTH_FENCE_Z && z < 122) return false;                         // plaza & avenue
    if (VIEW_SPOTS.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < 17)) return false; // keep viewpoints clear
    return list.every((p) => Math.hypot(p.x - x, p.z - z) > p.minGap);
  };
  const scatter = (n, fx, fz, types, gap = 13, tries = 40) => {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < tries; k++) {
        const x = fx(), z = fz();
        if (!ok(x, z)) continue;
        const type = types[Math.floor(rand() * types.length)];
        list.push({ x, z, type, s: 0.8 + rand() * 0.45, ry: rand() * Math.PI * 2, minGap: gap });
        break;
      }
    }
  };
  const side = () => (rand() < 0.5 ? -1 : 1);
  // North Lawn: framed on both sides, the center left open to the portico
  scatter(26, () => side() * (24 + rand() * 80), () => 30 + rand() * 62, ['elm', 'elm', 'oak', 'small']);
  // flanks of the house
  scatter(26, () => side() * (40 + rand() * 80), () => -40 + rand() * 75, ['elm', 'oak', 'oak', 'small']);
  // South Lawn edges, leaving the long view to the Monument open
  scatter(46, () => side() * (48 + rand() * 100), () => -225 + rand() * 190, ['elm', 'oak', 'oak', 'small'], 12);
  // Lafayette Square beyond Pennsylvania Avenue
  scatter(26, () => (rand() - 0.5) * 300, () => 130 + rand() * 110, ['elm', 'oak'], 16);
  // the Ellipse and the far edges
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * 190 + (rand() - 0.5) * 20, z = -470 + Math.sin(a) * 170 + (rand() - 0.5) * 20;
    if (Math.abs(x) < 70 && z > -330) continue;
    list.push({ x, z, type: rand() < 0.5 ? 'elm' : 'oak', s: 0.9 + rand() * 0.4, ry: rand() * 6, minGap: 10 });
  }
  scatter(36, () => side() * (170 + rand() * 330), () => -600 + rand() * 900, ['elm', 'oak'], 22, 10);
  // the Jackson magnolias beside the South Portico, and companions
  for (const [x, z, s] of [[-24, -27, 1.0], [-30.5, -22, 0.9], [-19, -33, 0.85], [24, -29, 0.9], [30, -23, 0.8]]) {
    list.push({ x, z, type: 'magnolia', s, ry: rand() * 6, minGap: 5 });
  }
  for (const [x, z] of [[-33, 24], [33, 24], [-36, 6], [36, 6]]) list.push({ x, z, type: 'magnolia', s: 0.85 + rand() * 0.2, ry: rand() * 6, minGap: 5 });
  return list;
}

const LEAF = {
  elm: [0x50782f, 0x5c8636, 0x47702b, 0x648c3a],
  oak: [0x4a6e2c, 0x56793a, 0x3f6328, 0x5e7f34],
  magnolia: [0x2c4a22, 0x335427, 0x274020],
  small: [0x6f9442, 0x7d9c4a, 0x8aa651],
};

export function buildTrees(materials) {
  const group = new THREE.Group();
  const list = placements();
  const variants = {};
  for (const type of Object.keys(SPECS)) {
    variants[type] = [0, 1].map(() => ({ canopy: canopy(SPECS[type], 1), trunk: trunk(SPECS[type]) }));
    variants[type + '_far'] = [{ canopy: canopy({ ...SPECS[type], blobs: Math.round(SPECS[type].blobs / 3) }, 1), trunk: trunk(SPECS[type]) }];
  }
  const buckets = new Map();
  for (const t of list) {
    const far = Math.hypot(t.x, t.z) > 240;
    const key = far ? `${t.type}_far|0` : `${t.type}|${Math.floor(rand() * 2)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (const [key, items] of buckets) {
    const [vname, vi] = key.split('|');
    const v = variants[vname][+vi];
    const far = vname.endsWith('_far');
    const type = vname.replace('_far', '');
    const leaves = new THREE.InstancedMesh(v.canopy, type === 'magnolia' ? materials.magnolia : materials.leaves, items.length);
    const bark = new THREE.InstancedMesh(v.trunk, materials.bark, items.length);
    items.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.ry);
      const y = terrainHeight(t.x, t.z) - 0.2;
      m.compose(new THREE.Vector3(t.x, y, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + rand() * 0.2), t.s));
      leaves.setMatrixAt(i, m);
      bark.setMatrixAt(i, m);
      const pal = LEAF[type];
      c.setHex(pal[Math.floor(rand() * pal.length)]);
      c.offsetHSL((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06);
      leaves.setColorAt(i, c);
    });
    for (const mesh of [leaves, bark]) {
      mesh.castShadow = !far;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
  return group;
}

export function buildHedges(material, items) {
  const g = blob(1, 0.35, 3.3);
  g.computeVertexNormals();
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) {
    const ao = 0.5 + 0.5 * THREE.MathUtils.smoothstep(g.attributes.position.getY(i), -0.9, 0.7);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(0, 0.55, 0);
  const mesh = new THREE.InstancedMesh(g, material, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  items.forEach((h, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6);
    m.compose(new THREE.Vector3(h.x, h.y - 0.05, h.z), q, new THREE.Vector3(h.s[0] * 0.62, h.s[1] * 0.95, h.s[2] * 0.62));
    mesh.setMatrixAt(i, m);
    c.setHex(0x3d5c2a).offsetHSL(0, 0, (rand() - 0.5) * 0.05);
    mesh.setColorAt(i, c);
  });
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function buildFlowers(material, items) {
  const geo = new THREE.OctahedronGeometry(0.095, 0);
  const mesh = new THREE.InstancedMesh(geo, material, items.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  items.forEach((f, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6);
    m.compose(new THREE.Vector3(f.x, f.y + 0.22 + rand() * 0.1, f.z), q, new THREE.Vector3(1, 0.8, 1));
    mesh.setMatrixAt(i * 2, m);
    mesh.setColorAt(i * 2, c.setHex(f.c));
    m.compose(new THREE.Vector3(f.x + (rand() - 0.5) * 0.15, f.y + 0.06, f.z + (rand() - 0.5) * 0.15), q, new THREE.Vector3(1.8, 1.2, 1.8));
    mesh.setMatrixAt(i * 2 + 1, m);
    mesh.setColorAt(i * 2 + 1, c.setHex(0x3e5f28).offsetHSL(0, 0, (rand() - 0.5) * 0.06));
  });
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.computeBoundingSphere();
  return mesh;
}
