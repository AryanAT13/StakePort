'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * The animated WebGL hero.
 *
 * What you're seeing: a 100×100 subdivided plane rotated into perspective,
 * with vertex Z displaced by 3D simplex noise + a mouse-driven bump. Render
 * mode is wireframe so we read it as a digital topology / heatmap rather
 * than a solid surface — that's what gives it the "data terminal" feel.
 *
 * The fragment shader colour-grades by height: deep navy in the valleys,
 * blue at mid-level, an emerald-teal on the peaks (mirroring the up/down
 * green-on-blue palette we use throughout the trading UI).
 *
 * Intentional perf decisions:
 *   - dpr capped at [1, 1.5]. Retina at full DPR doubles GPU cost for ~zero
 *     visible gain on a wireframe.
 *   - The whole component is dynamic-imported by the page (ssr:false), so
 *     none of the three.js / R3F bytes ship to non-landing routes.
 */

// Stefan Gustavson's 3D simplex noise (public domain). Inline so we avoid a
// shader-include build step. Prefixed-nothing — Three's chunks don't define
// snoise / mod289 in plain ShaderMaterial, so there's no name clash.
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
`;

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  varying float vHeight;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Two octaves of noise — large rolling shape + finer chop. Time drift
    // is slow on purpose; we want ambience, not a screensaver.
    float n1 = snoise(vec3(pos.xy * 0.22, uTime * 0.10));
    float n2 = snoise(vec3(pos.xy * 0.55, uTime * 0.18)) * 0.35;
    // Mouse bump in clip-ish space. Exp falloff so the disturbance is local.
    float md = distance(pos.xy * 0.10, uMouse * 1.2);
    float bump = exp(-md * md * 2.5) * 0.7;
    pos.z += n1 * 0.55 + n2 + bump;
    vHeight = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  varying float vHeight;
  varying vec2 vUv;
  void main() {
    vec3 cold = vec3(0.04, 0.08, 0.22);   // deep navy, valley
    vec3 mid  = vec3(0.10, 0.42, 0.85);   // brand blue
    vec3 hot  = vec3(0.05, 0.90, 0.65);   // gain-green peak
    float h = smoothstep(-0.55, 0.65, vHeight);
    vec3 col = mix(cold, mid, h);
    col = mix(col, hot, smoothstep(0.35, 0.95, h));
    // Vignette toward the edges so foreground text stays legible.
    vec2 c = vUv - 0.5;
    float fade = 1.0 - smoothstep(0.25, 0.85, length(c));
    gl_FragColor = vec4(col * fade, 1.0);
  }
`;

function TerrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  // We keep mouse in a ref to bypass React re-renders — pointermove fires
  // ~60Hz and would otherwise re-render the whole tree. The shader uniform
  // is then lerped toward the target every frame for buttery interpolation.
  const targetMouse = useRef(new THREE.Vector2(0, 0));

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    }),
    []
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      targetMouse.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uMouse.value.lerp(targetMouse.current, 0.06);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2.6, 0, 0]} position={[0, -1.1, 0]}>
      <planeGeometry args={[22, 22, 100, 100]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        wireframe
        transparent
      />
    </mesh>
  );
}

export default function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 5.5], fov: 55 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      // We're decorative — pointer-events on the canvas would steal them
      // from the buttons that sit on top.
      style={{ pointerEvents: 'none' }}
    >
      <TerrainMesh />
    </Canvas>
  );
}
