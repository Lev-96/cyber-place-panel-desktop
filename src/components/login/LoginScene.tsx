import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createGlowTexture,
  createMoonTexture,
  createNebulaTexture,
  createPlanetTexture,
} from "./spaceTextures";

/**
 * The 3D backdrop behind the sign-in panel: deep space over a neon grid — a
 * starfield, a nebula, a cratered moon and a floor running to the horizon,
 * with the camera leaning gently on the pointer.
 *
 * ## Why a real scene rather than a CSS illusion
 * Perspective faked in CSS is a flat image with a transform on it: the
 * parallax is wrong the moment anything moves, and the horizon does not
 * behave. Here the grid genuinely recedes, fog genuinely swallows it, and the
 * camera lean produces real motion parallax between the floor, the moon and
 * the stars. That layered depth is the whole effect.
 *
 * ## It is decoration, and it defers to the form
 * `pointer-events: none`, no DOM inside the canvas, never takes focus: the
 * sign-in form in front stays ordinary, fully keyboard-operable DOM.
 */
const LoginScene = () => (
  <Canvas
    className="login-scene"
    // Transparent so the app background supplies the base colour, and DPR
    // capped: a 4K panel would otherwise render this decorative layer at full
    // resolution for no visible gain.
    gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    dpr={[1, 1.75]}
    camera={{ position: [0, 1.15, 6.5], fov: 55 }}
    style={{ pointerEvents: "none" }}
  >
    {/* Fog is what creates the horizon: the grid does not end, it dissolves.
        Everything meant to read as *distant* opts out of it below — fog is for
        the floor running away from you, not for objects already far off. */}
    <fog attach="fog" args={["#020514", 9, 30]} />
    <ambientLight intensity={0.35} />
    {/* Key light from the upper left, so the moon shows a terminator instead
        of reading as a flat disc. */}
    <directionalLight position={[-6, 5, 2]} intensity={2.1} />

    <Starfield />
    <Nebula />
    <Moon />
    <Planets />
    <PassingShips />
    <NeonGrid />
    <Motes />
    <PointerParallax />
  </Canvas>
);

/* ---------------------------------------------------------------- stars -- */

const STAR_COUNT = 1400;

/**
 * Two interleaved star layers that breathe out of phase.
 *
 * A single field pulsing as one reads as the whole sky dimming; two offset
 * layers read as individual stars twinkling, which is the effect wanted — and
 * it costs two draw calls instead of a per-star shader.
 *
 * `sizeAttenuation` is off: stars are effectively at infinity, so they should
 * stay the same pinprick regardless of camera movement.
 */
const Starfield = () => {
  const near = useRef<THREE.PointsMaterial>(null);
  const far = useRef<THREE.PointsMaterial>(null);
  const glow = useMemo(createGlowTexture, []);

  const [geoA, geoB] = useMemo(() => {
    const build = (count: number, radius: number) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        // Spread over a sphere shell so the sky surrounds the camera rather
        // than sitting on a plane behind it.
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius * (0.75 + Math.random() * 0.25);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.7;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      return geo;
    };
    return [build(STAR_COUNT, 60), build(STAR_COUNT / 2, 48)];
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (near.current) near.current.opacity = 0.55 + Math.sin(t * 0.8) * 0.2;
    if (far.current) far.current.opacity = 0.42 + Math.sin(t * 0.8 + Math.PI) * 0.18;
  });

  return (
    <>
      <points geometry={geoA}>
        <pointsMaterial
          ref={near}
          // Pixels, not world units: with attenuation on, a star 50 units away
          // was drawn as a huge quad. Off, `size` is a screen-space size, which
          // is what a star at effectively infinite distance should be.
          sizeAttenuation={false}
          size={2}
          map={glow}
          alphaMap={glow}
          color="#ffffff"
          transparent
          depthWrite={false}
          fog={false}
        />
      </points>
      <points geometry={geoB}>
        <pointsMaterial
          ref={far}
          sizeAttenuation={false}
          size={1.3}
          map={glow}
          alphaMap={glow}
          color="#a9d8ff"
          transparent
          depthWrite={false}
          fog={false}
        />
      </points>
    </>
  );
};

/* --------------------------------------------------------------- nebula -- */

/**
 * A slow drift of coloured gas, far behind everything.
 *
 * Additive and un-fogged: it is light, not matter, so it brightens what is
 * behind it rather than occluding it, and distance should not grey it out.
 */
