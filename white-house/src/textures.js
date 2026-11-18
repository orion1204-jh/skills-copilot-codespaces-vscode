// Procedural canvas textures. Everything is generated at load time, tileable,
// and sized in world meters through `texture.userData.meters`.
import * as THREE from 'three';

let seed = 1337;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Tileable value noise (fbm) in [0,1].
function noise(size, cells = 8, octaves = 5, persistence = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const lattice = new Float32Array(n * n);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const a = lattice[(y0 % n) * n + (x0 % n)];
        const b = lattice[(y0 % n) * n + ((x0 + 1) % n)];
        const c = lattice[((y0 + 1) % n) * n + (x0 % n)];
        const d = lattice[((y0 + 1) % n) * n + ((x0 + 1) % n)];
        out[y * size + x] += amp * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
      }
    }
    total += amp;
    amp *= persistence;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function toTexture(c, meters, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.userData.meters = meters;
  if (meters) t.repeat.set(1 / meters, 1 / meters);
  return t;
}

function fromHeight(h, size, strength, meters) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, meters, { srgb: false });
}

function fromGray(h, size, lo, hi, meters) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < h.length; i++) {
    const v = (lo + (hi - lo) * h[i]) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, meters, { srgb: false });
}

function fromColor(h, size, base, vary, meters, extra) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < h.length; i++) {
    const v = 1 + (h[i] - 0.5) * vary;
    img.data[i * 4] = Math.min(255, base[0] * v);
    img.data[i * 4 + 1] = Math.min(255, base[1] * v);
    img.data[i * 4 + 2] = Math.min(255, base[2] * v);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (extra) extra(ctx, size);
  return toTexture(c, meters);
}

// Painted Aquia sandstone: ashlar coursing with faint joints and soft mottling.
export function stone({ rustic = false, plain = false } = {}) {
  const size = 512, meters = rustic ? 4.6 : 4.8;
  const n = noise(size, 6, 6, 0.55);
  const fine = noise(size, 64, 2, 0.5);
  const h = new Float32Array(size * size);
  const courses = rustic ? 8 : 8;            // course height = meters / courses
  const blocksPerCourse = rustic ? 3 : 4;
  const jointPx = rustic ? 9 : 2.2;
  for (let y = 0; y < size; y++) {
    const course = Math.floor(y / (size / courses));
    const cy = (y % (size / courses)) / (size / courses);
    for (let x = 0; x < size; x++) {
      const off = (course % 2) * 0.5;
      const bx = ((x / size) * blocksPerCourse + off) % 1;
      let joint = 1;
      const dyPx = Math.min(cy, 1 - cy) * (size / courses);
      if (rustic) {
        // V-cut horizontal channels, barely-there vertical joints
        joint = Math.min(1, dyPx / jointPx);
        joint = Math.sqrt(joint);
      } else {
        const dxPx = Math.min(bx, 1 - bx) * (size / blocksPerCourse);
        joint = Math.min(1, Math.min(dyPx, dxPx) / jointPx);
      }
      const i = y * size + x;
      if (plain) joint = 1;
      h[i] = joint * 0.85 + n[i] * 0.1 + fine[i] * 0.05;
    }
  }
  const color = fromColor(h.map((v, i) => 0.25 + v * 0.55 + n[i] * 0.2), size,
    [244, 241, 233], rustic ? 0.16 : 0.1, meters);
  const normal = fromHeight(h, size, rustic ? 5 : 2.5, meters);
  const rough = fromGray(n.map((v, i) => v * 0.6 + fine[i] * 0.4), size, 0.62, 0.92, meters);
  return { map: color, normalMap: normal, roughnessMap: rough };
}

