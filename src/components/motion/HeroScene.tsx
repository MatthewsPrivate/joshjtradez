import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  Lightformer,
  MeshReflectorMaterial,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  Vignette,
  GodRays,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";

type Phase = "drift" | "shatter";

// =============================================================================
// HERO CANDLE — bevelled gold ingot, animated flame on top, point-light flicker
// =============================================================================
function HeroCandle({ phase }: { phase: Phase }) {
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const tStart = useRef(0);
  const velocity = useRef(new THREE.Vector3(1.5, 6, -1));

  useFrame((state, dt) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;

    if (phase === "shatter") {
      if (tStart.current === 0) tStart.current = t;
      const elapsed = t - tStart.current;
      group.current.position.x += velocity.current.x * dt;
      group.current.position.y += velocity.current.y * dt;
      group.current.position.z += velocity.current.z * dt;
      velocity.current.y -= 4 * dt;
      group.current.rotation.x += dt * 3.2;
      group.current.rotation.y += dt * 4.4;
      group.current.rotation.z += dt * 2.6;
      group.current.scale.setScalar(Math.max(0, 1.7 * (1 - elapsed * 0.55)));
    } else {
      group.current.rotation.y = t * 0.15;
      group.current.position.y = -0.35 + Math.sin(t * 0.6) * 0.06;
    }

    // Flame flicker — two stacked sines so it never looks periodic.
    if (flame.current && light.current) {
      const flicker = 1 + Math.sin(t * 12) * 0.08 + Math.sin(t * 5.3) * 0.05;
      flame.current.scale.set(2 - flicker, 1.1 * flicker, 2 - flicker);
      light.current.intensity = 2.2 * flicker;
    }
  });

  return (
    <group ref={group} position={[0, -0.35, 0]} scale={1.7}>
      <RoundedBox args={[0.7, 2.4, 0.7]} radius={0.06} smoothness={4} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#F2C75C"
          metalness={1}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.8}
          emissive="#3A2B0A"
          emissiveIntensity={0.55}
        />
      </RoundedBox>

      {/* Wick — short matte cylinder rising from the top */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
        <meshStandardMaterial color="#1A1208" roughness={1} />
      </mesh>

      {/* Flame — stretched glowing sphere, animated above */}
      <mesh ref={flame} position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color="#FFE9A8" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 1.55, 0]} intensity={2.2} color="#FFDB80" distance={6} decay={2} />
    </group>
  );
}

// =============================================================================
// PILLARS — 8 hexagonal gold columns in a ring, varying heights, gilded caps
// =============================================================================
interface PillarData {
  position: [number, number, number];
  height: number;
  shatterVelocity: THREE.Vector3;
  shatterSpin: THREE.Vector3;
}

function makePillars(): PillarData[] {
  const count = 8;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const radius = 4.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 0.3;
    const height = 1.4 + Math.abs(Math.sin(i * 0.9)) * 1.0;
    return {
      position: [x, -2.4 + height / 2, z] as [number, number, number],
      height,
      shatterVelocity: new THREE.Vector3(
        Math.cos(angle) * (5 + i * 0.4),
        2.5 + Math.random() * 2,
        Math.sin(angle) * (5 + i * 0.4),
      ),
      shatterSpin: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
      ),
    };
  });
}

function Pillar({ data, phase }: { data: PillarData; phase: Phase }) {
  const ref = useRef<THREE.Group>(null);
  const tStart = useRef(0);
  const velocity = useRef(data.shatterVelocity.clone());

  useFrame((state, dt) => {
    if (!ref.current) return;
    if (phase === "shatter") {
      if (tStart.current === 0) tStart.current = state.clock.elapsedTime;
      const elapsed = state.clock.elapsedTime - tStart.current;
      ref.current.position.x += velocity.current.x * dt;
      ref.current.position.y += velocity.current.y * dt;
      ref.current.position.z += velocity.current.z * dt;
      velocity.current.y -= 4 * dt;
      ref.current.rotation.x += data.shatterSpin.x * dt;
      ref.current.rotation.y += data.shatterSpin.y * dt;
      ref.current.rotation.z += data.shatterSpin.z * dt;
      ref.current.scale.setScalar(Math.max(0, 0.6 * (1 - elapsed * 0.5)));
    } else {
      const t = state.clock.elapsedTime;
      ref.current.position.y = data.position[1] + Math.sin(t * 0.5 + data.position[0]) * 0.05;
    }
  });

  return (
    <group ref={ref} position={data.position} scale={0.6}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.36, data.height, 6]} />
        <meshPhysicalMaterial
          color="#D69E2E"
          metalness={1}
          roughness={0.22}
          clearcoat={0.75}
          clearcoatRoughness={0.15}
          envMapIntensity={1.5}
        />
      </mesh>
      {/* Brighter cap so the top edge catches bloom */}
      <mesh position={[0, data.height / 2 + 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.34, 0.1, 6]} />
        <meshPhysicalMaterial
          color="#FFDB80"
          metalness={1}
          roughness={0.12}
          clearcoat={1}
          envMapIntensity={2}
        />
      </mesh>
    </group>
  );
}

