"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  RoomSceneGraph,
  RoomObjectNode,
  EgressAndShelterResult,
  ObjectHazardResult,
} from "@/types/contracts";
import {
  getProceduralTexture,
  getProceduralBumpMap,
  getItemTexture,
  getItemBumpMap,
  getGlassPillTexture,
  TextureStyle,
} from "./proceduralTextures";
import {
  WallCollider,
  PhysicsBody,
  stepObjectPhysics,
  resolvePlayerCollisions,
} from "./collisionPhysics";

export interface QuakeRoomCanvasProps {
  scene: RoomSceneGraph;
  evaluation: EgressAndShelterResult;
  isShaking: boolean;
  hasCollapsed: boolean;
  walkthroughActive: boolean;
  fullScreen?: boolean;
  titleBadge?: string;
  floorMaterial?: TextureStyle;
  teleportRoomId?: string | null;
  playerResetCounter?: number;
  showItemLabels?: boolean;
}

/**
 * Spacious Multi-Room Layout Constants (World coordinates centered around (0,0)):
 * Suite total footprint: 20.4m wide (X: -10.2 to +10.2) x 13.2m deep (Z: -6.6 to +6.6)
 * - Room 1 (Student Study & Bedroom): X in [-10.2, -3.4] (6.8m), Z in [0.4, 6.6] (6.2m)
 * - Room 2 (Central Lounge & Dining Hall): X in [-3.4, 3.4] (6.8m), Z in [0.4, 6.6] (6.2m)
 * - Room 3 (Seismic Server & Research Lab): X in [3.4, 10.2] (6.8m), Z in [0.4, 6.6] (6.2m)
 * - Room 4 (North Gallery & Emergency Exit Wing): X in [-10.2, 10.2] (20.4m), Z in [-6.6, 0.4] (7.0m)
 */
const SUITE_W = 20.4;
const SUITE_D = 13.2;
const WALL_H = 3.35;
const WALL_T = 0.18;

// Scale factor mapping Room 1 preset local coords (0..4.4, 0..4.0) into spacious 6.8m x 6.2m Room 1
const R1_ORIGIN_X = -9.85;
const R1_ORIGIN_Z = 0.65;
const R1_SCALE_X = 1.42;
const R1_SCALE_Z = 1.42;

function r1ToWorldX(x_m: number, effW: number): number {
  return R1_ORIGIN_X + x_m * R1_SCALE_X + effW / 2;
}

function r1ToWorldZ(z_m: number, effD: number): number {
  return R1_ORIGIN_Z + z_m * R1_SCALE_Z + effD / 2;
}

export const SUITE_ROOMS = [
  {
    id: "room_1",
    name: "Room 1: Student Study & Bedroom",
    spawnX: -8.2,
    spawnZ: 5.1,
    yaw: -0.65,
    bounds: { minX: -10.2, maxX: -3.4, minZ: 0.4, maxZ: 6.6 },
  },
  {
    id: "room_2",
    name: "Room 2: Central Lounge & Dining Hall",
    spawnX: -0.3,
    spawnZ: 4.4,
    yaw: -0.4,
    bounds: { minX: -3.4, maxX: 3.4, minZ: 0.4, maxZ: 6.6 },
  },
  {
    id: "room_3",
    name: "Room 3: Seismic Server & Research Lab",
    spawnX: 6.4,
    spawnZ: 4.4,
    yaw: 0.5,
    bounds: { minX: 3.4, maxX: 10.2, minZ: 0.4, maxZ: 6.6 },
  },
  {
    id: "room_4",
    name: "Room 4: North Gallery & Emergency Exit Wing",
    spawnX: -2.4,
    spawnZ: -3.1,
    yaw: -Math.PI / 2,
    bounds: { minX: -10.2, maxX: 10.2, minZ: -6.6, maxZ: 0.4 },
  },
];

/**
 * Wall segments with generous 1.7m–1.8m open doorway portals between all 4 rooms
 */
const SUITE_WALLS: WallCollider[] = [
  // Outer Perimeter Walls
  { id: "w_north", x1: -10.2, z1: -6.6, x2: 10.2, z2: -6.6, thickness: WALL_T },
  { id: "w_south", x1: -10.2, z1: 6.6, x2: 10.2, z2: 6.6, thickness: WALL_T },
  { id: "w_west", x1: -10.2, z1: -6.6, x2: -10.2, z2: 6.6, thickness: WALL_T },
  { id: "w_east", x1: 10.2, z1: -6.6, x2: 10.2, z2: 6.6, thickness: WALL_T },

  // Interior East-West Spine Wall at Z = 0.4 (separating South Rooms 1,2,3 from North Gallery Room 4)
  // Doorway 1->4 at X in [-7.6, -5.9] (1.7m wide)
  { id: "w_spine_1a", x1: -10.2, z1: 0.4, x2: -7.6, z2: 0.4, thickness: WALL_T },
  { id: "w_spine_1b", x1: -5.9, z1: 0.4, x2: -0.9, z2: 0.4, thickness: WALL_T },
  // Doorway 2->4 at X in [-0.9, 0.9] (1.8m wide)
  { id: "w_spine_2", x1: 0.9, z1: 0.4, x2: 5.9, z2: 0.4, thickness: WALL_T },
  // Doorway 3->4 at X in [5.9, 7.6] (1.7m wide)
  { id: "w_spine_3", x1: 7.6, z1: 0.4, x2: 10.2, z2: 0.4, thickness: WALL_T },

  // Interior Partition between Room 1 & Room 2 at X = -3.4 (Z from 0.4 to 6.6)
  // Doorway 1->2 at Z in [2.6, 4.35] (1.75m wide)
  { id: "w_p12_a", x1: -3.4, z1: 0.4, x2: -3.4, z2: 2.6, thickness: WALL_T },
  { id: "w_p12_b", x1: -3.4, z1: 4.35, x2: -3.4, z2: 6.6, thickness: WALL_T },

  // Interior Partition between Room 2 & Room 3 at X = 3.4 (Z from 0.4 to 6.6)
  // Doorway 2->3 at Z in [2.6, 4.35] (1.75m wide)
  { id: "w_p23_a", x1: 3.4, z1: 0.4, x2: 3.4, z2: 2.6, thickness: WALL_T },
  { id: "w_p23_b", x1: 3.4, z1: 4.35, x2: 3.4, z2: 6.6, thickness: WALL_T },
];

const DOORWAY_LINTELS = [
  { id: "lintel_14", x: -6.75, z: 0.4, w: 1.7, rotY: 0, label: "TO NORTH GALLERY" },
  { id: "lintel_24", x: 0.0, z: 0.4, w: 1.8, rotY: 0, label: "GALLERY ARCH" },
  { id: "lintel_34", x: 6.75, z: 0.4, w: 1.7, rotY: 0, label: "LAB PASSAGE" },
  { id: "lintel_12", x: -3.4, z: 3.475, w: 1.75, rotY: Math.PI / 2, label: "TO LOUNGE (RM 2)" },
  { id: "lintel_23", x: 3.4, z: 3.475, w: 1.75, rotY: Math.PI / 2, label: "TO LAB (RM 3)" },
];

/**
 * Additional furniture & physical obstacles populating spacious Rooms 2, 3, and 4
 */
interface ExtraSuiteObject {
  id: string;
  roomId: string;
  label: string;
  category:
    | "sofa"
    | "table"
    | "cabinet"
    | "cart"
    | "chair"
    | "debris"
    | "server_rack"
    | "lab_bench"
    | "crate"
    | "exit_door";
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rotY: number;
  mass: number;
  movable: boolean;
  willTipInQuake: boolean;
  lowObstacle?: boolean;
  targetRotX?: number;
  targetRotZ?: number;
}

const EXTRA_SUITE_OBJECTS: ExtraSuiteObject[] = [
  // Room 2 (Central Lounge & Dining Hall: X in [-3.4, 3.4], Z in [0.4, 6.6])
  {
    id: "r2_sofa",
    roomId: "room_2",
    label: "Velvet Chesterfield Sofa",
    category: "sofa",
    x: -0.2,
    z: 5.75,
    w: 2.3,
    d: 0.9,
    h: 0.88,
    rotY: Math.PI,
    mass: 65,
    movable: false,
    willTipInQuake: false,
  },
  {
    id: "r2_table",
    roomId: "room_2",
    label: "Reinforced Oak Shelter Table",
    category: "table",
    x: 1.55,
    z: 2.85,
    w: 1.5,
    d: 0.95,
    h: 0.78,
    rotY: 0,
    mass: 55,
    movable: false,
    willTipInQuake: false,
  },
  {
    id: "r2_cabinet",
    roomId: "room_2",
    label: "Tall Curio Display Cabinet",
    category: "cabinet",
    x: -2.25,
    z: 0.95,
    w: 1.0,
    d: 0.45,
    h: 2.1,
    rotY: 0,
    mass: 78,
    movable: false,
    willTipInQuake: true,
    targetRotX: Math.PI * 0.44,
    targetRotZ: 0,
  },
  {
    id: "r2_cart",
    roomId: "room_2",
    label: "Rolling Brass Tea Cart (Pushable)",
    category: "cart",
    x: -1.45,
    z: 3.65,
    w: 0.72,
    d: 0.48,
    h: 0.82,
    rotY: 0.3,
    mass: 18,
    movable: true,
    willTipInQuake: false,
  },
  {
    id: "r2_chair",
    roomId: "room_2",
    label: "Lounge Swivel Chair (Pushable)",
    category: "chair",
    x: 0.25,
    z: 3.45,
    w: 0.58,
    d: 0.58,
    h: 0.86,
    rotY: -0.5,
    mass: 14,
    movable: true,
    willTipInQuake: false,
  },

  // Room 3 (Seismic Research & Server Lab: X in [3.4, 10.2], Z in [0.4, 6.6])
  {
    id: "r3_server",
    roomId: "room_3",
    label: "Unanchored Mainframe Rack",
    category: "server_rack",
    x: 4.55,
    z: 1.05,
    w: 0.9,
    d: 0.58,
    h: 2.15,
    rotY: 0,
    mass: 110,
    movable: false,
    willTipInQuake: true,
    targetRotX: Math.PI * 0.45,
    targetRotZ: 0,
  },
  {
    id: "r3_bench",
    roomId: "room_3",
    label: "Steel Seismic Lab Workbench",
    category: "lab_bench",
    x: 8.15,
    z: 4.95,
    w: 1.85,
    d: 0.9,
    h: 0.82,
    rotY: 0,
    mass: 90,
    movable: false,
    willTipInQuake: false,
  },
  {
    id: "r3_cart",
    roomId: "room_3",
    label: "Lab Oscilloscope Cart (Pushable)",
    category: "cart",
    x: 5.55,
    z: 3.55,
    w: 0.75,
    d: 0.52,
    h: 0.88,
    rotY: -0.2,
    mass: 22,
    movable: true,
    willTipInQuake: false,
  },
  {
    id: "r3_crate",
    roomId: "room_3",
    label: "Equipment Crate (Pushable)",
    category: "crate",
    x: 7.45,
    z: 2.25,
    w: 0.65,
    d: 0.65,
    h: 0.58,
    rotY: 0.4,
    mass: 20,
    movable: true,
    willTipInQuake: false,
    lowObstacle: true,
  },

  // Room 4 (North Gallery Corridor & Exit Wing: X in [-10.2, 10.2], Z in [-6.6, 0.4])
  {
    id: "r4_debris_west",
    roomId: "room_4",
    label: "Fallen Masonry & Timber Obstacle",
    category: "debris",
    x: -4.1,
    z: -2.75,
    w: 1.45,
    d: 0.8,
    h: 0.48,
    rotY: 0.25,
    mass: 140,
    movable: false,
    willTipInQuake: false,
    lowObstacle: true,
  },
  {
    id: "r4_crate_mid",
    roomId: "room_4",
    label: "Archive Storage Crate (Pushable)",
    category: "crate",
    x: 1.35,
    z: -1.95,
    w: 0.72,
    d: 0.72,
    h: 0.62,
    rotY: -0.3,
    mass: 24,
    movable: true,
    willTipInQuake: false,
    lowObstacle: true,
  },
  {
    id: "r4_cart_east",
    roomId: "room_4",
    label: "Corridor Utility Cart (Pushable)",
    category: "cart",
    x: 4.4,
    z: -3.85,
    w: 0.82,
    d: 0.55,
    h: 0.85,
    rotY: 0.15,
    mass: 20,
    movable: true,
    willTipInQuake: false,
  },
  {
    id: "r4_debris_east",
    roomId: "room_4",
    label: "Collapsed Plaster Barricade",
    category: "debris",
    x: 6.85,
    z: -1.65,
    w: 1.25,
    d: 0.7,
    h: 0.45,
    rotY: -0.35,
    mass: 120,
    movable: false,
    willTipInQuake: false,
    lowObstacle: true,
  },
  {
    id: "r4_exit_door",
    roomId: "room_4",
    label: "VERIFIED STAIRWELL EXIT",
    category: "exit_door",
    x: 9.98,
    z: -3.2,
    w: 0.24,
    d: 1.65,
    h: 2.55,
    rotY: 0,
    mass: 500,
    movable: false,
    willTipInQuake: false,
  },
];