export function grass() {
  const size = 512, meters = 6;
  const n = noise(size, 4, 6, 0.6);
  const map = fromColor(n, size, [92, 132, 58], 0.5, meters, (ctx, s) => {
    for (let i = 0; i < 9000; i++) {
      const x = rand() * s, y = rand() * s, l = 2 + rand() * 5;
      const g = 90 + rand() * 90;
      ctx.strokeStyle = `rgba(${g * 0.55 | 0},${g | 0},${g * 0.35 | 0},${0.25 + rand() * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 2, y - l);
      ctx.stroke();
    }
  });
  const fine = noise(size, 96, 2, 0.5);
  const normal = fromHeight(fine, size, 6, meters);
  return { map, normalMap: normal };
}

export function pavement({ base = [196, 190, 178], meters = 3, joints = false } = {}) {
  const size = 512;
  const n = noise(size, 8, 6, 0.6);
  const grain = noise(size, 128, 1, 0.5);
  const h = n.map((v, i) => v * 0.6 + grain[i] * 0.4);
  const map = fromColor(h, size, base, 0.28, meters, joints ? (ctx, s) => {
    ctx.strokeStyle = 'rgba(70,64,56,0.35)';
    ctx.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      ctx.beginPath(); ctx.moveTo(0, k * s / 4); ctx.lineTo(s, k * s / 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k * s / 4, 0); ctx.lineTo(k * s / 4, s); ctx.stroke();
    }
  } : null);
  const normal = fromHeight(grain, size, 3, meters);
  const rough = fromGray(grain, size, 0.75, 0.98, meters);
  return { map, normalMap: normal, roughnessMap: rough };
}

// Standing-seam roof (the seams run along V).
export function roof() {
  const size = 256, meters = 4;
  const n = noise(size, 4, 4, 0.5);
  const h = new Float32Array(size * size);
  const seams = 8;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = ((x / size) * seams) % 1;
    const ridge = Math.exp(-Math.pow((u - 0.5) * 22, 2));
    h[y * size + x] = ridge * 0.9 + n[y * size + x] * 0.1;
  }
  const map = fromColor(h.map((v, i) => 0.5 + v * 0.3 + n[i] * 0.2), size, [128, 134, 138], 0.25, meters);
  const normal = fromHeight(h, size, 6, meters);
  return { map, normalMap: normal };
}

// Lit interior seen through glass: dim room, drawn curtains, a warm ceiling glow.
export function windowInterior() {
  const w = 128, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6d5a43');
  g.addColorStop(0.45, '#3a3128');
  g.addColorStop(1, '#1d1915');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const drape = (x0, dir) => {
    for (let i = 0; i < 26; i++) {
      const x = x0 + dir * i;
      const shade = 200 + Math.sin(i * 1.3) * 30;
      ctx.fillStyle = `rgb(${shade},${shade * 0.93 | 0},${shade * 0.8 | 0})`;
      ctx.fillRect(x, 0, 1.2, h);
    }
  };
  drape(0, 1);
  drape(w - 1, -1);
  // valance
  ctx.fillStyle = '#d9c9a8';
  ctx.fillRect(0, 0, w, 18);
  ctx.fillStyle = 'rgba(255,220,160,0.35)';
  ctx.beginPath();
  ctx.ellipse(w / 2, 40, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function waterNormal() {
  const size = 256;
  const a = noise(size, 8, 4, 0.55);
  return fromHeight(a, size, 4, 3);
}

export function bark() {
  const size = 128;
  const n = noise(size, 16, 3, 0.5);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    h[i] = 0.5 + 0.5 * Math.sin(x * 0.6 + n[i] * 9) * 0.6 + n[i] * 0.4;
  }
  return { map: fromColor(h, size, [92, 80, 68], 0.6, 1), normalMap: fromHeight(h, size, 2, 1) };
}

export function foliage() {
  const size = 256;
  const n = noise(size, 16, 5, 0.6);
  const map = fromColor(n, size, [255, 255, 255], 0.55, 2.2, (ctx, s) => {
    for (let i = 0; i < 2600; i++) {
      const x = rand() * s, y = rand() * s, r = 1.5 + rand() * 3;
      const v = 150 + rand() * 105;
      ctx.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.5)`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, rand() * 3.14, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const normal = fromHeight(noise(size, 48, 2, 0.5), size, 5, 2.2);
  return { map, normalMap: normal };
}

// Stars and stripes, simplified: 13 stripes and a canton with 50 points.
export function flag() {
  const w = 380, h = 200;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 ? '#f4f1ea' : '#b22234';
    ctx.fillRect(0, (i * h) / 13, w, h / 13 + 1);
  }
  const cw = w * 0.4, ch = (h * 7) / 13;
  ctx.fillStyle = '#3c3b6e';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < 9; r++) {
    const cols = r % 2 ? 5 : 6;
    for (let k = 0; k < cols; k++) {
      const x = (cw / 12) * (2 * k + 1 + (r % 2));
      const y = (ch / 10) * (r + 1);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function glow() {
  const c = canvas(128), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,235,200,0.6)');
  g.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export { rand };
