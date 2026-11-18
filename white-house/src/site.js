// Site constants (meters). x: east+, z: north+, y: up. Building centered at origin.
export const HW = 25.6;          // half width  (168 ft ≈ 51.2 m)
export const HD = 13.0;          // half depth  (85.5 ft ≈ 26 m)
export const NG = 2.9;           // north grade: the land rises toward Pennsylvania Ave
export const STATE = 4.6;        // State Floor level
export const SECOND = 10.4;      // Second Floor level
export const ENT = 15.4;         // underside of the main entablature
export const TOP = 17.5;         // top of cornice / base of the roof balustrade
export const AREA = { x: 26.4, z0: HD, z1: 15.3, floor: 0.35 }; // north areaway (dry moat)

const smooth = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

// Natural ground height (without the areaway cut).
export function groundHeight(x, z) {
  let h = NG * smooth(-6, 12, z);
  // South Lawn falls gently toward the Ellipse
  h -= Math.min(2.2, Math.max(0, -z - 40) * 0.012);
  // soft undulation far from the house
  const d = Math.hypot(x, z);
  const far = smooth(240, 420, d) * (z < 0 ? 1 : 0.5);
  h += far * (Math.sin(x * 0.021) * Math.cos(z * 0.017) * 0.9 + Math.sin(x * 0.007 + z * 0.011) * 1.4);
  return h;
}

export function inAreaway(x, z) {
  return Math.abs(x) < AREA.x && z > AREA.z0 - 0.5 && z < AREA.z1;
}

// Key landmarks
export const NORTH_FOUNTAIN = { x: 0, z: 58, r: 6.2 };
export const SOUTH_FOUNTAIN = { x: 0, z: -108, r: 9.5 };
export const NORTH_FENCE_Z = 96;
