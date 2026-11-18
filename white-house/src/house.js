// The Executive Residence: main block, North Portico, South Portico with the
// Truman Balcony, roof, chimneys and flagpole.
import * as THREE from 'three';
import { mat4, arcBand, sector, prism } from './builder.js';
import { addColumn, addPilaster, addWindow, balustrade, balustradeArc, at } from './parts.js';
import { HW, HD, NG, STATE, SECOND, ENT, TOP, AREA, groundHeight } from './site.js';
import { rand } from './textures.js';


const PI = Math.PI;
const glassPick = () => { const r = rand(); return r < 0.5 ? 'glassA' : r < 0.8 ? 'glassB' : 'glassC'; };

const M_N = mat4(0, 0, HD, 0);
const M_S = mat4(0, 0, -HD, PI);
const M_E = mat4(HW, 0, 0, PI / 2);
const M_W = mat4(-HW, 0, 0, -PI / 2);

// South bow geometry
const BOW = { cz: -HD, wall: 6.8, col: 9.8, base: 10.4, D: 1.1 };
// North portico geometry
const NP = { xs: [-7.2, -2.4, 2.4, 7.2], front: 22.2, mid: 17.7, D: 1.3, half: 8.0 };

const radialRy = (a) => Math.atan2(Math.cos(a), -Math.sin(a));
const bowPt = (r, a) => [Math.cos(a) * r, BOW.cz - Math.sin(a) * r];

// Entablature profile along a straight run in a facade frame (wall surface at
// local z=0, run from x0 to x1). Dentils are instanced.
function entablature(b, M, x0, x1, wrap = false) {
  const L = x1 - x0, cx = (x0 + x1) / 2;
  const layers = [
    // [y0, y1, projection, key]
    [ENT, ENT + 0.55, 0.1, 'trim'],
    [ENT + 0.18, ENT + 0.24, 0.16, 'trim'],
    [ENT + 0.49, ENT + 0.55, 0.18, 'trim'],
    [ENT + 0.55, ENT + 1.2, 0.06, 'stone'],
    [ENT + 1.2, ENT + 1.35, 0.24, 'trim'],
    [ENT + 1.35, ENT + 1.55, 0.26, 'trim'],
    [ENT + 1.55, ENT + 1.9, 0.78, 'trim'],
    [ENT + 1.9, TOP, 0.86, 'trim'],
  ];
  for (const [y0, y1, p, key] of layers) {
    b.add(key, new THREE.BoxGeometry(L + (wrap ? 2 * p : 0), y1 - y0, p + 0.02),
      at(M, cx, (y0 + y1) / 2, (p + 0.02) / 2 - 0.02));
  }
  const dent = new THREE.BoxGeometry(0.15, 0.2, 0.16);
  const n = Math.floor(L / 0.3);
  for (let i = 0; i < n; i++) {
    const x = x0 + (L * (i + 0.5)) / n;
    b.instance('dentil', dent, 'trim', at(M, x, ENT + 1.45, 0.34));
  }
}

function entablatureArc(b, r, a0, a1) {
  const rings = [
    [ENT, ENT + 0.55, r - 0.6, r + 0.62, 'trim'],
    [ENT + 0.55, ENT + 1.2, r - 0.62, r + 0.58, 'stone'],
    [ENT + 1.2, ENT + 1.35, r - 0.8, r + 0.78, 'trim'],
    [ENT + 1.35, ENT + 1.55, r - 0.8, r + 0.76, 'trim'],
    [ENT + 1.55, ENT + 1.9, r - 1.2, r + 1.32, 'trim'],
    [ENT + 1.9, TOP, r - 1.2, r + 1.4, 'trim'],
  ];
  for (const [y0, y1, r0, r1, key] of rings) {
    b.add(key, arcBand(r0, r1, a0, a1, y0, y1, 64), mat4(0, 0, BOW.cz));
  }
  const dent = new THREE.BoxGeometry(0.15, 0.2, 0.16);
  const n = Math.floor(((a1 - a0) * (r + 0.84)) / 0.3);
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    const [x, z] = bowPt(r + 0.84, a);
    b.instance('dentil', dent, 'trim', mat4(x, ENT + 1.45, z, radialRy(a)));
  }
}

