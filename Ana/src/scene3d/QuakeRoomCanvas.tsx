"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Line,
  RoundedBox,
  ContactShadows,
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
  fullScreen?: boolean;
  titleBadge?: string;
}

/**
 * Generates a realistic warm oak hardwood plank texture in memory (100% offline-safe)
 */
function useHardwoodFloorTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#b88655";
    ctx.fillRect(0, 0, 512, 512);

    const plankRows = 8;
    const plankCols = 4;
    const rowH = 512 / plankRows;
    const colW = 512 / plankCols;
    const tones = ["#b37d4b", "#c18c59", "#a97140", "#be8956", "#b6804e"];

    for (let r = 0; r < plankRows; r++) {
      const offset = (r % 2) * (colW / 2);
      for (let c = -1; c <= plankCols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        ctx.fillStyle = tones[(r * 3 + c + 10) % tones.length];
        ctx.fillRect(x, y, colW, rowH);

        ctx.strokeStyle = "rgba(85, 48, 18, 0.14)";
        ctx.lineWidth = 1.2;
        for (let g = 1; g < 6; g++) {
          ctx.beginPath();
          ctx.moveTo(x + 2, y + (rowH / 6) * g);
          ctx.bezierCurveTo(
            x + colW * 0.3,
            y + (rowH / 6) * g + ((r + g) % 2 === 0 ? 3 : -3),
            x + colW * 0.7,
            y + (rowH / 6) * g + ((c + g) % 2 === 0 ? -3 : 3),
            x + colW - 2,
            y + (rowH / 6) * g
          );
          ctx.stroke();
        }

        ctx.strokeStyle = "rgba(58, 32, 12, 0.45)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, colW, rowH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/**
 * Generates a subtle woven carpet/rug texture
 */
function useRugTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#334155";
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, 220, 220);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, 192, 192);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let y = 0; y < 256; y += 4) {
      for (let x = y % 8 === 0 ? 0 : 2; x < 256; x += 4) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/**
 * First-Person Human Eye-Level Inside Room Controller (Mouse Drag 360° Look + WASD Walk + Optional Auto-Tour)
 */
function WalkthroughController({
  active,
  autoWalk,
  escapePath,
  shelterSpot,
  roomWidth,
  roomDepth,
}: {
  active: boolean;
  autoWalk: boolean;
  escapePath: Array<{ x_m: number; z_m: number }>;
  shelterSpot: { x_m: number; z_m: number; label: string } | null;
  roomWidth: number;
  roomDepth: number;
}) {
  const { camera, gl } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  const progressRef = useRef(0);
  const isDragging = useRef(false);
  const yawRef = useRef(-0.48); // Looking across the bedroom toward bookcase, window, desk & door
  const pitchRef = useRef(-0.08);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const dom = gl.domElement;
    const onPointerDown = () => {
      isDragging.current = true;
    };
    const onPointerUp = () => {
      isDragging.current = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!active || !isDragging.current) return;
      yawRef.current -= e.movementX * 0.004;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - e.movementY * 0.0035,
        -0.75,
        0.65
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
  }, [active, gl.domElement]);

  useEffect(() => {
    if (active) {
      progressRef.current = 0;
      // Start at human eye-height (1.58m) in the south-west doorway/bedside vantage point looking across the whole room
      camera.position.set(
        -roomWidth / 2 + 0.95,
        1.58,
        roomDepth / 2 - 0.55
      );
      yawRef.current = -0.52;
      pitchRef.current = -0.1;
    } else {
      camera.position.set(2.8, 3.8, 4.9);
      camera.lookAt(0, 0.7, 0);
    }
  }, [active, camera, roomWidth, roomDepth]);

  useFrame((_, delta) => {
    if (!active) return;

    const moveSpeed = 2.1 * delta;
    const forward = new THREE.Vector3(
      -Math.sin(yawRef.current),
      0,
      -Math.cos(yawRef.current)
    ).normalize();
    const right = new THREE.Vector3().crossVectors(
      forward,
      new THREE.Vector3(0, 1, 0)
    );

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

    // Clamp camera inside the room walls
    camera.position.x = THREE.MathUtils.clamp(
      camera.position.x,
      -roomWidth / 2 + 0.35,
      roomWidth / 2 - 0.35
    );
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z,
      -roomDepth / 2 + 0.35,
      roomDepth / 2 - 0.35
    );
    camera.position.y = 1.58;

    if (autoWalk && !manualMoved && !isDragging.current && escapePath.length > 1) {
      progressRef.current = (progressRef.current + delta * 0.22) % 1;
      const floatIdx = progressRef.current * (escapePath.length - 1);
      const idx = Math.floor(floatIdx);
      const nextIdx = Math.min(escapePath.length - 1, idx + 1);
      const alpha = floatIdx - idx;

      const p1 = escapePath[idx];
      const p2 = escapePath[nextIdx];
      const wx = THREE.MathUtils.lerp(p1.x_m, p2.x_m, alpha) - roomWidth / 2;
      const wz = THREE.MathUtils.lerp(p1.z_m, p2.z_m, alpha) - roomDepth / 2;

      camera.position.lerp(new THREE.Vector3(wx, 1.56, wz), 0.1);
      const lookTarget = escapePath[escapePath.length - 1];
      camera.lookAt(
        lookTarget.x_m - roomWidth / 2,
        1.15,
        lookTarget.z_m - roomDepth / 2
      );
    } else {
      // Look direction driven by mouse yaw/pitch
      const lookDir = new THREE.Vector3(
        -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        Math.sin(pitchRef.current),
        -Math.cos(yawRef.current) * Math.cos(pitchRef.current)
      );
      const target = camera.position.clone().add(lookDir.multiplyScalar(3));
      void shelterSpot;
      camera.lookAt(target);
    }
  });

  return null;
}

