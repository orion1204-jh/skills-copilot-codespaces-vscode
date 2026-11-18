// HUD: a site-plan card with clickable viewpoints and a live view cone,
// a light segmented control, orbit and full-screen toggles.
import * as THREE from 'three';
import { HW, HD, NORTH_FOUNTAIN, SOUTH_FOUNTAIN } from './site.js';
import { NORTH_DRIVE, SOUTH_DRIVE } from './grounds.js';

const K = 0.5, OZ = -20;              // plan scale (svg units per meter) and z offset
const P = (x, z) => [x * K, -(z + OZ) * K];
const f = (n) => n.toFixed(2);
const NS = 'http://www.w3.org/2000/svg';

export function initHud({ views, onView, onLight, onOrbit }) {
  // static plan geometry
  const [hx0, hy0] = P(-HW, HD), [hx1, hy1] = P(HW, -HD);
  const br = 10.4 * K;
  const house = [
    `M ${f(hx0)} ${f(hy0)}`, `L ${f(P(-8, HD)[0])} ${f(hy0)}`, `L ${f(P(-8, 23)[0])} ${f(P(-8, 23)[1])}`,
    `L ${f(P(8, 23)[0])} ${f(P(8, 23)[1])}`, `L ${f(P(8, HD)[0])} ${f(hy0)}`, `L ${f(hx1)} ${f(hy0)}`,
    `L ${f(hx1)} ${f(hy1)}`, `L ${f(P(10.4, -HD)[0])} ${f(hy1)}`,
    `A ${f(br)} ${f(br)} 0 0 1 ${f(P(-10.4, -HD)[0])} ${f(hy1)}`, `L ${f(hx0)} ${f(hy1)}`, 'Z',
  ].join(' ');
  document.getElementById('plan-house').setAttribute('d', house);
  const line = (pts) => pts.map(([x, z], i) => `${i ? 'L' : 'M'} ${f(P(x, z)[0])} ${f(P(x, z)[1])}`).join(' ');
  document.getElementById('plan-drives').setAttribute('d', `${line(NORTH_DRIVE)} ${line(SOUTH_DRIVE)}`);
  const nf = document.getElementById('plan-nf'), sf = document.getElementById('plan-sf');
  nf.setAttribute('cx', P(NORTH_FOUNTAIN.x, NORTH_FOUNTAIN.z)[0]);
  nf.setAttribute('cy', P(NORTH_FOUNTAIN.x, NORTH_FOUNTAIN.z)[1]);
  sf.setAttribute('cx', P(SOUTH_FOUNTAIN.x, SOUTH_FOUNTAIN.z)[0]);
  sf.setAttribute('cy', P(SOUTH_FOUNTAIN.x, SOUTH_FOUNTAIN.z)[1]);
  const lawn = document.querySelector('.plan .lawn');
  lawn.setAttribute('x', -70); lawn.setAttribute('width', 140);
  lawn.setAttribute('y', P(0, 96)[1]); lawn.setAttribute('height', 80 - P(0, 96)[1]);
  document.querySelector('.plan .fence').setAttribute('d', `M -70 ${f(P(0, 96)[1])} H 70`);

  // viewpoints
  const spotsG = document.getElementById('plan-spots');
  const spotEls = new Map();
  const names = {
    north: 'North Lawn', fountain: 'North Fountain', portico: 'North Portico', northeast: 'Northeast',
    west: 'West Garden', aerial: 'Aerial', south: 'South Lawn', balcony: 'Truman Balcony',
  };
  for (const v of views) {
    const [x, y] = P(v.pos[0], v.pos[2]);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'spot');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', names[v.id] || v.id);
    const hit = document.createElementNS(NS, 'circle');
    hit.setAttribute('class', 'hit'); hit.setAttribute('cx', f(x)); hit.setAttribute('cy', f(y)); hit.setAttribute('r', 9);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', 'dot'); dot.setAttribute('cx', f(x)); dot.setAttribute('cy', f(y)); dot.setAttribute('r', 3.6);
    g.append(hit, dot);
    const go = (e) => { e.preventDefault(); onView(v); };
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(e); });
    spotsG.append(g);
    spotEls.set(v.id, g);
  }

  // light control
  const seg = document.getElementById('light');
  const thumb = seg.querySelector('.thumb');
  const lightBtns = [...seg.querySelectorAll('.btn')];
  const placeThumb = (btn) => { thumb.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`; };
  lightBtns.forEach((btn) => btn.addEventListener('click', () => {
    lightBtns.forEach((o) => o.setAttribute('aria-checked', String(o === btn)));
    placeThumb(btn);
    onLight(btn.dataset.light);
  }));
  window.addEventListener('resize', () => placeThumb(lightBtns.find((b) => b.getAttribute('aria-checked') === 'true')));

  const orbit = document.getElementById('orbit');
  orbit.addEventListener('click', () => {
    const on = orbit.getAttribute('aria-pressed') !== 'true';
    orbit.setAttribute('aria-pressed', String(on));
    onOrbit(on);
  });

  const full = document.getElementById('full');
  const fsEl = document.documentElement;
  const canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!canFs) full.hidden = true;
  full.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        await (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl);
      }
    } catch { /* not available in this frame */ }
  });
  const fsIcon = full.querySelector('path');
  const onFs = () => {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fsIcon.setAttribute('d', on ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // live eye + view cone
  const cone = document.getElementById('plan-cone');
  const eye = document.getElementById('plan-eye');
  const dir = new THREE.Vector3();
  const clamp = (v) => Math.max(-74, Math.min(74, v));

  return {
    ready() { placeThumb(lightBtns[0]); },
    setView(id) {
      for (const [k, el] of spotEls) el.classList.toggle('on', k === id);
    },
    update(camera) {
      camera.getWorldDirection(dir);
      const [ex, ey] = P(camera.position.x, camera.position.z).map(clamp);
      const yaw = Math.atan2(-dir.z, dir.x);        // plan angle (svg y is -z)
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const L = 30;
      const a0 = yaw - half, a1 = yaw + half;
      const p0 = [ex + Math.cos(a0) * L, ey - Math.sin(a0) * L];
      const p1 = [ex + Math.cos(a1) * L, ey - Math.sin(a1) * L];
      cone.setAttribute('d', `M ${f(ex)} ${f(ey)} L ${f(p0[0])} ${f(p0[1])} A ${L} ${L} 0 0 0 ${f(p1[0])} ${f(p1[1])} Z`);
      eye.setAttribute('cx', f(ex));
      eye.setAttribute('cy', f(ey));
    },
  };
}