export function buildHouse(b) {
  // ------------------------------------------------------------ masses
  b.box('rustic', 0, 2.2, 0, 2 * HW + 0.14, 4.4, 2 * HD + 0.14);
  b.box('trim', 0, 4.6, 0, 2 * HW + 0.36, 0.4, 2 * HD + 0.36);
  b.box('trim', 0, 4.36, 0, 2 * HW + 0.24, 0.08, 2 * HD + 0.24);
  b.box('stone', 0, (4.8 + ENT) / 2, 0, 2 * HW, ENT - 4.8, 2 * HD);
  // plinth at the foot of the ground floor
  b.box('trim', 0, 0.3, 0, 2 * HW + 0.3, 0.6, 2 * HD + 0.3);

  // ------------------------------------------------------------ entablature
  entablature(b, M_N, -HW, HW, true);
  entablature(b, M_S, -HW, HW, true);
  entablature(b, M_E, -HD, HD);
  entablature(b, M_W, -HD, HD);
  // corner blocks so the cornice wraps cleanly
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box('trim', sx * (HW + 0.42), ENT + 1.72, sz * (HD + 0.42), 0.86, 0.36, 0.86);
    b.box('trim', sx * (HW + 0.42), TOP - 0.05, sz * (HD + 0.42), 0.86, 0.1, 0.86);
  }

  // ------------------------------------------------------------ corner pilasters
  for (const M of [M_N, M_S]) for (const s of [-1, 1]) addPilaster(b, M, s * (HW - 0.75), 4.8, ENT, 1.0);
  for (const M of [M_E, M_W]) for (const s of [-1, 1]) addPilaster(b, M, s * (HD - 0.75), 4.8, ENT, 1.0);

  // ------------------------------------------------------------ north facade
  const sideXs = [11.6, 15.4, 19.2, 23.0];
  const northXs = [0, 4.8, ...sideXs].flatMap((x) => (x ? [-x, x] : [0])).sort((a, c) => a - c);
  northXs.forEach((x) => {
    const head = [0, 4.8, 15.4, 23.0].includes(Math.abs(x)) ? 'triangle' : 'segment';
    if (x !== 0) {
      addWindow(b, at(M_N, x, 5.1, 0), { w: 1.75, h: 3.6, head, glass: glassPick() });
      addWindow(b, at(M_N, x, 11.2, 0), { w: 1.75, h: 3.0, head: 'plain', glass: glassPick() });
    } else {
      addWindow(b, at(M_N, 0, 11.2, 0), { w: 1.75, h: 3.0, head: 'plain', glass: glassPick() });
    }
    if (Math.abs(x) > 9) addWindow(b, at(M_N, x, 0.9, 0.07), { w: 1.5, h: 2.0, head: 'keystone', glass: 'glassC' });
  });

  // North entrance: door leaves under a fanlight
  addWindow(b, at(M_N, 0, STATE, 0), { w: 2.0, h: 3.3, cols: 4, rows: 1, arch: true, door: true, head: 'flat', glass: 'glassA', surround: 0.3 });
  for (const s of [-1, 1]) {
    b.add('door', new THREE.BoxGeometry(0.96, 3.25, 0.08), at(M_N, s * 0.5, STATE + 1.625, 0.06));
    for (const py of [0.55, 1.6, 2.65]) {
      b.add('door', new THREE.BoxGeometry(0.62, py === 1.6 ? 0.9 : 0.75, 0.05), at(M_N, s * 0.5, STATE + py, 0.11));
    }
    b.add('brass', new THREE.SphereGeometry(0.045, 10, 8), at(M_N, s * 0.1, STATE + 1.6, 0.16));
  }

  // ------------------------------------------------------------ North Portico
  const ptop = NG + 0.3;
  b.box('paving', 0, NG + 0.15 - 0.6, (HD + NP.front + 1.0) / 2, 2 * NP.half + 2.0, 1.5, NP.front + 1.0 - HD);
  // stoop up to the door
  for (let i = 0; i < 7; i++) {
    const y = ptop + (STATE - ptop) * ((7 - i) / 7);
    const z = HD + 0.9 + i * 0.36;
    b.box('paving', 0, (ptop + y) / 2, (HD + z) / 2 + 0.18, 4.6 + 0.0, y - ptop, z - HD + 0.36);
  }
  for (const s of [-1, 1]) {
    b.box('trim', s * 2.55, (ptop + STATE) / 2 + 0.25, HD + 1.7, 0.4, STATE - ptop + 0.5, 3.4);
  }
  const colH = ENT - ptop;
  for (const x of NP.xs) addColumn(b, x, ptop, NP.front, colH, NP.D, 0);
  for (const x of [-7.2, 7.2]) addColumn(b, x, ptop, NP.mid, colH, NP.D, 0);
  for (const x of NP.xs) addPilaster(b, M_N, x, ptop + 1.5, ENT, 1.1);
  // portico entablature: front beam and side beams
  const PF = mat4(0, 0, NP.front + NP.D / 2 + 0.05, 0);
  entablature(b, PF, -NP.half - 0.05, NP.half + 0.05, true);
  const sideLen = NP.front + NP.D / 2 + 0.05 - HD;
  entablature(b, mat4(NP.half, 0, HD + sideLen / 2, PI / 2), -sideLen / 2, sideLen / 2);
  entablature(b, mat4(-NP.half, 0, HD + sideLen / 2, -PI / 2), -sideLen / 2, sideLen / 2);
  b.box('stone', 0, (ENT + TOP) / 2, (HD + NP.front + NP.D / 2) / 2, 2 * NP.half, TOP - ENT, NP.front + NP.D / 2 - HD);
  // coffered ceiling
  b.box('soffit', 0, ENT - 0.05, (HD + NP.front) / 2, 2 * NP.half - 0.4, 0.1, NP.front - HD);
  for (const z of [NP.mid, (HD + NP.mid) / 2, (NP.mid + NP.front) / 2]) {
    b.box('trim', 0, ENT - 0.28, z, 2 * NP.half - 0.4, 0.4, 0.5);
  }
  for (const x of NP.xs) b.box('trim', x, ENT - 0.28, (HD + NP.front) / 2, 0.5, 0.4, NP.front - HD);

  // pediment
  const pw = NP.half + 0.95, rise = pw * Math.tan(THREE.MathUtils.degToRad(17));
  const pz = NP.front + NP.D / 2 + 0.05;
  b.add('stone', prism([[-pw + 0.9, 0], [pw - 0.9, 0], [0, rise - 0.5]], 0.4), mat4(0, TOP, pz - 0.6));
  // raking cornice
  const rakeLen = Math.hypot(pw, rise), rakeA = Math.atan2(rise, pw);
  for (const s of [-1, 1]) {
    b.add('trim', new THREE.BoxGeometry(rakeLen + 0.1, 0.42, 1.3), mat4(s * pw / 2, TOP + rise / 2 + 0.05, pz - 0.15, 0, 1, 1, 1, 0, -s * rakeA));
    b.add('trim', new THREE.BoxGeometry(rakeLen + 0.2, 0.14, 1.42), mat4(s * pw / 2, TOP + rise / 2 + 0.3, pz - 0.15, 0, 1, 1, 1, 0, -s * rakeA));
  }
  b.box('trim', 0, TOP + 0.05, pz - 0.15, 2 * pw, 0.3, 1.3);
  // tympanum ornament: oval cartouche with garlands
  b.add('trim', new THREE.TorusGeometry(0.62, 0.11, 10, 32), mat4(0, TOP + rise * 0.45, pz - 0.3, 0, 1.25, 0.85, 1));
  b.add('trim', new THREE.CircleGeometry(0.55, 24), mat4(0, TOP + rise * 0.45, pz - 0.36, 0, 1.25, 0.85, 1));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const gx = s * (0.9 + t * 2.8);
      const gy = TOP + rise * 0.45 - Math.sin(t * PI) * 0.35 + t * -0.1;
      b.add('trim', new THREE.SphereGeometry(0.16 - t * 0.05, 10, 8), mat4(gx, gy, pz - 0.36));
    }
  }
  // gable roof behind the pediment
  const gable = new THREE.BufferGeometry();
  const gz0 = HD - 0.2, gz1 = pz - 0.3;
  const yv = TOP + 0.35;
  const v = [
    -pw + 0.2, yv, gz1, 0, yv + rise - 0.1, gz1, 0, yv + rise - 0.1, gz0,
    -pw + 0.2, yv, gz1, 0, yv + rise - 0.1, gz0, -pw + 0.2, yv, gz0,
    pw - 0.2, yv, gz1, 0, yv + rise - 0.1, gz0, 0, yv + rise - 0.1, gz1,
    pw - 0.2, yv, gz1, pw - 0.2, yv, gz0, 0, yv + rise - 0.1, gz0,
  ];
  v.push(-pw + 0.2, yv, gz0, 0, yv + rise - 0.1, gz0, pw - 0.2, yv, gz0);
  gable.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  gable.computeVertexNormals();
  b.add('roof', gable, null);

  // ------------------------------------------------------------ south facade
  const southXs = sideXs.flatMap((x) => [-x, x]);
  southXs.forEach((x) => {
    const head = [15.4, 23.0].includes(Math.abs(x)) ? 'triangle' : 'segment';
    addWindow(b, at(M_S, x, 5.1, 0), { w: 1.75, h: 3.6, head, glass: glassPick() });
    addWindow(b, at(M_S, x, 11.2, 0), { w: 1.75, h: 3.0, head: 'plain', glass: glassPick() });
    if (Math.abs(x) > 12) addWindow(b, at(M_S, x, 1.0, 0.07), { w: 1.5, h: 2.1, head: 'keystone', glass: glassPick() });
  });
  for (const s of [-1, 1]) addPilaster(b, M_S, s * BOW.col, 4.8, ENT, 1.1);

  // ------------------------------------------------------------ South Portico
  const C = mat4(0, 0, BOW.cz);
  // rusticated base and deck
  b.add('rustic', arcBand(BOW.base - 0.4, BOW.base, 0, PI, 0, 4.4, 64), C);
  b.add('trim', arcBand(BOW.base - 0.3, BOW.base + 0.18, 0, PI, 0, 0.6, 64), C);
  b.add('trim', sector(BOW.base + 0.25, 0, PI, 4.4, 4.8, 64), C);
  b.add('trim', arcBand(BOW.base - 0.2, BOW.base + 0.3, 0, PI, 4.32, 4.42, 64), C);
  // ground floor openings on the base: windows and the diplomatic entrance
  for (const a of [PI / 3, PI / 2, (2 * PI) / 3]) {
    const [x, z] = bowPt(BOW.base, a);
    const M = mat4(x, 0, z, radialRy(a));
    if (a === PI / 2) {
      addWindow(b, at(M, 0, 0.6, 0.02), { w: 1.7, h: 2.8, cols: 4, rows: 1, door: true, head: 'keystone', glass: 'glassA' });
      for (const s of [-1, 1]) b.add('door', new THREE.BoxGeometry(0.82, 2.75, 0.08), at(M, s * 0.43, 0.6 + 1.375, 0.08));
    } else {
      addWindow(b, at(M, 0, 1.0, 0.02), { w: 1.4, h: 2.1, head: 'keystone', glass: glassPick() });
    }
  }
  // the Blue Room's curved wall
  b.add('stone', arcBand(BOW.wall - 0.4, BOW.wall, 0, PI, 4.8, ENT, 64), C);
  for (const a of [PI * 0.28, PI / 2, PI * 0.72]) {
    const [x, z] = bowPt(BOW.wall, a);
    const M = mat4(x, 0, z, radialRy(a));
    addWindow(b, at(M, 0, 5.0, 0.05), { w: 1.6, h: 3.7, cols: 3, rows: 4, head: 'flat', glass: glassPick() });
    addWindow(b, at(M, 0, SECOND + 0.15, 0.05), { w: 1.5, h: 3.0, cols: 3, rows: 4, head: 'plain', glass: glassPick() });
  }
  // columns
  for (let k = 0; k < 6; k++) {
    const a = THREE.MathUtils.degToRad(15 + 30 * k);
    const [x, z] = bowPt(BOW.col, a);
    addColumn(b, x, 4.8, z, ENT - 4.8, BOW.D, radialRy(a));
  }
  entablatureArc(b, BOW.col, 0, PI);
  b.add('soffit', sector(BOW.col - 0.55, 0, PI, ENT - 0.1, ENT, 64), C);
  b.add('trim', sector(BOW.col + 1.4, 0, PI, TOP - 0.06, TOP + 0.04, 64), C);

  // Truman Balcony
  b.add('trim', arcBand(BOW.wall - 0.1, BOW.col + 0.2, 0, PI, SECOND - 0.25, SECOND, 64), C);
  b.add('trim', arcBand(BOW.col - 0.1, BOW.col + 0.35, 0, PI, SECOND - 0.45, SECOND - 0.25, 64), C);
  const colA = Array.from({ length: 6 }, (_, k) => THREE.MathUtils.degToRad(15 + 30 * k));
  const gapA = (BOW.D * 0.62) / BOW.col;
  const stops = [0.06, ...colA.flatMap((a) => [a - gapA, a + gapA]), PI - 0.06];
  for (let i = 0; i < stops.length; i += 2) {
    balustradeArc(b, 0, BOW.cz, BOW.col, stops[i], stops[i + 1], SECOND, 1.05);
  }

  // twin curved staircases from the portico down to the South Lawn
  const steps = 24, sa0 = 0.12, sa1 = 0.78;
  for (const side of [1, -1]) {
    const ang = (a) => (side > 0 ? a : PI - a);
    const landA = [0, sa0];
    b.add('paving', arcBand(BOW.base, BOW.base + 2.3, Math.min(ang(landA[0]), ang(landA[1])), Math.max(ang(landA[0]), ang(landA[1])), 0, STATE + 0.2, 8), C);
    for (let i = 0; i < steps; i++) {
      const a0 = sa0 + ((sa1 - sa0) * i) / steps, a1 = sa0 + ((sa1 - sa0) * (i + 1)) / steps;
      const y = (STATE + 0.2) * (1 - (i + 1) / (steps + 1));
      const lo = Math.min(ang(a0), ang(a1)), hi = Math.max(ang(a0), ang(a1));
      b.add('paving', arcBand(BOW.base, BOW.base + 2.3, lo, hi, 0, y, 3), C);
    }
    // outer stringer wall and iron railing
    for (let i = 0; i <= steps; i += 3) {
      const a = sa0 + ((sa1 - sa0) * i) / steps;
      const y = (STATE + 0.2) * (1 - (i + 0.5) / (steps + 1));
      const [x, z] = bowPt(BOW.base + 2.2, ang(a));
      b.add('iron', new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), mat4(x, y + 0.5, z));
    }
    const rail = [];
    for (let i = 0; i <= 24; i++) {
      const a = sa0 + ((sa1 - sa0) * i) / 24;
      const y = (STATE + 0.2) * (1 - (i * steps / 24 + 0.5) / (steps + 1)) + 1.0;
      const [x, z] = bowPt(BOW.base + 2.2, ang(a));
      rail.push(new THREE.Vector3(x, y, z));
    }
    b.add('iron', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 48, 0.045, 6), null);
    const [lx, lz] = bowPt(BOW.base + 2.2, ang(0.02));
    b.add('iron', new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(lx, STATE + 1.2, lz), rail[0]), 2, 0.045, 6), null);
  }
  // balustrade on top of the portico
  balustradeArc(b, 0, BOW.cz, BOW.col + 0.7, 0.02, PI - 0.02, TOP, 1.3);

  // ------------------------------------------------------------ east & west facades
  const sideBays = [-8.8, -4.4, 0, 4.4, 8.8];
  for (const [M, sign] of [[M_E, 1], [M_W, -1]]) {
    sideBays.forEach((lx, i) => {
      // world z of this bay (local x maps to -z on the east, +z on the west)
      const wz = -sign * lx;
      const head = lx === 0 ? 'flat' : i % 2 ? 'segment' : 'triangle';
      addWindow(b, at(M, lx, 5.2, 0), { w: 1.6, h: lx === 0 ? 3.0 : 3.4, arch: lx === 0, head, glass: glassPick() });
      addWindow(b, at(M, lx, 11.2, 0), { w: 1.75, h: 3.0, head: 'plain', glass: glassPick() });
      if (groundHeight(sign * HW, wz) < 0.6) {
        addWindow(b, at(M, lx, 1.0, 0.07), { w: 1.5, h: 2.1, head: 'keystone', glass: glassPick() });
      }
    });
  }

  // ------------------------------------------------------------ roof
  const rx = HW - 1.0, rz = HD - 1.0, ridge = TOP + 3.2;
  const roof = new THREE.BufferGeometry();
  const rv = [];
  const p = (x, y, z) => rv.push(x, y, z);
  const r0 = TOP, rr = rx - rz;
  // north & south trapezoids, east & west hips
  p(-rx, r0, rz); p(rx, r0, rz); p(rr, ridge, 0); p(-rx, r0, rz); p(rr, ridge, 0); p(-rr, ridge, 0);
  p(rx, r0, -rz); p(-rx, r0, -rz); p(-rr, ridge, 0); p(rx, r0, -rz); p(-rr, ridge, 0); p(rr, ridge, 0);
  p(rx, r0, rz); p(rx, r0, -rz); p(rr, ridge, 0);
  p(-rx, r0, -rz); p(-rx, r0, rz); p(-rr, ridge, 0);
  roof.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
  roof.computeVertexNormals();
  b.add('roof', roof, null);
  b.box('roof', 0, TOP + 0.02, 0, 2 * HW - 0.2, 0.08, 2 * HD - 0.2);
  // standing-seam ridge cap
  b.add('roof', new THREE.CylinderGeometry(0.12, 0.12, 2 * rr, 8).rotateZ(PI / 2), mat4(0, ridge, 0));

  // main roof balustrade (broken by the north pediment and the south bow)
  const bi = 0.3, by = TOP, bs = 1.3;
  balustrade(b, -HW + bi, HD - bi, -NP.half - 0.9, HD - bi, by, bs);
  balustrade(b, NP.half + 0.9, HD - bi, HW - bi, HD - bi, by, bs);
  balustrade(b, -HW + bi, -HD + bi, -BOW.col - 0.7, -HD + bi, by, bs);
  balustrade(b, BOW.col + 0.7, -HD + bi, HW - bi, -HD + bi, by, bs);
  balustrade(b, HW - bi, -HD + bi, HW - bi, HD - bi, by, bs);
  balustrade(b, -HW + bi, -HD + bi, -HW + bi, HD - bi, by, bs);

  // chimneys
  for (const [x, z] of [[-19.5, 5.2], [19.5, 5.2], [-19.5, -5.2], [19.5, -5.2], [-9.5, 6.0], [9.5, 6.0], [-9.5, -6.0], [9.5, -6.0]]) {
    const base = TOP + (1 - Math.abs(z) / rz) * 3.2 - 0.6;
    const ht = TOP + 5.4;
    b.box('stone', x, (base + ht) / 2, z, 1.2, ht - base, 2.4);
    b.box('trim', x, ht - 0.5, z, 1.4, 0.2, 2.6);
    b.box('trim', x, ht + 0.1, z, 1.5, 0.22, 2.7);
    for (const dz of [-0.6, 0.6]) b.box('dark', x, ht + 0.3, z + dz, 0.5, 0.2, 0.5);
  }

  // flagpole
  b.add('trim', new THREE.CylinderGeometry(0.07, 0.11, 11, 12), mat4(0, ridge + 5.5, 0));
  b.add('brass', new THREE.SphereGeometry(0.2, 14, 10), mat4(0, ridge + 11.1, 0));

  // north areaway: retaining wall, floor and iron railing
  b.box('paving', 0, AREA.floor - 0.15, (AREA.z0 + AREA.z1) / 2, 2 * AREA.x, 0.3, AREA.z1 - AREA.z0);
  for (const s of [-1, 1]) {
    b.box('stone', s * (AREA.x + 0.25), NG / 2, (AREA.z0 + AREA.z1 + 0.5) / 2, 0.5, NG + 0.3, AREA.z1 - AREA.z0 + 0.5);
  }
  b.box('stone', 0, (AREA.floor + NG) / 2, AREA.z1 + 0.25, 2 * AREA.x + 1.0, NG - AREA.floor + 0.3, 0.5);
  b.box('trim', 0, NG + 0.22, AREA.z1 + 0.25, 2 * AREA.x + 1.2, 0.14, 0.7);
  for (const [x0, x1] of [[-AREA.x, -NP.half - 1.0], [NP.half + 1.0, AREA.x]]) {
    b.box('iron', (x0 + x1) / 2, NG + 1.25, AREA.z1 + 0.25, x1 - x0, 0.06, 0.06);
    b.box('iron', (x0 + x1) / 2, NG + 0.45, AREA.z1 + 0.25, x1 - x0, 0.05, 0.05);
    for (let x = x0; x <= x1; x += 0.16) b.instance('picket', new THREE.BoxGeometry(0.025, 1.0, 0.025), 'iron', mat4(x, NG + 0.8, AREA.z1 + 0.25));
  }

  return {
    flagTop: new THREE.Vector3(0, ridge + 10.8, 0),
    lantern: new THREE.Vector3(0, ENT - 2.6, (HD + NP.mid) / 2 + 0.6),
  };
}

export { NP, BOW };
