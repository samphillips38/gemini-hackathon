"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Line,
  RoundedBox,
  ContactShadows,
  Sky,
} from "@react-three/drei";
import * as THREE from "three";
import {
  RoomSceneGraph,
  RoomObjectNode,
  EgressAndShelterResult,
  ObjectHazardResult,
} from "@/types/contracts";

interface QuakeRoomCanvasProps {
  scene: RoomSceneGraph;
  evaluation: EgressAndShelterResult;
  isShaking: boolean;
  hasCollapsed: boolean;
  walkthroughActive: boolean;
  titleBadge?: string;
}

/**
 * Interactive First-Person Walkthrough Controller
 * Supports:
 * 1) Auto-Guided 2-Phase Seismic Drill (Phase 1: Duck under Desk -> Phase 2: Follow A* Path to Exit)
 * 2) Free WASD / Arrow Key Movement + Mouse-Drag 360° Look + Crouch (C / Shift) + Seismic Camera Shake
 */
function WalkthroughController({
  active,
  autoGuide,
  isShaking,
  magnitudeMw,
  escapePath,
  shelterSpot,
  roomWidth,
  roomDepth,
  onPhaseChange,
}: {
  active: boolean;
  autoGuide: boolean;
  isShaking: boolean;
  magnitudeMw: number;
  escapePath: Array<{ x_m: number; z_m: number }>;
  shelterSpot: { x_m: number; z_m: number; label: string } | null;
  roomWidth: number;
  roomDepth: number;
  onPhaseChange?: (phaseText: string) => void;
}) {
  const { camera, gl } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  const yawRef = useRef(0);
  const pitchRef = useRef(-0.08);
  const isPointerDown = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const progressRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      isPointerDown.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      isPointerDown.current = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!active || !isPointerDown.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      yawRef.current -= dx * 0.005;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - dy * 0.004,
        -Math.PI / 2.4,
        Math.PI / 2.4
      );
    };

    const dom = gl.domElement;
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
  }, [active, gl.domElement]);

  useEffect(() => {
    if (active) {
      progressRef.current = 0;
      const startPt = escapePath[0] || { x_m: 1.4, z_m: 2.2 };
      camera.position.set(
        startPt.x_m - roomWidth / 2,
        1.58,
        startPt.z_m - roomDepth / 2
      );
      yawRef.current = -0.6;
      pitchRef.current = -0.12;
    } else {
      camera.position.set(0, 4.5, 5.1);
      camera.lookAt(0, 0.6, 0);
    }
  }, [active, camera, escapePath, roomWidth, roomDepth]);

  useFrame((state, delta) => {
    if (!active) return;

    const t = state.clock.getElapsedTime();
    const isCrouching =
      keys.current["KeyC"] || keys.current["ShiftLeft"] || isShaking;
    const baseEyeHeight = isCrouching ? 0.62 : 1.58;

    // Keyboard rotation (Q / E)
    if (keys.current["KeyQ"]) yawRef.current += 1.6 * delta;
    if (keys.current["KeyE"]) yawRef.current -= 1.6 * delta;

    const forward = new THREE.Vector3(
      -Math.sin(yawRef.current),
      0,
      -Math.cos(yawRef.current)
    ).normalize();
    const right = new THREE.Vector3().crossVectors(
      forward,
      new THREE.Vector3(0, 1, 0)
    );

    const moveSpeed = (isCrouching ? 1.5 : 2.5) * delta;
    let manualMoved = false;

    if (keys.current["KeyW"] || keys.current["ArrowUp"]) {
      camera.position.addScaledVector(forward, moveSpeed);
      manualMoved = true;
    }
    if (keys.current["KeyS"] || keys.current["ArrowDown"]) {
      camera.position.addScaledVector(forward, -moveSpeed);
      manualMoved = true;
    }
    if (keys.current["KeyA"] || keys.current["ArrowLeft"]) {
      camera.position.addScaledVector(right, -moveSpeed);
      manualMoved = true;
    }
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) {
      camera.position.addScaledVector(right, moveSpeed);
      manualMoved = true;
    }

    // Clamp position inside room interior walls
    const margin = 0.32;
    camera.position.x = THREE.MathUtils.clamp(
      camera.position.x,
      -roomWidth / 2 + margin,
      roomWidth / 2 - margin
    );
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z,
      -roomDepth / 2 + margin,
      roomDepth / 2 - margin
    );

    if (!manualMoved && autoGuide) {
      if (isShaking && shelterSpot) {
        // Phase 1: Move to & crouch under sturdy study desk during shaking
        onPhaseChange?.(
          "PHASE 1 (DURING QUAKE): Ducking under sturdy Steel Study Desk — Drop, Cover & Hold On!"
        );
        const sx = shelterSpot.x_m - roomWidth / 2;
        const sz = shelterSpot.z_m - roomDepth / 2;
        camera.position.lerp(new THREE.Vector3(sx, 0.56, sz), 0.08);
        const lookQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(-0.05, yawRef.current + Math.sin(t * 1.5) * 0.25, 0, "YXZ")
        );
        camera.quaternion.slerp(lookQuat, 0.15);
      } else if (escapePath.length > 1) {
        // Phase 2: Glide along the verified green A* path to the exit door
        onPhaseChange?.(
          "PHASE 2 (POST-SHAKE EGRESS): Following verified A* green chevron corridor to Exit Door"
        );
        progressRef.current = (progressRef.current + delta * 0.22) % 1;
        const floatIdx = progressRef.current * (escapePath.length - 1);
        const idx = Math.floor(floatIdx);
        const nextIdx = Math.min(escapePath.length - 1, idx + 1);
        const alpha = floatIdx - idx;

        const p1 = escapePath[idx];
        const p2 = escapePath[nextIdx];
        const wx = THREE.MathUtils.lerp(p1.x_m, p2.x_m, alpha) - roomWidth / 2;
        const wz = THREE.MathUtils.lerp(p1.z_m, p2.z_m, alpha) - roomDepth / 2;

        const bob = Math.sin(t * 9) * 0.03;
        camera.position.lerp(new THREE.Vector3(wx, 1.52 + bob, wz), 0.14);

        const lookTarget = escapePath[Math.min(escapePath.length - 1, nextIdx + 2)];
        const targetVec = new THREE.Vector3(
          lookTarget.x_m - roomWidth / 2,
          1.25,
          lookTarget.z_m - roomDepth / 2
        );
        const m = new THREE.Matrix4().lookAt(
          camera.position,
          targetVec,
          new THREE.Vector3(0, 1, 0)
        );
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
        camera.quaternion.slerp(targetQuat, 0.12);
      }
    } else {
      // Free-walk camera look + head bob
      onPhaseChange?.(
        isCrouching
          ? "FREE WALK (CROUCHING): Protected low stance — use WASD to move, drag mouse to look"
          : "FREE WALK ACTIVE: Use WASD / Arrows to walk room, drag mouse to look, press C to crouch"
      );
      const bob = manualMoved ? Math.sin(t * 11) * 0.035 : 0;
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        baseEyeHeight + bob,
        0.18
      );
      const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, "YXZ");
      camera.quaternion.setFromEuler(euler);
    }

    // Add realistic seismic camera tremor if earthquake is active
    if (isShaking) {
      const tremor = 0.015 * Math.pow(1.35, magnitudeMw - 5.5);
      camera.position.x += Math.sin(t * 43) * tremor;
      camera.position.y += Math.cos(t * 37) * tremor * 0.8;
      camera.rotation.z = Math.sin(t * 29) * tremor * 1.4;
    } else {
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0, 0.2);
    }
  });

  return null;
}

