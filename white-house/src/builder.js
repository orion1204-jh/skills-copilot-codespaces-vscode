// Geometry batching: parts are transformed into world space, given world-scale
// UVs (box projection in meters) and merged into one mesh per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

export function mat4(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// World-space box projection: each triangle picks the axis its normal faces.
function projectUV(g) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(_p.subVectors(a, b));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      let u, w;
      if (ay >= ax && ay >= az) { u = v.x; w = v.z; }
      else if (ax >= az) { u = v.z; w = v.y; }
      else { u = v.x; w = v.y; }
      uv[(i + k) * 2] = u;
      uv[(i + k) * 2 + 1] = w;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class Builder {
  constructor() {
    this.buckets = new Map();
    this.instances = new Map();
  }

  // uv: 'world' (default) | 'keep' | [su, sv] to scale existing UVs into meters
  add(key, geo, matrix, uv = 'world') {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (uv === 'world' || !g.attributes.uv) projectUV(g);
    else if (Array.isArray(uv)) {
      const a = g.attributes.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uv[0], a.getY(i) * uv[1]);
    }
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
    return this;
  }

  box(key, cx, cy, cz, w, h, d, ry = 0) {
    return this.add(key, new THREE.BoxGeometry(w, h, d), mat4(cx, cy, cz, ry));
  }

  instance(name, geo, key, matrix) {
    if (!this.instances.has(name)) this.instances.set(name, { geo, key, list: [] });
    this.instances.get(name).list.push(matrix.clone());
  }

  build(materials, { castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.castShadow = castShadow && !key.startsWith('glass') && key !== 'emissive';
      mesh.receiveShadow = receiveShadow;
      mesh.name = key;
      group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    for (const [name, { geo, key, list }] of this.instances) {
      const im = new THREE.InstancedMesh(geo, materials[key], list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = castShadow;
      im.receiveShadow = receiveShadow;
      im.name = name;
      im.computeBoundingSphere();
      group.add(im);
    }
    return group;
  }
}

// A vertical band following a circular arc (center cx,cz; angles measured
// from +x toward -z, i.e. sweeping across the south side for 0..PI).
export function arcBand(r0, r1, a0, a1, y0, y1, segs = 48) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: segs });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

// Solid disc sector slab (for floors / roofs of the bow).
export function sector(r, a0, a1, y0, y1, segs = 48) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, r, a0, a1, false);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: segs });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

// Extrude a 2D outline (in the XY plane) along Z by depth, centered on z.
export function prism(points, depth) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

export { UP };