const Nebula = () => {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useMemo(createNebulaTexture, []);

  useFrame((_state, delta) => {
    if (mesh.current) mesh.current.rotation.z += delta * 0.012;
  });

  return (
    <mesh ref={mesh} position={[2, 6, -34]}>
      <planeGeometry args={[60, 60]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
};

/* ----------------------------------------------------------------- moon -- */

/**
 * The moon, turning slowly.
 *
 * Lit by the scene's key light so the terminator does the work — a moon with
 * uniform lighting is just a grey circle. It sits outside the fog because it
 * is meant to read as very far away and bright, not as something the haze in
 * this room could touch, and it carries its own soft halo sprite so the glow
 * survives against the dark sky.
 */
const Moon = () => {
  const moon = useRef<THREE.Mesh>(null);
  const texture = useMemo(createMoonTexture, []);
  const halo = useMemo(createGlowTexture, []);

  useFrame((_state, delta) => {
    if (moon.current) moon.current.rotation.y += delta * 0.018;
  });

  return (
    // Parked up and to the left, well clear of the ring and the panel: the
    // moon should read as its own landmark, not as decoration on the form.
    <group position={[-13.5, 8.4, -26]}>
      {/* Halo first, so the sphere draws over it. */}
      <sprite scale={[13, 13, 1]}>
        <spriteMaterial
          map={halo}
          color="#9fd4ff"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </sprite>
      <mesh ref={moon}>
        <sphereGeometry args={[2.9, 48, 48]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} fog={false} />
      </mesh>
    </group>
  );
};


/* -------------------------------------------------------------- planets -- */

/**
 * A handful of distant worlds.
 *
 * Placement, size, hue and spin are randomised ONCE per mount, so the sky is
 * different every time the login screen is opened but stable while you look at
 * it — a sky that reshuffles itself mid-session would read as a glitch.
 *
 * All of them sit far behind the panel and out of the central column, so
 * nothing ever competes with the form for attention.
 */
/**
 * Regions each planet may occupy: [xMin, xMax, yMin, yMax]. Right-high,
 * right-low and left-low — the upper left is deliberately absent, because
 * that is the moon's.
 */
const SLOTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [16, 30, 6, 15],
  [13, 26, -4, 4],
  [-30, -17, -5, 3],
] as const;

const Planets = () => {
  const planets = useMemo(
    () =>
      // Jittered slots, not free randomness. Pure randomness clumps — two
      // worlds overlapping read as a mistake — and it kept dropping a planet
      // on top of the moon. Fixed regions with jitter inside them give variety
      // every mount while guaranteeing the moon's corner stays its own.
      SLOTS.map(([xMin, xMax, yMin, yMax]) => ({
        texture: createPlanetTexture(Math.random() * 360),
        position: [
          xMin + Math.random() * (xMax - xMin),
          yMin + Math.random() * (yMax - yMin),
          // Far enough back that they read as worlds rather than props: at
          // this distance a 2-unit sphere is a few dozen pixels.
          -46 - Math.random() * 26,
        ] as [number, number, number],
        radius: 1.6 + Math.random() * 2.4,
        // Slow enough that you only notice it if you stay a while.
        spin: (0.005 + Math.random() * 0.009) * (Math.random() < 0.5 ? -1 : 1),
        tilt: (Math.random() - 0.5) * 0.6,
        // Each world fades up on its own schedule, so they do not all switch
        // on together the moment the scene mounts.
        fadeDelay: 1.5 + Math.random() * 6,
        fadeTime: 5 + Math.random() * 5,
        // Drift: a very long, very shallow oscillation. Real distant bodies do
        // not visibly travel, but a completely static sphere reads as a
        // sticker — this is the smallest motion that still says "adrift".
        driftAmp: [1.4 + Math.random() * 1.8, 0.7 + Math.random() * 1.2] as [number, number],
        driftRate: [0.012 + Math.random() * 0.014, 0.009 + Math.random() * 0.012] as [number, number],
        driftPhase: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2] as [number, number],
      })),
    [],
  );

  return (
    <>
      {planets.map((planet, i) => (
        <Planet key={i} {...planet} />
      ))}
    </>
  );
};

interface PlanetProps {
  texture: THREE.Texture;
  position: [number, number, number];
  radius: number;
  spin: number;
  tilt: number;
  fadeDelay: number;
  fadeTime: number;
  driftAmp: [number, number];
  driftRate: [number, number];
  driftPhase: [number, number];
}

