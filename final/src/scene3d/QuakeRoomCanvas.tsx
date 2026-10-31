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
 * Multi-tier Brass & Crystal Chandelier with Dynamic Seismic Sway
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
      ref.current.rotation.z = Math.sin(t * 15 + position[0]) * 0.26;
      ref.current.rotation.x = Math.cos(t * 13 + position[2]) * 0.2;
    } else {
      ref.current.rotation.z = THREE.MathUtils.lerp(
        ref.current.rotation.z,
        Math.sin(t * 1.1 + position[0]) * 0.012,
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
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.18} />
      </mesh>
      <mesh position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.018, 12, 32]} />
        <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[0, -0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.014, 12, 24]} />
        <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.16} />
      </mesh>
      {[0, 60, 120, 180, 240, 300].map((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        const cx = Math.cos(rad) * 0.38;
        const cz = Math.sin(rad) * 0.38;
        return (
          <group key={idx} position={[cx, -0.56, cz]}>
            <mesh>
              <cylinderGeometry args={[0.016, 0.016, 0.09, 10]} />
              <meshStandardMaterial color="#fffbeb" roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.065, 0]}>
              <sphereGeometry args={[0.026, 10, 10]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#f59e0b"
                emissiveIntensity={2.0}
              />
            </mesh>
          </group>
        );
      })}
      <pointLight
        position={[0, -0.68, 0]}
        intensity={0.95}
        distance={8.5}
        color="#fde68a"
      />
    </group>
  );
}

