"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Line,
  PerspectiveCamera,
  RoundedBox,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import {
  RoomSceneGraph,
  EgressAndShelterResult,
  RoomObjectNode,
  ObjectHazardResult,
} from "@/types/contracts";
import {
  getProceduralTexture,
  getProceduralBumpMap,
  getGlassPillTexture,
} from "./proceduralTextures";

export interface QuakeRoomCanvasProps {
  scene: RoomSceneGraph;
  simReport: EgressAndShelterResult;
  isShaking: boolean;
  remediated: boolean;
  firstPersonMode?: boolean;
  onToggleFirstPerson?: () => void;
  compact?: boolean;
  label?: string;
}

/**
 * Memory Palace Starfield Sky Dome & Ambient Sanctuary Dust Motes
 */
function SanctuaryAtmosphere({ isShaking }: { isShaking: boolean }) {
  const dustRef = useRef<THREE.Points>(null);

  const starMap = useMemo(() => {
    const tex = getProceduralTexture("stars").clone();
    tex.repeat.set(4, 2);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { positions, phases, colors } = useMemo(() => {
    const count = 260;
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const gold = new THREE.Color("#fde68a");
    const cyan = new THREE.Color("#38bdf8");
    const ember = new THREE.Color("#f97316");

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.sin(i * 73.1) - 0.5) * 14;
      pos[i * 3 + 1] = ((i * 19.7) % 5.2) + 0.2;
      pos[i * 3 + 2] = (Math.cos(i * 41.3) - 0.5) * 14;
      ph[i] = i * 0.43;

      const c = i % 5 === 0 ? cyan : i % 7 === 0 ? ember : gold;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, phases: ph, colors: col };
  }, []);

  useFrame(({ clock }) => {
    if (!dustRef.current) return;
    const t = clock.getElapsedTime();
    const posAttr = dustRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const speed = isShaking ? 3.8 : 0.45;
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      const x =
        posAttr.getX(i) +
        Math.sin(t * speed + p) * (isShaking ? 0.014 : 0.0018);
      let y = posAttr.getY(i) + (isShaking ? 0.012 : 0.0015);
      const z =
        posAttr.getZ(i) +
        Math.cos(t * speed + p) * (isShaking ? 0.014 : 0.0018);
      if (y > 5.4) y = 0.2;
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group>
      {/* Nocturnal Starfield Sky Dome */}
      <mesh>
        <sphereGeometry args={[55, 32, 24]} />
        <meshBasicMaterial map={starMap} side={THREE.BackSide} fog={false} />
      </mesh>

      {/* Floating Golden & Cyan Sanctuary Dust Motes */}
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={isShaking ? 0.065 : 0.045}
          vertexColors
          transparent
          opacity={isShaking ? 0.85 : 0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

/**
 * Memory Palace Multi-Tier Brass & Crystal Chandelier with Seismic Sway
 */
function OrnateChandelier({
  heightM,
  isShaking,
}: {
  heightM: number;
  isShaking: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const swayX = isShaking
        ? Math.sin(t * 16) * 0.22 + Math.cos(t * 23) * 0.08
        : Math.sin(t * 1.2) * 0.012;
      const swayZ = isShaking
        ? Math.cos(t * 14) * 0.19
        : Math.cos(t * 1.1) * 0.01;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        swayX,
        0.18
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        swayZ,
        0.18
      );
    }
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.9;
    }
  });

  return (
    <group ref={groupRef} position={[0, heightM, 0]}>
      {/* Ceiling Medallion Rose */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.24, 0.18, 0.04, 24]} />
        <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.2} />
      </mesh>
      {/* Suspension Rod */}
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.48, 12]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>
      {/* Upper Brass Tier Ring */}
      <mesh position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.016, 12, 32]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.18} />
      </mesh>
      {/* Lower Grand Brass Tier Ring */}
      <mesh position={[0, -0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.022, 14, 36]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.18} />
      </mesh>
      {/* 6 Perimeter Warm Candle Bulbs */}
      {[0, 1, 2, 3, 4, 5].map((idx) => {
        const angle = (idx / 6) * Math.PI * 2;
        const rx = Math.cos(angle) * 0.46;
        const rz = Math.sin(angle) * 0.46;
        return (
          <group key={idx} position={[rx, -0.47, rz]}>
            <mesh position={[0, -0.02, 0]}>
              <cylinderGeometry args={[0.016, 0.02, 0.06, 10]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <sphereGeometry args={[0.028, 12, 12]} />
              <meshStandardMaterial
                color="#fffbeb"
                emissive="#fbbf24"
                emissiveIntensity={isShaking ? 1.8 : 1.3}
              />
            </mesh>
          </group>
        );
      })}
      {/* Rotating Crystal Octahedron Pendant */}
      <mesh ref={crystalRef} position={[0, -0.62, 0]}>
        <octahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive={isShaking ? "#ef4444" : "#f59e0b"}
          emissiveIntensity={isShaking ? 1.6 : 0.95}
          metalness={0.2}
          roughness={0.1}
        />
      </mesh>
      {/* Warm Sanctuary Point Light */}
      <pointLight
        position={[0, -0.68, 0]}
        intensity={isShaking ? 1.35 : 1.75}
        distance={11}
        color={isShaking ? "#fca5a5" : "#fde68a"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}

/**
 * Memory Palace Architectural Room Shell:
 * - Versailles Parquet Oak Floor with Bump Map & Specular Polish
 * - Outer Calacatta Marble Plinth & Brushed Gold Compass Medallion Inlay
 * - Ashlar Stone/Plaster Walls with Slate Baseboards, Gold Dado Rails & Crown Moldings
 * - Coffered Ceiling Perimeter Beams & Corner Fluted Pilasters
 */
function ArchitecturalRoomShell({
  widthM,
  depthM,
  heightM,
  remediated,
}: {
  widthM: number;
  depthM: number;
  heightM: number;
  remediated: boolean;
}) {
  const {
    woodTex,
    woodBump,
    stoneTex,
    stoneBump,
    marbleTex,
    carpetTex,
    carpetBump,
  } = useMemo(() => {
    const wTex = getProceduralTexture("wood").clone();
    wTex.repeat.set(2.5, 2.5);
    wTex.needsUpdate = true;

    const wBump = getProceduralBumpMap("wood").clone();
    wBump.repeat.set(2.5, 2.5);
    wBump.needsUpdate = true;

    const sTex = getProceduralTexture("stone").clone();
    sTex.repeat.set(2, 1.4);
    sTex.needsUpdate = true;

    const sBump = getProceduralBumpMap("stone").clone();
    sBump.repeat.set(2, 1.4);
    sBump.needsUpdate = true;

    const mTex = getProceduralTexture("marble").clone();
    mTex.repeat.set(3, 3);
    mTex.needsUpdate = true;

    const cTex = getProceduralTexture("carpet").clone();
    cTex.repeat.set(1, 1);
    cTex.needsUpdate = true;

    const cBump = getProceduralBumpMap("carpet").clone();
    cBump.repeat.set(1, 1);
    cBump.needsUpdate = true;

    return {
      woodTex: wTex,
      woodBump: wBump,
      stoneTex: sTex,
      stoneBump: sBump,
      marbleTex: mTex,
      carpetTex: cTex,
      carpetBump: cBump,
    };
  }, []);

  return (
    <group>
      {/* Monumental Calacatta Marble Outer Plinth Foundation */}
      <RoundedBox
        args={[widthM + 0.56, 0.16, depthM + 0.56]}
        radius={0.04}
        smoothness={4}
        position={[0, -0.14, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          map={marbleTex}
          color="#cbd5e1"
          roughness={0.32}
          metalness={0.12}
        />
      </RoundedBox>

      {/* Brushed Gold Plinth Trim Ring */}
      <mesh position={[0, -0.055, 0]}>
        <boxGeometry args={[widthM + 0.42, 0.022, depthM + 0.42]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>

      {/* Royal Versailles Parquet Hardwood Floor */}
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <boxGeometry args={[widthM, 0.05, depthM]} />
        <meshStandardMaterial
          map={woodTex}
          bumpMap={woodBump}
          bumpScale={0.015}
          roughness={0.34}
          metalness={0.08}
        />
      </mesh>

      {/* Central Memory-Palace Gold Compass Medallion Inlay */}
      <group position={[0.15, 0.003, 0.1]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[0.62, 0.68, 48]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.88}
            roughness={0.2}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[0.32, 0.35, 36]} />
          <meshStandardMaterial
            color={remediated ? "#10b981" : "#d4af37"}
            emissive={remediated ? "#059669" : "#b45309"}
            emissiveIntensity={0.35}
            metalness={0.85}
            roughness={0.22}
          />
        </mesh>
      </group>

      {/* Royal Woven Tapestry Area Rug */}
      <mesh position={[-0.55, 0.005, 0.15]} receiveShadow>
        <boxGeometry args={[2.35, 0.012, 2.65]} />
        <meshStandardMaterial
          map={carpetTex}
          bumpMap={carpetBump}
          bumpScale={0.012}
          roughness={0.78}
        />
      </mesh>

      {/* NORTH BACK WALL (Ashlar Stone + Baseboard + Gold Dado + Crown Molding) */}
      <group position={[0, 0, -depthM / 2 - 0.06]}>
        <mesh position={[0, heightM / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[widthM + 0.24, heightM, 0.12]} />
          <meshStandardMaterial
            map={stoneTex}
            bumpMap={stoneBump}
            bumpScale={0.018}
            roughness={0.62}
            metalness={0.08}
          />
        </mesh>
        <mesh position={[0, 0.09, 0.068]} receiveShadow>
          <boxGeometry args={[widthM + 0.12, 0.18, 0.025]} />
          <meshStandardMaterial
            color="#0f172a"
            roughness={0.4}
            metalness={0.25}
          />
        </mesh>
        <mesh position={[0, 0.92, 0.068]}>
          <boxGeometry args={[widthM + 0.08, 0.032, 0.028]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.86}
            roughness={0.22}
          />
        </mesh>
        <mesh position={[0, heightM - 0.04, 0.072]}>
          <boxGeometry args={[widthM + 0.24, 0.075, 0.045]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.86}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* WEST LEFT WALL (Ashlar Stone + Baseboard + Gold Dado + Crown Molding) */}
      <group position={[-widthM / 2 - 0.06, 0, 0]}>
        <mesh position={[0, heightM / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.12, heightM, depthM + 0.24]} />
          <meshStandardMaterial
            map={stoneTex}
            bumpMap={stoneBump}
            bumpScale={0.018}
            roughness={0.62}
            metalness={0.08}
          />
        </mesh>
        <mesh position={[0.068, 0.09, 0]} receiveShadow>
          <boxGeometry args={[0.025, 0.18, depthM + 0.12]} />
          <meshStandardMaterial
            color="#0f172a"
            roughness={0.4}
            metalness={0.25}
          />
        </mesh>
        <mesh position={[0.068, 0.92, 0]}>
          <boxGeometry args={[0.028, 0.032, depthM + 0.08]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.86}
            roughness={0.22}
          />
        </mesh>
        <mesh position={[0.072, heightM - 0.04, 0]}>
          <boxGeometry args={[0.045, 0.075, depthM + 0.24]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.86}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* CUTAWAY SOUTH & EAST LOW CURB + UPPER CORNICE FRAME */}
      <mesh position={[0, 0.05, depthM / 2 + 0.04]} receiveShadow>
        <boxGeometry args={[widthM + 0.24, 0.1, 0.08]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[widthM / 2 + 0.04, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.08, 0.1, depthM + 0.24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
      </mesh>

      <mesh position={[0, heightM - 0.03, depthM / 2 + 0.04]}>
        <boxGeometry args={[widthM + 0.24, 0.06, 0.08]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[widthM / 2 + 0.04, heightM - 0.03, 0]}>
        <boxGeometry args={[0.08, 0.06, depthM + 0.24]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.4} />
      </mesh>

      {/* 3 Corner Architectural Pilasters with Gold Capitals */}
      {[
        [-widthM / 2 - 0.02, -depthM / 2 - 0.02],
        [widthM / 2 + 0.02, -depthM / 2 - 0.02],
        [-widthM / 2 - 0.02, depthM / 2 + 0.02],
      ].map(([cx, cz], idx) => (
        <group key={idx} position={[cx, 0, cz]}>
          <mesh position={[0, heightM / 2, 0]} castShadow>
            <boxGeometry args={[0.16, heightM, 0.16]} />
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.45}
              metalness={0.2}
            />
          </mesh>
          <mesh position={[0, heightM - 0.06, 0]}>
            <boxGeometry args={[0.2, 0.08, 0.2]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.2, 0.1, 0.2]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* Warm Architectural Wall Sconces on North Wall */}
      {[
        { pos: [-1.15, 1.95, -depthM / 2 + 0.04] as [number, number, number] },
        { pos: [1.15, 1.95, -depthM / 2 + 0.04] as [number, number, number] },
      ].map((sconce, idx) => (
        <group key={idx} position={sconce.pos}>
          <mesh position={[0, -0.06, 0]}>
            <boxGeometry args={[0.08, 0.18, 0.04]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.04, 0.04]}>
            <cylinderGeometry args={[0.06, 0.04, 0.14, 14]} />
            <meshStandardMaterial
              color="#fffbeb"
              emissive="#f59e0b"
              emissiveIntensity={1.15}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * First-Person Interactive Escape & Shelter Camera Controller
 */
function FirstPersonEscapeController({
  active,
  freeWalkMode,
  isShaking,
  shelterZone,
  escapePath,
  widthM,
  depthM,
  onHudUpdate,
}: {
  active: boolean;
  freeWalkMode: boolean;
  isShaking: boolean;
  shelterZone: { x_m: number; z_m: number; label: string } | null;
  escapePath: Array<{ x_m: number; z_m: number }>;
  widthM: number;
  depthM: number;
  onHudUpdate: (msg: string) => void;
}) {
  const { camera, gl } = useThree();
  const progressRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const yawRef = useRef(0.4);
  const pitchRef = useRef(-0.1);
  const draggingRef = useRef(false);
  const lastMsgRef = useRef("");

  useEffect(() => {
    if (!active) {
      progressRef.current = 0;
      return;
    }
    const startPt = escapePath[0] ?? { x_m: 0.95, z_m: 1.9 };
    camera.position.set(
      startPt.x_m - widthM / 2,
      1.62,
      startPt.z_m - depthM / 2
    );
    yawRef.current = 0.65;
    pitchRef.current = -0.08;
  }, [active, escapePath, widthM, depthM, camera]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    const onMouseDown = () => {
      draggingRef.current = true;
    };
    const onMouseUp = () => {
      draggingRef.current = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      yawRef.current -= e.movementX * 0.0035;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - e.movementY * 0.0028,
        -Math.PI / 2.6,
        Math.PI / 2.6
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const dom = gl.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [active, gl]);

  useFrame((_, delta) => {
    if (!active) return;

    const crouch =
      keysRef.current["KeyC"] ||
      keysRef.current["ShiftLeft"] ||
      keysRef.current["ControlLeft"];
    const baseEyeHeight = crouch ? 0.62 : 1.62;

    if (freeWalkMode) {
      const speed = (crouch ? 1.6 : 2.8) * delta;
      const forward = new THREE.Vector3(
        -Math.sin(yawRef.current),
        0,
        -Math.cos(yawRef.current)
      ).normalize();
      const right = new THREE.Vector3(
        Math.cos(yawRef.current),
        0,
        -Math.sin(yawRef.current)
      ).normalize();

      let moved = false;
      if (keysRef.current["KeyW"] || keysRef.current["ArrowUp"]) {
        camera.position.addScaledVector(forward, speed);
        moved = true;
      }
      if (keysRef.current["KeyS"] || keysRef.current["ArrowDown"]) {
        camera.position.addScaledVector(forward, -speed);
        moved = true;
      }
      if (keysRef.current["KeyA"] || keysRef.current["ArrowLeft"]) {
        camera.position.addScaledVector(right, -speed);
        moved = true;
      }
      if (keysRef.current["KeyD"] || keysRef.current["ArrowRight"]) {
        camera.position.addScaledVector(right, speed);
        moved = true;
      }

      camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        -widthM / 2 + 0.25,
        widthM / 2 - 0.25
      );
      camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        -depthM / 2 + 0.25,
        depthM / 2 - 0.25
      );

      const bob = moved ? Math.sin(performance.now() * 0.012) * 0.035 : 0;
      const tremor = isShaking ? Math.sin(performance.now() * 0.045) * 0.06 : 0;
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        baseEyeHeight + bob + tremor,
        0.22
      );

      const lookTarget = new THREE.Vector3(
        camera.position.x -
          Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        camera.position.y + Math.sin(pitchRef.current),
        camera.position.z -
          Math.cos(yawRef.current) * Math.cos(pitchRef.current)
      );
      camera.lookAt(lookTarget);

      const statusMsg = crouch
        ? "CROUCHED UNDER DESK SHELTER (0.62m) — Protected from falling debris"
        : "FREE-WALK 1ST-PERSON — WASD/Arrows to walk, Hold C/Shift to crouch under desk, Drag mouse to look";
      if (lastMsgRef.current !== statusMsg) {
        lastMsgRef.current = statusMsg;
        onHudUpdate(statusMsg);
      }
      return;
    }

    progressRef.current = (progressRef.current + delta * 0.22) % 1;
    const p = progressRef.current;

    const startPt = escapePath[0] ?? { x_m: 0.95, z_m: 1.9 };
    const shelterPt = shelterZone
      ? { x_m: shelterZone.x_m, z_m: shelterZone.z_m }
      : { x_m: 2.85, z_m: 0.72 };
    const doorPt = escapePath[escapePath.length - 1] ?? { x_m: 3.6, z_m: 3.7 };

    if (p < 0.48) {
      const localT = Math.min(1, p / 0.32);
      const cx =
        THREE.MathUtils.lerp(startPt.x_m, shelterPt.x_m, localT) - widthM / 2;
      const cz =
        THREE.MathUtils.lerp(startPt.z_m, shelterPt.z_m, localT) - depthM / 2;
      const eyeY = THREE.MathUtils.lerp(1.62, 0.58, Math.min(1, p / 0.36));
      const tremor = isShaking
        ? Math.sin(performance.now() * 0.05) * 0.055
        : 0;

      camera.position.set(cx, eyeY + tremor, cz + 0.18);
      camera.lookAt(cx, 0.55, cz - 0.6);

      const msg =
        localT < 0.95
          ? "PHASE 1 (DURING QUAKE): Dropping & crawling under reinforced study desk shelter..."
          : "PHASE 1 (HOLD ON): Crouched at 0.58m under study desk — shielded from toppling hazards!";
      if (lastMsgRef.current !== msg) {
        lastMsgRef.current = msg;
        onHudUpdate(msg);
      }
    } else {
      const localT = (p - 0.48) / 0.52;
      const cx =
        THREE.MathUtils.lerp(shelterPt.x_m, doorPt.x_m, localT) - widthM / 2;
      const cz =
        THREE.MathUtils.lerp(shelterPt.z_m, doorPt.z_m, localT) - depthM / 2;
      const eyeY = THREE.MathUtils.lerp(0.58, 1.62, Math.min(1, localT * 3.0));
      const bob = Math.sin(localT * Math.PI * 10) * 0.035;

      camera.position.set(cx, eyeY + bob, cz);
      camera.lookAt(doorPt.x_m - widthM / 2, 1.35, doorPt.z_m - depthM / 2);

      const msg =
        "PHASE 2 (SHAKING STOPPED): Standing up & evacuating along verified A* path to Bedroom Exit Door";
      if (lastMsgRef.current !== msg) {
        lastMsgRef.current = msg;
        onHudUpdate(msg);
      }
    }
  });

  return null;
}

/**
 * Memory Palace-Grade 3D Furniture Prefabs with Procedural Textures, Double Floor Aura Rings,
 * and Crisp Glassmorphic Floating Telemetry Sprites
 */
function FurniturePrefab({
  obj,
  allObjects,
  roomWidth,
  roomDepth,
  hazard,
  isShaking,
  remediated,
}: {
  obj: RoomObjectNode;
  allObjects: RoomObjectNode[];
  roomWidth: number;
  roomDepth: number;
  hazard?: ObjectHazardResult;
  isShaking: boolean;
  remediated: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const spriteRef = useRef<THREE.Sprite>(null);

  const centerX = obj.x_m + obj.width_m / 2 - roomWidth / 2;
  const centerZ = obj.z_m + obj.depth_m / 2 - roomDepth / 2;
  const rotRad = ((obj.rotation_deg || 0) * Math.PI) / 180;

  const childrenItems = useMemo(
    () => allObjects.filter((child) => child.parent_id === obj.id),
    [allObjects, obj.id]
  );

  const sf = hazard?.analytical_safety_factor ?? 1.5;
  const isDanger = sf < 1.0 && !obj.anchored_to_wall;

  const pillTexture = useMemo(() => {
    if (obj.category === "window" || obj.category === "chair") return null;
    if (obj.category === "exit_door") {
      return getGlassPillTexture({
        badge: "EXIT",
        title: "Primary Egress Door",
        subtitle: "ISO 85cm Clear Passageway",
        accentColor: "#10b981",
        badgeBg: "#059669",
      });
    }
    if (obj.category === "desk") {
      return getGlassPillTexture({
        badge: "SAFE",
        title: obj.label,
        subtitle: `Phase 1 Shelter • SF ${sf.toFixed(2)}`,
        accentColor: "#38bdf8",
        badgeBg: "#0284c7",
      });
    }
    if (obj.category === "bed") {
      return getGlassPillTexture({
        badge: "BED",
        title: obj.label,
        subtitle: remediated ? "Clear of Tip Arcs • Safe" : "Occupancy Zone",
        accentColor: remediated ? "#10b981" : "#f59e0b",
        badgeBg: remediated ? "#059669" : "#d97706",
      });
    }
    return getGlassPillTexture({
      badge: isDanger ? "RISK" : obj.anchored_to_wall ? "LOCK" : "SAFE",
      title: obj.label,
      subtitle: `SF ${sf.toFixed(2)} • ${
        obj.anchored_to_wall
          ? "Anchored"
          : isDanger
            ? "TOPPLE HAZARD"
            : "Stable"
      }`,
      accentColor: isDanger
        ? "#ef4444"
        : obj.anchored_to_wall
          ? "#10b981"
          : "#d4af37",
      badgeBg: isDanger
        ? "#dc2626"
        : obj.anchored_to_wall
          ? "#059669"
          : "#b45309",
    });
  }, [obj.category, obj.label, obj.anchored_to_wall, sf, isDanger, remediated]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (auraRingRef.current) {
      const pulse = 1 + Math.sin(t * (isDanger ? 5.5 : 2.4)) * 0.06;
      auraRingRef.current.scale.set(pulse, pulse, 1);
    }

    if (spriteRef.current) {
      spriteRef.current.position.y =
        Math.max(obj.height_m + 0.38, 1.25) +
        Math.sin(t * 2.2 + centerX) * 0.035;
    }

    if (!groupRef.current) return;

    if (isShaking && hazard?.tipped_over && !remediated) {
      const targetAngle = Math.PI / 2.15;
      if (obj.category === "bookshelf") {
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z,
          -targetAngle,
          0.08
        );
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          0.25,
          0.08
        );
        groupRef.current.position.x = THREE.MathUtils.lerp(
          groupRef.current.position.x,
          centerX + 0.65,
          0.08
        );
      } else {
        groupRef.current.rotation.x = THREE.MathUtils.lerp(
          groupRef.current.rotation.x,
          targetAngle,
          0.08
        );
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          0.28,
          0.08
        );
        groupRef.current.position.z = THREE.MathUtils.lerp(
          groupRef.current.position.z,
          centerZ + 0.65,
          0.08
        );
      }
    } else {
      const rockAngle = isShaking
        ? Math.sin(t * 24) * (obj.anchored_to_wall ? 0.012 : 0.048)
        : 0;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        rockAngle,
        0.2
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        0,
        0.2
      );
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        centerX,
        0.2
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        0,
        0.2
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        centerZ,
        0.2
      );
    }
  });

  if (obj.parent_id !== null) return null;

  const auraRadius = Math.max(obj.width_m, obj.depth_m) * 0.58;
  const auraColor = isDanger
    ? "#ef4444"
    : obj.category === "desk"
      ? "#38bdf8"
      : "#10b981";

  return (
    <group
      ref={groupRef}
      position={[centerX, 0, centerZ]}
      rotation={[0, rotRad, 0]}
    >
      {/* Memory Palace Double Concentric Floor Aura Rings */}
      {(isDanger ||
        obj.anchored_to_wall ||
        obj.category === "desk" ||
        obj.category === "bookshelf" ||
        obj.category === "wardrobe") && (
        <group position={[0, 0.008, 0]}>
          <mesh ref={auraRingRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[auraRadius * 0.86, auraRadius, 40]} />
            <meshBasicMaterial
              color={auraColor}
              transparent
              opacity={isDanger ? 0.65 : 0.38}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[auraRadius * 0.62, auraRadius * 0.66, 36]} />
            <meshBasicMaterial
              color="#d4af37"
              transparent
              opacity={0.32}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* ==================== BED PREFAB ==================== */}
      {obj.category === "bed" && (
        <group>
          <RoundedBox
            args={[obj.width_m, 0.24, obj.depth_m]}
            radius={0.035}
            smoothness={4}
            position={[0, 0.15, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#451a03"
              roughness={0.42}
              metalness={0.12}
            />
          </RoundedBox>
          <mesh position={[0, 0.275, 0]}>
            <boxGeometry
              args={[obj.width_m + 0.015, 0.015, obj.depth_m + 0.015]}
            />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>

          <RoundedBox
            args={[obj.width_m * 0.94, 0.22, obj.depth_m * 0.94]}
            radius={0.055}
            smoothness={4}
            position={[0, 0.36, 0.03]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#f8fafc" roughness={0.68} />
          </RoundedBox>

          <RoundedBox
            args={[obj.width_m * 0.96, 0.23, obj.depth_m * 0.64]}
            radius={0.055}
            smoothness={4}
            position={[0, 0.39, 0.28]}
            castShadow
          >
            <meshStandardMaterial
              color="#1e3a8a"
              roughness={0.62}
              metalness={0.08}
            />
          </RoundedBox>

          <RoundedBox
            args={[obj.width_m * 0.97, 0.24, 0.34]}
            radius={0.04}
            smoothness={4}
            position={[0, 0.41, obj.depth_m * 0.38]}
            castShadow
          >
            <meshStandardMaterial
              color="#b45309"
              roughness={0.55}
              metalness={0.2}
            />
          </RoundedBox>

          {[-0.24, 0.24].map((px, idx) => (
            <RoundedBox
              key={idx}
              args={[obj.width_m * 0.38, 0.11, 0.34]}
              radius={0.04}
              smoothness={4}
              position={[px, 0.52, -obj.depth_m * 0.32]}
              rotation={[0.14, 0, 0]}
              castShadow
            >
              <meshStandardMaterial color="#ffffff" roughness={0.55} />
            </RoundedBox>
          ))}

          <RoundedBox
            args={[obj.width_m, 1.02, 0.1]}
            radius={0.035}
            smoothness={4}
            position={[0, 0.54, -obj.depth_m / 2 + 0.04]}
            castShadow
          >
            <meshStandardMaterial color="#1e293b" roughness={0.55} />
          </RoundedBox>
          <mesh position={[0, 1.06, -obj.depth_m / 2 + 0.04]}>
            <boxGeometry args={[obj.width_m + 0.02, 0.03, 0.11]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>

          {/* Bedside Nightstand + Warm Brass Sanctuary Lamp */}
          <group
            position={[obj.width_m / 2 + 0.25, 0, -obj.depth_m / 2 + 0.24]}
          >
            <RoundedBox
              args={[0.38, 0.48, 0.36]}
              radius={0.025}
              position={[0, 0.24, 0]}
              castShadow
            >
              <meshStandardMaterial color="#3b1d0a" roughness={0.45} />
            </RoundedBox>
            <mesh position={[0, 0.49, 0]}>
              <boxGeometry args={[0.4, 0.02, 0.38]} />
              <meshStandardMaterial color="#f1efe9" roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.56, 0]}>
              <cylinderGeometry args={[0.045, 0.075, 0.13, 18]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <coneGeometry args={[0.135, 0.19, 24, 1, true]} />
              <meshStandardMaterial
                color="#fef3c7"
                emissive="#f59e0b"
                emissiveIntensity={1.1}
                side={THREE.DoubleSide}
              />
            </mesh>
            <pointLight
              position={[0, 0.68, 0]}
              intensity={0.65}
              distance={3.2}
              color="#fbbf24"
            />
          </group>
        </group>
      )}

      {/* ==================== BOOKSHELF PREFAB ==================== */}
      {obj.category === "bookshelf" && (
        <group>
          <mesh
            position={[0, obj.height_m / 2, -obj.depth_m / 2 + 0.02]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[obj.width_m, obj.height_m, 0.035]} />
            <meshStandardMaterial
              color={isDanger ? "#6b1426" : "#4a2511"}
              roughness={0.42}
            />
          </mesh>
          <mesh
            position={[-obj.width_m / 2 + 0.025, obj.height_m / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.045, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial
              color={isDanger ? "#7f1d1d" : "#5c2d0c"}
              roughness={0.42}
            />
          </mesh>
          <mesh
            position={[obj.width_m / 2 - 0.025, obj.height_m / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.045, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial
              color={isDanger ? "#7f1d1d" : "#5c2d0c"}
              roughness={0.42}
            />
          </mesh>

          <mesh position={[0, obj.height_m + 0.015, 0]}>
            <boxGeometry
              args={[obj.width_m + 0.04, 0.035, obj.depth_m + 0.04]}
            />
            <meshStandardMaterial
              color={obj.anchored_to_wall ? "#10b981" : "#d4af37"}
              emissive={obj.anchored_to_wall ? "#059669" : "#000000"}
              emissiveIntensity={obj.anchored_to_wall ? 0.55 : 0}
              metalness={0.85}
              roughness={0.22}
            />
          </mesh>

          {[0.12, 0.52, 0.92, 1.34, 1.76, obj.height_m - 0.02].map((sy, i) => (
            <group key={i}>
              <mesh position={[0, sy, 0]} castShadow>
                <boxGeometry
                  args={[obj.width_m * 0.95, 0.035, obj.depth_m * 0.96]}
                />
                <meshStandardMaterial color="#78350f" roughness={0.42} />
              </mesh>
              {i >= 1 && i <= 3 && (
                <group position={[0, sy + 0.11, 0]}>
                  {[-0.18, -0.11, -0.04, 0.04, 0.12].map((bz, bIdx) => (
                    <mesh key={bIdx} position={[0, 0, bz]} castShadow>
                      <boxGeometry
                        args={[
                          obj.width_m * 0.72,
                          0.18 + (bIdx % 2) * 0.03,
                          0.048,
                        ]}
                      />
                      <meshStandardMaterial
                        color={
                          [
                            "#1e3a8a",
                            "#b45309",
                            "#065f46",
                            "#831843",
                            "#4c1d95",
                          ][(i + bIdx) % 5]
                        }
                        roughness={0.48}
                        metalness={0.15}
                      />
                    </mesh>
                  ))}
                </group>
              )}
            </group>
          ))}

          {childrenItems.map((child) => {
            const cy =
              child.shelf_level === "top"
                ? obj.height_m * 0.88
                : child.shelf_level === "middle"
                  ? obj.height_m * 0.52
                  : 0.24;
            const isTop = child.shelf_level === "top";
            return (
              <group key={child.id} position={[0, cy, 0]}>
                <RoundedBox
                  args={[obj.width_m * 0.82, 0.24, obj.depth_m * 0.74]}
                  radius={0.025}
                  castShadow
                >
                  <meshStandardMaterial
                    color={isTop ? "#ef4444" : "#10b981"}
                    emissive={isTop ? "#991b1b" : "#065f46"}
                    emissiveIntensity={0.5}
                    roughness={0.35}
                  />
                </RoundedBox>
                <Text
                  position={[obj.width_m / 2 + 0.06, 0, 0]}
                  rotation={[0, Math.PI / 2, 0]}
                  fontSize={0.09}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                >
                  {`${child.mass_kg}kg (${child.shelf_level?.toUpperCase()})`}
                </Text>
              </group>
            );
          })}

          {hazard?.com_height_m && (
            <group position={[0, hazard.com_height_m, obj.depth_m / 2 + 0.09]}>
              <mesh>
                <sphereGeometry args={[0.075, 20, 20]} />
                <meshStandardMaterial
                  color={isDanger ? "#ef4444" : "#10b981"}
                  emissive={isDanger ? "#dc2626" : "#059669"}
                  emissiveIntensity={1.1}
                />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.095, 0.115, 24]} />
                <meshBasicMaterial color="#d4af37" side={THREE.DoubleSide} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ==================== WARDROBE PREFAB ==================== */}
      {obj.category === "wardrobe" && (
        <group>
          <RoundedBox
            args={[obj.width_m, obj.height_m, obj.depth_m]}
            radius={0.03}
            position={[0, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={isDanger ? "#6b1426" : "#3b1d0a"}
              roughness={0.42}
              metalness={0.1}
            />
          </RoundedBox>
          <mesh position={[0, obj.height_m + 0.018, 0]}>
            <boxGeometry
              args={[obj.width_m + 0.04, 0.036, obj.depth_m + 0.04]}
            />
            <meshStandardMaterial
              color={obj.anchored_to_wall ? "#10b981" : "#d4af37"}
              emissive={obj.anchored_to_wall ? "#059669" : "#000000"}
              emissiveIntensity={obj.anchored_to_wall ? 0.6 : 0}
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>
          {[-obj.width_m * 0.23, obj.width_m * 0.23].map((dx, i) => (
            <group
              key={i}
              position={[dx, obj.height_m * 0.52, -obj.depth_m / 2 - 0.01]}
            >
              <mesh castShadow>
                <boxGeometry
                  args={[obj.width_m * 0.42, obj.height_m * 0.86, 0.02]}
                />
                <meshStandardMaterial
                  color={isDanger ? "#881337" : "#5c2d0c"}
                  roughness={0.38}
                />
              </mesh>
              <mesh position={[0, 0, -0.012]}>
                <boxGeometry
                  args={[obj.width_m * 0.36, obj.height_m * 0.78, 0.006]}
                />
                <meshStandardMaterial
                  color="#d4af37"
                  metalness={0.85}
                  roughness={0.22}
                />
              </mesh>
            </group>
          ))}
          {[-0.048, 0.048].map((hx, i) => (
            <mesh
              key={i}
              position={[hx, obj.height_m * 0.5, -obj.depth_m / 2 - 0.03]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.22, 14]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.92}
                roughness={0.15}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ==================== DESK PREFAB ==================== */}
      {obj.category === "desk" && (
        <group>
          <RoundedBox
            args={[obj.width_m, 0.058, obj.depth_m]}
            radius={0.02}
            position={[0, obj.height_m, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#0f766e"
              roughness={0.32}
              metalness={0.18}
            />
          </RoundedBox>
          <mesh position={[0, obj.height_m - 0.032, 0]}>
            <boxGeometry
              args={[obj.width_m + 0.01, 0.014, obj.depth_m + 0.01]}
            />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>

          {[
            [-obj.width_m / 2 + 0.05, -obj.depth_m / 2 + 0.05],
            [obj.width_m / 2 - 0.05, -obj.depth_m / 2 + 0.05],
            [-obj.width_m / 2 + 0.05, obj.depth_m / 2 - 0.05],
            [obj.width_m / 2 - 0.05, obj.depth_m / 2 - 0.05],
          ].map(([lx, lz], idx) => (
            <mesh key={idx} position={[lx, obj.height_m / 2, lz]} castShadow>
              <boxGeometry args={[0.055, obj.height_m, 0.055]} />
              <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.78}
                roughness={0.22}
              />
            </mesh>
          ))}

          <mesh position={[0, obj.height_m + 0.034, 0.14]} castShadow>
            <boxGeometry args={[0.38, 0.015, 0.14]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} />
          </mesh>
          <group position={[-obj.width_m * 0.36, obj.height_m + 0.03, -0.15]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.016, 0.045, 0.36, 14]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.88}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0.06, 0.36, 0.04]} rotation={[0.4, 0, -0.3]}>
              <coneGeometry args={[0.085, 0.13, 18]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#059669"
                emissiveIntensity={0.95}
              />
            </mesh>
          </group>

          {childrenItems.map((child) => (
            <group key={child.id} position={[0, obj.height_m + 0.27, -0.12]}>
              <mesh position={[0, -0.15, -0.04]}>
                <cylinderGeometry args={[0.025, 0.04, 0.22, 14]} />
                <meshStandardMaterial
                  color="#94a3b8"
                  metalness={0.8}
                  roughness={0.2}
                />
              </mesh>
              <RoundedBox args={[0.74, 0.39, 0.035]} radius={0.012} castShadow>
                <meshStandardMaterial
                  color="#0f172a"
                  roughness={0.25}
                  metalness={0.5}
                />
              </RoundedBox>
              <mesh position={[0, 0, 0.019]}>
                <planeGeometry args={[0.7, 0.35]} />
                <meshStandardMaterial
                  color="#38bdf8"
                  emissive="#0284c7"
                  emissiveIntensity={0.85}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ==================== ERGONOMIC CHAIR PREFAB ==================== */}
      {obj.category === "chair" && (
        <group>
          <RoundedBox
            args={[obj.width_m * 0.85, 0.075, obj.depth_m * 0.85]}
            radius={0.025}
            position={[0, 0.46, 0]}
            castShadow
          >
            <meshStandardMaterial color="#1e293b" roughness={0.45} />
          </RoundedBox>
          <RoundedBox
            args={[obj.width_m * 0.8, 0.44, 0.06]}
            radius={0.025}
            position={[0, 0.72, obj.depth_m * 0.36]}
            castShadow
          >
            <meshStandardMaterial color="#334155" roughness={0.45} />
          </RoundedBox>
          <mesh position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.42, 14]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((ang, i) => (
            <mesh
              key={i}
              position={[Math.sin(ang) * 0.14, 0.04, Math.cos(ang) * 0.14]}
              rotation={[0, ang, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.015, 0.015, 0.28, 10]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ==================== GRAND PORTAL EXIT DOOR PREFAB ==================== */}
      {obj.category === "exit_door" && (
        <group>
          {[-obj.width_m / 2 - 0.07, obj.width_m / 2 + 0.07].map((px, idx) => (
            <mesh key={idx} position={[px, obj.height_m / 2, 0]} castShadow>
              <boxGeometry args={[0.1, obj.height_m + 0.12, 0.14]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.88}
                roughness={0.22}
              />
            </mesh>
          ))}
          <mesh position={[0, obj.height_m + 0.08, 0]} castShadow>
            <boxGeometry args={[obj.width_m + 0.28, 0.12, 0.18]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>

          <RoundedBox
            args={[obj.width_m, obj.height_m, 0.075]}
            radius={0.015}
            position={[0, obj.height_m / 2, 0]}
            castShadow
          >
            <meshStandardMaterial
              color="#064e3b"
              emissive="#059669"
              emissiveIntensity={0.45}
              roughness={0.35}
            />
          </RoundedBox>
          <RoundedBox
            args={[0.48, 0.16, 0.06]}
            radius={0.02}
            position={[0, obj.height_m + 0.24, 0]}
          >
            <meshStandardMaterial
              color="#10b981"
              emissive="#34d399"
              emissiveIntensity={1.6}
            />
          </RoundedBox>
          <mesh
            position={[-obj.width_m * 0.34, 1.02, -0.055]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.016, 0.016, 0.13, 14]} />
            <meshStandardMaterial
              color="#fde047"
              metalness={0.95}
              roughness={0.12}
            />
          </mesh>
        </group>
      )}

      {/* ==================== TEMPERED GLASS CASEMENT WINDOW PREFAB ==================== */}
      {obj.category === "window" && (
        <group position={[0, 0.9, 0]}>
          <mesh>
            <boxGeometry
              args={[
                obj.width_m + 0.08,
                obj.height_m + 0.08,
                obj.depth_m + 0.04,
              ]}
            />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.82}
              roughness={0.25}
            />
          </mesh>
          <mesh>
            <boxGeometry args={[obj.width_m, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={0.35}
              transparent
              opacity={0.42}
              metalness={0.85}
              roughness={0.08}
            />
          </mesh>
        </group>
      )}

      {/* ==================== HIGH-DPI GLASSMORPHIC FLOATING TELEMETRY SPRITE ==================== */}
      {pillTexture && (
        <sprite
          ref={spriteRef}
          position={[0, Math.max(obj.height_m + 0.38, 1.25), 0]}
          scale={[1.45, 0.36, 1]}
        >
          <spriteMaterial
            map={pillTexture}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      )}
    </group>
  );
}

/**
 * Memory Palace Catmull-Rom 3D Glowing Tube Threads & Floating Octahedron Diamond Beacons
 */
function AnimatedEscapePath({
  path,
  shelterZone,
  roomWidth,
  roomDepth,
  exitClear,
}: {
  path: Array<{ x_m: number; z_m: number }>;
  shelterZone: {
    x_m: number;
    z_m: number;
    label: string;
  } | null;
  roomWidth: number;
  roomDepth: number;
  exitClear: boolean;
}) {
  const beaconGroupRef = useRef<THREE.Group>(null);
  const shelterDomeRef = useRef<THREE.Mesh>(null);

  const points3D = useMemo(() => {
    if (!path || path.length < 2) return [];
    return path.map(
      (pt) =>
        new THREE.Vector3(pt.x_m - roomWidth / 2, 0.055, pt.z_m - roomDepth / 2)
    );
  }, [path, roomWidth, roomDepth]);

  const shelterTarget3D = useMemo(() => {
    if (!shelterZone) return null;
    return new THREE.Vector3(
      shelterZone.x_m - roomWidth / 2,
      0.06,
      shelterZone.z_m - roomDepth / 2
    );
  }, [shelterZone, roomWidth, roomDepth]);

  const phase1TubeGeo = useMemo(() => {
    if (!shelterTarget3D) return null;
    const start =
      points3D.length > 0
        ? points3D[0]
        : new THREE.Vector3(0.95 - roomWidth / 2, 0.055, 2.2 - roomDepth / 2);
    const mid = new THREE.Vector3(
      (start.x + shelterTarget3D.x) * 0.5,
      0.08,
      start.z * 0.65 + shelterTarget3D.z * 0.35
    );
    const curve = new THREE.CatmullRomCurve3([start, mid, shelterTarget3D]);
    return new THREE.TubeGeometry(curve, 36, 0.028, 12, false);
  }, [points3D, shelterTarget3D, roomWidth, roomDepth]);

  const phase2TubeGeo = useMemo(() => {
    if (points3D.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points3D);
    return new THREE.TubeGeometry(curve, 64, 0.036, 14, false);
  }, [points3D]);

  const beaconNodes = useMemo(() => {
    if (points3D.length < 2) return [];
    const curve = new THREE.CatmullRomCurve3(points3D);
    const totalLen = curve.getLength();
    const count = Math.max(4, Math.min(9, Math.floor(totalLen / 0.55)));
    const nodes: THREE.Vector3[] = [];
    for (let i = 1; i <= count; i++) {
      nodes.push(curve.getPointAt(i / (count + 1)));
    }
    return nodes;
  }, [points3D]);

  const shelterSpriteTex = useMemo(
    () =>
      getGlassPillTexture({
        badge: "P1",
        title: "Drop, Cover & Hold On",
        subtitle: "Under-Desk Safe Shelter Zone",
        accentColor: "#38bdf8",
        badgeBg: "#0284c7",
      }),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beaconGroupRef.current) {
      beaconGroupRef.current.children.forEach((child, idx) => {
        child.position.y = 0.16 + Math.sin(t * 3.8 - idx * 0.7) * 0.045;
        child.rotation.y = t * 1.8 + idx * 0.5;
      });
    }
    if (shelterDomeRef.current) {
      const s = 1 + Math.sin(t * 3.2) * 0.05;
      shelterDomeRef.current.scale.set(s, 1, s);
    }
  });

  const mainColor = exitClear ? "#10b981" : "#ef4444";

  return (
    <group>
      {/* PHASE 1: Glowing Cyan/Gold Tube Thread to Under-Desk Safe Shelter */}
      {phase1TubeGeo && shelterTarget3D && (
        <group>
          <mesh geometry={phase1TubeGeo}>
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.4}
              roughness={0.2}
            />
          </mesh>

          <group position={[shelterTarget3D.x, 0.015, shelterTarget3D.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.32, 0.44, 40]} />
              <meshBasicMaterial
                color="#38bdf8"
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh ref={shelterDomeRef} position={[0, 0.32, 0]}>
              <cylinderGeometry args={[0.38, 0.42, 0.62, 28, 1, true]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.6}
                transparent
                opacity={0.18}
                side={THREE.DoubleSide}
              />
            </mesh>
            <sprite position={[0, 1.18, 0]} scale={[1.38, 0.34, 1]}>
              <spriteMaterial
                map={shelterSpriteTex}
                transparent
                depthTest={false}
                depthWrite={false}
              />
            </sprite>
          </group>
        </group>
      )}

      {/* PHASE 2: Glowing Catmull-Rom 3D Tube Thread to Bedroom Exit Door */}
      {phase2TubeGeo && (
        <mesh geometry={phase2TubeGeo}>
          <meshStandardMaterial
            color={mainColor}
            emissive={mainColor}
            emissiveIntensity={1.5}
            roughness={0.18}
          />
        </mesh>
      )}

      {points3D.length > 0 && (
        <group position={[points3D[0].x, 0.015, points3D[0].z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.14, 0.22, 32]} />
            <meshBasicMaterial color="#d4af37" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      <group ref={beaconGroupRef}>
        {beaconNodes.map((pt, idx) => (
          <mesh key={idx} position={[pt.x, 0.16, pt.z]}>
            <octahedronGeometry args={[0.055, 0]} />
            <meshStandardMaterial
              color={exitClear ? "#fde68a" : "#fca5a5"}
              emissive={mainColor}
              emissiveIntensity={1.4}
              metalness={0.4}
              roughness={0.15}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Tipping Danger Arc Overlay on Floor
 */
function TippingDangerZones({
  scene,
  simReport,
  remediated,
}: {
  scene: RoomSceneGraph;
  simReport: EgressAndShelterResult;
  remediated: boolean;
}) {
  if (remediated) return null;

  const { width_m, depth_m } = scene.room;

  return (
    <group>
      {simReport.object_results.map((h: ObjectHazardResult) => {
        if (!h.tipped_over) return null;
        const bbox = h.resting_bbox_2d;
        const zoneW = Math.max(0.4, bbox.max_x - bbox.min_x);
        const zoneD = Math.max(0.4, bbox.max_z - bbox.min_z);
        const dzX = (bbox.min_x + bbox.max_x) / 2 - width_m / 2;
        const dzZ = (bbox.min_z + bbox.max_z) / 2 - depth_m / 2;

        return (
          <group key={h.object_id} position={[dzX, 0.012, dzZ]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[zoneW, zoneD]} />
              <meshBasicMaterial
                color="#ef4444"
                transparent
                opacity={0.22}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Line
              points={[
                [-zoneW / 2, 0.015, -zoneD / 2],
                [zoneW / 2, 0.015, -zoneD / 2],
                [zoneW / 2, 0.015, zoneD / 2],
                [-zoneW / 2, 0.015, zoneD / 2],
                [-zoneW / 2, 0.015, -zoneD / 2],
              ]}
              color="#f87171"
              lineWidth={2}
            />
          </group>
        );
      })}
    </group>
  );
}

/**
 * Global Seismic Ground-Motion Shake Wrapper
 */
function SeismicTableGroup({
  isShaking,
  pgaG,
  children,
}: {
  isShaking: boolean;
  pgaG: number;
  children: React.ReactNode;
}) {
  const tableRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!tableRef.current) return;
    if (isShaking) {
      const t = clock.getElapsedTime();
      const amp = Math.min(0.14, pgaG * 0.14);
      tableRef.current.position.x =
        Math.sin(t * 34) * amp + Math.cos(t * 19) * (amp * 0.5);
      tableRef.current.position.z =
        Math.cos(t * 29) * amp + Math.sin(t * 15) * (amp * 0.4);
    } else {
      tableRef.current.position.x = THREE.MathUtils.lerp(
        tableRef.current.position.x,
        0,
        0.2
      );
      tableRef.current.position.z = THREE.MathUtils.lerp(
        tableRef.current.position.z,
        0,
        0.2
      );
    }
  });

  return <group ref={tableRef}>{children}</group>;
}

export default function QuakeRoomCanvas({
  scene,
  simReport,
  isShaking,
  remediated,
  firstPersonMode = false,
  onToggleFirstPerson,
  compact = false,
  label,
}: QuakeRoomCanvasProps) {
  const { width_m, depth_m, height_m } = scene.room;
  const [freeWalkMode, setFreeWalkMode] = useState(false);
  const [fpHudStatus, setFpHudStatus] = useState(
    "PHASE 1 (DURING QUAKE): Dropping & crawling under reinforced study desk shelter..."
  );

  const floorPgaG =
    simReport.object_results[0]?.pga_ratio_g ??
    simReport.monte_carlo?.pga_g_range[0] ??
    0.45;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050811]">
      {/* Split-Screen Comparison Pill */}
      {label && (
        <div className="pointer-events-none absolute top-20 left-5 z-20">
          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-md border shadow-xl ${
              remediated
                ? "bg-emerald-950/85 border-emerald-400/60 text-emerald-200"
                : "bg-red-950/85 border-red-400/60 text-red-200"
            }`}
          >
            {label}
          </div>
        </div>
      )}

      {/* 1st-Person Interactive Sub-Bar */}
      {firstPersonMode && (
        <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2 bg-slate-950/90 backdrop-blur-xl border border-amber-400/40 px-4 py-2 rounded-2xl shadow-2xl">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-semibold text-amber-100">
            {fpHudStatus}
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={() => setFreeWalkMode(false)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                !freeWalkMode
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Auto-Drill (P1 → P2)
            </button>
            <button
              onClick={() => setFreeWalkMode(true)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                freeWalkMode
                  ? "bg-sky-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              WASD Free-Walk
            </button>
            {onToggleFirstPerson && (
              <button
                onClick={onToggleFirstPerson}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600"
              >
                Orbital View
              </button>
            )}
          </div>
        </div>
      )}

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#050811"]} />
        <fogExp2 attach="fog" args={["#050811", 0.032]} />

        <PerspectiveCamera
          makeDefault
          position={compact ? [2.8, 3.6, 3.8] : [2.6, 3.35, 3.75]}
          fov={compact ? 48 : 44}
        />

        {!firstPersonMode && (
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={1.8}
            maxDistance={11.5}
            maxPolarAngle={Math.PI / 2 - 0.03}
            target={[0, 0.85, 0]}
            dampingFactor={0.06}
          />
        )}

        <FirstPersonEscapeController
          active={firstPersonMode}
          freeWalkMode={freeWalkMode}
          isShaking={isShaking}
          shelterZone={simReport.safe_shelter_spot_m}
          escapePath={simReport.escape_path_points_m}
          widthM={width_m}
          depthM={depth_m}
          onHudUpdate={setFpHudStatus}
        />

        {/* Memory Palace Sanctuary Lighting Rig */}
        <ambientLight intensity={0.58} color="#e2e8f0" />
        <hemisphereLight
          intensity={0.55}
          color="#fef3c7"
          groundColor="#0f172a"
        />
        <directionalLight
          position={[5.5, 9.5, 6.5]}
          intensity={1.65}
          color="#fffbeb"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0002}
        />
        <directionalLight
          position={[-5, 5, -4]}
          intensity={0.55}
          color="#38bdf8"
        />

        <SanctuaryAtmosphere isShaking={isShaking} />

        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.55}
          scale={10}
          blur={1.8}
          far={4}
        />

        <SeismicTableGroup isShaking={isShaking} pgaG={floorPgaG}>
          <ArchitecturalRoomShell
            widthM={width_m}
            depthM={depth_m}
            heightM={height_m}
            remediated={remediated}
          />

          <OrnateChandelier heightM={height_m} isShaking={isShaking} />

          <TippingDangerZones
            scene={scene}
            simReport={simReport}
            remediated={remediated}
          />

          <AnimatedEscapePath
            path={simReport.escape_path_points_m}
            shelterZone={simReport.safe_shelter_spot_m}
            roomWidth={width_m}
            roomDepth={depth_m}
            exitClear={simReport.exit_reachable_post_quake}
          />

          {scene.objects.map((obj) => (
            <FurniturePrefab
              key={obj.id}
              obj={obj}
              allObjects={scene.objects}
              roomWidth={width_m}
              roomDepth={depth_m}
              hazard={simReport.object_results.find(
                (h: ObjectHazardResult) => h.object_id === obj.id
              )}
              isShaking={isShaking}
              remediated={remediated}
            />
          ))}
        </SeismicTableGroup>
      </Canvas>
    </div>
  );
}