const Planet = ({
  texture,
  position,
  radius,
  spin,
  tilt,
  fadeDelay,
  fadeTime,
  driftAmp,
  driftRate,
  driftPhase,
}: PlanetProps) => {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const age = useRef(0);

  useFrame((_state, delta) => {
    age.current += delta;

    if (mesh.current) mesh.current.rotation.y += spin * delta;

    // Fade up once the delay has passed. Held at 0 before that, so a planet is
    // genuinely absent rather than merely dim.
    if (material.current) {
      const since = age.current - fadeDelay;
      material.current.opacity = since <= 0 ? 0 : Math.min(1, since / fadeTime);
    }

    // Two out-of-step sinusoids, one per axis: a single one would trace a
    // straight line back and forth, which reads as a mechanism. Different
    // rates give an open, wandering path that never repeats to the eye.
    if (group.current) {
      const t = age.current;
      group.current.position.x =
        position[0] + Math.sin(t * driftRate[0] + driftPhase[0]) * driftAmp[0];
      group.current.position.y =
        position[1] + Math.sin(t * driftRate[1] + driftPhase[1]) * driftAmp[1];
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh ref={mesh} rotation={[tilt, 0, tilt * 0.5]}>
        <sphereGeometry args={[radius, 32, 32]} />
        {/* Un-fogged, like the moon and the stars: these are far-off objects,
            not something the haze over this floor could reach. `transparent`
            is what allows the fade-in — an opaque material ignores opacity. */}
        <meshStandardMaterial
          ref={material}
          map={texture}
          roughness={0.9}
          metalness={0.05}
          transparent
          opacity={0}
          fog={false}
        />
      </mesh>
    </group>
  );
};

/* ---------------------------------------------------------------- ships -- */

const SHIP_COUNT = 3;

/** Seconds a ship takes to cross, and the gap before the next one appears. */
const SHIP_CROSS = [26, 46] as const;
const SHIP_GAP = [6, 26] as const;

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min);

/**
 * Craft drifting across the far distance.
 *
 * ## Why they are on timers rather than always present
 * Three ships permanently sliding across would read as a screensaver. Each
 * one instead waits a random gap, crosses once on a fresh random path, then
 * waits again — so the sky is mostly empty and a passing ship is something you
 * happen to catch. That is what makes it feel like space rather than traffic.
 *
 * Everything is deliberately slow: a crossing takes half a minute or more.
 */
const PassingShips = () => (
  <>
    {Array.from({ length: SHIP_COUNT }, (_, i) => (
      <Ship key={i} />
    ))}
  </>
);

const Ship = () => {
  const group = useRef<THREE.Group>(null);
  const glow = useMemo(createGlowTexture, []);

  // Mutable flight plan. Held in a ref because it changes every crossing and
  // none of it should trigger a React render.
  const flight = useRef({
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    duration: 1,
    elapsed: 0,
    // Start part-way through a gap so the three do not all launch together on
    // the first frame.
    wait: Math.random() * SHIP_GAP[1],
  });

  /** Roll a fresh crossing: a random line across the back of the scene. */
  const replan = () => {
    const plan = flight.current;
    const leftToRight = Math.random() < 0.5;
    const x = 30 + Math.random() * 10;
    const y = 1 + Math.random() * 11;
    const z = -22 - Math.random() * 20;

    plan.from.set(leftToRight ? -x : x, y, z);
    plan.to.set(leftToRight ? x : -x, y + (Math.random() - 0.5) * 3, z + (Math.random() - 0.5) * 8);
    plan.duration = between(SHIP_CROSS);
    plan.elapsed = 0;
    // Deliberately does NOT touch `wait`. Setting a new gap here meant every
    // expiring wait immediately armed the next one, so a ship was planned over
    // and over and never actually launched. The gap belongs to the END of a
    // crossing, and only there.
  };

  useFrame((_state, delta) => {
    const node = group.current;
    const plan = flight.current;
    if (!node) return;

    if (plan.wait > 0) {
      plan.wait -= delta;
      node.visible = false;
      if (plan.wait <= 0) replan();
      return;
    }

    plan.elapsed += delta;
    const progress = plan.elapsed / plan.duration;

    if (progress >= 1) {
      node.visible = false;
      plan.wait = between(SHIP_GAP);
      return;
    }

    node.visible = true;
    node.position.lerpVectors(plan.from, plan.to, progress);
    // Point the nose along the flight path.
    node.lookAt(plan.to);
    // Fade in and out at the ends, so a ship never pops into or out of
    // existence at the edge of the frame.
    const fade = Math.min(1, Math.min(progress, 1 - progress) * 12);
    node.scale.setScalar(0.6 + fade * 0.4);
  });

  return (
    <group ref={group} visible={false}>
      {/* Hull: a slim cone laid along the flight path. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.85, 8]} />
        <meshStandardMaterial
          color="#c7d6f0"
          emissive="#3aa0ff"
          emissiveIntensity={0.5}
          roughness={0.4}
          metalness={0.6}
          fog={false}
        />
      </mesh>
      {/* Engine bloom, at negative Z: `lookAt` aims a mesh's +Z at its
          target, so the nose is +Z and the exhaust trails from -Z. */}
      <sprite position={[0, 0, -0.55]} scale={[1.1, 1.1, 1]}>
        <spriteMaterial
          map={glow}
          color="#07ddf1"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </sprite>
    </group>
  );
};

/* ----------------------------------------------------------------- grid -- */

/** Distance between grid lines, in world units. */
const CELL = 1.5;

/** How fast the floor flows towards the viewer, in units per second. */
const FLOW = 1.35;

/**
 * The floor: a wide grid flowing towards the camera.
 *
 * The endless plane comes from moving the grid by exactly one cell and then
 * wrapping. Every cell being identical makes the wrap invisible — resetting
 * from an arbitrary offset would show a jump on every loop.
 */
const NeonGrid = () => {
  const grid = useRef<THREE.GridHelper>(null);

  // Built once: re-creating a GridHelper each render would rebuild its
  // geometry every time the parent re-renders.
  const helper = useMemo(() => {
    const g = new THREE.GridHelper(90, 90 / CELL, "#07ddf1", "#1e3a6b");
    const material = g.material as THREE.Material | THREE.Material[];
    // Transparency lets the fog fade the far lines out instead of clipping
    // them; depthWrite off stops the lines fighting the motes behind.
    (Array.isArray(material) ? material : [material]).forEach((m) => {
      m.transparent = true;
      m.opacity = 0.5;
      m.depthWrite = false;
    });
    return g;
  }, []);

  useFrame((_state, delta) => {
    const node = grid.current;
    if (!node) return;
    node.position.z = (node.position.z + FLOW * delta) % CELL;
  });

  return <primitive ref={grid} object={helper} position={[0, -1.6, 0]} />;
};

/* ---------------------------------------------------------------- motes -- */

const MOTE_COUNT = 260;

/**
 * Slow-moving points of light just above the grid.
 *
 * They exist for parallax: without something at a middle depth the floor and
 * the sky read as two flat images. Positions live in one buffer that is only
 * nudged per frame — rebuilding the attribute would allocate a typed array
 * every tick.
 */
const Motes = () => {
  const points = useRef<THREE.Points>(null);
  const glow = useMemo(createGlowTexture, []);

  const geometry = useMemo(() => {
    const positions = new Float32Array(MOTE_COUNT * 3);
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 34;
      positions[i * 3 + 1] = Math.random() * 9 - 1.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((_state, delta) => {
    const node = points.current;
    if (!node) return;

    const attribute = node.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;

    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const y = i * 3 + 1;
      array[y] += delta * 0.22;
      // Recycle from the top back to below the floor, so the drift never runs
      // out of motes.
      if (array[y] > 7.8) array[y] = -1.4;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.08}
        sizeAttenuation
        // Same reason as the stars: an untextured point is a square quad, and
        // at this size the corners are plainly visible.
        map={glow}
        alphaMap={glow}
        color="#7fe9ff"
        transparent
        opacity={0.75}
        depthWrite={false}
        // Additive so overlapping motes bloom rather than flatten — the cheap
        // way to suggest glow without a post-processing pass.
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/* -------------------------------------------------------------- parallax -- */

/** How far the camera may lean, in world units. */
const PARALLAX = 0.55;

/**
 * Leans the camera towards the pointer.
 *
 * Eased rather than tracked one-to-one: a camera pinned to the cursor feels
 * twitchy and, on this screen, actively distracting while someone is typing a
 * password. The easing is frame-rate independent, so it behaves the same at
 * 60 and 144 Hz.
 */
const PointerParallax = () => {
  const { camera, pointer } = useThree();

  useFrame((_state, delta) => {
    const ease = 1 - Math.exp(-2.2 * delta);
    camera.position.x += (pointer.x * PARALLAX - camera.position.x) * ease;
    camera.position.y += (1.15 + pointer.y * PARALLAX * 0.5 - camera.position.y) * ease;
    camera.lookAt(0, 0.6, -6);
  });

  return null;
};

export default LoginScene;
