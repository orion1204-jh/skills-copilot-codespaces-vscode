// Gradient sky dome with sun/moon disc, scattering glow, drifting clouds and stars.
import * as THREE from 'three';

const vs = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fs = /* glsl */`
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform float uSunSize;
  uniform float uSunDisc;
  uniform float uGlow;
  uniform float uClouds;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
    col = mix(col, uGround, smoothstep(0.0, -0.12, h));
    float sd = max(dot(d, uSunDir), 0.0);
    float above = smoothstep(-0.05, 0.02, uSunDir.y);
    col += uSunColor * (pow(sd, 5.0) * 0.22 + pow(sd, 48.0) * 0.5) * uGlow;
    col += uSunColor * pow(1.0 - abs(h), 10.0) * pow(sd, 1.6) * 0.45 * uGlow;
    float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
    col += uSunColor * smoothstep(uSunSize, uSunSize * 0.75, ang) * uSunDisc * above;

    if (h > 0.0) {
      vec2 uv = d.xz / (h + 0.12) * 0.55 + vec2(uTime * 0.004, uTime * 0.0015);
      float n = fbm(uv * 1.3);
      float cover = smoothstep(0.62 - uClouds * 0.22, 0.95, n) * smoothstep(0.0, 0.22, h);
      float lit = clamp(0.5 + (fbm(uv * 1.3 + uSunDir.xz * 0.08) - n) * 3.5, 0.0, 1.0);
      vec3 cc = mix(uCloudShade, uCloudLit, lit);
      cc += uSunColor * pow(sd, 6.0) * 0.6 * uGlow;
      col = mix(col, cc, cover * 0.9);
    }

    if (uStars > 0.0 && h > 0.0) {
      vec3 p = d * 220.0;
      vec3 id = floor(p);
      float r = hash3(id);
      vec3 f = fract(p) - 0.5;
      float star = step(0.9965, r) * smoothstep(0.32, 0.0, length(f));
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 4.0) + r * 60.0);
      col += vec3(0.85, 0.9, 1.0) * star * tw * uStars * smoothstep(0.02, 0.25, h) * 1.6;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uSunSize: { value: 0.012 },
    uSunDisc: { value: 20 },
    uGlow: { value: 1 },
    uClouds: { value: 0.5 },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: vs, fragmentShader: fs,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.scale.setScalar(4000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms, material };
}