/**
 * Floating 3D Glassmorphic Telemetry Pill
 */
function TelemetrySprite({
  position,
  title,
  subtitle,
  statusColor,
  scale = [1.18, 0.28, 1],
}: {
  position: [number, number, number];
  title: string;
  subtitle: string;
  statusColor: string;
  scale?: [number, number, number];
}) {
  const tex = useMemo(
    () =>
      getGlassPillTexture({
        title,
        subtitle,
        badge: statusColor === "#ef4444" ? "RISK" : "SAFE",
        accentColor: statusColor,
      }),
    [title, subtitle, statusColor]
  );
  if (!tex) return null;
  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
}

/**
 * Ambient Sanctuary Dust Motes & Nocturnal Starfield Dome (Memory Palace Signature)
 */
function SanctuaryAtmosphere() {
  const starTex = useMemo(() => getProceduralTexture("stars"), []);
  const particlesRef = useRef<THREE.Points>(null);

  const particlePositions = useMemo(() => {
    const count = 240;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * (SUITE_W + 3);
      arr[i * 3 + 1] = 0.25 + Math.random() * 3.6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * (SUITE_D + 3);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const t = clock.getElapsedTime();
    particlesRef.current.rotation.y = t * 0.012;
    particlesRef.current.position.y = Math.sin(t * 0.45) * 0.06;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[52, 32, 32]} />
        <meshBasicMaterial
          map={starTex}
          side={THREE.BackSide}
          transparent
          opacity={0.78}
        />
      </mesh>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlePositions.length / 3}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#f8e7b0"
          size={0.042}
          transparent
          opacity={0.62}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

/**
 * Architectural Acoustic Ceiling Panel & Paired Recessed Warm-White LED Downlight Cluster (Matches the Lecture Theatre video)
 */
function MemoryPalaceChandelier({
  position,
  isShaking,
}: {
  position: [number, number, number];
  isShaking: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    if (isShaking) {
      ref.current.rotation.z = Math.sin(t * 15 + position[0]) * 0.18;
      ref.current.rotation.x = Math.cos(t * 13 + position[2]) * 0.14;
    } else {
      ref.current.rotation.z = THREE.MathUtils.lerp(
        ref.current.rotation.z,
        Math.sin(t * 1.1 + position[0]) * 0.005,
        0.1
      );
      ref.current.rotation.x = THREE.MathUtils.lerp(
        ref.current.rotation.x,
        0,
        0.1
      );
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Suspended Matte-White Acoustic Ceiling Raft */}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[1.45, 0.04, 0.85]} />
        <meshStandardMaterial color="#f5f5f3" roughness={0.65} metalness={0.05} />
      </mesh>
      {/* Paired Circular Recessed Warm-White LED Downlights (seen across the ceiling in the video) */}
      {[
        [-0.36, -0.18],
        [-0.14, -0.18],
        [0.14, 0.18],
        [0.36, 0.18],
      ].map(([dx, dz], idx) => (
        <group key={idx} position={[dx, -0.085, dz]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.045, 0.068, 20]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.045, 20]} />
            <meshStandardMaterial
              color="#fffbeb"
              emissive="#fef08a"
              emissiveIntensity={2.2}
            />
          </mesh>
        </group>
      ))}
      <pointLight
        position={[0, -0.35, 0]}
        intensity={1.15}
        distance={10.5}
        color="#fffbeb"
      />
    </group>
  );
}

/**
 * Flowing, Multi-Layered 3D Architectural Evacuation Path Model:
 * - Sculpted wide translucent energy runway ribbon flush with the floor
 * - Continuously scrolling animated procedural chevron & wave flow texture
 * - Twin raised metallic-emissive lateral edge guide rails + central harmonic spine
 * - 3D floating aerodynamic V-chevron gliders streaming smoothly along the spline
 * - Multi-ring counter-rotating destination portal beacon
 */