// =============================================================================
// CRYSTAL SHARDS — refractive floating octahedra (built-in transmission, so
// no per-object render target — cheap enough to keep 4 of them).
// =============================================================================
interface ShardData {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  rotationSpeed: [number, number, number];
  shatterVelocity: THREE.Vector3;
}

function makeShards(): ShardData[] {
  const positions: [number, number, number][] = [
    [2.4, 1.6, 1.4],
    [-2.6, 2.2, -0.4],
    [0.8, 3.0, -2.2],
    [-1.4, 3.6, 1.8],
  ];
  return positions.map((p, i) => ({
    position: p,
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number],
    scale: 0.34 + (i % 2) * 0.1,
    rotationSpeed: [0.15 + i * 0.05, 0.2 + i * 0.04, 0.12 + i * 0.03] as [number, number, number],
    shatterVelocity: new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      Math.random() * 4 + 1,
      (Math.random() - 0.5) * 10,
    ),
  }));
}

function Shard({ data, phase }: { data: ShardData; phase: Phase }) {
  const ref = useRef<THREE.Group>(null);
  const tStart = useRef(0);
  const velocity = useRef(data.shatterVelocity.clone());

  useFrame((state, dt) => {
    if (!ref.current) return;
    if (phase === "shatter") {
      if (tStart.current === 0) tStart.current = state.clock.elapsedTime;
      const elapsed = state.clock.elapsedTime - tStart.current;
      ref.current.position.x += velocity.current.x * dt;
      ref.current.position.y += velocity.current.y * dt;
      ref.current.position.z += velocity.current.z * dt;
      velocity.current.y -= 4 * dt;
      ref.current.rotation.x += dt * 6;
      ref.current.rotation.y += dt * 7;
      ref.current.scale.setScalar(Math.max(0, data.scale * (1 - elapsed * 0.7)));
    } else {
      ref.current.rotation.x += data.rotationSpeed[0] * dt;
      ref.current.rotation.y += data.rotationSpeed[1] * dt;
      ref.current.rotation.z += data.rotationSpeed[2] * dt;
      const t = state.clock.elapsedTime;
      ref.current.position.y = data.position[1] + Math.sin(t * 0.7 + data.position[0]) * 0.22;
    }
  });

  return (
    <group ref={ref} position={data.position} rotation={data.rotation} scale={data.scale}>
      <mesh>
        <octahedronGeometry args={[0.6, 0]} />
        <meshPhysicalMaterial
          color="#FFE9A8"
          metalness={0}
          roughness={0.05}
          transmission={1}
          thickness={0.6}
          ior={1.6}
          envMapIntensity={2}
          attenuationColor="#FFDB80"
          attenuationDistance={1.2}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>
    </group>
  );
}

// =============================================================================
// HALO RINGS — three counter-rotating tori above the scene
// =============================================================================
function Halos() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const c = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (a.current) a.current.rotation.z += 0.05 * dt;
    if (b.current) b.current.rotation.z -= 0.08 * dt;
    if (c.current) c.current.rotation.z += 0.12 * dt;
  });

  return (
    <group position={[0, 5, -1]}>
      <mesh ref={a} rotation={[Math.PI / 2 + 0.05, 0, 0]}>
        <torusGeometry args={[8, 0.04, 6, 140]} />
        <meshBasicMaterial color="#FFDB80" transparent opacity={0.28} toneMapped={false} />
      </mesh>
      <mesh ref={b} rotation={[Math.PI / 2 - 0.18, 0, 0]}>
        <torusGeometry args={[5.5, 0.04, 6, 140]} />
        <meshBasicMaterial color="#FFDB80" transparent opacity={0.22} toneMapped={false} />
      </mesh>
      <mesh ref={c} rotation={[Math.PI / 2 + 0.28, 0, 0]}>
        <torusGeometry args={[3.2, 0.04, 6, 140]} />
        <meshBasicMaterial color="#FFDB80" transparent opacity={0.16} toneMapped={false} />
      </mesh>
    </group>
  );
}

// =============================================================================
// FLOOR — dark polished marble that catches a hint of the gold
// =============================================================================
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={18}
        roughness={0.75}
        depthScale={1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#0B0A09"
        metalness={0.6}
        mirror={0}
      />
    </mesh>
  );
}

// =============================================================================
// CAMERA RIG — orbital intro that spirals in to a slow off-axis bob
// =============================================================================
function Rig({ phase }: { phase: Phase }) {
  const start = useRef<number | null>(null);
  useFrame((state) => {
    if (start.current === null) start.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - start.current;
    const intro = Math.min(1, elapsed / 2.8);
    const eased = 1 - Math.pow(1 - intro, 3);

    if (phase === "shatter") {
      if (state.camera.position.z > 2.5) state.camera.position.z -= 0.07;
      state.camera.position.y = Math.max(-1, state.camera.position.y - 0.008);
      state.camera.lookAt(0, 0.4, 0);
    } else {
      const t = state.clock.elapsedTime;
      const restingR = 8.4 + Math.sin(t * 0.05) * 0.3;
      const introR = 22;
      const r = introR - (introR - restingR) * eased;
      const orbit = t * 0.05;
      const idleY = 1.0 + Math.cos(t * 0.07) * 0.35;
      state.camera.position.x = Math.sin(orbit) * r * eased;
      state.camera.position.z = Math.cos(orbit) * r;
      state.camera.position.y = idleY * eased;
      state.camera.lookAt(0, -0.2, 0);
    }
  });
  return null;
}

