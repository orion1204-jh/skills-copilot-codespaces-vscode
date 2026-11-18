// Classical building parts: Ionic columns, pilasters, windows, balustrades.
import * as THREE from 'three';
import { mat4, prism } from './builder.js';

const tmp = new THREE.Matrix4();
const at = (M, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
  tmp.copy(M).multiply(mat4(x, y, z, ry, sx, sy, sz, rx, rz)).clone();

// ---------------------------------------------------------------- Ionic column
class Spiral extends THREE.Curve {
  constructor(R, turns) { super(); this.R = R; this.turns = turns; }
  getPoint(t, out = new THREE.Vector3()) {
    const a = Math.PI * 0.5 + t * this.turns * Math.PI * 2;
    const r = this.R * (1 - 0.82 * t);
    return out.set(Math.cos(a) * r, Math.sin(a) * r, 0);
  }
}

const columnCache = new Map();

// Returns { shaft, capital } geometries for a column of height H and lower diameter D,
// standing on y=0, volutes facing ±z. Shaft has lathe UVs (scale them into meters).
export function ionicColumn(H, D) {
  const key = `${H.toFixed(2)}_${D.toFixed(2)}`;
  if (columnCache.has(key)) return columnCache.get(key);
  const r = D / 2;
  const hb = 0.5 * D, hcap = 0.34 * D, hs = H - hb - hcap - 0.12 * D;
  const pts = [];
  const P = (x, y) => pts.push(new THREE.Vector2(x, y));
  P(0, 0.2 * D);
  P(1.22 * r, 0.2 * D);
  P(1.3 * r, 0.25 * D); P(1.22 * r, 0.3 * D);          // lower torus
  P(1.06 * r, 0.31 * D); P(1.0 * r, 0.35 * D); P(1.06 * r, 0.39 * D); // scotia
  P(1.12 * r, 0.42 * D); P(1.06 * r, 0.47 * D);         // upper torus
  P(1.0 * r, hb);
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ent = 1 - 0.14 * Math.pow(t, 1.6) + 0.015 * Math.sin(t * Math.PI);
    P(r * ent, hb + hs * t);
  }
  const top = hb + hs, rt = r * 0.86;
  P(rt * 1.1, top + 0.02 * D); P(rt * 1.1, top + 0.05 * D); P(rt, top + 0.06 * D); // astragal
  P(rt * 1.12, top + 0.12 * D);                                             // echinus
  P(0, top + 0.12 * D);
  const parts = [];
  const shaft = new THREE.LatheGeometry(pts, 36);
  // plinth
  parts.push(new THREE.BoxGeometry(2.7 * r, 0.2 * D, 2.7 * r).translate(0, 0.1 * D, 0));

  const cap = [];
  const y0 = top + 0.12 * D;
  const vx = 0.56 * D, vy = y0 + 0.02 * D, vr = 0.2 * D;
  // bolsters (pulvini) running front to back
  for (const s of [-1, 1]) {
    cap.push(new THREE.CylinderGeometry(vr * 0.92, vr * 0.92, 0.86 * D, 20).rotateX(Math.PI / 2).translate(s * vx, vy, 0));
    for (const f of [-1, 1]) {
      const disc = new THREE.CylinderGeometry(vr, vr, 0.04 * D, 24).rotateX(Math.PI / 2).translate(s * vx, vy, f * 0.45 * D);
      cap.push(disc);
      const sp = new THREE.TubeGeometry(new Spiral(vr * 0.96, 2.4), 56, 0.022 * D, 5, false);
      if (s < 0) sp.scale(-1, 1, 1);
      sp.translate(s * vx, vy, f * 0.475 * D);
      cap.push(sp);
      // eye of the volute
      cap.push(new THREE.SphereGeometry(0.035 * D, 10, 8).translate(s * vx, vy, f * 0.48 * D));
    }
  }
  // canalis band joining the volutes
  cap.push(new THREE.BoxGeometry(2 * vx, 0.14 * D, 0.9 * D).translate(0, vy + vr - 0.07 * D, 0));
  cap.push(new THREE.BoxGeometry(1.75 * vx, 0.1 * D, 0.82 * D).translate(0, y0 - 0.0 * D, 0));
  // abacus
  cap.push(new THREE.BoxGeometry(2.45 * vx * 0.82, 0.07 * D, 1.0 * D).translate(0, vy + vr + 0.035 * D, 0));
  cap.push(new THREE.BoxGeometry(2.3 * vx * 0.82, 0.03 * D, 0.96 * D).translate(0, vy + vr + 0.085 * D, 0));

  const res = { shaft, plinth: parts, capital: cap, height: vy + vr + 0.1 * D, circ: Math.PI * D, hs: H };
  columnCache.set(key, res);
  return res;
}