function OptimalPathRibbon({
  points,
  color,
  emissive,
  label,
}: {
  points: Array<[number, number, number]>;
  color: string;
  emissive: string;
  label?: string;
}) {
  const diamondRef = useRef<THREE.Mesh>(null);
  const gyroRingRef = useRef<THREE.Mesh>(null);
  const floorPortalRef = useRef<THREE.Mesh>(null);
  const chevronRefs = useRef<Array<THREE.Group | null>>([]);

  const isPrimaryRoute = points.length >= 5;
  const halfWidth = isPrimaryRoute ? 0.28 : 0.19;
  const gliderCount = isPrimaryRoute ? 12 : 4;

  // Build smooth Catmull-Rom curve, sculpted flat ribbon BufferGeometry, and twin edge rails
  const pathData = useMemo(() => {
    if (points.length < 2) return null;
    const vecs = points.map((p) => new THREE.Vector3(p[0], 0.026, p[2]));
    const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.42);
    const totalLength = curve.getLength();
    const segments = Math.max(80, points.length * 22);

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const leftRailPts: THREE.Vector3[] = [];
    const rightRailPts: THREE.Vector3[] = [];
    const centerWavePts: THREE.Vector3[] = [];

    const uvRepeatAlongPath = Math.max(2, totalLength / 0.85);

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u).normalize();
      // Horizontal perpendicular vector in XZ plane
      const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

      const lx = pt.x - perp.x * halfWidth;
      const lz = pt.z - perp.z * halfWidth;
      const rx = pt.x + perp.x * halfWidth;
      const rz = pt.z + perp.z * halfWidth;

      positions.push(lx, 0.026, lz);
      positions.push(rx, 0.026, rz);

      normals.push(0, 1, 0, 0, 1, 0);

      const uCoord = u * uvRepeatAlongPath;
      uvs.push(uCoord, 0);
      uvs.push(uCoord, 1);

      const railOffset = halfWidth * 0.88;
      leftRailPts.push(
        new THREE.Vector3(
          pt.x - perp.x * railOffset,
          0.036,
          pt.z - perp.z * railOffset
        )
      );
      rightRailPts.push(
        new THREE.Vector3(
          pt.x + perp.x * railOffset,
          0.036,
          pt.z + perp.z * railOffset
        )
      );
      centerWavePts.push(
        new THREE.Vector3(
          pt.x,
          0.044 + Math.sin(u * Math.PI * 12) * 0.008,
          pt.z
        )
      );

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const ribbonGeom = new THREE.BufferGeometry();
    ribbonGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    ribbonGeom.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    ribbonGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    ribbonGeom.setIndex(indices);

    const leftCurve = new THREE.CatmullRomCurve3(leftRailPts);
    const rightCurve = new THREE.CatmullRomCurve3(rightRailPts);
    const centerCurve = new THREE.CatmullRomCurve3(centerWavePts);

    const leftRailGeom = new THREE.TubeGeometry(
      leftCurve,
      segments,
      0.013,
      8,
      false
    );
    const rightRailGeom = new THREE.TubeGeometry(
      rightCurve,
      segments,
      0.013,
      8,
      false
    );
    const centerSpineGeom = new THREE.TubeGeometry(
      centerCurve,
      segments,
      0.018,
      10,
      false
    );

    return {
      curve,
      ribbonGeom,
      leftRailGeom,
      rightRailGeom,
      centerSpineGeom,
    };
  }, [points, halfWidth]);

  // Procedural scrolling flow texture with feathered edges, lane ticks & glowing forward chevrons
  const flowTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, 512, 256);

    // 1. Transverse energy runway gradient (feathered outer margins, glowing body)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
    bgGrad.addColorStop(0.0, "rgba(0, 0, 0, 0)");
    bgGrad.addColorStop(0.08, `${emissive}44`);
    bgGrad.addColorStop(0.15, `${color}88`);
    bgGrad.addColorStop(0.5, `${emissive}40`);
    bgGrad.addColorStop(0.85, `${color}88`);
    bgGrad.addColorStop(0.92, `${emissive}44`);
    bgGrad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 256);

    // 2. Longitudinal harmonic wave streaks
    ctx.strokeStyle = "#ffffff44";
    ctx.lineWidth = 3;
    for (const yLine of [36, 220]) {
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(0, yLine);
      ctx.lineTo(512, yLine);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Draw 2 sculpted forward-flowing chevron pulses per tile
    const drawFlowChevron = (cx: number, width: number, alpha: number) => {
      const grad = ctx.createLinearGradient(cx - width, 0, cx + width * 0.6, 0);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(0.55, `${color}`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - width * 0.55, 44);
      ctx.lineTo(cx + width * 0.15, 44);
      ctx.lineTo(cx + width * 0.65, 128);
      ctx.lineTo(cx + width * 0.15, 212);
      ctx.lineTo(cx - width * 0.55, 212);
      ctx.lineTo(cx - width * 0.05, 128);
      ctx.closePath();
      ctx.fill();
    };

    drawFlowChevron(140, 115, 0.95);
    drawFlowChevron(396, 115, 0.95);
    drawFlowChevron(268, 70, 0.55);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [color, emissive]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // Scroll the runway flow texture forward along the spline
    if (flowTexture) {
      flowTexture.offset.x -= delta * 1.45;
    }

    // Animate destination beacon crystal & gyro rings
    if (diamondRef.current) {
      diamondRef.current.rotation.y = t * 2.2;
      diamondRef.current.position.y = 0.46 + Math.sin(t * 3.2) * 0.06;
    }
    if (gyroRingRef.current) {
      gyroRingRef.current.rotation.z = -t * 1.6;
      gyroRingRef.current.rotation.x = Math.sin(t * 1.5) * 0.35;
    }
    if (floorPortalRef.current) {
      const pulse = 1 + Math.sin(t * 4.0) * 0.08;
      floorPortalRef.current.scale.set(pulse, pulse, 1);
    }

    // Animate 3D floating aerodynamic V-chevron gliders along the spline
    if (pathData) {
      const { curve } = pathData;
      for (let i = 0; i < gliderCount; i++) {
        const glider = chevronRefs.current[i];
        if (!glider) continue;
        const u = (i / gliderCount + t * 0.11) % 1;
        const pos = curve.getPointAt(u);
        const tan = curve.getTangentAt(u).normalize();
        const waveY = 0.062 + Math.sin(u * Math.PI * 8 - t * 5.0) * 0.014;
        glider.position.set(pos.x, waveY, pos.z);
        glider.rotation.set(0, Math.atan2(tan.x, tan.z), 0);

        // Smooth scale fade-in at origin and fade-out at destination portal
        const edgeFade =
          u < 0.08 ? u / 0.08 : u > 0.92 ? (1 - u) / 0.08 : 1.0;
        const s = Math.max(0.01, edgeFade * (isPrimaryRoute ? 1.0 : 0.72));
        glider.scale.set(s, s, s);
      }
    }
  });

  if (!pathData || points.length < 2) return null;
  const startPt = points[0];
  const endPt = points[points.length - 1];

  return (
    <group>
      {/* 1. Wide Sculpted Translucent Energy Runway Ribbon with Scrolling Flow Texture */}
      <mesh geometry={pathData.ribbonGeom} receiveShadow>
        <meshStandardMaterial
          map={flowTexture}
          color={color}
          emissive={emissive}
          emissiveMap={flowTexture}
          emissiveIntensity={1.35}
          roughness={0.25}
          metalness={0.35}
          transparent
          opacity={0.88}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 2. Twin Raised Metallic-Emissive Edge Guide Rails */}
      <mesh geometry={pathData.leftRailGeom}>
        <meshStandardMaterial
          color="#f8fafc"
          emissive={color}
          emissiveIntensity={1.15}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <mesh geometry={pathData.rightRailGeom}>
        <meshStandardMaterial
          color="#f8fafc"
          emissive={color}
          emissiveIntensity={1.15}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* 3. Central Harmonic Undulating Fibre-Optic Spine */}
      <mesh geometry={pathData.centerSpineGeom}>
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={1.75}
          roughness={0.15}
          metalness={0.6}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* 4. 3D Floating Aerodynamic V-Chevron Gliders Streaming Along the Path */}
      {Array.from({ length: gliderCount }).map((_, idx) => (
        <group
          key={`glider-${idx}`}
          ref={(el) => {
            chevronRefs.current[idx] = el;
          }}
        >
          {/* Left swept wing of 3D V-chevron */}
          <mesh position={[-0.068, 0, -0.04]} rotation={[0, 0.58, 0]}>
            <boxGeometry args={[0.16, 0.016, 0.042]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={color}
              emissiveIntensity={2.0}
              roughness={0.15}
              metalness={0.7}
            />
          </mesh>
          {/* Right swept wing of 3D V-chevron */}
          <mesh position={[0.068, 0, -0.04]} rotation={[0, -0.58, 0]}>
            <boxGeometry args={[0.16, 0.016, 0.042]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={color}
              emissiveIntensity={2.0}
              roughness={0.15}
              metalness={0.7}
            />
          </mesh>
        </group>
      ))}

      {/* 5. Origin Anchor Pad & Intermediate Waypoint Relay Nodes */}
      <group position={[startPt[0], 0.028, startPt[2]]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.26, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      </group>
      {points.slice(1, -1).map((pt, idx) => (
        <group key={idx} position={[pt[0], 0.028, pt[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.09, 0.13, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.55} />
          </mesh>
        </group>
      ))}

      {/* 6. Destination Harmonic Portal Beacon */}
      <group position={[endPt[0], 0, endPt[2]]}>
        {/* Pulsing concentric floor target pad */}
        <mesh
          ref={floorPortalRef}
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.24, 0.36, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
        {/* Vertical translucent light column */}
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.22, 0.28, 0.72, 24, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Counter-rotating orbital gyro ring */}
        <mesh ref={gyroRingRef} position={[0, 0.46, 0]}>
          <torusGeometry args={[0.24, 0.014, 12, 36]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={color}
            emissiveIntensity={1.8}
            metalness={0.85}
            roughness={0.15}
          />
        </mesh>
        {/* Floating core crystal */}
        <mesh ref={diamondRef} position={[0, 0.46, 0]}>
          <octahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={emissive}
            emissiveIntensity={2.1}
            metalness={0.75}
            roughness={0.12}
          />
        </mesh>
        {label && (
          <TelemetrySprite
            position={[0, 0.94, 0]}
            title={label}
            subtitle="OPTIMAL VERIFIED GOAL"
            statusColor={color}
            scale={[1.55, 0.36, 1]}
          />
        )}
      </group>
    </group>
  );
}

/**
 * 3D Visible Player Avatar (Shown when in 3D Dollhouse Orbit view, and casts shadow in 1st-person)
 */
function PlayerAvatarMesh({
  playerPosRef,
  playerYawRef,
  walkthroughActive,
  showItemLabels,
}: {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  playerYawRef: React.MutableRefObject<number>;
  walkthroughActive: boolean;
  showItemLabels: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const steelTex = useMemo(() => getItemTexture("brushed_steel"), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const p = playerPosRef.current;
    groupRef.current.position.set(p.x, p.y - 1.58, p.z);
    groupRef.current.rotation.y = playerYawRef.current;
    const t = clock.getElapsedTime();
    groupRef.current.position.y += Math.sin(t * 4) * 0.01;
  });

  // In 1st person, only render the floor footprint ring so the camera inside the head isn't occluded
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.31, 28]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>
      {!walkthroughActive && (
        <group>
          <mesh position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.22, 0.95, 16]} />
            <meshStandardMaterial
              map={steelTex}
              color="#0284c7"
              emissive="#0369a1"
              emissiveIntensity={0.35}
              roughness={0.32}
              metalness={0.45}
            />
          </mesh>
          <mesh position={[0, 1.32, 0]} castShadow>
            <sphereGeometry args={[0.17, 20, 20]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
          {/* Direction visor */}
          <mesh position={[0, 1.34, -0.14]}>
            <boxGeometry args={[0.2, 0.08, 0.08]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={1.2}
            />
          </mesh>
          {showItemLabels && (
            <TelemetrySprite
              position={[0, 1.85, 0]}
              title="YOU (PLAYER)"
              subtitle="WASD / ARROWS TO WALK"
              statusColor="#38bdf8"
              scale={[1.18, 0.28, 1]}
            />
          )}
        </group>
      )}
    </group>
  );
}

/**
 * Renders Room 1 Primary Scene Furniture using PhysicsBody coordinates & rotations
 */
function Room1FurnitureMesh({
  obj,
  allObjects,
  hazard,
  body,
  isShaking,
  hasCollapsed,
  showItemLabels,
}: {
  obj: RoomObjectNode;
  allObjects: RoomObjectNode[];
  hazard?: ObjectHazardResult;
  body?: PhysicsBody;
  isShaking: boolean;
  hasCollapsed: boolean;
  showItemLabels: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftDoorPivotRef = useRef<THREE.Group>(null);
  const rightDoorPivotRef = useRef<THREE.Group>(null);
  const tumbleBookRefs = useRef<Array<THREE.Mesh | null>>([]);
  const monitorGroupRef = useRef<THREE.Group>(null);
  const monitorAngleRef = useRef<number>(0);
  const monitorVelRef = useRef<number>(0);
  const impactRingRef = useRef<THREE.Mesh>(null);
  const rotRad = (obj.rotation_deg * Math.PI) / 180;

  // High-detail item textures & bump maps
  const walnutTex = useMemo(() => getItemTexture("walnut_wood"), []);
  const walnutBump = useMemo(() => getItemBumpMap("walnut_wood"), []);
  const oakTex = useMemo(() => getItemTexture("oak_wood"), []);
  const oakBump = useMemo(() => getItemBumpMap("oak_wood"), []);
  const velvetTex = useMemo(() => getItemTexture("tufted_velvet"), []);
  const velvetBump = useMemo(() => getItemBumpMap("tufted_velvet"), []);
  const linenTex = useMemo(() => getItemTexture("quilted_linen"), []);
  const linenBump = useMemo(() => getItemBumpMap("quilted_linen"), []);
  const steelTex = useMemo(() => getItemTexture("brushed_steel"), []);
  const steelBump = useMemo(() => getItemBumpMap("brushed_steel"), []);

  const childrenItems = useMemo(
    () => allObjects.filter((c) => c.parent_id === obj.id),
    [allObjects, obj.id]
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    if (groupRef.current && body) {
      // Apply bottom-edge hinge pivot offsets so tipping furniture pivots around its floor edge and rests ON the carpet
      groupRef.current.position.set(
        body.x + (body.pivotOffsetX ?? 0),
        body.y + (body.pivotOffsetY ?? 0),
        body.z + (body.pivotOffsetZ ?? 0)
      );
      groupRef.current.rotation.set(body.rotX, rotRad, body.rotZ);

      const tipProg = body.tipProgress ?? 0;

      // 1. Articulated Wardrobe Doors: swing/burst open on hinges as the wardrobe rocks and tips
      if (obj.category === "wardrobe") {
        const shakeWobble =
          isShaking && !body.isAnchored ? Math.sin(t * 16) * 0.12 : 0;
        const leftOpenAngle = -(tipProg * 1.65 + Math.max(0, shakeWobble));
        const rightOpenAngle = tipProg * 1.38 + Math.max(0, -shakeWobble);
        if (leftDoorPivotRef.current) {
          leftDoorPivotRef.current.rotation.y = THREE.MathUtils.lerp(
            leftDoorPivotRef.current.rotation.y,
            leftOpenAngle,
            0.22
          );
        }
        if (rightDoorPivotRef.current) {
          rightDoorPivotRef.current.rotation.y = THREE.MathUtils.lerp(
            rightDoorPivotRef.current.rotation.y,
            rightOpenAngle,
            0.22
          );
        }
      }

      // 2. Articulated Bookshelf Volumes: individual books slide out and scatter as the bookcase tips
      if (obj.category === "bookshelf") {
        for (let i = 0; i < 6; i++) {
          const bookMesh = tumbleBookRefs.current[i];
          if (!bookMesh) continue;
          const row = i < 3 ? 0 : 1;
          const col = (i % 3) - 1;
          const baseX = col * (obj.width_m * 0.25);
          const baseY = row === 0 ? 1.32 : 0.94;
          const slideOut = Math.pow(tipProg, 1.35) * (0.38 + (i % 3) * 0.16);
          const scatterX = tipProg * col * (0.14 + (i % 2) * 0.09);
          const dropY = tipProg * (0.12 + row * 0.15);
          bookMesh.position.set(
            baseX + scatterX,
            baseY - dropY,
            0.04 + slideOut
          );
          bookMesh.rotation.set(
            tipProg * (1.1 + i * 0.28),
            tipProg * (col * 0.65),
            tipProg * ((i % 2 === 0 ? 1 : -1) * 0.45)
          );
        }
      }

      // 3. Floor Impact Shockwave & Dust Halo Ring
      if (impactRingRef.current) {
        const impact = Math.max(
          body.impactIntensity ?? 0,
          tipProg > 0.92 ? 0.38 : 0
        );
        impactRingRef.current.visible = impact > 0.02;
        const scale = 0.7 + tipProg * 0.85 + (body.impactIntensity ?? 0) * 0.45;
        impactRingRef.current.scale.set(scale, scale, 1);
      }
    }

    // 4. Articulated Desk Monitor: gravitational topple + bounce onto the desk mat
    if (obj.category === "desk" && monitorGroupRef.current) {
      const shouldFall =
        Boolean(hazard?.shattered_or_fell) && (isShaking || hasCollapsed);
      if (shouldFall) {
        const grav = 3.2 + 11.5 * Math.sin(Math.max(0.15, monitorAngleRef.current));
        monitorVelRef.current += grav * dt;
        monitorAngleRef.current += monitorVelRef.current * dt;
        if (monitorAngleRef.current >= 1.42) {
          monitorAngleRef.current = 1.42;
          if (monitorVelRef.current > 0.5) {
            monitorVelRef.current = -monitorVelRef.current * 0.3;
          } else {
            monitorVelRef.current = 0;
          }
        }
      } else {
        monitorAngleRef.current = THREE.MathUtils.lerp(
          monitorAngleRef.current,
          isShaking ? Math.sin(t * 24) * 0.08 : 0,
          0.2
        );
        monitorVelRef.current = 0;
      }
      monitorGroupRef.current.rotation.x = monitorAngleRef.current;
      monitorGroupRef.current.position.z =
        -0.1 + Math.sin(Math.max(0, monitorAngleRef.current)) * 0.09;
    }
  });

  if (obj.parent_id !== null) return null;

  const sf = hazard?.analytical_safety_factor ?? 1.5;
  const isDanger = sf < 1.0 && !obj.anchored_to_wall;
  const statusColor = isDanger ? "#ef4444" : "#10b981";
  const effW =
    obj.rotation_deg === 90 || obj.rotation_deg === 270
      ? obj.depth_m
      : obj.width_m;
  const effD =
    obj.rotation_deg === 90 || obj.rotation_deg === 270
      ? obj.width_m
      : obj.depth_m;
  const initX = r1ToWorldX(obj.x_m, effW);
  const initZ = r1ToWorldZ(obj.z_m, effD);

  return (
    <group
      ref={groupRef}
      position={[body?.x ?? initX, 0, body?.z ?? initZ]}
      rotation={[0, rotRad, 0]}
    >
      {/* Memory Palace Concentric Floor Aura Rings */}
      {obj.category !== "window" && (
        <group position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry
              args={[
                Math.max(obj.width_m, obj.depth_m) * 0.46,
                Math.max(obj.width_m, obj.depth_m) * 0.51,
                32,
              ]}
            />
            <meshBasicMaterial
              color={body?.collidingWithId ? "#f59e0b" : statusColor}
              transparent
              opacity={0.45}
            />
          </mesh>
        </group>
      )}

      {/* BED (Carved Walnut Frame + Quilted Linen Mattress + Tufted Velvet Duvet & Headboard) */}
      {obj.category === "bed" && (
        <group>
          <RoundedBox
            args={[obj.width_m, 0.24, obj.depth_m]}
            radius={0.025}
            position={[0, 0.16, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={walnutTex}
              bumpMap={walnutBump}
              bumpScale={0.025}
              roughness={0.38}
              metalness={0.12}
            />
          </RoundedBox>
          <RoundedBox
            args={[obj.width_m + 0.04, 1.05, 0.12]}
            radius={0.03}
            position={[0, 0.58, -obj.depth_m / 2 + 0.06]}
            castShadow
          >
            <meshStandardMaterial
              map={velvetTex}
              bumpMap={velvetBump}
              bumpScale={0.03}
              roughness={0.55}
              metalness={0.1}
            />
          </RoundedBox>
          <RoundedBox
            args={[obj.width_m * 0.94, 0.22, obj.depth_m * 0.92]}
            radius={0.04}
            position={[0, 0.36, 0.03]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={linenTex}
              bumpMap={linenBump}
              bumpScale={0.02}
              roughness={0.62}
            />
          </RoundedBox>
          <RoundedBox
            args={[obj.width_m * 0.96, 0.21, obj.depth_m * 0.62]}
            radius={0.05}
            position={[0, 0.4, obj.depth_m * 0.14]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={velvetTex}
              bumpMap={velvetBump}
              bumpScale={0.03}
              roughness={0.52}
            />
          </RoundedBox>
          {[-0.24, 0.24].map((px, i) => (
            <RoundedBox
              key={i}
              args={[obj.width_m * 0.36, 0.11, 0.28]}
              radius={0.04}
              position={[px * obj.width_m, 0.52, -obj.depth_m * 0.32]}
              rotation={[0.15, 0, 0]}
              castShadow
            >
              <meshStandardMaterial
                map={linenTex}
                bumpMap={linenBump}
                bumpScale={0.018}
                color="#fef3c7"
                roughness={0.55}
              />
            </RoundedBox>
          ))}
        </group>
      )}

      {/* BOOKSHELF (Walnut Casework + Brass Trim + Individual Leather-Bound Volumes) */}
      {obj.category === "bookshelf" && (
        <group>
          <RoundedBox
            args={[obj.width_m, obj.height_m, obj.depth_m]}
            radius={0.02}
            position={[0, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={walnutTex}
              bumpMap={walnutBump}
              bumpScale={0.025}
              roughness={0.38}
            />
          </RoundedBox>
          {[0.1, 0.46, 0.84, 1.22, 1.58].map((sy, i) => (
            <mesh
              key={i}
              position={[0, sy, 0.02]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[obj.width_m * 0.92, 0.03, obj.depth_m]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.75}
                roughness={0.25}
              />
            </mesh>
          ))}
          {childrenItems.map((child) => {
            const isTop = child.shelf_level === "top";
            const cy = isTop ? 1.64 : 0.22;
            const tipProg = body?.tipProgress ?? 0;
            return (
              <group
                key={child.id}
                position={[
                  0,
                  cy - (isTop ? tipProg * 0.14 : 0),
                  obj.depth_m / 2 + 0.02 + (isTop ? tipProg * 0.42 : 0),
                ]}
                rotation={[isTop ? tipProg * 0.85 : 0, 0, 0]}
              >
                <RoundedBox
                  args={[obj.width_m * 0.65, 0.16, obj.depth_m * 0.85]}
                  radius={0.01}
                  castShadow
                >
                  <meshStandardMaterial
                    map={velvetTex}
                    bumpMap={velvetBump}
                    bumpScale={0.02}
                    color={isTop ? "#dc2626" : "#059669"}
                    roughness={0.42}
                  />
                </RoundedBox>
                {showItemLabels && (
                  <TelemetrySprite
                    position={[0, 0.26, 0.08]}
                    title={`${child.mass_kg}kg BOOKS (${child.shelf_level?.toUpperCase()})`}
                    subtitle={
                      isTop ? "TOP-HEAVY OVERTURN RISK" : "LOW BALLAST STABLE"
                    }
                    statusColor={isTop ? "#ef4444" : "#10b981"}
                    scale={[1.1, 0.26, 1]}
                  />
                )}
              </group>
            );
          })}
          {/* Individual Volumes & Binders that Slide Out and Tumble During Overturning */}
          {[
            "#1e40af",
            "#991b1b",
            "#065f46",
            "#92400e",
            "#3730a3",
            "#b45309",
          ].map((bookCol, bIdx) => (
            <mesh
              key={`tumble-book-${bIdx}`}
              ref={(el) => {
                tumbleBookRefs.current[bIdx] = el;
              }}
              position={[
                ((bIdx % 3) - 1) * (obj.width_m * 0.25),
                bIdx < 3 ? 1.32 : 0.94,
                0.04,
              ]}
              castShadow
            >
              <boxGeometry args={[0.14, 0.21, 0.22]} />
              <meshStandardMaterial
                color={bookCol}
                roughness={0.48}
                metalness={0.12}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* WARDROBE (Warm Honey-Oak / Beech Veneer Hinged Doors + Interior Rail + Brushed Stainless Handles) */}
      {obj.category === "wardrobe" && (
        <group>
          {/* Main Wardrobe Cabinet Carcass */}
          <RoundedBox
            args={[obj.width_m, obj.height_m, obj.depth_m]}
            radius={0.025}
            position={[0, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={walnutTex}
              bumpMap={walnutBump}
              bumpScale={0.025}
              roughness={0.38}
              metalness={0.08}
            />
          </RoundedBox>
          {/* Dark Recessed Wardrobe Interior Cavity + Chrome Hanging Rail (visible when doors swing open during fall) */}
          <mesh position={[0, obj.height_m * 0.5, obj.depth_m / 2 - 0.015]}>
            <planeGeometry args={[obj.width_m * 0.88, obj.height_m * 0.86]} />
            <meshStandardMaterial color="#1e1b18" roughness={0.85} />
          </mesh>
          <mesh
            position={[0, obj.height_m * 0.78, obj.depth_m / 2 - 0.04]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.012, 0.012, obj.width_m * 0.84, 10]} />
            <meshStandardMaterial
              color="#cbd5e1"
              metalness={0.9}
              roughness={0.18}
            />
          </mesh>
          {/* Left Hinged Door Leaf (pivots around outer left edge [-obj.width_m * 0.45]) */}
          <group
            ref={leftDoorPivotRef}
            position={[
              -obj.width_m * 0.45,
              obj.height_m * 0.5,
              obj.depth_m / 2 + 0.008,
            ]}
          >
            <RoundedBox
              args={[obj.width_m * 0.43, obj.height_m * 0.86, 0.026]}
              radius={0.01}
              position={[obj.width_m * 0.215, 0, 0]}
              castShadow
            >
              <meshStandardMaterial
                map={walnutTex}
                bumpMap={walnutBump}
                bumpScale={0.02}
                roughness={0.34}
              />
            </RoundedBox>
            <mesh position={[obj.width_m * 0.39, 0.02, 0.024]}>
              <cylinderGeometry args={[0.012, 0.012, 0.32, 12]} />
              <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.88}
                roughness={0.18}
              />
            </mesh>
          </group>
          {/* Right Hinged Door Leaf (pivots around outer right edge [+obj.width_m * 0.45]) */}
          <group
            ref={rightDoorPivotRef}
            position={[
              obj.width_m * 0.45,
              obj.height_m * 0.5,
              obj.depth_m / 2 + 0.008,
            ]}
          >
            <RoundedBox
              args={[obj.width_m * 0.43, obj.height_m * 0.86, 0.026]}
              radius={0.01}
              position={[-obj.width_m * 0.215, 0, 0]}
              castShadow
            >
              <meshStandardMaterial
                map={walnutTex}
                bumpMap={walnutBump}
                bumpScale={0.02}
                roughness={0.34}
              />
            </RoundedBox>
            <mesh position={[-obj.width_m * 0.39, 0.02, 0.024]}>
              <cylinderGeometry args={[0.012, 0.012, 0.32, 12]} />
              <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.88}
                roughness={0.18}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* DESK (Light-Grey Matte Laminate Bench Top + Dark Charcoal Edge + Silver Aluminum Legs) */}
      {obj.category === "desk" && (
        <group>
          <RoundedBox
            args={[obj.width_m, 0.06, obj.depth_m]}
            radius={0.015}
            position={[0, obj.height_m, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={oakTex}
              bumpMap={oakBump}
              bumpScale={0.018}
              roughness={0.35}
              metalness={0.08}
            />
          </RoundedBox>
          {/* Silver Anodized Modesty Panel (like the lecture benches in the video) */}
          <mesh
            position={[0, obj.height_m - 0.22, -obj.depth_m / 2 + 0.04]}
            castShadow
          >
            <boxGeometry args={[obj.width_m - 0.12, 0.38, 0.025]} />
            <meshStandardMaterial
              map={steelTex}
              color="#cbd5e1"
              roughness={0.4}
              metalness={0.45}
            />
          </mesh>
          {/* Silver Laptop / Keyboard Mat */}
          <RoundedBox
            args={[0.38, 0.014, 0.25]}
            radius={0.005}
            position={[0, obj.height_m + 0.035, 0.14]}
            castShadow
          >
            <meshStandardMaterial
              map={steelTex}
              bumpMap={steelBump}
              bumpScale={0.012}
              color="#e2e8f0"
              roughness={0.28}
              metalness={0.75}
            />
          </RoundedBox>
          {[
            [-obj.width_m / 2 + 0.06, -obj.depth_m / 2 + 0.06],
            [obj.width_m / 2 - 0.06, -obj.depth_m / 2 + 0.06],
            [-obj.width_m / 2 + 0.06, obj.depth_m / 2 - 0.06],
            [obj.width_m / 2 - 0.06, obj.depth_m / 2 - 0.06],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, obj.height_m / 2, lz]} castShadow>
              <cylinderGeometry args={[0.028, 0.024, obj.height_m, 12]} />
              <meshStandardMaterial
                color="#94a3b8"
                metalness={0.75}
                roughness={0.25}
              />
            </mesh>
          ))}
          {childrenItems.map((child) => {
            const tipped =
              hazard?.shattered_or_fell && (isShaking || hasCollapsed);
            return (
              <group
                key={child.id}
                ref={monitorGroupRef}
                position={[0, obj.height_m + 0.03, -0.1]}
              >
                <RoundedBox
                  args={[0.54, 0.34, 0.025]}
                  radius={0.01}
                  position={[0, 0.24, 0]}
                  castShadow
                >
                  <meshStandardMaterial
                    map={steelTex}
                    bumpMap={steelBump}
                    bumpScale={0.015}
                    roughness={0.25}
                    metalness={0.8}
                  />
                </RoundedBox>
                <mesh position={[0, 0.24, 0.015]}>
                  <planeGeometry args={[0.5, 0.3]} />
                  <meshStandardMaterial
                    color={tipped ? "#1e1b4b" : "#0f172a"}
                    emissive={tipped ? "#dc2626" : "#1e3a8a"}
                    emissiveIntensity={tipped ? 0.75 : 0.45}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Floor Impact Dust & Shockwave Halo for Falling Tall Furniture */}
      <mesh
        ref={impactRingRef}
        visible={false}
        position={[0, 0.04, obj.depth_m * 0.65]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.35, 0.78, 32]} />
        <meshBasicMaterial
          color="#cbd5e1"
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>

      {/* CHAIR (Imperial Royal Cobalt Blue Woven Fabric Upholstery + Dark Charcoal Pedestal) */}
      {obj.category === "chair" && (
        <group>
          <RoundedBox
            args={[0.48, 0.07, 0.46]}
            radius={0.025}
            position={[0, 0.45, 0]}
            castShadow
          >
            <meshStandardMaterial
              map={velvetTex}
              bumpMap={velvetBump}
              bumpScale={0.022}
              roughness={0.55}
            />
          </RoundedBox>
          <RoundedBox
            args={[0.46, 0.48, 0.06]}
            radius={0.025}
            position={[0, 0.71, -0.2]}
            castShadow
          >
            <meshStandardMaterial
              map={velvetTex}
              bumpMap={velvetBump}
              bumpScale={0.022}
              roughness={0.55}
            />
          </RoundedBox>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.42, 12]} />
            <meshStandardMaterial
              color="#334155"
              metalness={0.75}
              roughness={0.28}
            />
          </mesh>
        </group>
      )}

      {/* WINDOW */}
      {obj.category === "window" && (
        <group position={[0, 1.48, 0]}>
          <mesh>
            <boxGeometry
              args={[obj.width_m + 0.1, obj.height_m + 0.1, obj.depth_m + 0.05]}
            />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.75}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[obj.width_m, obj.height_m, 0.03]} />
            <meshStandardMaterial
              color={
                hazard?.shattered_or_fell && (isShaking || hasCollapsed)
                  ? "#ef4444"
                  : "#38bdf8"
              }
              emissive={
                hazard?.shattered_or_fell && (isShaking || hasCollapsed)
                  ? "#dc2626"
                  : "#0284c7"
              }
              emissiveIntensity={0.45}
              transparent
              opacity={0.55}
            />
          </mesh>
        </group>
      )}

      {/* Floating 3D Glass Telemetry Badge (Only shown when enabled via Menu) */}
      {showItemLabels && obj.category !== "chair" && (
        <TelemetrySprite
          position={[0, Math.max(obj.height_m, 1.0) + 0.36, 0]}
          title={`${obj.label.toUpperCase()} (${obj.mass_kg}kg)`}
          subtitle={`SF: ${sf} • ${
            body?.movable ? "PUSHABLE • " : ""
          }${isDanger ? "TIPPING HAZARD" : "STABLE"}`}
          statusColor={statusColor}
        />
      )}
    </group>
  );
}

/**
 * Renders Suite Furniture & Obstacles in Rooms 2, 3, and 4 using PhysicsBody state + rich procedural textures
 */
function ExtraSuiteObjectMesh({
  item,
  body,
  showItemLabels,
}: {
  item: ExtraSuiteObject;
  body?: PhysicsBody;
  showItemLabels: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const drawerRefs = useRef<(THREE.Group | null)[]>([]);
  const impactRingRef = useRef<THREE.Mesh>(null);

  // Rich tactile procedural textures & bump maps for Rooms 2, 3, and 4 items
  const walnutTex = useMemo(() => getItemTexture("walnut_wood"), []);
  const walnutBump = useMemo(() => getItemBumpMap("walnut_wood"), []);
  const oakTex = useMemo(() => getItemTexture("oak_wood"), []);
  const oakBump = useMemo(() => getItemBumpMap("oak_wood"), []);
  const velvetTex = useMemo(() => getItemTexture("tufted_velvet"), []);
  const velvetBump = useMemo(() => getItemBumpMap("tufted_velvet"), []);
  const steelTex = useMemo(() => getItemTexture("brushed_steel"), []);
  const steelBump = useMemo(() => getItemBumpMap("brushed_steel"), []);
  const crateTex = useMemo(() => getItemTexture("weathered_crate"), []);
  const crateBump = useMemo(() => getItemBumpMap("weathered_crate"), []);
  const rubbleTex = useMemo(() => getItemTexture("fractured_rubble"), []);
  const rubbleBump = useMemo(() => getItemBumpMap("fractured_rubble"), []);

  useFrame((state) => {
    if (!groupRef.current || !body) return;
    const t = state.clock.elapsedTime;
    // Apply bottom-edge hinge pivot translation so overturning cabinets/server racks rest flush on the floor
    groupRef.current.position.set(
      body.x + (body.pivotOffsetX ?? 0),
      body.y + (body.pivotOffsetY ?? 0),
      body.z + (body.pivotOffsetZ ?? 0)
    );
    groupRef.current.rotation.set(body.rotX, item.rotY, body.rotZ);

    const tipProg = body.tipProgress ?? 0;
    const imp = body.impactIntensity ?? 0;
    if (item.category === "cabinet" || item.category === "server_rack") {
      const drawerHeights = [0.4, 0.85, 1.3, 1.75];
      for (let i = 0; i < 4; i++) {
        const dGroup = drawerRefs.current[i];
        if (!dGroup) continue;
        const slideDelay = 0.08 + i * 0.09;
        const slideProg = Math.min(1, Math.max(0, (tipProg - slideDelay) / 0.55));
        const easeOut = 1 - Math.pow(1 - slideProg, 2.2);
        const maxSlide = 0.24 + (i % 2) * 0.14;
        const bounceJolt = imp * 0.035 * Math.sin(t * 28 + i * 2);
        dGroup.position.set(
          0,
          drawerHeights[i],
          easeOut * maxSlide + bounceJolt
        );
        dGroup.rotation.x = easeOut * 0.12 * (i % 2 === 0 ? 1 : 0.6);
      }
    }

    if (impactRingRef.current) {
      impactRingRef.current.visible = imp > 0.02;
      const scale = 1.0 + (1.0 - imp) * 1.45;
      impactRingRef.current.scale.set(scale, scale, 1);
      const mat = impactRingRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = imp * 0.65;
      }
    }
  });

  const statusColor = item.willTipInQuake
    ? "#ef4444"
    : item.category === "exit_door" ||
      item.category === "table" ||
      item.category === "lab_bench"
    ? "#10b981"
    : item.movable
    ? "#38bdf8"
    : "#f59e0b";

  return (
    <group
      ref={groupRef}
      position={[body?.x ?? item.x, 0, body?.z ?? item.z]}
      rotation={[0, item.rotY, 0]}
    >
      {/* Floor Aura Ring */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[
            Math.max(item.w, item.d) * 0.45,
            Math.max(item.w, item.d) * 0.51,
            28,
          ]}
        />
        <meshBasicMaterial
          color={body?.collidingWithId ? "#fbbf24" : statusColor}
          transparent
          opacity={0.45}
        />
      </mesh>

      {item.category === "sofa" && (
        <group>
          <RoundedBox
            args={[item.w, 0.38, item.d]}
            radius={0.04}
            position={[0, 0.22, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={velvetTex}
              bumpMap={velvetBump}
              bumpScale={0.032}
              roughness={0.55}
            />
          </RoundedBox>
          <RoundedBox
            args={[item.w, 0.55, 0.22]}
            radius={0.04}
            position={[0, 0.58, -item.d / 2 + 0.11]}
            castShadow
          >
            <meshStandardMaterial
              map={velvetTex}
              bumpMap={velvetBump}
              bumpScale={0.035}
              roughness={0.52}
            />
          </RoundedBox>
          {[-item.w / 2 + 0.12, item.w / 2 - 0.12].map((ax, idx) => (
            <RoundedBox
              key={idx}
              args={[0.24, 0.52, item.d]}
              radius={0.04}
              position={[ax, 0.42, 0]}
              castShadow
            >
              <meshStandardMaterial
                map={velvetTex}
                bumpMap={velvetBump}
                bumpScale={0.03}
                roughness={0.52}
              />
            </RoundedBox>
          ))}
        </group>
      )}

      {(item.category === "table" || item.category === "lab_bench") && (
        <group>
          <RoundedBox
            args={[item.w, 0.065, item.d]}
            radius={0.015}
            position={[0, item.h, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={item.category === "lab_bench" ? steelTex : oakTex}
              bumpMap={item.category === "lab_bench" ? steelBump : oakBump}
              bumpScale={0.024}
              roughness={0.32}
              metalness={item.category === "lab_bench" ? 0.65 : 0.15}
            />
          </RoundedBox>
          {[
            [-item.w / 2 + 0.08, -item.d / 2 + 0.08],
            [item.w / 2 - 0.08, -item.d / 2 + 0.08],
            [-item.w / 2 + 0.08, item.d / 2 - 0.08],
            [item.w / 2 - 0.08, item.d / 2 - 0.08],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, item.h / 2, lz]} castShadow>
              <cylinderGeometry args={[0.035, 0.03, item.h, 12]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>
      )}

      {(item.category === "cabinet" || item.category === "server_rack") && (
        <group>
          <RoundedBox
            args={[item.w, item.h, item.d]}
            radius={0.02}
            position={[0, item.h / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={item.category === "server_rack" ? steelTex : walnutTex}
              bumpMap={item.category === "server_rack" ? steelBump : walnutBump}
              bumpScale={0.025}
              metalness={item.category === "server_rack" ? 0.78 : 0.18}
              roughness={0.32}
            />
          </RoundedBox>
          {/* Articulated sliding drawers / server rack blades that eject outward as the unit tips */}
          {[0.4, 0.85, 1.3, 1.75].map((ly, idx) => (
            <group
              key={idx}
              ref={(el) => {
                drawerRefs.current[idx] = el;
              }}
              position={[0, ly, 0]}
            >
              <RoundedBox
                args={[item.w * 0.86, 0.28, item.d * 0.88]}
                radius={0.012}
                position={[0, 0, 0.03]}
                castShadow
              >
                <meshStandardMaterial
                  map={item.category === "server_rack" ? steelTex : oakTex}
                  bumpMap={
                    item.category === "server_rack" ? steelBump : oakBump
                  }
                  bumpScale={0.02}
                  metalness={item.category === "server_rack" ? 0.82 : 0.15}
                  roughness={0.3}
                />
              </RoundedBox>
              <mesh position={[0, 0, item.d / 2 + 0.015]}>
                <planeGeometry args={[item.w * 0.8, 0.08]} />
                <meshStandardMaterial
                  color={item.category === "server_rack" ? "#38bdf8" : "#fde68a"}
                  emissive={
                    item.category === "server_rack" ? "#0284c7" : "#d4af37"
                  }
                  emissiveIntensity={0.8}
                />
              </mesh>
            </group>
          ))}
          {/* Floor Impact Shockwave Halo when cabinet/server rack slams into floor */}
          <mesh
            ref={impactRingRef}
            position={[0, item.h * 0.5, item.d / 2 + 0.02]}
            visible={false}
          >
            <ringGeometry
              args={[
                Math.max(item.w, item.h) * 0.35,
                Math.max(item.w, item.h) * 0.56,
                32,
              ]}
            />
            <meshBasicMaterial
              color="#f97316"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {(item.category === "cart" || item.category === "chair") && (
        <group>
          <RoundedBox
            args={[item.w, 0.05, item.d]}
            radius={0.015}
            position={[0, item.h * 0.55, 0]}
            castShadow
          >
            <meshStandardMaterial
              map={oakTex}
              bumpMap={oakBump}
              bumpScale={0.02}
              color="#d4af37"
              metalness={0.65}
              roughness={0.25}
            />
          </RoundedBox>
          <RoundedBox
            args={[item.w, 0.05, item.d]}
            radius={0.015}
            position={[0, item.h * 0.92, 0]}
            castShadow
          >
            <meshStandardMaterial
              map={steelTex}
              bumpMap={steelBump}
              bumpScale={0.02}
              metalness={0.65}
              roughness={0.28}
            />
          </RoundedBox>
          {[
            [-item.w / 2 + 0.05, -item.d / 2 + 0.05],
            [item.w / 2 - 0.05, -item.d / 2 + 0.05],
            [-item.w / 2 + 0.05, item.d / 2 - 0.05],
            [item.w / 2 - 0.05, item.d / 2 - 0.05],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, item.h * 0.46, lz]} castShadow>
              <cylinderGeometry args={[0.018, 0.018, item.h * 0.9, 10]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>
      )}

      {(item.category === "crate" || item.category === "debris") && (
        <group>
          <RoundedBox
            args={[item.w, item.h, item.d]}
            radius={0.02}
            position={[0, item.h / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={item.category === "debris" ? rubbleTex : crateTex}
              bumpMap={item.category === "debris" ? rubbleBump : crateBump}
              bumpScale={0.035}
              roughness={0.68}
            />
          </RoundedBox>
          {item.category === "debris" && (
            <mesh
              position={[0.1, item.h + 0.06, -0.05]}
              rotation={[0.2, 0.4, -0.25]}
              castShadow
            >
              <boxGeometry args={[item.w * 0.85, 0.14, 0.22]} />
              <meshStandardMaterial
                map={walnutTex}
                bumpMap={walnutBump}
                bumpScale={0.025}
                roughness={0.55}
              />
            </mesh>
          )}
        </group>
      )}

      {item.category === "exit_door" && (
        <group>
          {/* Imperial Royal Cobalt Blue Double Door Leaf (matches 00:00 & 00:06 of the video) */}
          <RoundedBox
            args={[item.w, item.h, item.d]}
            radius={0.02}
            position={[0, item.h / 2, 0]}
            castShadow
          >
            <meshStandardMaterial
              map={velvetTex}
              bumpMap={velvetBump}
              bumpScale={0.015}
              color="#25478a"
              metalness={0.18}
              roughness={0.38}
            />
          </RoundedBox>
          {/* Brushed Stainless-Steel Vertical Push/Pull Handle Bar */}
          <mesh position={[-item.w / 2 - 0.03, item.h * 0.48, 0.18]}>
            <cylinderGeometry args={[0.018, 0.018, 0.58, 12]} />
            <meshStandardMaterial
              color="#e2e8f0"
              metalness={0.92}
              roughness={0.15}
            />
          </mesh>
          {/* White Notice Sign on Blue Door ("Filming and photography are taking place") */}
          <mesh
            position={[-item.w / 2 - 0.015, item.h * 0.56, -0.28]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.32, 0.44]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          {/* Glowing Green & White Running-Man EXIT Sign Box Above Doorway */}
          <mesh position={[-0.08, item.h + 0.22, 0]}>
            <boxGeometry args={[0.08, 0.24, 0.72]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={1.6}
            />
          </mesh>
        </group>
      )}

      {showItemLabels && (
        <TelemetrySprite
          position={[0, item.h + 0.34, 0]}
          title={item.label.toUpperCase()}
          subtitle={
            item.movable
              ? "COLLISION ACTIVE • WALK INTO TO PUSH"
              : item.lowObstacle
              ? "OBSTACLE • WALK AROUND OR SPACE TO JUMP"
              : item.willTipInQuake
              ? "UNANCHORED • TOPPLES IN QUAKE"
              : "SOLID STRUCTURAL ELEMENT"
          }
          statusColor={statusColor}
          scale={[1.18, 0.28, 1]}
        />
      )}
    </group>
  );
}

/**
 * Multi-Room Suite Scene + Real-Time Collision Physics + Player Controller
 */
function MultiRoomSanctuaryScene({
  scene,
  evaluation,
  isShaking,
  hasCollapsed,
  walkthroughActive,
  floorMaterial = "wood",
  teleportRoomId,
  playerResetCounter,
  showItemLabels = false,
  onHudUpdate,
}: {
  scene: RoomSceneGraph;
  evaluation: EgressAndShelterResult;
  isShaking: boolean;
  hasCollapsed: boolean;
  walkthroughActive: boolean;
  floorMaterial: TextureStyle;
  teleportRoomId?: string | null;
  playerResetCounter?: number;
  showItemLabels?: boolean;
  onHudUpdate: (info: {
    roomName: string;
    collidedWith: string | null;
    pushedObject: string | null;
    distToExitM: number;
  }) => void;
}) {
  const { camera, gl } = useThree();
  const suiteGroupRef = useRef<THREE.Group>(null);

  // Procedural Memory Palace Textures & Bump Maps
  const floorTex = useMemo(
    () => getProceduralTexture(floorMaterial),
    [floorMaterial]
  );
  const floorBump = useMemo(
    () => getProceduralBumpMap(floorMaterial),
    [floorMaterial]
  );
  const marbleTex = useMemo(() => getProceduralTexture("marble"), []);
  const stoneTex = useMemo(() => getProceduralTexture("stone"), []);
  const stoneBump = useMemo(() => getProceduralBumpMap("stone"), []);
  const woodTex = useMemo(() => getProceduralTexture("wood"), []);
  const woodBump = useMemo(() => getProceduralBumpMap("wood"), []);
  const carpetTex = useMemo(() => getProceduralTexture("carpet"), []);
  const cyberTex = useMemo(() => getProceduralTexture("cyber"), []);

  const hazardMap = useMemo(() => {
    const map = new Map<string, ObjectHazardResult>();
    for (const r of evaluation.object_results) {
      map.set(r.object_id, r);
    }
    return map;
  }, [evaluation.object_results]);

  // Build mutable physics bodies for ALL furniture & obstacles across all 4 rooms
  const physicsBodiesRef = useRef<PhysicsBody[]>([]);

  useEffect(() => {
    const bodies: PhysicsBody[] = [];

    // 1. Room 1 Objects (from `scene.objects`)
    for (const obj of scene.objects) {
      if (obj.parent_id !== null || obj.category === "window") continue;
      const isRot = obj.rotation_deg === 90 || obj.rotation_deg === 270;
      const effW = isRot ? obj.depth_m : obj.width_m;
      const effD = isRot ? obj.width_m : obj.depth_m;
      const wx = r1ToWorldX(obj.x_m, effW);
      const wz = r1ToWorldZ(obj.z_m, effD);
      const haz = hazardMap.get(obj.id);
      const willTip = Boolean(haz?.tipped_over && !obj.anchored_to_wall);

      bodies.push({
        id: obj.id,
        label: obj.label,
        category: obj.category,
        x: wx,
        y: 0,
        z: wz,
        halfW: effW / 2,
        halfD: effD / 2,
        height: obj.height_m,
        currHalfW: effW / 2,
        currHalfD: effD / 2,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotZ: 0,
        rotY: (obj.rotation_deg * Math.PI) / 180,
        angVelX: 0,
        angVelZ: 0,
        targetRotX:
          obj.category === "wardrobe" ? 0 : willTip ? Math.PI * 0.44 : 0,
        targetRotZ:
          obj.category === "wardrobe" && willTip ? -Math.PI * 0.44 : 0,
        willTip,
        isAnchored: obj.anchored_to_wall,
        movable: obj.category === "chair" || obj.mass_kg <= 25,
        mass: obj.mass_kg,
        friction: 0.55,
        restitution: 0.25,
        collidingWithId: null,
      });
    }

    // 2. Extra Suite Objects in Rooms 2, 3, 4
    const isRemediated = evaluation.survivable;
    for (const item of EXTRA_SUITE_OBJECTS) {
      bodies.push({
        id: item.id,
        label: item.label,
        category: item.category,
        x: item.x,
        y: 0,
        z: item.z,
        halfW: item.w / 2,
        halfD: item.d / 2,
        height: item.h,
        currHalfW: item.w / 2,
        currHalfD: item.d / 2,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotZ: 0,
        rotY: item.rotY,
        angVelX: 0,
        angVelZ: 0,
        targetRotX: item.targetRotX ?? 0,
        targetRotZ: item.targetRotZ ?? 0,
        willTip: item.willTipInQuake && !isRemediated,
        isAnchored: isRemediated && item.willTipInQuake,
        movable: item.movable,
        lowObstacle: item.lowObstacle,
        mass: item.mass,
        friction: 0.5,
        restitution: 0.3,
        collidingWithId: null,
      });
    }

    physicsBodiesRef.current = bodies;
  }, [scene, hazardMap]);

  // Player state (World coordinates)
  const playerPosRef = useRef<THREE.Vector3>(
    new THREE.Vector3(-8.2, 1.58, 5.1)
  );
  const playerYawRef = useRef<number>(-0.65);
  const playerPitchRef = useRef<number>(-0.08);
  const playerVelYRef = useRef<number>(0);
  const isJumpingRef = useRef<boolean>(false);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const isDraggingRef = useRef<boolean>(false);
  const lastHudSyncRef = useRef<number>(0);

  // Handle teleport / reset requests
  useEffect(() => {
    const targetRoom =
      SUITE_ROOMS.find((r) => r.id === teleportRoomId) || SUITE_ROOMS[0];
    playerPosRef.current.set(targetRoom.spawnX, 1.58, targetRoom.spawnZ);
    playerYawRef.current = targetRoom.yaw;
    playerPitchRef.current = -0.08;
  }, [teleportRoomId, playerResetCounter]);

  // Keyboard & Mouse Look Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore movement keys if typing in an input or search bar
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      keysRef.current[e.code] = true;
      if (e.code === "Space" && !isJumpingRef.current) {
        isJumpingRef.current = true;
        playerVelYRef.current = 3.8;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    const dom = gl.domElement;
    const onPointerDown = () => {
      isDraggingRef.current = true;
    };
    const onPointerUp = () => {
      isDraggingRef.current = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!walkthroughActive || !isDraggingRef.current) return;
      playerYawRef.current -= e.movementX * 0.0042;
      playerPitchRef.current = THREE.MathUtils.clamp(
        playerPitchRef.current - e.movementY * 0.0035,
        -0.8,
        0.7
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [walkthroughActive, gl.domElement]);

  // Switch camera when toggling between 1st-Person and 3D Dollhouse Orbit
  useEffect(() => {
    if (!walkthroughActive) {
      camera.position.set(0, 15.8, 16.5);
      camera.lookAt(0, 0, 0);
    }
  }, [walkthroughActive, camera]);

  // Main Physics & Player Movement Loop
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    // 1. Whole-suite seismic ground motion during active shaking
    if (suiteGroupRef.current) {
      if (isShaking) {
        const amp = (scene.earthquake.magnitude_mw * 0.065) * 0.14;
        suiteGroupRef.current.position.x =
          Math.sin(t * 28) * Math.cos(t * 11) * amp;
        suiteGroupRef.current.position.z =
          Math.cos(t * 23) * Math.sin(t * 15) * amp;
      } else {
        suiteGroupRef.current.position.x = THREE.MathUtils.lerp(
          suiteGroupRef.current.position.x,
          0,
          0.2
        );
        suiteGroupRef.current.position.z = THREE.MathUtils.lerp(
          suiteGroupRef.current.position.z,
          0,
          0.2
        );
      }
    }

    // 2. Step Object-to-Object & Seismic Tipping Physics
    stepObjectPhysics(
      physicsBodiesRef.current,
      SUITE_WALLS,
      dt,
      isShaking,
      hasCollapsed,
      scene.earthquake.magnitude_mw * 0.065,
      t
    );

    // 3. Player Movement (WASD / Arrow Keys work in BOTH 1st-Person and 3D Orbit!)
    const isSprinting =
      keysRef.current["ShiftLeft"] || keysRef.current["ShiftRight"];
    const speed = (isSprinting ? 4.4 : 2.65) * dt;

    if (keysRef.current["KeyQ"]) playerYawRef.current += 1.8 * dt;
    if (keysRef.current["KeyE"]) playerYawRef.current -= 1.8 * dt;

    const forward = new THREE.Vector3(
      -Math.sin(playerYawRef.current),
      0,
      -Math.cos(playerYawRef.current)
    ).normalize();
    const right = new THREE.Vector3().crossVectors(
      forward,
      new THREE.Vector3(0, 1, 0)
    );

    if (keysRef.current["KeyW"] || keysRef.current["ArrowUp"]) {
      playerPosRef.current.addScaledVector(forward, speed);
    }
    if (keysRef.current["KeyS"] || keysRef.current["ArrowDown"]) {
      playerPosRef.current.addScaledVector(forward, -speed);
    }
    if (keysRef.current["KeyA"] || keysRef.current["ArrowLeft"]) {
      playerPosRef.current.addScaledVector(right, -speed);
    }
    if (keysRef.current["KeyD"] || keysRef.current["ArrowRight"]) {
      playerPosRef.current.addScaledVector(right, speed);
    }

    // Jump physics (for stepping over low debris obstacles)
    if (isJumpingRef.current) {
      playerPosRef.current.y += playerVelYRef.current * dt;
      playerVelYRef.current -= 9.81 * dt;
      if (playerPosRef.current.y <= 1.58) {
        playerPosRef.current.y = 1.58;
        playerVelYRef.current = 0;
        isJumpingRef.current = false;
      }
    }

    // 4. Resolve Player Capsule vs All Walls & Furniture/Obstacles
    const { collidedObjectLabel, pushedObjectLabel } = resolvePlayerCollisions(
      playerPosRef.current,
      0.27,
      isJumpingRef.current,
      SUITE_WALLS,
      physicsBodiesRef.current
    );

    // Clamp inside outer suite perimeter
    playerPosRef.current.x = THREE.MathUtils.clamp(
      playerPosRef.current.x,
      -SUITE_W / 2 + 0.35,
      SUITE_W / 2 - 0.35
    );
    playerPosRef.current.z = THREE.MathUtils.clamp(
      playerPosRef.current.z,
      -SUITE_D / 2 + 0.35,
      SUITE_D / 2 - 0.35
    );

    // 5. Update Camera in 1st-Person Walkthrough Mode
    if (walkthroughActive) {
      camera.position.copy(playerPosRef.current);
      const lookDir = new THREE.Vector3(
        -Math.sin(playerYawRef.current) * Math.cos(playerPitchRef.current),
        Math.sin(playerPitchRef.current),
        -Math.cos(playerYawRef.current) * Math.cos(playerPitchRef.current)
      );
      const target = camera.position.clone().add(lookDir.multiplyScalar(4));
      camera.lookAt(target);
    }

    // 6. Throttled HUD telemetry update (every ~120ms)
    if (t - lastHudSyncRef.current > 0.12) {
      lastHudSyncRef.current = t;
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      const activeRoom =
        SUITE_ROOMS.find(
          (r) =>
            px >= r.bounds.minX &&
            px <= r.bounds.maxX &&
            pz >= r.bounds.minZ &&
            pz <= r.bounds.maxZ
        ) || SUITE_ROOMS[0];
      const distToExitM = Math.hypot(px - 9.8, pz - -3.2);
      onHudUpdate({
        roomName: activeRoom.name,
        collidedWith: collidedObjectLabel,
        pushedObject: pushedObjectLabel,
        distToExitM: Number(distToExitM.toFixed(1)),
      });
    }
  });

  // Optimal multi-room path waypoints (from Room 1 -> Doorway 1-2 -> Room 2 around obstacles -> Doorway 2-4 -> North Gallery -> Emergency Exit)
  const optimalMultiRoomPath = useMemo<Array<[number, number, number]>>(
    () => [
      [-8.2, 0.08, 5.1], // Start in Room 1 (Student Bedroom)
      [-5.6, 0.08, 3.85], // Clear Room 1 desk/shelter
      [-3.4, 0.08, 3.475], // Through Doorway 1 -> 2
      [-1.8, 0.08, 4.35], // Navigate around Room 2 cabinet fall zone
      [-0.1, 0.08, 2.35], // Past Room 2 Shelter Table
      [0.0, 0.08, 0.4], // Through Gallery Arch Doorway 2 -> 4
      [0.0, 0.08, -3.15], // Enter North Gallery Corridor
      [3.2, 0.08, -2.75], // Slalom around Archive Crate & Utility Cart
      [6.9, 0.08, -3.45], // Bypass Collapsed Plaster Barricade
      [9.7, 0.08, -3.2], // Arrive at Verified Emergency Stairwell Exit
    ],
    []
  );

  // Branch path to Room 1 Drop-Cover-Hold-On Shelter Spot
  const shelterBranchPath = useMemo<Array<[number, number, number]>>(() => {
    if (!evaluation.safe_shelter_spot_m) return [];
    return [
      [-8.2, 0.09, 5.1],
      [-7.1, 0.09, 4.4],
      [
        R1_ORIGIN_X + evaluation.safe_shelter_spot_m.x_m * R1_SCALE_X,
        0.09,
        R1_ORIGIN_Z + evaluation.safe_shelter_spot_m.z_m * R1_SCALE_Z,
      ],
    ];
  }, [evaluation.safe_shelter_spot_m]);

  // Trigger periodic re-render for body lookup references
  const [, setTick] = useState(0);
  useEffect(() => {
    setTick((v) => v + 1);
  }, [scene, isShaking, hasCollapsed]);

  return (
    <group ref={suiteGroupRef}>
      <SanctuaryAtmosphere />

      {/* ==================== ARCHITECTURAL OUTER PLINTH & SILVER STEP EDGING ==================== */}
      <mesh position={[0, -0.14, 0]} receiveShadow>
        <boxGeometry args={[SUITE_W + 1.4, 0.26, SUITE_D + 1.4]} />
        <meshStandardMaterial
          map={marbleTex}
          roughness={0.28}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, -0.005, 0]}>
        <boxGeometry args={[SUITE_W + 0.45, 0.03, SUITE_D + 0.45]} />
        <meshStandardMaterial color="#dde2ea" metalness={0.45} roughness={0.25} />
      </mesh>

      {/* ==================== MULTI-ROOM LECTURE HALL CARPET & TIMBER FLOORS ==================== */}
      {/* Base Charcoal Loop-Pile Carpet / Selected Material Floor */}
      <mesh
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[SUITE_W, SUITE_D]} />
        <meshStandardMaterial
          map={floorTex}
          bumpMap={floorBump}
          bumpScale={0.018}
          roughness={floorMaterial === "marble" ? 0.18 : 0.62}
          metalness={floorMaterial === "cyber" ? 0.45 : 0.06}
        />
      </mesh>

      {/* Room 2 Central Lounge Slate Carpet Tier with Silver-White Step Edging (matches 00:01 of video) */}
      <group position={[0.0, 0.012, 3.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[5.4, 4.8]} />
          <meshStandardMaterial map={carpetTex} roughness={0.68} />
        </mesh>
        {/* Crisp Light-Grey Safety Step-Nosing Border */}
        <mesh position={[0, 0.003, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.44, 0.09]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.003, 2.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.44, 0.09]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
        </mesh>
      </group>

      {/* Room 3 Research Lab Floor Inlay */}
      <mesh
        position={[6.8, 0.012, 3.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[6.2, 5.6]} />
        <meshStandardMaterial
          map={carpetTex}
          roughness={0.58}
          metalness={0.08}
        />
      </mesh>

      {/* ==================== MATTE OFF-WHITE LECTURE HALL WALLS & HONEY-OAK TIMBER PANELS ==================== */}
      {SUITE_WALLS.map((w) => {
        const dx = w.x2 - w.x1;
        const dz = w.z2 - w.z1;
        const len = Math.hypot(dx, dz);
        const cx = (w.x1 + w.x2) / 2;
        const cz = (w.z1 + w.z2) / 2;
        const ang = Math.atan2(dz, dx);
        // Cutaway South exterior wall slightly in dollhouse mode so user can see inside easily
        const isSouthOuter = w.id === "w_south";
        const wallH = isSouthOuter && !walkthroughActive ? 0.55 : WALL_H;
        // Interior partition & rear walls use the Warm Honey-Oak Acoustic Timber Veneer from the video;
        // Perimeter walls use the Warm Matte Off-White Painted Plaster with Vertical Pilasters from the video!
        const isTimberFeatureWall =
          w.id.startsWith("w_r12") ||
          w.id.startsWith("w_r23") ||
          w.id.startsWith("w_mid");

        return (
          <group key={w.id} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
            <mesh position={[0, wallH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[len, wallH, w.thickness]} />
              <meshStandardMaterial
                map={isTimberFeatureWall ? woodTex : stoneTex}
                bumpMap={isTimberFeatureWall ? woodBump : stoneBump}
                bumpScale={0.018}
                roughness={isTimberFeatureWall ? 0.42 : 0.62}
              />
            </mesh>
            {/* Crisp Light-Grey & Charcoal Architectural Baseboard / Step-Nosing Trim */}
            <mesh position={[0, 0.07, 0]}>
              <boxGeometry args={[len + 0.01, 0.14, w.thickness + 0.03]} />
              <meshStandardMaterial color="#dde2ea" roughness={0.35} />
            </mesh>
            {/* Clean Matte-White / Silver Ceiling Shadow Reveal Trim */}
            <mesh position={[0, wallH - 0.04, 0]}>
              <boxGeometry args={[len + 0.02, 0.08, w.thickness + 0.04]} />
              <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.35}
                roughness={0.3}
              />
            </mesh>
          </group>
        );
      })}

      {/* ==================== FRONT-WALL PROJECTION SCREENS & SLIDING WHITEBOARDS (FROM VIDEO 00:02) ==================== */}
      {[
        { x: -6.8, z: -6.44, w: 3.6, h: 1.95 },
        { x: 0.0, z: -6.44, w: 4.2, h: 2.05 },
      ].map((scr, idx) => (
        <group key={idx} position={[scr.x, 1.85, scr.z]}>
          {/* Silver Anodized Aluminum Frame */}
          <mesh castShadow>
            <boxGeometry args={[scr.w + 0.12, scr.h + 0.12, 0.04]} />
            <meshStandardMaterial
              color="#cbd5e1"
              metalness={0.75}
              roughness={0.25}
            />
          </mesh>
          {/* Matte-White Projection / Whiteboard Surface */}
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[scr.w, scr.h]} />
            <meshStandardMaterial
              color="#f8fafc"
              emissive="#f1f5f9"
              emissiveIntensity={0.18}
              roughness={0.45}
            />
          </mesh>
        </group>
      ))}

      {/* ==================== HONEY-OAK TIMBER DOORWAY LINTELS, COBALT BLUE DOORS & GREEN EXIT SIGNS ==================== */}
      {DOORWAY_LINTELS.map((dl) => (
        <group
          key={dl.id}
          position={[dl.x, 0, dl.z]}
          rotation={[0, dl.rotY, 0]}
        >
          {/* Upper Honey-Oak Timber Veneer Transom above doorway (matches 00:06 of video) */}
          <mesh position={[0, WALL_H - 0.42, 0]} castShadow>
            <boxGeometry args={[dl.w, 0.84, WALL_T + 0.04]} />
            <meshStandardMaterial map={woodTex} roughness={0.42} />
          </mesh>
          {/* Brushed Silver Doorway Header Trim */}
          <mesh position={[0, WALL_H - 0.84, 0]}>
            <boxGeometry args={[dl.w + 0.08, 0.06, WALL_T + 0.08]} />
            <meshStandardMaterial
              color="#cbd5e1"
              metalness={0.8}
              roughness={0.22}
            />
          </mesh>
          {/* Glowing Green & White Running-Man EXIT Sign Box Above Portal */}
          <mesh position={[0, WALL_H - 0.58, WALL_T / 2 + 0.04]}>
            <boxGeometry args={[0.48, 0.18, 0.04]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={1.4}
            />
          </mesh>
          {/* Open Imperial Cobalt Blue Door Leaf Pinned Back Against Frame (with Steel Handle) */}
          <group position={[-dl.w / 2 + 0.06, 0, WALL_T / 2 + 0.36]}>
            <mesh position={[0, 1.2, 0]} castShadow>
              <boxGeometry args={[0.06, 2.4, 0.68]} />
              <meshStandardMaterial
                color="#25478a"
                roughness={0.38}
                metalness={0.15}
              />
            </mesh>
            <mesh position={[0.045, 1.15, 0.2]}>
              <cylinderGeometry args={[0.012, 0.012, 0.45, 10]} />
              <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.9}
                roughness={0.15}
              />
            </mesh>
          </group>
          {/* Crisp Silver-White Safety Step Threshold Strip */}
          <mesh position={[0, 0.014, 0]}>
            <boxGeometry args={[dl.w, 0.015, 0.24]} />
            <meshStandardMaterial
              color="#dde2ea"
              metalness={0.45}
              roughness={0.28}
            />
          </mesh>
        </group>
      ))}

      {/* ==================== CHANDELIERS IN ALL 4 ROOMS ==================== */}
      <MemoryPalaceChandelier position={[-6.8, WALL_H, 3.5]} isShaking={isShaking} />
      <MemoryPalaceChandelier position={[0.0, WALL_H, 3.5]} isShaking={isShaking} />
      <MemoryPalaceChandelier position={[6.8, WALL_H, 3.5]} isShaking={isShaking} />
      <MemoryPalaceChandelier position={[-4.2, WALL_H, -3.1]} isShaking={isShaking} />
      <MemoryPalaceChandelier position={[4.2, WALL_H, -3.1]} isShaking={isShaking} />

      {/* ==================== ROOM 1 PRIMARY FURNITURE ==================== */}
      {scene.objects.map((obj) => (
        <Room1FurnitureMesh
          key={obj.id}
          obj={obj}
          allObjects={scene.objects}
          hazard={hazardMap.get(obj.id)}
          body={physicsBodiesRef.current.find((b) => b.id === obj.id)}
          isShaking={isShaking}
          hasCollapsed={hasCollapsed}
          showItemLabels={showItemLabels}
        />
      ))}

      {/* ==================== ROOMS 2, 3, 4 FURNITURE & OBSTACLES ==================== */}
      {EXTRA_SUITE_OBJECTS.map((item) => (
        <ExtraSuiteObjectMesh
          key={item.id}
          item={item}
          body={physicsBodiesRef.current.find((b) => b.id === item.id)}
          showItemLabels={showItemLabels}
        />
      ))}

      {/* ==================== OPTIMAL PATH & SHELTER SPLINES ==================== */}
      <OptimalPathRibbon
        points={optimalMultiRoomPath}
        color="#10b981"
        emissive="#059669"
        label={showItemLabels ? "OPTIMAL MULTI-ROOM EXIT PATH" : undefined}
      />
      {shelterBranchPath.length >= 2 && (
        <OptimalPathRibbon
          points={shelterBranchPath}
          color="#d4af37"
          emissive="#b45309"
          label={
            showItemLabels
              ? evaluation.safe_shelter_spot_m?.label || "SAFE SHELTER SPOT"
              : undefined
          }
        />
      )}

      {/* ==================== PLAYER AVATAR & FOOTPRINT ==================== */}
      <PlayerAvatarMesh
        playerPosRef={playerPosRef}
        playerYawRef={playerYawRef}
        walkthroughActive={walkthroughActive}
        showItemLabels={showItemLabels}
      />

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.55}
        scale={22}
        blur={2.2}
        far={5}
      />
    </group>
  );
}

export default function QuakeRoomCanvas({
  scene,
  evaluation,
  isShaking,
  hasCollapsed,
  walkthroughActive,
  fullScreen = true,
  titleBadge,
  floorMaterial = "carpet",
  teleportRoomId = null,
  playerResetCounter = 0,
  showItemLabels = false,
}: QuakeRoomCanvasProps) {
  const [hudInfo, setHudInfo] = useState<{
    roomName: string;
    collidedWith: string | null;
    pushedObject: string | null;
    distToExitM: number;
  }>({
    roomName: SUITE_ROOMS[0].name,
    collidedWith: null,
    pushedObject: null,
    distToExitM: 12.8,
  });

  return (
    <div
      className={`relative w-full ${
        fullScreen
          ? "h-screen"
          : "h-[680px] rounded-2xl border border-slate-800"
      } overflow-hidden bg-[#050811] select-none`}
    >
      {/* Subtle Bottom-Left Player Telemetry & Controls Pill */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <div className="px-3.5 py-2 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-amber-500/30 text-xs text-slate-200 shadow-2xl flex items-center gap-3">
          <span className="font-bold text-amber-300">{hudInfo.roomName}</span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-300 font-mono">
            Exit: {hudInfo.distToExitM}m
          </span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-300 hidden sm:inline">
            <strong>WASD / Arrows</strong> Walk • <strong>Shift</strong> Sprint •{" "}
            <strong>Space</strong> Jump • <strong>Drag</strong> Look
          </span>
        </div>

        {(hudInfo.pushedObject || hudInfo.collidedWith) && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-400/50 text-xs font-bold text-amber-200 shadow-lg">
            {hudInfo.pushedObject
              ? `⚡ Pushing Obstacle: ${hudInfo.pushedObject}`
              : `🛡️ Colliding with: ${hudInfo.collidedWith}`}
          </div>
        )}
      </div>

      {titleBadge && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20 hidden lg:block">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300">
            {titleBadge}
          </div>
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [0, 15.8, 16.5], fov: 50 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
        }}
      >
        <color attach="background" args={["#050811"]} />
        <fog attach="fog" args={["#050811", 22, 62]} />

        <ambientLight intensity={0.55} color="#e2e8f0" />
        <directionalLight
          position={[10, 20, 12]}
          intensity={1.35}
          color="#fffbeb"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={48}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />
        <pointLight position={[-5, 2.6, 2.5]} intensity={0.55} color="#fde68a" />
        <pointLight position={[5, 2.6, -2.0]} intensity={0.65} color="#38bdf8" />

        <MultiRoomSanctuaryScene
          scene={scene}
          evaluation={evaluation}
          isShaking={isShaking}
          hasCollapsed={hasCollapsed}
          walkthroughActive={walkthroughActive}
          floorMaterial={floorMaterial}
          teleportRoomId={teleportRoomId}
          playerResetCounter={playerResetCounter}
          showItemLabels={showItemLabels}
          onHudUpdate={setHudInfo}
        />

        {!walkthroughActive && (
          <OrbitControls
            makeDefault
            enablePan={true}
            enableZoom={true}
            maxPolarAngle={Math.PI / 2 - 0.04}
            minDistance={3.5}
            maxDistance={26}
          />
        )}
      </Canvas>
    </div>
  );
}
