'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * The hero's WebGL terrain — rewritten for stability + visual sophistication.
 *
 * Fixes vs the prior pass:
 *   - Plane grows from 22 to 36 units so the displaced edges never clip out
 *     of the camera frustum (that was causing the "geometry breaking" reads).
 *   - Material is now double-sided. Tilted wireframes can briefly show their
 *     back faces while the camera parallaxes; one-sided caused invisible
 *     triangles.
 *   - Mouse position is projected onto the plane via a raycaster instead of
 *     a naive clip-space → world-space estimate. The bump now follows the
 *     cursor exactly, instead of drifting at the edges.
 *   - Noise time slowed from 0.18 to 0.08 — the previous rate aliased into
 *     a jittery flicker on lower-end GPUs.
 *
 * Pushed further:
 *   - 3-octave fractal Brownian motion (instead of single noise) for richer,
 *     more topographic terrain.
 *   - "Scan band" — a slow horizontal field of higher amplitude that drifts
 *     across X, suggesting market data flowing through the surface.
 *   - Fragment shader adds (a) additive emerald glow on peaks, (b) a soft
 *     blue halo around the cursor, (c) a height-coupled colour ramp with
 *     four stops instead of two.
 *   - Camera parallaxes gently toward the cursor, so the whole scene feels
 *     dimensional rather than flat.
 *
 * Perf budget: ~18k triangles, dpr capped at 1.5, no post-processing — runs
 * fluidly on integrated GPUs.
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
  // Fractal Brownian motion — three octaves of snoise sums into something
  // that looks like real topography instead of a single rolling wave.
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * snoise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }
`;

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;        // in plane-local space (units)
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vLocalPos;
  ${NOISE_GLSL}
  void main() {
    vUv = uv;
    vec3 pos = position;

    // Slow-evolving FBM dominates the terrain.
    float n = fbm(vec3(pos.xy * 0.18, uTime * 0.08)) * 0.65;

    // Cursor bump in plane-local coords (no clip-space gymnastics needed —
    // JS hands us the actual surface intersection point).
    float md = distance(pos.xy, uMouse);
    float bump = exp(-md * md * 0.10) * 0.75;

    // "Scan band" — a slow sinusoidal X position, with an exponential field
    // around it that pushes a small wobble through the terrain. Reads as a
    // market signal sweeping the surface.
    float scanX = sin(uTime * 0.17) * 14.0;
    float scanDist = abs(pos.x - scanX);
    float scanField = exp(-scanDist * 0.12) * 0.35;
    float scanWobble = sin(uTime * 1.1 + pos.y * 0.4) * scanField;

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
    // Four-stop palette — deep navy valleys, blue mid, cyan upper, emerald
    // peaks. We map vHeight through smoothstep windows so transitions feel
    // optical rather than discrete.
    vec3 c1 = vec3(0.018, 0.038, 0.130);
    vec3 c2 = vec3(0.060, 0.220, 0.620);
    vec3 c3 = vec3(0.180, 0.540, 0.880);
    vec3 c4 = vec3(0.190, 0.900, 0.680);

    float h = smoothstep(-0.85, 1.25, vHeight);
    vec3 col = mix(c1, c2, smoothstep(0.00, 0.40, h));
    col = mix(col, c3, smoothstep(0.40, 0.75, h));
    col = mix(col, c4, smoothstep(0.75, 1.00, h));

    // Peak glow — gives a sense of crest highlight without real lighting.
    col += pow(max(h - 0.55, 0.0), 2.5) * vec3(0.12, 0.32, 0.22);

    // Scan-band highlight in fragment space, mirroring the vertex bump.
    float scanX = sin(uTime * 0.17) * 14.0;
    float scanDist = abs(vLocalPos.x - scanX);
    col += exp(-scanDist * 0.42) * 0.22 * vec3(0.36, 0.78, 0.65);

    // Cursor halo — warm blue glow around the bump centre.
    float md = distance(vLocalPos.xy, uMouse);
    col += exp(-md * md * 0.05) * 0.20 * vec3(0.42, 0.62, 0.92);

    // Radial vignette so the canvas dissolves into the surrounding black
    // and the hero text always wins on contrast.
    vec2 c = vUv - 0.5;
    float vignette = 1.0 - smoothstep(0.30, 0.95, length(c));

    gl_FragColor = vec4(col * vignette, 1.0);
  }
`;

function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const targetMouse = useRef(new THREE.Vector2(0, 0));
  // Reused on every frame to avoid allocating in the hot path.
  const localPoint = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3(0, -0.3, 0));

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    }),
    []
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;

    // Project cursor onto the un-displaced plane. Raycasting hits the
    // geometry's flat triangles, which is exactly what we want — the bump's
    // "centre" lives in surface-local coords, not vertex-displaced ones.
    if (meshRef.current) {
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObject(meshRef.current, false);
      if (hits.length > 0) {
        localPoint.current.copy(hits[0].point);
        meshRef.current.worldToLocal(localPoint.current);
        targetMouse.current.lerp(
          new THREE.Vector2(localPoint.current.x, localPoint.current.y),
          0.12
        );
      }
    }
    uniforms.uMouse.value.copy(targetMouse.current);

    // Subtle camera parallax — exaggerates depth without making the scene
    // queasy. Lerp factor is low so a flick doesn't whip the view.
    const cx = state.pointer.x * 0.45;
    const cy = 0.55 + state.pointer.y * 0.22;
    state.camera.position.x += (cx - state.camera.position.x) * 0.035;
    state.camera.position.y += (cy - state.camera.position.y) * 0.035;
    state.camera.lookAt(cameraTarget.current);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2.55, 0, 0]} position={[0, -1.3, 0]}>
      <planeGeometry args={[36, 36, 96, 96]} />
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

// Small helper so we can grab `gl.setClearColor` after mount — the default
// alpha clear shows the body's pure black, which is exactly what we want.
function NullClear() {
  useThree((s) => s.gl.setClearAlpha(0));
  return null;
}

export default function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0.55, 5.8], fov: 55, near: 0.1, far: 100 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
    >
      <NullClear />
      <Terrain />
    </Canvas>
  );
}