/**
 * Animated Glowing 3D Floor Chevrons + Volumetric Guidance Ribbon
 */
function AnimatedEscapePath({
  points,
  color = "#10b981",
}: {
  points: THREE.Vector3[];
  color?: string;
}) {
  const chevronsRef = useRef<THREE.Group>(null);

  const chevronTransforms = useMemo(() => {
    if (points.length < 2) return [];
    const list: Array<{ pos: THREE.Vector3; rotY: number; index: number }> = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const mid = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
      mid.y = 0.035;
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const rotY = Math.atan2(dx, dz);
      list.push({ pos: mid, rotY, index: i });
    }
    return list;
  }, [points]);

  useFrame((state) => {
    if (!chevronsRef.current) return;
    const t = state.clock.getElapsedTime();
    chevronsRef.current.children.forEach((child, idx) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        const wave = 0.5 + 0.5 * Math.sin(t * 6 - idx * 0.7);
        mat.emissiveIntensity = 0.5 + wave * 1.4;
        mesh.position.y = 0.035 + wave * 0.02;
      }
    });
  });

  if (points.length < 2) return null;

  return (
    <group>
      {/* Raised Glowing Path Ribbon */}
      <Line points={points} color={color} lineWidth={7} />
      <Line
        points={points.map((p) => new THREE.Vector3(p.x, 0.015, p.z))}
        color="#ffffff"
        lineWidth={2.5}
      />

      {/* Directional Pulsing Floor Chevrons */}
      <group ref={chevronsRef}>
        {chevronTransforms.map((c, i) => (
          <mesh
            key={i}
            position={c.pos}
            rotation={[Math.PI / 2, 0, -c.rotY]}
          >
            <coneGeometry args={[0.11, 0.22, 3]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.1}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Falling Ceiling Dust & Plaster Debris Particles during Quake
 */
function SeismicDebrisParticles({
  active,
  roomWidth,
  roomDepth,
  roomHeight,
}: {
  active: boolean;
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    return Array.from({ length: 42 }).map((_, i) => ({
      x: ((i * 73) % 100) / 100 * (roomWidth - 0.4) - (roomWidth - 0.4) / 2,
      y: ((i * 37) % 100) / 100 * roomHeight,
      z: ((i * 53) % 100) / 100 * (roomDepth - 0.4) - (roomDepth - 0.4) / 2,
      speed: 0.9 + ((i * 19) % 10) * 0.18,
      size: 0.02 + ((i * 11) % 5) * 0.008,
    }));
  }, [roomWidth, roomDepth, roomHeight]);

  useFrame((_, delta) => {
    if (!groupRef.current || !active) return;
    groupRef.current.children.forEach((child, idx) => {
      const p = particles[idx];
      child.position.y -= p.speed * delta;
      child.rotation.x += delta * 3;
      child.rotation.z += delta * 2;
      if (child.position.y < 0.04) {
        child.position.y = roomHeight - 0.1;
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <dodecahedronGeometry args={[p.size, 0]} />
          <meshStandardMaterial
            color="#cbd5e1"
            emissive="#94a3b8"
            emissiveIntensity={0.3}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * High-Detail Procedural 3D Furniture & Interior Prefabs
 */
function FurniturePrefab({
  obj,
  allObjects,
  hazard,
  roomWidth,
  roomDepth,
  isShaking,
  hasCollapsed,
}: {
  obj: RoomObjectNode;
  allObjects: RoomObjectNode[];
  hazard?: ObjectHazardResult;
  roomWidth: number;
  roomDepth: number;
  isShaking: boolean;
  hasCollapsed: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rotRad = (obj.rotation_deg * Math.PI) / 180;
  const isRotated = obj.rotation_deg === 90 || obj.rotation_deg === 270;
  const effW = isRotated ? obj.depth_m : obj.width_m;
  const effD = isRotated ? obj.width_m : obj.depth_m;

  const centerX = obj.x_m + effW / 2 - roomWidth / 2;
  const centerZ = obj.z_m + effD / 2 - roomDepth / 2;

  const childrenItems = useMemo(
    () => allObjects.filter((c) => c.parent_id === obj.id),
    [allObjects, obj.id]
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const shouldTip = Boolean(
      hazard?.tipped_over && (isShaking || hasCollapsed)
    );

    if (shouldTip) {
      const targetAngle =
        obj.category === "wardrobe" ? -Math.PI * 0.46 : Math.PI * 0.45;
      if (obj.category === "wardrobe") {
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z,
          targetAngle,
          0.08
        );
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          0.32,
          0.08
        );
        groupRef.current.position.x = THREE.MathUtils.lerp(
          groupRef.current.position.x,
          centerX + 0.55,
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

  const sf = hazard?.analytical_safety_factor ?? 1.5;
  const isDanger = sf < 1.0 && !obj.anchored_to_wall;

  return (
    <group
      ref={groupRef}
      position={[centerX, 0, centerZ]}
      rotation={[0, rotRad, 0]}
    >
      {/* ==================== BED PREFAB WITH NIGHTSTAND & LAMP ==================== */}
      {obj.category === "bed" && (
        <group>
          {/* Soft Woven Area Rug Under Bed */}
          <mesh position={[0.25, 0.008, 0]} receiveShadow>
            <boxGeometry args={[obj.width_m + 0.7, 0.012, obj.depth_m + 0.35]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>

          {/* Warm Oak Bed Frame */}
          <RoundedBox
            args={[obj.width_m, 0.24, obj.depth_m]}
            radius={0.03}
            smoothness={4}
            position={[0, 0.16, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#78350f" roughness={0.65} />
          </RoundedBox>

          {/* Tufted Mattress */}
          <RoundedBox
            args={[obj.width_m * 0.94, 0.22, obj.depth_m * 0.94]}
            radius={0.05}
            smoothness={4}
            position={[0, 0.36, 0.03]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#f8fafc" roughness={0.8} />
          </RoundedBox>

          {/* Quilted Duvet Blanket */}
          <RoundedBox
            args={[obj.width_m * 0.96, 0.23, obj.depth_m * 0.64]}
            radius={0.05}
            smoothness={4}
            position={[0, 0.39, 0.28]}
            castShadow
          >
            <meshStandardMaterial color="#1d4ed8" roughness={0.75} />
          </RoundedBox>

          {/* Accent Folded Throw Blanket at Foot of Bed */}
          <RoundedBox
            args={[obj.width_m * 0.97, 0.24, 0.34]}
            radius={0.04}
            smoothness={4}
            position={[0, 0.41, obj.depth_m * 0.38]}
            castShadow
          >
            <meshStandardMaterial color="#0284c7" roughness={0.8} />
          </RoundedBox>

          {/* Dual Plush Pillows */}
          {[-0.24, 0.24].map((px, idx) => (
            <RoundedBox
              key={idx}
              args={[obj.width_m * 0.38, 0.11, 0.34]}
              radius={0.04}
              smoothness={4}
              position={[px, 0.51, -obj.depth_m * 0.32]}
              rotation={[0.12, 0, 0]}
              castShadow
            >
              <meshStandardMaterial color="#ffffff" roughness={0.6} />
            </RoundedBox>
          ))}

          {/* Upholstered Headboard */}
          <RoundedBox
            args={[obj.width_m, 0.95, 0.09]}
            radius={0.03}
            smoothness={4}
            position={[0, 0.52, -obj.depth_m / 2 + 0.04]}
            castShadow
          >
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </RoundedBox>

          {/* Bedside Nightstand + Warm Table Lamp */}
          <group position={[obj.width_m / 2 + 0.24, 0, -obj.depth_m / 2 + 0.24]}>
            <RoundedBox
              args={[0.38, 0.48, 0.36]}
              radius={0.02}
              position={[0, 0.24, 0]}
              castShadow
            >
              <meshStandardMaterial color="#451a03" roughness={0.6} />
            </RoundedBox>
            {/* Lamp Base */}
            <mesh position={[0, 0.54, 0]}>
              <cylinderGeometry args={[0.05, 0.07, 0.12, 16]} />
              <meshStandardMaterial color="#d97706" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Glowing Warm Lamp Shade */}
            <mesh position={[0, 0.68, 0]}>
              <coneGeometry args={[0.13, 0.18, 20, 1, true]} />
              <meshStandardMaterial
                color="#fef3c7"
                emissive="#f59e0b"
                emissiveIntensity={0.9}
                side={THREE.DoubleSide}
              />
            </mesh>
            <pointLight
              position={[0, 0.66, 0]}
              intensity={0.45}
              distance={2.6}
              color="#fbbf24"
            />
          </group>
        </group>
      )}

      {/* ==================== BOOKSHELF PREFAB WITH BOOKS & CoM GIZMO ==================== */}
      {obj.category === "bookshelf" && (
        <group>
          {/* Left, Right & Back Oak Frame Panels */}
          <mesh
            position={[0, obj.height_m / 2, -obj.depth_m / 2 + 0.02]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[obj.width_m, obj.height_m, 0.03]} />
            <meshStandardMaterial
              color={isDanger ? "#7f1d1d" : "#713f12"}
              roughness={0.55}
            />
          </mesh>
          <mesh
            position={[-obj.width_m / 2 + 0.02, obj.height_m / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.04, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial
              color={isDanger ? "#991b1b" : "#854d0e"}
              roughness={0.55}
            />
          </mesh>
          <mesh
            position={[obj.width_m / 2 - 0.02, obj.height_m / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.04, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial
              color={isDanger ? "#991b1b" : "#854d0e"}
              roughness={0.55}
            />
          </mesh>

          {/* 5 Horizontal Shelves + Decorative Book Rows */}
          {[0.12, 0.52, 0.92, 1.34, 1.76, obj.height_m - 0.02].map((sy, i) => (
            <group key={i}>
              <mesh position={[0, sy, 0]} castShadow>
                <boxGeometry
                  args={[obj.width_m * 0.96, 0.035, obj.depth_m * 0.96]}
                />
                <meshStandardMaterial color="#a16207" roughness={0.5} />
              </mesh>
              {/* Decorative Individual Book Spines on Middle Shelves */}
              {i >= 1 && i <= 3 && (
                <group position={[0, sy + 0.11, 0]}>
                  {[-0.18, -0.11, -0.04, 0.04, 0.12].map((bz, bIdx) => (
                    <mesh key={bIdx} position={[0, 0, bz]} castShadow>
                      <boxGeometry
                        args={[
                          obj.width_m * 0.72,
                          0.18 + (bIdx % 2) * 0.03,
                          0.045,
                        ]}
                      />
                      <meshStandardMaterial
                        color={
                          ["#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"][
                            (i + bIdx) % 5
                          ]
                        }
                        roughness={0.6}
                      />
                    </mesh>
                  ))}
                </group>
              )}
            </group>
          ))}

          {/* Stacked Heavy Items (20kg Engineering Textbooks & Lab Gear) */}
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
                  args={[obj.width_m * 0.82, 0.25, obj.depth_m * 0.72]}
                  radius={0.02}
                  castShadow
                >
                  <meshStandardMaterial
                    color={isTop ? "#ef4444" : "#10b981"}
                    emissive={isTop ? "#991b1b" : "#065f46"}
                    emissiveIntensity={0.45}
                  />
                </RoundedBox>
                <Text
                  position={[obj.width_m / 2 + 0.06, 0, 0]}
                  rotation={[0, Math.PI / 2, 0]}
                  fontSize={0.095}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                >
                  {`${child.mass_kg}kg (${child.shelf_level?.toUpperCase()})`}
                </Text>
              </group>
            );
          })}

          {/* Center-of-Mass (h_CoM) Holographic Sphere */}
          {hazard?.com_height_m && (
            <group position={[0, hazard.com_height_m, obj.depth_m / 2 + 0.09]}>
              <mesh>
                <sphereGeometry args={[0.085, 20, 20]} />
                <meshStandardMaterial
                  color={isDanger ? "#ff2222" : "#22c55e"}
                  emissive={isDanger ? "#ff0000" : "#16a34a"}
                  emissiveIntensity={0.95}
                />
              </mesh>
              <Text
                position={[0, 0.14, 0]}
                fontSize={0.085}
                color={isDanger ? "#fca5a5" : "#86efac"}
              >
                {`CoM: ${hazard.com_height_m}m`}
              </Text>
            </group>
          )}
        </group>
      )}

      {/* ==================== WARDROBE PREFAB WITH DOORS & HANDLES ==================== */}
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
              color={isDanger ? "#7f1d1d" : "#5c2d0c"}
              roughness={0.55}
            />
          </RoundedBox>
          {/* Twin Recessed Door Panels */}
          {[-obj.width_m * 0.23, obj.width_m * 0.23].map((dx, i) => (
            <mesh
              key={i}
              position={[dx, obj.height_m * 0.52, -obj.depth_m / 2 - 0.008]}
              castShadow
            >
              <boxGeometry
                args={[obj.width_m * 0.42, obj.height_m * 0.88, 0.018]}
              />
              <meshStandardMaterial
                color={isDanger ? "#991b1b" : "#78350f"}
                roughness={0.5}
              />
            </mesh>
          ))}
          {/* Brushed Brass Handles */}
          {[-0.045, 0.045].map((hx, i) => (
            <mesh
              key={i}
              position={[hx, obj.height_m * 0.5, -obj.depth_m / 2 - 0.025]}
            >
              <cylinderGeometry args={[0.01, 0.01, 0.18, 12]} />
              <meshStandardMaterial
                color="#fbbf24"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}
          {/* Non-Drill Seismic Wedge Strap Indicator when Anchored */}
          {obj.anchored_to_wall && (
            <mesh position={[0, obj.height_m + 0.02, 0]}>
              <boxGeometry args={[obj.width_m * 0.9, 0.04, obj.depth_m * 0.9]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#059669"
                emissiveIntensity={0.7}
              />
            </mesh>
          )}
        </group>
      )}

      {/* ==================== DESK PREFAB (SAFE SHELTER) WITH WORKSTATION ==================== */}
      {obj.category === "desk" && (
        <group>
          {/* Wood-Grain Tabletop with Rounded Edges */}
          <RoundedBox
            args={[obj.width_m, 0.055, obj.depth_m]}
            radius={0.018}
            position={[0, obj.height_m, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#0f766e" roughness={0.45} />
          </RoundedBox>

          {/* 4 Powder-Coated Steel Frame Legs + Crossbar */}
          {[
            [-obj.width_m / 2 + 0.05, -obj.depth_m / 2 + 0.05],
            [obj.width_m / 2 - 0.05, -obj.depth_m / 2 + 0.05],
            [-obj.width_m / 2 + 0.05, obj.depth_m / 2 - 0.05],
            [obj.width_m / 2 - 0.05, obj.depth_m / 2 - 0.05],
          ].map(([lx, lz], idx) => (
            <mesh key={idx} position={[lx, obj.height_m / 2, lz]} castShadow>
              <boxGeometry args={[0.055, obj.height_m, 0.055]} />
              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
          ))}

          {/* Keyboard, Mousepad & Desk Task Lamp */}
          <mesh position={[0, obj.height_m + 0.032, 0.14]} castShadow>
            <boxGeometry args={[0.38, 0.015, 0.14]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <group position={[-obj.width_m * 0.36, obj.height_m + 0.03, -0.15]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.015, 0.04, 0.36, 12]} />
              <meshStandardMaterial color="#64748b" metalness={0.7} />
            </mesh>
            <mesh position={[0.06, 0.36, 0.04]} rotation={[0.4, 0, -0.3]}>
              <coneGeometry args={[0.08, 0.12, 16]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>

          {/* Ultrawide Monitor on Desk */}
          {childrenItems.map((child) => (
            <group
              key={child.id}
              position={[0, obj.height_m + 0.27, -0.12]}
            >
              {/* Monitor Stand */}
              <mesh position={[0, -0.15, -0.04]}>
                <cylinderGeometry args={[0.025, 0.035, 0.22, 12]} />
                <meshStandardMaterial color="#334155" metalness={0.7} />
              </mesh>
              {/* Monitor Bezel */}
              <RoundedBox args={[0.72, 0.38, 0.035]} radius={0.01} castShadow>
                <meshStandardMaterial color="#0f172a" roughness={0.3} />
              </RoundedBox>
              {/* Glowing Display Screen */}
              <mesh position={[0, 0, 0.019]}>
                <planeGeometry args={[0.68, 0.34]} />
                <meshStandardMaterial
                  color="#0ea5e9"
                  emissive="#0369a1"
                  emissiveIntensity={0.65}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ==================== ERGONOMIC CHAIR PREFAB ==================== */}
      {obj.category === "chair" && (
        <group>
          {/* 5-Star Base & Gas Cylinder */}
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.38, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.03, 6]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} />
          </mesh>
          {/* Seat Cushion */}
          <RoundedBox
            args={[0.48, 0.07, 0.46]}
            radius={0.025}
            position={[0, 0.44, 0]}
            castShadow
          >
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </RoundedBox>
          {/* Mesh Backrest */}
          <RoundedBox
            args={[0.44, 0.48, 0.05]}
            radius={0.02}
            position={[0, 0.72, -0.21]}
            castShadow
          >
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </RoundedBox>
        </group>
      )}

      {/* ==================== EXTERIOR WINDOW PREFAB WITH MULLIONS & SKYLINE GLOW ==================== */}
      {obj.category === "window" && (
        <group position={[0, 1.45, 0]}>
          {/* Outer Window Frame */}
          <mesh>
            <boxGeometry args={[obj.width_m + 0.08, obj.height_m + 0.08, 0.12]} />
            <meshStandardMaterial color="#334155" metalness={0.5} />
          </mesh>
          {/* Glass Pane */}
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[obj.width_m, obj.height_m, 0.04]} />
            <meshStandardMaterial
              color={
                hazard?.shattered_or_fell && (hasCollapsed || isShaking)
                  ? "#f87171"
                  : "#38bdf8"
              }
              emissive={
                hazard?.shattered_or_fell && (hasCollapsed || isShaking)
                  ? "#dc2626"
                  : "#0284c7"
              }
              emissiveIntensity={0.45}
              transparent
              opacity={0.55}
            />
          </mesh>
          {/* Center Mullion Bar */}
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[0.04, obj.height_m, 0.05]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      )}

      {/* ==================== ILLUMINATED FIRE EXIT DOOR PREFAB ==================== */}
      {obj.category === "exit_door" && (
        <group position={[0, obj.height_m / 2, 0]}>
          {/* Door Frame */}
          <mesh>
            <boxGeometry args={[obj.width_m + 0.1, obj.height_m + 0.06, 0.14]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Fire-Rated Door Leaf */}
          <RoundedBox args={[obj.width_m, obj.height_m, 0.09]} radius={0.01}>
            <meshStandardMaterial
              color="#059669"
              emissive="#047857"
              emissiveIntensity={0.35}
              roughness={0.4}
            />
          </RoundedBox>
          {/* Stainless Panic Push-Bar */}
          <mesh position={[0, -0.05, -0.06]}>
            <boxGeometry args={[obj.width_m * 0.78, 0.045, 0.04]} />
            <meshStandardMaterial
              color="#e2e8f0"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {/* Illuminated ISO Green EXIT Lightbox Above Door */}
          <group position={[0, obj.height_m / 2 + 0.18, -0.06]}>
            <mesh>
              <boxGeometry args={[0.52, 0.18, 0.06]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#10b981"
                emissiveIntensity={1.4}
              />
            </mesh>
            <Text
              position={[0, 0, -0.035]}
              rotation={[0, Math.PI, 0]}
              fontSize={0.1}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              EXIT ➔
            </Text>
            <pointLight
              position={[0, -0.1, -0.2]}
              intensity={0.7}
              distance={2.8}
              color="#10b981"
            />
          </group>
        </group>
      )}

      {/* Floating Safety Factor Telemetry Pill */}
      {obj.category !== "window" &&
        obj.category !== "exit_door" &&
        obj.category !== "chair" && (
          <Text
            position={[0, obj.height_m + 0.28, 0]}
            fontSize={0.12}
            color={isDanger ? "#fca5a5" : "#86efac"}
            anchorX="center"
            anchorY="middle"
          >
            {`${obj.id} | SF=${sf.toFixed(2)}`}
          </Text>
        )}
    </group>
  );
}

/**
 * Fully Formed 3D Room Interior with Swaying Ceiling Light, Baseboards, Wall Art & Glass Shards
 */
function ShakeTableRoom({
  scene,
  evaluation,
  isShaking,
  hasCollapsed,
  walkthroughActive,
}: {
  scene: RoomSceneGraph;
  evaluation: EgressAndShelterResult;
  isShaking: boolean;
  hasCollapsed: boolean;
  walkthroughActive: boolean;
}) {
  const tableRef = useRef<THREE.Group>(null);
  const pendantRef = useRef<THREE.Group>(null);
  const { width_m, depth_m, height_m, floor_level } = scene.room;
  const { magnitude_mw } = scene.earthquake;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (tableRef.current) {
      if (isShaking) {
        const amp =
          0.035 *
          Math.pow(1.45, magnitude_mw - 5.5) *
          (1 + floor_level * 0.05);
        tableRef.current.position.x =
          Math.sin(t * 28) * amp + Math.cos(t * 17) * amp * 0.6;
        tableRef.current.position.z =
          Math.cos(t * 23) * amp + Math.sin(t * 31) * amp * 0.5;
      } else {
        tableRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.18);
      }
    }

    // Swaying overhead ceiling pendant light during quake
    if (pendantRef.current) {
      if (isShaking) {
        pendantRef.current.rotation.x = Math.sin(t * 9.5) * 0.38;
        pendantRef.current.rotation.z = Math.cos(t * 8.2) * 0.34;
      } else {
        pendantRef.current.rotation.x = THREE.MathUtils.lerp(
          pendantRef.current.rotation.x,
          0,
          0.08
        );
        pendantRef.current.rotation.z = THREE.MathUtils.lerp(
          pendantRef.current.rotation.z,
          0,
          0.08
        );
      }
    }
  });

  const escapeLinePoints = useMemo(() => {
    if (
      !evaluation.escape_path_points_m ||
      evaluation.escape_path_points_m.length < 2
    ) {
      return [];
    }
    return evaluation.escape_path_points_m.map(
      (p) => new THREE.Vector3(p.x_m - width_m / 2, 0.04, p.z_m - depth_m / 2)
    );
  }, [evaluation.escape_path_points_m, width_m, depth_m]);

  // Direct Phase-1 Shelter Path from Bed to Under-Desk Safe Zone
  const shelterLinePoints = useMemo(() => {
    if (!evaluation.safe_shelter_spot_m) return [];
    const startPt = evaluation.escape_path_points_m[0] || {
      x_m: 1.5,
      z_m: 2.2,
    };
    return [
      new THREE.Vector3(
        startPt.x_m - width_m / 2,
        0.04,
        startPt.z_m - depth_m / 2
      ),
      new THREE.Vector3(
        evaluation.safe_shelter_spot_m.x_m - width_m / 2,
        0.04,
        evaluation.safe_shelter_spot_m.z_m - depth_m / 2
      ),
    ];
  }, [evaluation.safe_shelter_spot_m, evaluation.escape_path_points_m, width_m, depth_m]);

  return (
    <group ref={tableRef}>
      {/* ==================== HARDWOOD FLOOR & BASEBOARDS ==================== */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[width_m + 0.25, 0.16, depth_m + 0.25]} />
        <meshStandardMaterial
          color="#3b2314"
          roughness={0.55}
          metalness={0.08}
        />
      </mesh>
      <gridHelper
        args={[Math.max(width_m, depth_m), 22, "#475569", "#1e293b"]}
        position={[0, 0.005, 0]}
      />

      {/* ==================== 4 ARCHITECTURAL WALLS + CEILING ==================== */}
      {/* North Back Wall */}
      <mesh position={[0, height_m / 2, -depth_m / 2]} receiveShadow>
        <boxGeometry args={[width_m, height_m, 0.1]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      {/* West Left Wall */}
      <mesh position={[-width_m / 2, height_m / 2, 0]} receiveShadow>
        <boxGeometry args={[0.1, height_m, depth_m]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>

      {/* East & South Walls: Solid in 1st-Person Walkthrough, Translucent Cutaway in Orbit View */}
      <mesh position={[width_m / 2, height_m / 2, 0]} receiveShadow>
        <boxGeometry args={[0.08, height_m, depth_m]} />
        <meshStandardMaterial
          color="#0f172a"
          transparent={!walkthroughActive}
          opacity={walkthroughActive ? 0.96 : 0.12}
        />
      </mesh>
      <mesh position={[0, height_m / 2, depth_m / 2]} receiveShadow>
        <boxGeometry args={[width_m, height_m, 0.08]} />
        <meshStandardMaterial
          color="#0f172a"
          transparent={!walkthroughActive}
          opacity={walkthroughActive ? 0.96 : 0.15}
        />
      </mesh>

      {/* Framed Architectural Poster on West Wall */}
      <group position={[-width_m / 2 + 0.06, 1.65, 0.6]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.85, 0.6, 0.02]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[0.76, 0.52]} />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#0369a1"
            emissiveIntensity={0.25}
          />
        </mesh>
      </group>

      {/* Swaying Overhead Pendant Ceiling Fixture + Dynamic Emergency Strobe */}
      <group ref={pendantRef} position={[0, height_m, 0]}>
        <mesh position={[0, -0.28, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.56, 8]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh position={[0, -0.56, 0]}>
          <coneGeometry args={[0.24, 0.16, 24, 1, true]} />
          <meshStandardMaterial
            color="#1e293b"
            side={THREE.DoubleSide}
            metalness={0.5}
          />
        </mesh>
        <mesh position={[0, -0.58, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial
            color={isShaking ? "#f97316" : "#fef08a"}
            emissive={isShaking ? "#ef4444" : "#facc15"}
            emissiveIntensity={1.6}
          />
        </mesh>
        <pointLight
          position={[0, -0.65, 0]}
          intensity={isShaking ? 1.4 : 0.9}
          distance={8}
          color={isShaking ? "#fb923c" : "#fef9c3"}
        />
      </group>

      {/* Falling Plaster & Dust Particles During Shaking */}
      <SeismicDebrisParticles
        active={isShaking}
        roomWidth={width_m}
        roomDepth={depth_m}
        roomHeight={height_m}
      />

      {/* ==================== GLASS SHATTER HAZARD ZONE + 3D GLASS SHARDS ==================== */}
      {evaluation.glass_hazard_zones_m.map((gz, i) => {
        const gx = gz.x_m - width_m / 2;
        const gzCoord = gz.z_m - depth_m / 2;
        return (
          <group key={i} position={[gx, 0.02, gzCoord]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[gz.radius_m, 36]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.55}
                transparent
                opacity={hasCollapsed || isShaking ? 0.42 : 0.18}
              />
            </mesh>
            {/* Scattered 3D Crystalline Glass Shards when Shattered */}
            {(hasCollapsed || isShaking) &&
              Array.from({ length: 14 }).map((_, sIdx) => {
                const angle = (sIdx / 14) * Math.PI * 2;
                const r = 0.2 + ((sIdx * 37) % 10) * 0.085;
                return (
                  <mesh
                    key={sIdx}
                    position={[Math.cos(angle) * r, 0.02, Math.sin(angle) * r]}
                    rotation={[0.2, angle, 0.4]}
                  >
                    <coneGeometry args={[0.06, 0.02, 3]} />
                    <meshStandardMaterial
                      color="#bae6fd"
                      emissive="#38bdf8"
                      emissiveIntensity={0.8}
                    />
                  </mesh>
                );
              })}
          </group>
        );
      })}

      {/* ==================== POST-QUAKE FALL SHADOW BOUNDING BOXES ==================== */}
      {evaluation.object_results
        .filter((r) => r.tipped_over || r.analytical_safety_factor < 1.0)
        .map((r) => {
          const w = r.resting_bbox_2d.max_x - r.resting_bbox_2d.min_x;
          const d = r.resting_bbox_2d.max_z - r.resting_bbox_2d.min_z;
          const cx =
            (r.resting_bbox_2d.min_x + r.resting_bbox_2d.max_x) / 2 -
            width_m / 2;
          const cz =
            (r.resting_bbox_2d.min_z + r.resting_bbox_2d.max_z) / 2 -
            depth_m / 2;
          return (
            <mesh key={`shadow_${r.object_id}`} position={[cx, 0.022, cz]}>
              <boxGeometry args={[w, 0.035, d]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#dc2626"
                emissiveIntensity={0.65}
                transparent
                opacity={0.42}
              />
            </mesh>
          );
        })}

      {/* ==================== PHASE 1: SAFE DROP-COVER-HOLD SHELTER SPOT ==================== */}
      {evaluation.safe_shelter_spot_m && (
        <group
          position={[
            evaluation.safe_shelter_spot_m.x_m - width_m / 2,
            0.04,
            evaluation.safe_shelter_spot_m.z_m - depth_m / 2,
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.46, 32]} />
            <meshStandardMaterial
              color="#06b6d4"
              emissive="#0891b2"
              emissiveIntensity={1.1}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Text position={[0, 0.24, 0]} fontSize={0.105} color="#67e8f9">
            PHASE 1: DROP-COVER-HOLD SHELTER
          </Text>
        </group>
      )}

      {/* Phase 1 Shelter Guidance Line (Cyan Dashed) */}
      {shelterLinePoints.length > 1 && (
        <Line
          points={shelterLinePoints}
          color="#06b6d4"
          lineWidth={3}
          dashed
          dashSize={0.18}
          gapSize={0.12}
        />
      )}

      {/* ==================== PHASE 2: ANIMATED 3D A* ESCAPE PATH ==================== */}
      <AnimatedEscapePath points={escapeLinePoints} color="#10b981" />

      {/* Blocked Door Alert Banner */}
      {!evaluation.exit_reachable_post_quake && (
        <Text
          position={[width_m / 2 - 0.65, 1.15, depth_m / 2 - 0.35]}
          fontSize={0.17}
          color="#ef4444"
          anchorX="center"
        >
          EXIT BLOCKED BY WARDROBE!
        </Text>
      )}

      {/* Render All High-Detail Furniture Prefabs */}
      {scene.objects.map((obj) => (
        <FurniturePrefab
          key={obj.id}
          obj={obj}
          allObjects={scene.objects}
          hazard={evaluation.object_results.find((r) => r.object_id === obj.id)}
          roomWidth={width_m}
          roomDepth={depth_m}
          isShaking={isShaking}
          hasCollapsed={hasCollapsed}
        />
      ))}
    </group>
  );
}

export default function QuakeRoomCanvas({
  scene,
  evaluation,
  isShaking,
  hasCollapsed,
  walkthroughActive,
  titleBadge,
}: QuakeRoomCanvasProps) {
  const [autoGuide, setAutoGuide] = useState(true);
  const [phaseBanner, setPhaseBanner] = useState(
    "PHASE 2 (POST-SHAKE EGRESS): Following verified A* green chevron corridor to Exit Door"
  );

  return (
    <div className="relative w-full h-full min-h-[440px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {titleBadge && (
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2">
          <span>{titleBadge}</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              evaluation.survivable
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-red-500/20 text-red-300 border border-red-500/40"
            }`}
          >
            {evaluation.survivable
              ? "VERIFIED SURVIVABLE"
              : "FATAL / EXIT BLOCKED"}
          </span>
        </div>
      )}

      {/* Interactive First-Person Controls HUD Overlay */}
      {walkthroughActive && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-900/95 backdrop-blur border border-emerald-500/40 text-xs">
          <div className="flex items-center gap-2 text-emerald-200 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{phaseBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoGuide((g) => !g)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition ${
                autoGuide
                  ? "bg-emerald-500 text-slate-950 border-emerald-400"
                  : "bg-slate-800 text-slate-200 border-slate-700"
              }`}
            >
              {autoGuide ? "Mode: Auto-Guided Path" : "Mode: Free WASD + Mouse"}
            </button>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              WASD: Walk | Drag Mouse / Q,E: Look | C: Crouch Under Desk
            </span>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 4.5, 5.1], fov: 50 }}>
        <color attach="background" args={["#050a14"]} />
        <fog attach="fog" args={["#050a14", 7, 22]} />
        <Sky
          distance={450000}
          sunPosition={[-5, -0.5, -10]}
          inclination={0.48}
          azimuth={0.25}
        />

        <ambientLight intensity={0.65} />
        <directionalLight
          position={[5, 9, 5]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-3, 2.5, -2]} intensity={0.45} color="#38bdf8" />

        <ShakeTableRoom
          scene={scene}
          evaluation={evaluation}
          isShaking={isShaking}
          hasCollapsed={hasCollapsed}
          walkthroughActive={walkthroughActive}
        />

        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.5}
          scale={10}
          blur={1.8}
          far={4}
        />

        <WalkthroughController
          active={walkthroughActive}
          autoGuide={autoGuide}
          isShaking={isShaking}
          magnitudeMw={scene.earthquake.magnitude_mw}
          escapePath={evaluation.escape_path_points_m}
          shelterSpot={evaluation.safe_shelter_spot_m}
          roomWidth={scene.room.width_m}
          roomDepth={scene.room.depth_m}
          onPhaseChange={setPhaseBanner}
        />

        {!walkthroughActive && (
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            maxPolarAngle={Math.PI / 2 - 0.04}
          />
        )}
      </Canvas>
    </div>
  );
}