export function addColumn(b, x, y, z, H, D, ry = 0, key = 'trim') {
  const c = ionicColumn(H, D);
  // world-ish uv scale: around = circumference, along = height
  b.add(key, c.shaft, mat4(x, y, z, ry), [c.circ, H]);
  c.plinth.forEach((g) => b.add(key, g, mat4(x, y, z, ry)));
  c.capital.forEach((g) => b.add(key, g, mat4(x, y, z, ry)));
}

// Flat pilaster against a wall (wall surface at local z=0, facing +z).
export function addPilaster(b, M, x, y0, y1, w, key = 'trim') {
  const d = 0.22;
  const h = y1 - y0;
  b.add(key, new THREE.BoxGeometry(w + 0.18, 0.28, d + 0.12), at(M, x, y0 + 0.14, (d + 0.12) / 2));
  b.add(key, new THREE.BoxGeometry(w + 0.08, 0.12, d + 0.06), at(M, x, y0 + 0.34, (d + 0.06) / 2));
  b.add(key, new THREE.BoxGeometry(w, h - 0.8, d), at(M, x, y0 + 0.4 + (h - 0.8) / 2, d / 2));
  // capital: echinus band, small volutes, abacus
  b.add(key, new THREE.BoxGeometry(w + 0.1, 0.16, d + 0.06), at(M, x, y1 - 0.32, (d + 0.06) / 2));
  for (const s of [-1, 1]) {
    b.add(key, new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18), at(M, x + s * (w / 2 - 0.02), y1 - 0.22, d + 0.03, 0, 1, 1, 1, Math.PI / 2));
  }
  b.add(key, new THREE.BoxGeometry(w + 0.36, 0.12, d + 0.14), at(M, x, y1 - 0.06, (d + 0.14) / 2));
}