/**
 * Glowing 3D Optimal Path Spline Tube + Rotating Diamond Beacons
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

  const tubeGeom = useMemo(() => {
    if (points.length < 2) return null;
    const vecs = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.35);
    return new THREE.TubeGeometry(curve, 72, 0.052, 12, false);
  }, [points]);

  useFrame(({ clock }) => {
    if (!diamondRef.current) return;
    const t = clock.getElapsedTime();
    diamondRef.current.rotation.y = t * 2.4;
    diamondRef.current.position.y = 0.42 + Math.sin(t * 3.4) * 0.07;
  });

  if (!tubeGeom || points.length < 2) return null;
  const endPt = points[points.length - 1];

  return (
    <group>
      <mesh geometry={tubeGeom}>
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={1.3}
          roughness={0.2}
          metalness={0.5}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Waypoint Floor Rings along the path */}
      {points.map((pt, idx) => (
        <mesh
          key={idx}
          position={[pt[0], 0.025, pt[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.11, 0.16, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.75} />
        </mesh>
      ))}
      <group position={[endPt[0], 0, endPt[2]]}>
        <mesh ref={diamondRef} position={[0, 0.42, 0]}>
          <octahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={1.6}
            metalness={0.7}
            roughness={0.15}
          />
        </mesh>
        {label && (
          <TelemetrySprite
            position={[0, 0.88, 0]}
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
}: {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  playerYawRef: React.MutableRefObject<number>;
  walkthroughActive: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

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
              color="#0284c7"
              emissive="#0369a1"
              emissiveIntensity={0.4}
              roughness={0.35}
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
          <TelemetrySprite
            position={[0, 1.85, 0]}
            title="YOU (PLAYER)"
            subtitle="WASD / ARROWS TO WALK"
            statusColor="#38bdf8"
            scale={[1.35, 0.34, 1]}
          />
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
}: {
  obj: RoomObjectNode;
  allObjects: RoomObjectNode[];
  hazard?: ObjectHazardResult;
  body?: PhysicsBody;
  isShaking: boolean;
  hasCollapsed: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rotRad = (obj.rotation_deg * Math.PI) / 180;

  const childrenItems = useMemo(
    () => allObjects.filter((c) => c.parent_id === obj.id),
    [allObjects, obj.id]
  );

  useFrame(() => {
    if (!groupRef.current || !body) return;
    groupRef.current.position.set(body.x, body.y, body.z);
    groupRef.current.rotation.set(body.rotX, rotRad, body.rotZ);
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

      {/* BED */}
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
              color="#3e2723"
              roughness={0.42}
              metalness={0.15}
            />
          </RoundedBox>
          <RoundedBox
            args={[obj.width_m + 0.04, 1.05, 0.12]}
            radius={0.03}
            position={[0, 0.58, -obj.depth_m / 2 + 0.06]}
            castShadow
          >
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.65}
              metalness={0.2}
            />
          </RoundedBox>
          <RoundedBox
            args={[obj.width_m * 0.94, 0.22, obj.depth_m * 0.92]}
            radius={0.04}
            position={[0, 0.36, 0.03]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </RoundedBox>
          <RoundedBox
            args={[obj.width_m * 0.96, 0.21, obj.depth_m * 0.62]}
            radius={0.05}
            position={[0, 0.4, obj.depth_m * 0.14]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
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
              <meshStandardMaterial color="#fef3c7" roughness={0.6} />
            </RoundedBox>
          ))}
        </group>
      )}

      {/* BOOKSHELF */}
      {obj.category === "bookshelf" && (
        <group>
          <RoundedBox
            args={[obj.width_m, obj.height_m, obj.depth_m]}
            radius={0.02}
            position={[0, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#451a03" roughness={0.45} />
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
                metalness={0.65}
                roughness={0.3}
              />
            </mesh>
          ))}
          {childrenItems.map((child) => {
            const isTop = child.shelf_level === "top";
            const cy = isTop ? 1.64 : 0.22;
            return (
              <group
                key={child.id}
                position={[0, cy, obj.depth_m / 2 + 0.02]}
              >
                <RoundedBox
                  args={[obj.width_m * 0.65, 0.16, obj.depth_m * 0.85]}
                  radius={0.01}
                  castShadow
                >
                  <meshStandardMaterial
                    color={isTop ? "#dc2626" : "#059669"}
                    roughness={0.4}
                  />
                </RoundedBox>
                <TelemetrySprite
                  position={[0, 0.26, 0.08]}
                  title={`${child.mass_kg}kg BOOKS (${child.shelf_level?.toUpperCase()})`}
                  subtitle={
                    isTop ? "TOP-HEAVY OVERTURN RISK" : "LOW BALLAST STABLE"
                  }
                  statusColor={isTop ? "#ef4444" : "#10b981"}
                  scale={[1.25, 0.3, 1]}
                />
              </group>
            );
          })}
        </group>
      )}

      {/* WARDROBE */}
      {obj.category === "wardrobe" && (
        <group>
          <RoundedBox
            args={[obj.width_m, obj.height_m, obj.depth_m]}
            radius={0.025}
            position={[0, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.4}
              metalness={0.2}
            />
          </RoundedBox>
          {[-0.05, 0.05].map((hx, i) => (
            <mesh
              key={i}
              position={[hx, obj.height_m * 0.52, obj.depth_m / 2 + 0.025]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.28, 12]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.9}
                roughness={0.15}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* DESK */}
      {obj.category === "desk" && (
        <group>
          <RoundedBox
            args={[obj.width_m, 0.055, obj.depth_m]}
            radius={0.015}
            position={[0, obj.height_m, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#78350f"
              roughness={0.35}
              metalness={0.15}
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
                color="#d4af37"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}
          {childrenItems.map((child) => {
            const tipped =
              hazard?.shattered_or_fell && (isShaking || hasCollapsed);
            return (
              <group
                key={child.id}
                position={[0, obj.height_m + 0.03, -0.1]}
                rotation={[tipped ? 1.3 : 0, 0, 0]}
              >
                <RoundedBox
                  args={[0.54, 0.34, 0.025]}
                  radius={0.01}
                  position={[0, 0.24, 0]}
                  castShadow
                >
                  <meshStandardMaterial
                    color="#0f172a"
                    roughness={0.25}
                    metalness={0.8}
                  />
                </RoundedBox>
                <mesh position={[0, 0.24, 0.015]}>
                  <planeGeometry args={[0.5, 0.3]} />
                  <meshStandardMaterial
                    color="#0284c7"
                    emissive="#38bdf8"
                    emissiveIntensity={0.65}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* CHAIR */}
      {obj.category === "chair" && (
        <group>
          <RoundedBox
            args={[0.46, 0.06, 0.44]}
            radius={0.02}
            position={[0, 0.45, 0]}
            castShadow
          >
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </RoundedBox>
          <RoundedBox
            args={[0.42, 0.46, 0.05]}
            radius={0.02}
            position={[0, 0.7, -0.2]}
            castShadow
          >
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </RoundedBox>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.42, 12]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.85}
              roughness={0.2}
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

      {/* Floating 3D Glass Telemetry Badge */}
      {obj.category !== "chair" && (
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
 * Renders Suite Furniture & Obstacles in Rooms 2, 3, and 4 using PhysicsBody state
 */
function ExtraSuiteObjectMesh({
  item,
  body,
}: {
  item: ExtraSuiteObject;
  body?: PhysicsBody;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current || !body) return;
    groupRef.current.position.set(body.x, body.y, body.z);
    groupRef.current.rotation.set(body.rotX, item.rotY, body.rotZ);
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
            <meshStandardMaterial color="#7f1d1d" roughness={0.65} />
          </RoundedBox>
          <RoundedBox
            args={[item.w, 0.55, 0.2]}
            radius={0.04}
            position={[0, 0.58, -item.d / 2 + 0.1]}
            castShadow
          >
            <meshStandardMaterial color="#991b1b" roughness={0.65} />
          </RoundedBox>
          {[-item.w / 2 + 0.12, item.w / 2 - 0.12].map((ax, idx) => (
            <RoundedBox
              key={idx}
              args={[0.22, 0.52, item.d]}
              radius={0.04}
              position={[ax, 0.42, 0]}
              castShadow
            >
              <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
            </RoundedBox>
          ))}
        </group>
      )}

      {(item.category === "table" || item.category === "lab_bench") && (
        <group>
          <RoundedBox
            args={[item.w, 0.06, item.d]}
            radius={0.015}
            position={[0, item.h, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={item.category === "lab_bench" ? "#0f172a" : "#78350f"}
              roughness={0.35}
              metalness={item.category === "lab_bench" ? 0.6 : 0.15}
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
              color={item.category === "server_rack" ? "#0f172a" : "#3e2723"}
              metalness={item.category === "server_rack" ? 0.75 : 0.2}
              roughness={0.35}
            />
          </RoundedBox>
          {[0.4, 0.85, 1.3, 1.75].map((ly, idx) => (
            <mesh key={idx} position={[0, ly, item.d / 2 + 0.012]}>
              <planeGeometry args={[item.w * 0.8, 0.08]} />
              <meshStandardMaterial
                color={item.category === "server_rack" ? "#38bdf8" : "#fde68a"}
                emissive={
                  item.category === "server_rack" ? "#0284c7" : "#d4af37"
                }
                emissiveIntensity={0.8}
              />
            </mesh>
          ))}
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
              color="#d4af37"
              metalness={0.85}
              roughness={0.2}
            />
          </RoundedBox>
          <RoundedBox
            args={[item.w, 0.05, item.d]}
            radius={0.015}
            position={[0, item.h * 0.92, 0]}
            castShadow
          >
            <meshStandardMaterial
              color="#1e293b"
              metalness={0.6}
              roughness={0.3}
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
              color={item.category === "debris" ? "#475569" : "#92400e"}
              roughness={0.75}
            />
          </RoundedBox>
          {item.category === "debris" && (
            <mesh
              position={[0.1, item.h + 0.06, -0.05]}
              rotation={[0.2, 0.4, -0.25]}
              castShadow
            >
              <boxGeometry args={[item.w * 0.85, 0.14, 0.22]} />
              <meshStandardMaterial color="#78350f" roughness={0.65} />
            </mesh>
          )}
        </group>
      )}

      {item.category === "exit_door" && (
        <group>
          <RoundedBox
            args={[item.w, item.h, item.d]}
            radius={0.02}
            position={[0, item.h / 2, 0]}
            castShadow
          >
            <meshStandardMaterial
              color="#059669"
              emissive="#047857"
              emissiveIntensity={0.65}
              metalness={0.45}
              roughness={0.25}
            />
          </RoundedBox>
          <mesh position={[-0.08, item.h + 0.22, 0]}>
            <boxGeometry args={[0.08, 0.24, 0.75]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={1.6}
            />
          </mesh>
        </group>
      )}

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

      {/* ==================== CALACATTA MARBLE OUTER PLINTH & GOLD TRIM ==================== */}
      <mesh position={[0, -0.14, 0]} receiveShadow>
        <boxGeometry args={[SUITE_W + 1.4, 0.26, SUITE_D + 1.4]} />
        <meshStandardMaterial
          map={marbleTex}
          roughness={0.22}
          metalness={0.12}
        />
      </mesh>
      <mesh position={[0, -0.005, 0]}>
        <boxGeometry args={[SUITE_W + 0.45, 0.03, SUITE_D + 0.45]} />
        <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.2} />
      </mesh>

      {/* ==================== MULTI-ROOM ARCHITECTURAL FLOORS ==================== */}
      {/* Base Versailles Parquet / Selected Material Floor */}
      <mesh
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[SUITE_W, SUITE_D]} />
        <meshStandardMaterial
          map={floorTex}
          bumpMap={floorBump}
          bumpScale={0.015}
          roughness={floorMaterial === "marble" ? 0.18 : 0.36}
          metalness={floorMaterial === "cyber" ? 0.45 : 0.08}
        />
      </mesh>

      {/* Room 2 Damask Sanctuary Carpet Inlay */}
      <mesh
        position={[0.0, 0.012, 3.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[5.2, 4.6]} />
        <meshStandardMaterial map={carpetTex} roughness={0.65} />
      </mesh>

      {/* Room 3 Cyber Lab Matrix Floor Inlay */}
      <mesh
        position={[6.8, 0.012, 3.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[6.2, 5.6]} />
        <meshStandardMaterial
          map={cyberTex}
          roughness={0.28}
          metalness={0.35}
        />
      </mesh>

      {/* ==================== ASHLAR STONE WALLS & GOLD CROWN MOLDINGS ==================== */}
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

        return (
          <group key={w.id} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
            <mesh position={[0, wallH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[len, wallH, w.thickness]} />
              <meshStandardMaterial
                map={stoneTex}
                bumpMap={stoneBump}
                bumpScale={0.02}
                roughness={0.55}
              />
            </mesh>
            {/* Dark Slate Baseboard */}
            <mesh position={[0, 0.09, 0]}>
              <boxGeometry args={[len + 0.01, 0.18, w.thickness + 0.03]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>
            {/* Brushed Gold Crown Molding */}
            <mesh position={[0, wallH - 0.04, 0]}>
              <boxGeometry args={[len + 0.02, 0.08, w.thickness + 0.05]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}

      {/* ==================== GOLDEN DOORWAY LINTELS & ROOM PORTALS ==================== */}
      {DOORWAY_LINTELS.map((dl) => (
        <group
          key={dl.id}
          position={[dl.x, 0, dl.z]}
          rotation={[0, dl.rotY, 0]}
        >
          {/* Upper Stone & Gold Lintel above doorway */}
          <mesh position={[0, WALL_H - 0.42, 0]} castShadow>
            <boxGeometry args={[dl.w, 0.84, WALL_T + 0.04]} />
            <meshStandardMaterial map={stoneTex} roughness={0.5} />
          </mesh>
          <mesh position={[0, WALL_H - 0.84, 0]}>
            <boxGeometry args={[dl.w + 0.08, 0.07, WALL_T + 0.08]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.9}
              roughness={0.18}
            />
          </mesh>
          {/* Threshold Gold Plate */}
          <mesh position={[0, 0.014, 0]}>
            <boxGeometry args={[dl.w, 0.015, 0.24]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.85}
              roughness={0.22}
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
        />
      ))}

      {/* ==================== ROOMS 2, 3, 4 FURNITURE & OBSTACLES ==================== */}
      {EXTRA_SUITE_OBJECTS.map((item) => (
        <ExtraSuiteObjectMesh
          key={item.id}
          item={item}
          body={physicsBodiesRef.current.find((b) => b.id === item.id)}
        />
      ))}

      {/* ==================== OPTIMAL PATH & SHELTER SPLINES ==================== */}
      <OptimalPathRibbon
        points={optimalMultiRoomPath}
        color="#10b981"
        emissive="#059669"
        label="OPTIMAL MULTI-ROOM EXIT PATH"
      />
      {shelterBranchPath.length >= 2 && (
        <OptimalPathRibbon
          points={shelterBranchPath}
          color="#d4af37"
          emissive="#b45309"
          label={evaluation.safe_shelter_spot_m?.label || "SAFE SHELTER SPOT"}
        />
      )}

      {/* ==================== PLAYER AVATAR & FOOTPRINT ==================== */}
      <PlayerAvatarMesh
        playerPosRef={playerPosRef}
        playerYawRef={playerYawRef}
        walkthroughActive={walkthroughActive}
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
  floorMaterial = "wood",
  teleportRoomId = null,
  playerResetCounter = 0,
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
