'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hero terrain — Phase 8.3 auto-loop pass.
 *
 * Interactive mouse-following had unfixable lag because each pointermove
 * triggered a raycast against a 64×64-tri plane. Per latest brief: drop
 * interactivity, run the bump on a smooth procedural path. Result is a
 * deterministic loop that never stutters under input.
 *
 * Specifically:
 *   - No raycaster. No window pointermove listener. No state.pointer reads.
 *   - The "cursor bump" position moves on its own — a Lissajous curve
 *     (two incommensurate sine pairs) so it never repeats identically
 *     within a viewing session.
 *   - Camera does a very slow figure-8 drift on its own for parallax
 *     without input.
 *   - The pre-existing scan-band shader effect continues to sweep across X.
 *
 * Still here: webglcontextlost handler, pointer-events:none on canvas so
 * the foreground stays clickable, dpr capped at 1.25.
 */

const NOISE_GLSL = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  float fbm(vec3 p) {
    float v = snoise(p) * 0.55;
    v += snoise(p * 2.0) * 0.27;
    return v;
  }
`;

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vLocalPos;
  ${NOISE_GLSL}
  void main() {
    vUv = uv;
    vec3 pos = position;

    float n = fbm(vec3(pos.xy * 0.18, uTime * 0.07)) * 0.65;
    float md = distance(pos.xy, uMouse);
    float bump = exp(-md * md * 0.10) * 0.75;

    float scanX = sin(uTime * 0.15) * 14.0;
    float scanDist = abs(pos.x - scanX);
    float scanField = exp(-scanDist * 0.12) * 0.30;
    float scanWobble = sin(uTime * 1.0 + pos.y * 0.4) * scanField;

    pos.z += n + bump + scanWobble;
    vHeight = pos.z;
    vLocalPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vLocalPos;
  uniform float uTime;
  uniform vec2 uMouse;
  void main() {
    vec3 c1 = vec3(0.018, 0.038, 0.130);
    vec3 c2 = vec3(0.060, 0.220, 0.620);
    vec3 c3 = vec3(0.180, 0.540, 0.880);
    vec3 c4 = vec3(0.190, 0.900, 0.680);

    float h = smoothstep(-0.85, 1.25, vHeight);
    vec3 col = mix(c1, c2, smoothstep(0.00, 0.40, h));
    col = mix(col, c3, smoothstep(0.40, 0.75, h));
    col = mix(col, c4, smoothstep(0.75, 1.00, h));
    col += pow(max(h - 0.55, 0.0), 2.5) * vec3(0.12, 0.32, 0.22);

    float scanX = sin(uTime * 0.15) * 14.0;
    col += exp(-abs(vLocalPos.x - scanX) * 0.42) * 0.22 * vec3(0.36, 0.78, 0.65);

    float md = distance(vLocalPos.xy, uMouse);
    col += exp(-md * md * 0.05) * 0.20 * vec3(0.42, 0.62, 0.92);

    vec2 c = vUv - 0.5;
    float vignette = 1.0 - smoothstep(0.30, 0.95, length(c));
    gl_FragColor = vec4(col * vignette, 1.0);
  }
`;

function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const cameraTarget = useRef(new THREE.Vector3(0, -0.3, 0));

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    }),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;

    // Auto-loop bump path — Lissajous: two pairs of sines at incommensurate
    // frequencies so the cursor never settles into a visible repeat within
    // a viewing session. Spans roughly the visible portion of the plane.
    const targetX = Math.sin(t * 0.14) * 9 + Math.cos(t * 0.21) * 3.5;
    const targetY = Math.sin(t * 0.19) * 5.5 + Math.cos(t * 0.11) * 4;
    uniforms.uMouse.value.set(targetX, targetY);

    // Camera drift — very slow figure-8 so the parallax never feels like
    // it's mechanically tracking anything; just gentle living motion.
    state.camera.position.x = Math.sin(t * 0.08) * 0.35;
    state.camera.position.y = 0.55 + Math.cos(t * 0.05) * 0.10;
    state.camera.lookAt(cameraTarget.current);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2.55, 0, 0]} position={[0, -1.3, 0]}>
      <planeGeometry args={[36, 36, 64, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        wireframe
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function NullClear() {
  useThree((s) => s.gl.setClearAlpha(0));
  return null;
}

export default function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0.55, 5.8], fov: 55, near: 0.1, far: 100 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.25]}
      style={{ pointerEvents: 'none' }}
      onCreated={({ gl }) => {
        const c = gl.domElement;
        c.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.warn('[hero] WebGL context lost — awaiting restore');
        }, false);
        c.addEventListener('webglcontextrestored', () => {
          console.info('[hero] WebGL context restored');
        }, false);
      }}
    >
      <NullClear />
      <Terrain />
    </Canvas>
  );
}