// ---------------------------------------------------------------- windows
// Local frame: origin at bottom-center of the opening on the wall surface,
// +z out of the wall. o = { w, h, cols, rows, head, glass, arch, frame }
export function addWindow(b, M, o) {
  const { w, h, cols = 3, rows = 4, head = 'flat', glass = 'glassA', arch = false, frame = true } = o;
  const sw = o.surround ?? 0.24;     // architrave width
  const dep = 0.22;                  // architrave projection
  const archR = arch ? w / 2 : 0;
  // glass + interior
  b.add(glass, new THREE.PlaneGeometry(w, h), at(M, 0, h / 2, 0.02), 'keep');
  if (arch) {
    b.add(glass, new THREE.CircleGeometry(archR, 24, 0, Math.PI), at(M, 0, h, 0.02), 'keep');
  }
  // sash frame, meeting rail, muntins
  const fb = 0.075, md = 0.07;
  const sz = 0.05;
  b.add('sash', new THREE.BoxGeometry(fb, h, md), at(M, -w / 2 + fb / 2, h / 2, sz));
  b.add('sash', new THREE.BoxGeometry(fb, h, md), at(M, w / 2 - fb / 2, h / 2, sz));
  b.add('sash', new THREE.BoxGeometry(w, fb * 1.3, md), at(M, 0, fb * 0.65, sz));
  if (!arch) b.add('sash', new THREE.BoxGeometry(w, fb, md), at(M, 0, h - fb / 2, sz));
  const split = rows >= 2 && !o.door;
  if (split) b.add('sash', new THREE.BoxGeometry(w, 0.07, md + 0.02), at(M, 0, h / 2, sz + 0.01));
  const mw = 0.032;
  for (let c = 1; c < cols; c++) {
    b.add('sash', new THREE.BoxGeometry(mw, h, 0.045), at(M, -w / 2 + (w * c) / cols, h / 2, sz));
  }
  for (let r = 1; r < rows; r++) {
    if (split && r * 2 === rows) continue;
    b.add('sash', new THREE.BoxGeometry(w, mw, 0.045), at(M, 0, (h * r) / rows, sz));
  }
  if (arch) {
    // radial muntins of the fanlight
    for (let k = 1; k < 5; k++) {
      const a = (Math.PI * k) / 5;
      b.add('sash', new THREE.BoxGeometry(mw, archR, 0.045), at(M, Math.cos(a) * archR / 2, h + Math.sin(a) * archR / 2, sz, 0, 1, 1, 1, 0, a - Math.PI / 2));
    }
    const ring = new THREE.TorusGeometry(archR - fb / 2, fb / 2, 6, 24, Math.PI);
    b.add('sash', ring, at(M, 0, h, sz));
    b.add('sash', new THREE.TorusGeometry(archR * 0.38, mw / 2, 6, 16, Math.PI), at(M, 0, h, sz));
    b.add('sash', new THREE.BoxGeometry(w, fb, md), at(M, 0, h, sz));
  }
  if (!frame) return;

  const top = h + archR;
  if (head === 'keystone') {
    // rusticated opening: flat arch of voussoirs and a keystone, no architrave
    b.add('rustic', new THREE.BoxGeometry(0.16, h, 0.3), at(M, -w / 2 - 0.08, h / 2, 0.0));
    b.add('rustic', new THREE.BoxGeometry(0.16, h, 0.3), at(M, w / 2 + 0.08, h / 2, 0.0));
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const isKey = i === (n - 1) >> 1;
      const vw = (w + 0.6) / n - 0.03;
      b.add('trim', new THREE.BoxGeometry(vw, isKey ? 0.86 : 0.62, isKey ? 0.2 : 0.1),
        at(M, t * (w + 0.6), h + (isKey ? 0.4 : 0.31), isKey ? 0.1 : 0.05, 0, 1, 1, 1, 0, -t * 0.5));
    }
    b.add('trim', new THREE.BoxGeometry(w + 0.5, 0.14, 0.32), at(M, 0, -0.07, 0.14));
    return;
  }

  // architrave with a stepped outer fillet
  const W = w + 2 * sw;
  b.add('trim', new THREE.BoxGeometry(sw, top + sw, dep), at(M, -w / 2 - sw / 2, (top + sw) / 2, dep / 2));
  b.add('trim', new THREE.BoxGeometry(sw, top + sw, dep), at(M, w / 2 + sw / 2, (top + sw) / 2, dep / 2));
  b.add('trim', new THREE.BoxGeometry(W, sw, dep), at(M, 0, top + sw / 2, dep / 2));
  b.add('trim', new THREE.BoxGeometry(0.06, top + sw + 0.06, dep - 0.08), at(M, -W / 2 - 0.03, (top + sw + 0.06) / 2, (dep - 0.08) / 2));
  b.add('trim', new THREE.BoxGeometry(0.06, top + sw + 0.06, dep - 0.08), at(M, W / 2 + 0.03, (top + sw + 0.06) / 2, (dep - 0.08) / 2));
  b.add('trim', new THREE.BoxGeometry(W + 0.12, 0.06, dep - 0.08), at(M, 0, top + sw + 0.03, (dep - 0.08) / 2));
  // sill with apron
  b.add('trim', new THREE.BoxGeometry(W + 0.34, 0.12, 0.36), at(M, 0, -0.06, 0.18));
  b.add('trim', new THREE.BoxGeometry(W - 0.2, 0.3, 0.12), at(M, 0, -0.27, 0.06));

  const yb = top + sw + 0.06;
  const CW = W + 0.42;
  if (head === 'flat' || head === 'triangle' || head === 'segment') {
    // frieze and cornice
    b.add('trim', new THREE.BoxGeometry(W + 0.12, 0.3, 0.16), at(M, 0, yb + 0.15, 0.08));
    b.add('trim', new THREE.BoxGeometry(CW - 0.12, 0.08, 0.3), at(M, 0, yb + 0.34, 0.15));
    b.add('trim', new THREE.BoxGeometry(CW, 0.1, 0.38), at(M, 0, yb + 0.43, 0.19));
    // consoles
    for (const s of [-1, 1]) {
      b.add('trim', new THREE.BoxGeometry(0.16, 0.58, 0.28), at(M, s * (W / 2 + 0.1), yb + 0.05, 0.14));
      b.add('trim', new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10), at(M, s * (W / 2 + 0.1), yb - 0.22, 0.2, 0, 1, 1, 1, 0, Math.PI / 2));
    }
  }
  const yp = yb + 0.48;
  if (head === 'triangle') {
    const rise = CW * 0.2;
    const outer = new THREE.Shape([new THREE.Vector2(-CW / 2, 0), new THREE.Vector2(CW / 2, 0), new THREE.Vector2(0, rise)]);
    const k = 0.17;
    outer.holes.push(new THREE.Path([new THREE.Vector2(-CW / 2 + k * 2.6, k * 0.6), new THREE.Vector2(0, rise - k * 1.1), new THREE.Vector2(CW / 2 - k * 2.6, k * 0.6)]));
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.38, bevelEnabled: false });
    b.add('trim', g, at(M, 0, yp, 0.0));
    b.add('trim', prism([[-CW / 2 + 0.2, 0], [CW / 2 - 0.2, 0], [0, rise - 0.08]], 0.16), at(M, 0, yp, 0.08));
  } else if (head === 'segment') {
    const R = CW * 0.62;
    const c = Math.sqrt(R * R - (CW / 2) * (CW / 2));
    const a0 = Math.atan2(c, CW / 2), a1 = Math.PI - a0;
    const s = new THREE.Shape();
    s.absarc(0, -c, R, a0, a1, false);
    s.lineTo(-CW / 2, 0);
    s.closePath();
    const hole = new THREE.Path();
    const Ri = R - 0.17;
    const ci = c;
    const ai0 = Math.acos((CW / 2 - 0.42) / Ri);
    hole.absarc(0, -ci, Ri, ai0, Math.PI - ai0, false);
    hole.closePath();
    s.holes.push(hole);
    b.add('trim', new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: false, curveSegments: 20 }), at(M, 0, yp, 0.0));
    const t = new THREE.Shape();
    t.absarc(0, -c, R - 0.1, a0 + 0.05, a1 - 0.05, false);
    t.closePath();
    b.add('trim', new THREE.ExtrudeGeometry(t, { depth: 0.24, bevelEnabled: false, curveSegments: 20 }), at(M, 0, yp, 0.0));
  }
}