/**
 * Detailed Architectural Furniture Prefabs with Dynamic Seismic Tipping & CoM Marker
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
        ? Math.sin(t * 24) * (obj.anchored_to_wall ? 0.01 : 0.042)
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
      {/* ==================== REALISTIC BED PREFAB ==================== */}
      {obj.category === "bed" && (
        <group>
          {[
            [-obj.width_m / 2 + 0.06, -obj.depth_m / 2 + 0.06],
            [obj.width_m / 2 - 0.06, -obj.depth_m / 2 + 0.06],
            [-obj.width_m / 2 + 0.06, obj.depth_m / 2 - 0.06],
            [obj.width_m / 2 - 0.06, obj.depth_m / 2 - 0.06],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.09, lz]} castShadow>
              <cylinderGeometry args={[0.035, 0.025, 0.18, 12]} />
              <meshStandardMaterial color="#451a03" roughness={0.6} />
            </mesh>
          ))}

          <RoundedBox
            args={[obj.width_m, 0.18, obj.depth_m]}
            radius={0.02}
            smoothness={4}
            position={[0, 0.22, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#5c2d16" roughness={0.55} />
          </RoundedBox>

          <RoundedBox
            args={[obj.width_m + 0.04, 0.95, 0.1]}
            radius={0.03}
            smoothness={4}
            position={[0, 0.56, -obj.depth_m / 2 + 0.05]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#334155" roughness={0.85} />
          </RoundedBox>
          {[-0.28, 0.28].map((px, idx) => (
            <RoundedBox
              key={idx}
              args={[obj.width_m * 0.42, 0.52, 0.04]}
              radius={0.02}
              position={[px * obj.width_m, 0.68, -obj.depth_m / 2 + 0.1]}
              castShadow
            >
              <meshStandardMaterial color="#475569" roughness={0.9} />
            </RoundedBox>
          ))}

          <RoundedBox
            args={[obj.width_m * 0.94, 0.22, obj.depth_m * 0.92]}
            radius={0.04}
            smoothness={4}
            position={[0, 0.4, 0.03]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#f8fafc" roughness={0.75} />
          </RoundedBox>

          <RoundedBox
            args={[obj.width_m * 0.96, 0.21, obj.depth_m * 0.64]}
            radius={0.05}
            smoothness={4}
            position={[0, 0.43, obj.depth_m * 0.14]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#1d4ed8" roughness={0.82} />
          </RoundedBox>

          <RoundedBox
            args={[obj.width_m * 0.95, 0.06, 0.22]}
            radius={0.02}
            position={[0, 0.52, -obj.depth_m * 0.14]}
            castShadow
          >
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
          </RoundedBox>

          <RoundedBox
            args={[obj.width_m * 0.97, 0.23, 0.32]}
            radius={0.03}
            position={[0, 0.44, obj.depth_m * 0.34]}
            castShadow
          >
            <meshStandardMaterial color="#0f172a" roughness={0.88} />
          </RoundedBox>

          {[-0.24, 0.24].map((px, i) => (
            <RoundedBox
              key={i}
              args={[obj.width_m * 0.38, 0.11, 0.32]}
              radius={0.04}
              position={[px * obj.width_m, 0.55, -obj.depth_m * 0.33]}
              rotation={[0.18, 0, 0]}
              castShadow
            >
              <meshStandardMaterial color="#ffffff" roughness={0.7} />
            </RoundedBox>
          ))}
        </group>
      )}

      {/* ==================== OPEN-FRAME BOOKSHELF WITH BOOKS ==================== */}
      {obj.category === "bookshelf" && (
        <group>
          <mesh
            position={[-obj.width_m / 2 + 0.02, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.04, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial color="#78350f" roughness={0.55} />
          </mesh>
          <mesh
            position={[obj.width_m / 2 - 0.02, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.04, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial color="#78350f" roughness={0.55} />
          </mesh>
          <mesh
            position={[0, obj.height_m / 2, -obj.depth_m / 2 + 0.015]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[obj.width_m, obj.height_m, 0.025]} />
            <meshStandardMaterial color="#5c2d16" roughness={0.7} />
          </mesh>

          {[0.06, 0.42, 0.78, 1.14, 1.48, obj.height_m - 0.02].map((sy, i) => (
            <mesh key={i} position={[0, sy, 0]} castShadow receiveShadow>
              <boxGeometry args={[obj.width_m - 0.02, 0.03, obj.depth_m]} />
              <meshStandardMaterial color="#92400e" roughness={0.5} />
            </mesh>
          ))}

          {[
            { x: -0.25, y: 0.9, c: "#2563eb", h: 0.21 },
            { x: -0.2, y: 0.9, c: "#dc2626", h: 0.23 },
            { x: -0.15, y: 0.9, c: "#059669", h: 0.19 },
            { x: -0.1, y: 0.9, c: "#d97706", h: 0.22 },
            { x: 0.15, y: 1.25, c: "#7c3aed", h: 0.2 },
            { x: 0.21, y: 1.25, c: "#0284c7", h: 0.22 },
            { x: 0.26, y: 1.25, c: "#be123c", h: 0.18 },
          ].map((bk, idx) => (
            <mesh
              key={idx}
              position={[bk.x * obj.width_m, bk.y, 0.01]}
              castShadow
            >
              <boxGeometry args={[0.038, bk.h, obj.depth_m * 0.72]} />
              <meshStandardMaterial color={bk.c} roughness={0.65} />
            </mesh>
          ))}

          {childrenItems.map((child) => {
            const isTop = child.shelf_level === "top";
            const cy = isTop
              ? 1.62
              : child.shelf_level === "middle"
              ? 0.92
              : 0.2;
            const badgeColor = isTop ? "#ef4444" : "#10b981";
            return (
              <group key={child.id} position={[0, cy, 0.02]}>
                {[0, 0.065, 0.13].map((by, bIdx) => (
                  <RoundedBox
                    key={bIdx}
                    args={[0.38, 0.058, obj.depth_m * 0.8]}
                    radius={0.008}
                    position={[0, by - 0.05, 0]}
                    castShadow
                  >
                    <meshStandardMaterial
                      color={
                        isTop
                          ? bIdx % 2 === 0
                            ? "#b91c1c"
                            : "#991b1b"
                          : bIdx % 2 === 0
                          ? "#047857"
                          : "#065f46"
                      }
                      roughness={0.5}
                    />
                  </RoundedBox>
                ))}
                <group position={[0, 0.22, obj.depth_m / 2 + 0.06]}>
                  <mesh>
                    <planeGeometry args={[0.72, 0.16]} />
                    <meshBasicMaterial
                      color={badgeColor}
                      transparent
                      opacity={0.92}
                    />
                  </mesh>
                  <Text
                    position={[0, 0, 0.01]}
                    fontSize={0.075}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                  >
                    {`${child.mass_kg}kg BOOKS (${child.shelf_level?.toUpperCase()})`}
                  </Text>
                </group>
              </group>
            );
          })}

          {hazard?.com_height_m && (
            <group position={[0, hazard.com_height_m, obj.depth_m / 2 + 0.07]}>
              <mesh>
                <sphereGeometry args={[0.065, 20, 20]} />
                <meshStandardMaterial
                  color={isDanger ? "#ef4444" : "#10b981"}
                  emissive={isDanger ? "#dc2626" : "#059669"}
                  emissiveIntensity={0.85}
                />
              </mesh>
              <Text
                position={[0, -0.13, 0]}
                fontSize={0.075}
                color={isDanger ? "#fca5a5" : "#6ee7b7"}
                anchorX="center"
              >
                {`h_CoM=${hazard.com_height_m}m | SF=${sf}`}
              </Text>
            </group>
          )}
        </group>
      )}

      {/* ==================== DOUBLE-DOOR ARMOIRE WARDROBE ==================== */}
      {obj.category === "wardrobe" && (
        <group>
          <RoundedBox
            args={[obj.width_m, obj.height_m, obj.depth_m]}
            radius={0.02}
            smoothness={4}
            position={[0, obj.height_m / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#475569" roughness={0.5} />
          </RoundedBox>

          <mesh position={[0, obj.height_m - 0.03, 0]} castShadow>
            <boxGeometry
              args={[obj.width_m + 0.04, 0.06, obj.depth_m + 0.04]}
            />
            <meshStandardMaterial color="#334155" roughness={0.4} />
          </mesh>

          {[-0.24, 0.24].map((dx, i) => (
            <RoundedBox
              key={i}
              args={[obj.width_m * 0.45, obj.height_m * 0.88, 0.025]}
              radius={0.01}
              position={[
                dx * obj.width_m,
                obj.height_m * 0.5,
                obj.depth_m / 2 + 0.01,
              ]}
              castShadow
            >
              <meshStandardMaterial color="#64748b" roughness={0.45} />
            </RoundedBox>
          ))}

          {[-0.05, 0.05].map((hx, i) => (
            <mesh
              key={i}
              position={[hx, obj.height_m * 0.52, obj.depth_m / 2 + 0.035]}
              castShadow
            >
              <cylinderGeometry args={[0.01, 0.01, 0.22, 12]} />
              <meshStandardMaterial
                color="#fbbf24"
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}

          {obj.anchored_to_wall && (
            <group position={[0, obj.height_m + 0.02, -obj.depth_m / 2]}>
              {[-0.25, 0.25].map((bx, i) => (
                <mesh key={i} position={[bx, 0, 0]}>
                  <boxGeometry args={[0.08, 0.06, 0.14]} />
                  <meshStandardMaterial
                    color="#10b981"
                    metalness={0.8}
                    roughness={0.2}
                  />
                </mesh>
              ))}
            </group>
          )}

          <group position={[0, obj.height_m + 0.18, 0]}>
            <mesh>
              <planeGeometry args={[0.92, 0.17]} />
              <meshBasicMaterial
                color={isDanger ? "#991b1b" : "#065f46"}
                transparent
                opacity={0.92}
              />
            </mesh>
            <Text
              position={[0, 0, 0.01]}
              fontSize={0.075}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              {`${obj.label} (SF=${sf})`}
            </Text>
          </group>
        </group>
      )}

      {/* ==================== ARCHITECTURAL STUDY DESK + MONITOR + LAMP ==================== */}
      {obj.category === "desk" && (
        <group>
          <RoundedBox
            args={[obj.width_m, 0.045, obj.depth_m]}
            radius={0.012}
            smoothness={4}
            position={[0, obj.height_m, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#b45309" roughness={0.42} />
          </RoundedBox>

          {[
            [-obj.width_m / 2 + 0.05, -obj.depth_m / 2 + 0.05],
            [obj.width_m / 2 - 0.05, -obj.depth_m / 2 + 0.05],
            [-obj.width_m / 2 + 0.05, obj.depth_m / 2 - 0.05],
            [obj.width_m / 2 - 0.05, obj.depth_m / 2 - 0.05],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, obj.height_m / 2, lz]} castShadow>
              <cylinderGeometry args={[0.022, 0.022, obj.height_m, 12]} />
              <meshStandardMaterial
                color="#1e293b"
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>
          ))}

          <mesh
            position={[0, obj.height_m - 0.06, -obj.depth_m / 2 + 0.05]}
            castShadow
          >
            <boxGeometry args={[obj.width_m - 0.08, 0.04, 0.04]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} />
          </mesh>

          <RoundedBox
            args={[0.36, 0.015, 0.14]}
            radius={0.004}
            position={[0, obj.height_m + 0.03, 0.14]}
            castShadow
          >
            <meshStandardMaterial color="#0f172a" roughness={0.4} />
          </RoundedBox>

          <group position={[-obj.width_m * 0.35, obj.height_m + 0.02, -0.15]}>
            <mesh position={[0, 0.01, 0]}>
              <cylinderGeometry args={[0.07, 0.08, 0.02, 16]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.18, 0]} rotation={[0, 0, -0.2]}>
              <cylinderGeometry args={[0.01, 0.01, 0.35, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.8} />
            </mesh>
            <mesh position={[0.06, 0.34, 0]} rotation={[0, 0, 0.6]}>
              <coneGeometry args={[0.07, 0.12, 16]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#f59e0b"
                emissiveIntensity={0.6}
              />
            </mesh>
            <pointLight
              position={[0.08, 0.28, 0]}
              intensity={0.45}
              distance={2.5}
              color="#fde68a"
            />
          </group>

          {childrenItems.map((child) => {
            const childHaz = hazard;
            const tipped =
              childHaz?.shattered_or_fell && (isShaking || hasCollapsed);
            return (
              <group
                key={child.id}
                position={[0.05, obj.height_m + 0.02, -0.12]}
                rotation={[tipped ? 1.35 : 0, 0, 0]}
              >
                <mesh position={[0, 0.01, 0]} castShadow>
                  <boxGeometry args={[0.2, 0.015, 0.16]} />
                  <meshStandardMaterial color="#334155" metalness={0.7} />
                </mesh>
                <mesh position={[0, 0.1, -0.04]} castShadow>
                  <boxGeometry args={[0.04, 0.18, 0.02]} />
                  <meshStandardMaterial color="#475569" metalness={0.7} />
                </mesh>
                <RoundedBox
                  args={[0.56, 0.34, 0.025]}
                  radius={0.008}
                  position={[0, 0.26, 0]}
                  castShadow
                >
                  <meshStandardMaterial color="#0f172a" roughness={0.3} />
                </RoundedBox>
                <mesh position={[0, 0.26, 0.014]}>
                  <planeGeometry args={[0.52, 0.3]} />
                  <meshStandardMaterial
                    color="#0284c7"
                    emissive="#0369a1"
                    emissiveIntensity={0.55}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ==================== ERGONOMIC SWIVEL OFFICE CHAIR ==================== */}
      {obj.category === "chair" && (
        <group>
          {[0, 72, 144, 216, 288].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh
                key={i}
                position={[Math.cos(rad) * 0.14, 0.05, Math.sin(rad) * 0.14]}
                rotation={[0, -rad, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
                <meshStandardMaterial color="#1e293b" metalness={0.8} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.024, 0.024, 0.38, 12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
          <RoundedBox
            args={[0.46, 0.06, 0.44]}
            radius={0.02}
            position={[0, 0.44, 0]}
            castShadow
          >
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </RoundedBox>
          <RoundedBox
            args={[0.42, 0.46, 0.04]}
            radius={0.02}
            position={[0, 0.7, -0.2]}
            castShadow
          >
            <meshStandardMaterial color="#334155" roughness={0.75} />
          </RoundedBox>
        </group>
      )}

      {/* ==================== ARCHITECTURAL WINDOW WITH MULLIONS & SHARDS ==================== */}
      {obj.category === "window" && (
        <group>
          <mesh position={[0, 1.48, 0]}>
            <boxGeometry
              args={[obj.width_m + 0.1, obj.height_m + 0.1, obj.depth_m + 0.06]}
            />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.48, 0.01]}>
            <boxGeometry args={[obj.width_m, obj.height_m, 0.03]} />
            <meshStandardMaterial
              color={
                hazard?.shattered_or_fell && (isShaking || hasCollapsed)
                  ? "#fca5a5"
                  : "#bae6fd"
              }
              emissive={
                hazard?.shattered_or_fell && (isShaking || hasCollapsed)
                  ? "#ef4444"
                  : "#38bdf8"
              }
              emissiveIntensity={0.45}
              transparent
              opacity={0.72}
              roughness={0.1}
              metalness={0.2}
            />
          </mesh>
          <mesh position={[0, 1.48, 0.03]}>
            <boxGeometry args={[0.035, obj.height_m, 0.04]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh position={[0, 1.48, 0.03]}>
            <boxGeometry args={[obj.width_m, 0.035, 0.04]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh position={[0, 1.48 - obj.height_m / 2 - 0.03, 0.06]} castShadow>
            <boxGeometry args={[obj.width_m + 0.16, 0.04, 0.16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>

          {hazard?.shattered_or_fell && (isShaking || hasCollapsed) && (
            <group position={[0, 0.02, 0.45]}>
              {[-0.4, -0.2, -0.05, 0.12, 0.28, 0.42, -0.15, 0.22].map(
                (sx, i) => (
                  <mesh
                    key={i}
                    position={[sx, 0, (i % 3) * 0.22 + 0.1]}
                    rotation={[-Math.PI / 2, 0, i * 1.1]}
                  >
                    <coneGeometry args={[0.09, 0.02, 3]} />
                    <meshStandardMaterial
                      color="#e0f2fe"
                      emissive="#38bdf8"
                      emissiveIntensity={0.5}
                      transparent
                      opacity={0.85}
                    />
                  </mesh>
                )
              )}
            </group>
          )}
        </group>
      )}

      {/* ==================== ARCHITECTURAL EXIT DOOR WITH EMERGENCY SIGN ==================== */}
      {obj.category === "exit_door" && (
        <group>
          <mesh position={[0, obj.height_m / 2, 0]}>
            <boxGeometry
              args={[obj.width_m + 0.14, obj.height_m + 0.08, 0.18]}
            />
            <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
          </mesh>
          <RoundedBox
            args={[obj.width_m, obj.height_m, 0.07]}
            radius={0.01}
            position={[0, obj.height_m / 2, 0.02]}
            castShadow
          >
            <meshStandardMaterial
              color={hazard?.blocked_exit_corridor ? "#7f1d1d" : "#78350f"}
              roughness={0.5}
            />
          </RoundedBox>
          <mesh
            position={[obj.width_m * 0.36, 1.02, 0.07]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.014, 0.014, 0.12, 12]} />
            <meshStandardMaterial
              color="#fbbf24"
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          <group position={[0, obj.height_m + 0.18, 0.06]}>
            <RoundedBox args={[0.46, 0.18, 0.06]} radius={0.01}>
              <meshStandardMaterial
                color="#059669"
                emissive="#10b981"
                emissiveIntensity={0.9}
              />
            </RoundedBox>
            <Text
              position={[0, 0, 0.035]}
              fontSize={0.085}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              EXIT
            </Text>
          </group>
        </group>
      )}
    </group>
  );
}

/**
 * Architectural Shake Table Room Container
 */
function ShakeTableRoom({
  scene,
  evaluation,
  isShaking,
  hasCollapsed,
  firstPersonInside,
}: {
  scene: RoomSceneGraph;
  evaluation: EgressAndShelterResult;
  isShaking: boolean;
  hasCollapsed: boolean;
  firstPersonInside: boolean;
}) {
  const tableRef = useRef<THREE.Group>(null);
  const { width_m, depth_m, height_m } = scene.room;
  const hardwoodTex = useHardwoodFloorTexture();
  const rugTex = useRugTexture();

  useFrame((state) => {
    if (!tableRef.current) return;
    if (isShaking) {
      const t = state.clock.getElapsedTime();
      const amp =
        0.045 *
        (scene.earthquake.magnitude_mw - 4.5) *
        (1 + (scene.room.floor_level - 1) * 0.08);
      tableRef.current.position.x =
        Math.sin(t * 32) * amp + Math.cos(t * 19) * amp * 0.5;
      tableRef.current.position.z =
        Math.cos(t * 27) * amp * 0.8 + Math.sin(t * 14) * amp * 0.4;
    } else {
      tableRef.current.position.x = THREE.MathUtils.lerp(
        tableRef.current.position.x,
        0,
        0.15
      );
      tableRef.current.position.z = THREE.MathUtils.lerp(
        tableRef.current.position.z,
        0,
        0.15
      );
    }
  });

  const escapeLinePoints = useMemo(() => {
    return evaluation.escape_path_points_m.map(
      (p) =>
        new THREE.Vector3(p.x_m - width_m / 2, 0.05, p.z_m - depth_m / 2)
    );
  }, [evaluation.escape_path_points_m, width_m, depth_m]);

  const frontWallHeight = firstPersonInside ? height_m : 0.28;

  return (
    <group ref={tableRef}>
      {/* ==================== OAK HARDWOOD FLOOR SLAB ==================== */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[width_m + 0.28, 0.12, depth_m + 0.28]} />
        <meshStandardMaterial
          map={hardwoodTex}
          color={hardwoodTex ? "#ffffff" : "#b88655"}
          roughness={0.38}
          metalness={0.05}
        />
      </mesh>

      {/* Woven Bedroom Area Rug */}
      <mesh position={[0.1, 0.008, 0.15]} receiveShadow>
        <boxGeometry args={[width_m * 0.58, 0.012, depth_m * 0.56]} />
        <meshStandardMaterial
          map={rugTex}
          color={rugTex ? "#ffffff" : "#334155"}
          roughness={0.92}
        />
      </mesh>

      {/* ==================== ARCHITECTURAL PLASTER WALLS & BASEBOARDS ==================== */}
      {/* North Back Wall */}
      <mesh
        position={[0, height_m / 2, -depth_m / 2 - 0.06]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[width_m + 0.24, height_m, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.06, -depth_m / 2 + 0.01]}>
        <boxGeometry args={[width_m, 0.12, 0.025]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      {/* West Left Wall */}
      <mesh
        position={[-width_m / 2 - 0.06, height_m / 2, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[0.12, height_m, depth_m + 0.24]} />
        <meshStandardMaterial color="#dbeafe" roughness={0.85} />
      </mesh>
      <mesh position={[-width_m / 2 + 0.01, 0.06, 0]}>
        <boxGeometry args={[0.025, 0.12, depth_m]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      {/* East Right Wall (Full height in 1st-Person Inside view, low cutaway in Orbit view) */}
      <mesh position={[width_m / 2 + 0.06, frontWallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.12, frontWallHeight, depth_m + 0.24]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.82} />
      </mesh>
      <mesh position={[width_m / 2 - 0.01, 0.06, 0]}>
        <boxGeometry args={[0.025, 0.12, depth_m]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      {/* South Front Wall (Full height in 1st-Person Inside view, low cutaway in Orbit view) */}
      <mesh position={[0, frontWallHeight / 2, depth_m / 2 + 0.06]} receiveShadow>
        <boxGeometry args={[width_m + 0.24, frontWallHeight, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.06, depth_m / 2 - 0.01]}>
        <boxGeometry args={[width_m, 0.12, 0.025]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      {/* ==================== ARCHITECTURAL CEILING + RECESSED DOWNLIGHTS (IN 1ST PERSON) ==================== */}
      {firstPersonInside && (
        <group position={[0, height_m, 0]}>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <boxGeometry args={[width_m + 0.24, 0.1, depth_m + 0.24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.9} />
          </mesh>
          {/* Central Modern Ceiling Pendant Light Fixture */}
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.32, 0.36, 0.08, 24]} />
            <meshStandardMaterial
              color="#fef3c7"
              emissive="#fde68a"
              emissiveIntensity={0.95}
            />
          </mesh>
          {/* 4 Recessed Warm Ceiling Downlights */}
          {[
            [-width_m * 0.28, -depth_m * 0.28],
            [width_m * 0.28, -depth_m * 0.28],
            [-width_m * 0.28, depth_m * 0.28],
            [width_m * 0.28, depth_m * 0.28],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, -0.01, lz]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.09, 16]} />
              <meshBasicMaterial color="#fef08a" side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}

      {/* Framed Architectural Art Print on West Wall Above Bed */}
      <group
        position={[-width_m / 2 + 0.02, 1.65, 0.1]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <RoundedBox args={[0.95, 0.65, 0.03]} radius={0.01} castShadow>
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 0, 0.018]}>
          <planeGeometry args={[0.85, 0.55]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.62, 0.36]} />
          <meshStandardMaterial color="#0284c7" roughness={0.5} />
        </mesh>
      </group>

      {/* ==================== HAZARD ZONES, SHELTER & A* ESCAPE PATH ==================== */}
      {(isShaking || hasCollapsed) &&
        evaluation.glass_hazard_zones_m.map((gz, idx) => (
          <mesh
            key={idx}
            position={[gz.x_m - width_m / 2, 0.018, gz.z_m - depth_m / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[gz.radius_m, 32]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={0.45}
              transparent
              opacity={0.32}
            />
          </mesh>
        ))}

      {evaluation.object_results
        .filter((r) => r.tipped_over)
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
            <mesh key={`shadow_${r.object_id}`} position={[cx, 0.02, cz]}>
              <boxGeometry args={[w, 0.025, d]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#dc2626"
                emissiveIntensity={0.5}
                transparent
                opacity={0.38}
              />
            </mesh>
          );
        })}

      {evaluation.safe_shelter_spot_m && (
        <group
          position={[
            evaluation.safe_shelter_spot_m.x_m - width_m / 2,
            0.03,
            evaluation.safe_shelter_spot_m.z_m - depth_m / 2,
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.44, 32]} />
            <meshStandardMaterial
              color="#22c55e"
              emissive="#16a34a"
              emissiveIntensity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Text position={[0, 0.22, 0]} fontSize={0.1} color="#4ade80">
            SAFE DROP-COVER-HOLD
          </Text>
        </group>
      )}

      {escapeLinePoints.length > 1 && (
        <Line
          points={escapeLinePoints}
          color="#10b981"
          lineWidth={5}
          dashed={false}
        />
      )}

      {!evaluation.exit_reachable_post_quake && (
        <group position={[width_m / 2 - 0.65, 1.25, depth_m / 2 - 0.35]}>
          <mesh>
            <planeGeometry args={[1.65, 0.26]} />
            <meshBasicMaterial color="#991b1b" transparent opacity={0.92} />
          </mesh>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.11}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            EXIT BLOCKED BY WARDROBE!
          </Text>
        </group>
      )}

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
  fullScreen = true,
  titleBadge,
}: QuakeRoomCanvasProps) {
  const [autoWalk, setAutoWalk] = useState(false);

  return (
    <div
      className={`relative w-full bg-slate-950 overflow-hidden ${
        fullScreen
          ? "h-screen rounded-none border-0"
          : "h-[580px] rounded-2xl border border-slate-800 shadow-2xl"
      }`}
    >
      {titleBadge && (
        <div className="absolute top-20 left-4 z-10 px-3.5 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-200 flex items-center gap-2.5 shadow-xl pointer-events-none">
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

      {walkthroughActive && (
        <div className="absolute bottom-5 left-4 z-10 flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-emerald-500/40 text-xs text-emerald-200 shadow-lg">
            👁️ <strong>First-Person Inside Room:</strong> Drag mouse to look 360° • Use <strong>W A S D / Arrow Keys</strong> to walk inside room
          </div>
          <button
            onClick={() => setAutoWalk((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-lg ${
              autoWalk
                ? "bg-emerald-600 text-white border-emerald-400"
                : "bg-slate-900/90 text-slate-200 border-slate-700 hover:border-emerald-500/50"
            }`}
          >
            {autoWalk ? "🚶 Auto-Walk Escape Route: ON" : "🚶 Auto-Walk Escape Route: OFF"}
          </button>
        </div>
      )}

      <Canvas shadows camera={{ position: [-1.15, 1.58, 1.2], fov: 58 }}>
        <color attach="background" args={["#0b1120"]} />
        <hemisphereLight args={["#f8fafc", "#334155", 0.85]} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.35}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0005}
        />
        <pointLight position={[0, 2.35, 0]} intensity={0.85} distance={8} color="#fef3c7" />
        <pointLight position={[-1.5, 2.2, 0]} intensity={0.45} color="#fef3c7" />
        <pointLight position={[2.5, 2.2, -1.2]} intensity={0.45} color="#bae6fd" />

        <ShakeTableRoom
          scene={scene}
          evaluation={evaluation}
          isShaking={isShaking}
          hasCollapsed={hasCollapsed}
          firstPersonInside={walkthroughActive}
        />

        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.45}
          scale={10}
          blur={1.8}
          far={4}
        />

        <WalkthroughController
          active={walkthroughActive}
          autoWalk={autoWalk}
          escapePath={evaluation.escape_path_points_m}
          shelterSpot={evaluation.safe_shelter_spot_m}
          roomWidth={scene.room.width_m}
          roomDepth={scene.room.depth_m}
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