// =============================================================================
// SCENE
// =============================================================================
function Scene({ phase, onSunReady }: { phase: Phase; onSunReady: (m: THREE.Mesh) => void }) {
  const pillars = useMemo(() => makePillars(), []);
  const shards = useMemo(() => makeShards(), []);

  return (
    <>
      <color attach="background" args={["#08080A"]} />
      <fog attach="fog" args={["#0A0A0B", 8, 28]} />

      <Rig phase={phase} />

      <ambientLight intensity={0.14} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={2.4}
        color="#FFE9A8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.04}
      >
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.1, 36]} />
      </directionalLight>
      <pointLight position={[-6, 3, 4]} intensity={0.7} color="#A9C8E8" distance={22} />
      <pointLight position={[0, 1.5, 6]} intensity={0.9} color="#E5B344" distance={10} />

      {/* God-ray source — bright sphere planted behind the scene. GodRays
          post-process samples the screen position of this mesh. */}
      <mesh ref={(m) => { if (m) onSunReady(m); }} position={[0, 7, -16]}>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color="#FFE9A8" toneMapped={false} />
      </mesh>

      {/* Studio HDRI built from lightformers — feeds the gold + crystal reflections. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={4}   color="#FFDB80" position={[-5, 4, -5]} scale={[5, 5, 1]} />
        <Lightformer intensity={3.2} color="#FFE9A8" position={[5, 6, -3]}  scale={[5, 5, 1]} />
        <Lightformer form="ring" intensity={3} color="#FFDB80" position={[0, 8, 0]} scale={[8, 8, 1]} />
        <Lightformer intensity={1.2} color="#F5F5F2" position={[0, 0, -8]}  scale={[10, 10, 1]} />
      </Environment>

      <Halos />

      <HeroCandle phase={phase} />

      {pillars.map((p, i) => (
        <Pillar key={i} data={p} phase={phase} />
      ))}

      {shards.map((s, i) => (
        <Shard key={i} data={s} phase={phase} />
      ))}

      <Floor />
      <ContactShadows
        position={[0, -2.39, 0]}
        opacity={0.85}
        scale={24}
        blur={3}
        far={6}
        color="#000000"
      />

      <Sparkles count={80} scale={[24, 16, 12]} size={2.2} speed={0.18} color="#FFDB80" opacity={0.7} />
      <Sparkles count={40} scale={[18, 12, 10]} size={5}   speed={0.08} color="#E5B344" opacity={0.32} />
    </>
  );
}

// =============================================================================
// EXPORT — Canvas + GodRays/Bloom/DOF/Vignette stack.
// Same Phase API + shatter event timing as the previous scene.
// =============================================================================
export default function HeroScene() {
  const viewport = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    observer.observe(viewport.current);
    const visibility = () => setVisible(!document.hidden && !!viewport.current && viewport.current.getBoundingClientRect().bottom > 0 && viewport.current.getBoundingClientRect().top < innerHeight);
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  const [phase, setPhase] = useState<Phase>("drift");
  const [sun, setSun] = useState<THREE.Mesh | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const trigger = () => {
      if (fired.current) return;
      fired.current = true;
      setPhase("shatter");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("hero:shatter-complete"));
      }, 1800);
    };

    window.addEventListener("hero:trigger-shatter", trigger);
    return () => {

      window.removeEventListener("hero:trigger-shatter", trigger);
    };
  }, []);

  return (
    <div ref={viewport} style={{ position: "absolute", inset: 0 }}><Canvas frameloop={visible ? "always" : "never"}
      shadows
      camera={{ position: [0, 1, 22], fov: 42 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true, // Freeze the rendered scene into the screen-fracture texture.
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.25,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Scene phase={phase} onSunReady={setSun} />

      <EffectComposer multisampling={4} key={sun ? "sun" : "no-sun"}>
        <Bloom
          intensity={1.3}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.25}
          mipmapBlur
          kernelSize={KernelSize.LARGE}
        />
        {sun ? (
          <GodRays
            sun={sun}
            blendFunction={BlendFunction.SCREEN}
            samples={60}
            density={0.96}
            decay={0.92}
            weight={0.45}
            exposure={0.55}
            clampMax={1}
            kernelSize={KernelSize.SMALL}
            blur
          />
        ) : (
          <></>
        )}
        <DepthOfField focusDistance={0.018} focalLength={0.05} bokehScale={2.6} />
        <Vignette offset={0.3} darkness={0.7} eskil={false} />
      </EffectComposer>
    </Canvas></div>
  );
}