// ---------------------------------------------------------------- balustrades
let balusterGeo = null;
export function balusterGeometry() {
  if (balusterGeo) return balusterGeo;
  const h = 0.68;
  const p = [
    [0, 0], [0.09, 0], [0.09, 0.05], [0.07, 0.07], [0.075, 0.1], [0.1, 0.18], [0.112, 0.26],
    [0.1, 0.34], [0.065, 0.44], [0.05, 0.52], [0.06, 0.56], [0.05, 0.6], [0.085, 0.62], [0.085, h], [0, h],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  balusterGeo = new THREE.LatheGeometry(p, 10);
  return balusterGeo;
}

// Straight balustrade from (x0,z0) to (x1,z1) at base height y. s scales height.
export function balustrade(b, x0, z0, x1, z1, y, s = 1, { posts = 3.4, key = 'trim', endPosts = true } = {}) {
  const dx = x1 - x0, dz = z1 - z0;
  const L = Math.hypot(dx, dz);
  const ry = Math.atan2(-dz, dx);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const plinthH = 0.18 * s, balH = 0.68 * s, railH = 0.15 * s;
  b.add(key, new THREE.BoxGeometry(L, plinthH, 0.44), mat4(cx, y + plinthH / 2, cz, ry));
  b.add(key, new THREE.BoxGeometry(L, railH, 0.5), mat4(cx, y + plinthH + balH + railH / 2, cz, ry));
  b.add(key, new THREE.BoxGeometry(L, 0.04 * s, 0.4), mat4(cx, y + plinthH + balH - 0.02 * s, cz, ry));
  const nPosts = Math.max(1, Math.round(L / posts));
  const ux = dx / L, uz = dz / L;
  const postAt = [];
  for (let i = endPosts ? 0 : 1; i <= (endPosts ? nPosts : nPosts - 1); i++) postAt.push((i / nPosts) * L);
  const pw = 0.48;
  for (const d of postAt) {
    const px = x0 + ux * d, pz = z0 + uz * d;
    const ph = plinthH + balH;
    b.add(key, new THREE.BoxGeometry(pw, ph, pw), mat4(px, y + ph / 2, pz, ry));
    b.add(key, new THREE.BoxGeometry(pw + 0.1, railH * 1.1, pw + 0.1), mat4(px, y + ph + railH * 0.55, pz, ry));
  }
  const g = balusterGeometry();
  const gap = 0.3;
  const edges = [[0, false], ...postAt.map((d) => [d, true]), [L, false]]
    .filter((e, i, arr) => i === 0 || Math.abs(e[0] - arr[i - 1][0]) > 1e-3 || e[1]);
  for (let k = 0; k < edges.length - 1; k++) {
    const a = edges[k][0] + (edges[k][1] ? pw / 2 : 0);
    const e = edges[k + 1][0] - (edges[k + 1][1] ? pw / 2 : 0);
    if (e - a < gap * 0.8) continue;
    const n = Math.max(1, Math.floor((e - a) / gap));
    const step = (e - a) / n;
    for (let i = 0; i < n; i++) {
      const d = a + step * (i + 0.5);
      b.instance('baluster', g, key, mat4(x0 + ux * d, y + plinthH, z0 + uz * d, 0, s, s, s));
    }
  }
}

// Balustrade along an arc (center cx,cz, radius r, angles a0..a1 with the
// same convention as arcBand: x = cos(a)*r, z = -sin(a)*r).
export function balustradeArc(b, cx, cz, r, a0, a1, y, s = 1, key = 'trim') {
  const segs = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / 1.2));
  const pt = (a) => [cx + Math.cos(a) * r, cz - Math.sin(a) * r];
  const plinthH = 0.18 * s, balH = 0.68 * s, railH = 0.15 * s;
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + ((a1 - a0) * i) / segs, t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
    const [x0, z0] = pt(t0), [x1, z1] = pt(t1);
    const L = Math.hypot(x1 - x0, z1 - z0) + 0.04;
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    b.add(key, new THREE.BoxGeometry(L, plinthH, 0.44), mat4(mx, y + plinthH / 2, mz, ry));
    b.add(key, new THREE.BoxGeometry(L, railH, 0.5), mat4(mx, y + plinthH + balH + railH / 2, mz, ry));
  }
  const g = balusterGeometry();
  const n = Math.floor(Math.abs(a1 - a0) * r / 0.3);
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    const [x, z] = pt(a);
    b.instance('baluster', g, key, mat4(x, y + plinthH, z, 0, s, s, s));
  }
}

export { at };
