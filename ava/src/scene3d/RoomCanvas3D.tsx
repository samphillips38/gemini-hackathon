"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, Html, Line, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  EgressAndShelterResult,
  ObjectHazardResult,
  RoomObjectNode,
  RoomSceneGraph,
} from "@/types/contracts";
import { getOrientedDims } from "@/solver/roomVerifier";

interface RoomCanvas3DProps {
  scene: RoomSceneGraph;
  verification: EgressAndShelterResult;
  simState: "idle" | "shaking" | "collapsed";
  dropHazardMode: boolean;
  onFloorClickDropHazard?: (x_m: number, z_m: number) => void;
  selectedObjectId: string | null;
  onSelectObject?: (id: string | null) => void;
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
 * First-Person Human Eye-Level Inside Room Controller (Mouse Drag 360° Look + WASD Walk + Optional Auto-Tour)
 */
function WalkthroughController({
  active,
  autoWalk,
  escapePath,
  roomWidth,
  roomDepth,
}: {
  active: boolean;
  autoWalk: boolean;
  escapePath: Array<{ x_m: number; z_m: number }>;
  roomWidth: number;
  roomDepth: number;
}) {
  const { camera, gl } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  const progressRef = useRef(0);
  const isDragging = useRef(false);
  const yawRef = useRef(-0.48);
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
      camera.position.set(-roomWidth / 2 + 0.95, 1.58, roomDepth / 2 - 0.55);
      yawRef.current = -0.52;
      pitchRef.current = -0.1;
    } else {
      camera.position.set(4.2, 3.8, 4.6);
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
      const lookDir = new THREE.Vector3(
        -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        Math.sin(pitchRef.current),
        -Math.cos(yawRef.current) * Math.cos(pitchRef.current)
      );
      const target = camera.position.clone().add(lookDir.multiplyScalar(3));
      camera.lookAt(target);
    }
  });

  return null;
}

function FurnitureItem3D({
  obj,
  childrenItems,
  hazard,
  roomW,
  roomD,
  simState,
  isSelected,
  onSelect,
}: {
  obj: RoomObjectNode;
  childrenItems: RoomObjectNode[];
  hazard?: ObjectHazardResult;
  roomW: number;
  roomD: number;
  simState: "idle" | "shaking" | "collapsed";
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const { w, d } = getOrientedDims(obj);
  const h = obj.height_m;

  const worldX = obj.x_m - roomW / 2;
  const worldZ = obj.z_m - roomD / 2;

  const shouldTip = hazard?.tipped_over && (simState === "shaking" || simState === "collapsed");
  const tipAngleTarget = shouldTip ? Math.PI * 0.47 : 0;
  const tipDir = hazard?.tip_direction_rad ?? 0;

  useFrame((state, delta) => {
    if (!pivotRef.current) return;
    if (simState === "idle") {
      pivotRef.current.rotation.set(0, 0, 0);
      return;
    }

    const t = state.clock.getElapsedTime();
    if (shouldTip) {
      const targetRotZ = -Math.cos(tipDir) * tipAngleTarget;
      const targetRotX = Math.sin(tipDir) * tipAngleTarget;
      pivotRef.current.rotation.z = THREE.MathUtils.lerp(
        pivotRef.current.rotation.z,
        targetRotZ,
        Math.min(1, delta * 3.8)
      );
      pivotRef.current.rotation.x = THREE.MathUtils.lerp(
        pivotRef.current.rotation.x,
        targetRotX,
        Math.min(1, delta * 3.8)
      );
    } else if (simState === "shaking") {
      const wobble = obj.anchored_to_wall ? 0.005 : 0.035;
      pivotRef.current.rotation.z = Math.sin(t * 22 + obj.x_m) * wobble;
      pivotRef.current.rotation.x = Math.cos(t * 19 + obj.z_m) * wobble;
    } else {
      pivotRef.current.rotation.z = THREE.MathUtils.lerp(pivotRef.current.rotation.z, 0, delta * 6);
      pivotRef.current.rotation.x = THREE.MathUtils.lerp(pivotRef.current.rotation.x, 0, delta * 6);
    }
  });

  const sf = hazard?.analytical_safety_factor ?? 2.0;
  const isDanger = sf < 1.0 || hazard?.hit_occupant_zone || hazard?.blocked_exit_corridor;

  // Render Wall-Mounted Window with Mullions & Shattered Shards
  if (obj.category === "window") {
    const shattered = simState !== "idle" && hazard?.shattered_or_fell;
    return (
      <group position={[worldX, 1.35, worldZ]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <mesh>
          <boxGeometry args={[w + 0.08, h + 0.08, d + 0.04]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={shattered ? "#f43f5e" : "#7dd3fc"}
            transparent
            opacity={shattered ? 0.3 : 0.62}
          />
        </mesh>
        {shattered && (
          <group position={[0, -1.33, 0.45]}>
            {[-0.4, -0.2, 0, 0.22, 0.42, -0.1, 0.3].map((ox, idx) => (
              <mesh
                key={idx}
                position={[ox, 0.01, (idx % 3) * 0.22 - 0.15]}
                rotation={[0, idx * 0.8, 0]}
              >
                <coneGeometry args={[0.09, 0.03, 3]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#0284c7" emissiveIntensity={0.5} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    );
  }

  // Render Exit Door
  if (obj.category === "exit_door") {
    return (
      <group position={[worldX, h / 2, worldZ]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <RoundedBox args={[w, h, d]} radius={0.02}>
          <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.45} />
        </RoundedBox>
        <Html position={[0, h / 2 + 0.22, 0]} center distanceFactor={8}>
          <div className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-400 text-[10px] font-bold text-emerald-300 whitespace-nowrap shadow-lg">
            EXIT STAIRS
          </div>
        </Html>
      </group>
    );
  }

  // Render Lift Door (Locked Out in Emergency)
  if (obj.category === "lift_door") {
    return (
      <group position={[worldX, h / 2, worldZ]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <RoundedBox args={[w, h, d]} radius={0.02}>
          <meshStandardMaterial color="#dc2626" emissive="#991b1b" emissiveIntensity={0.5} />
        </RoundedBox>
        <Html position={[0, h / 2 + 0.22, 0]} center distanceFactor={8}>
          <div className="px-2 py-0.5 rounded bg-red-950/95 border border-red-400 text-[10px] font-bold text-red-200 whitespace-nowrap shadow-lg">
            LIFT LOCKED (NO SEISMIC/FIRE USE)
          </div>
        </Html>
      </group>
    );
  }

  // Render Dynamic Floor Hazard (Fire / Debris Blockade)
  if (obj.category === "hazard_zone") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <mesh position={[0, 0.35, 0]}>
          <coneGeometry args={[w * 0.55, 0.7, 16]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#dc2626"
            emissiveIntensity={0.85}
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <circleGeometry args={[w * 0.65, 24]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.35} />
        </mesh>
        <Html position={[0, 0.85, 0]} center distanceFactor={8}>
          <div className="px-2 py-0.5 rounded bg-orange-950/90 border border-orange-400 text-[10px] font-bold text-orange-200 whitespace-nowrap">
            LIVE HAZARD BLOCKADE
          </div>
        </Html>
      </group>
    );
  }

  return (
    <group position={[worldX, 0, worldZ]}>
      {/* Fall Shadow / Crush Footprint Indicator on Floor for Tall Objects */}
      {(obj.category === "bookshelf" || obj.category === "wardrobe") && hazard && (
        <mesh
          position={[
            (hazard.fallen_footprint_2d.min_x + hazard.fallen_footprint_2d.max_x) / 2 - obj.x_m,
            0.008,
            (hazard.fallen_footprint_2d.min_z + hazard.fallen_footprint_2d.max_z) / 2 - obj.z_m,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry
            args={[
              hazard.fallen_footprint_2d.max_x - hazard.fallen_footprint_2d.min_x,
              hazard.fallen_footprint_2d.max_z - hazard.fallen_footprint_2d.min_z,
            ]}
          />
          <meshBasicMaterial
            color={hazard.tipped_over ? "#ef4444" : "#10b981"}
            transparent
            opacity={hazard.tipped_over ? 0.24 : 0.1}
          />
        </mesh>
      )}

      {/* Pivot Group at Floor Level (y = 0) so tipping rotates around the base */}
      <group
        ref={pivotRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {/* ==================== REALISTIC BED PREFAB (WITH HEADBOARD & PILLOWS) ==================== */}
        {obj.category === "bed" && (
          <group>
            <RoundedBox
              args={[w, 0.18, d]}
              radius={0.02}
              smoothness={4}
              position={[0, 0.2, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#5c2d16" roughness={0.55} />
            </RoundedBox>
            <RoundedBox
              args={[w + 0.04, 0.9, 0.1]}
              radius={0.03}
              smoothness={4}
              position={[0, 0.54, -d / 2 + 0.05]}
              castShadow
            >
              <meshStandardMaterial color="#334155" roughness={0.85} />
            </RoundedBox>
            <RoundedBox
              args={[w * 0.94, 0.22, d * 0.92]}
              radius={0.04}
              smoothness={4}
              position={[0, 0.38, 0.03]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#f8fafc" roughness={0.75} />
            </RoundedBox>
            <RoundedBox
              args={[w * 0.96, 0.21, d * 0.64]}
              radius={0.05}
              smoothness={4}
              position={[0, 0.41, d * 0.14]}
              castShadow
            >
              <meshStandardMaterial
                color={hazard?.hit_occupant_zone && simState !== "idle" ? "#dc2626" : "#1d4ed8"}
                roughness={0.82}
              />
            </RoundedBox>
            {[-0.24, 0.24].map((px, i) => (
              <RoundedBox
                key={i}
                args={[w * 0.38, 0.1, 0.28]}
                radius={0.04}
                position={[px * w, 0.52, -d * 0.32]}
                rotation={[0.16, 0, 0]}
                castShadow
              >
                <meshStandardMaterial color="#ffffff" roughness={0.7} />
              </RoundedBox>
            ))}
          </group>
        )}

        {/* ==================== OPEN-FRAME BOOKSHELF WITH COLORFUL BOOKS ==================== */}
        {obj.category === "bookshelf" && (
          <group>
            <mesh position={[-w / 2 + 0.02, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.04, h, d]} />
              <meshStandardMaterial color={isDanger ? "#991b1b" : "#78350f"} roughness={0.55} />
            </mesh>
            <mesh position={[w / 2 - 0.02, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.04, h, d]} />
              <meshStandardMaterial color={isDanger ? "#991b1b" : "#78350f"} roughness={0.55} />
            </mesh>
            <mesh position={[0, h / 2, -d / 2 + 0.015]} castShadow receiveShadow>
              <boxGeometry args={[w, h, 0.025]} />
              <meshStandardMaterial color={isDanger ? "#7f1d1d" : "#5c2d16"} roughness={0.7} />
            </mesh>
            {[0.06, 0.38, 0.68, 0.98, 1.32, h - 0.02].map((sy, i) => (
              <mesh key={i} position={[0, Math.min(h - 0.02, sy), 0]} castShadow receiveShadow>
                <boxGeometry args={[w - 0.02, 0.03, d]} />
                <meshStandardMaterial color="#92400e" roughness={0.5} />
              </mesh>
            ))}
            {[
              { x: -0.26, y: 0.52, c: "#2563eb", bh: 0.2 },
              { x: -0.19, y: 0.52, c: "#dc2626", bh: 0.22 },
              { x: -0.12, y: 0.52, c: "#059669", bh: 0.19 },
              { x: 0.14, y: 0.82, c: "#7c3aed", bh: 0.21 },
              { x: 0.22, y: 0.82, c: "#0284c7", bh: 0.22 },
            ].map((bk, idx) => (
              <mesh key={idx} position={[bk.x * w, Math.min(h - 0.18, bk.y), 0.01]} castShadow>
                <boxGeometry args={[0.04, bk.bh, d * 0.72]} />
                <meshStandardMaterial color={bk.c} roughness={0.65} />
              </mesh>
            ))}
            {/* Combined Center of Mass (h_CoM) Marker Sphere */}
            {hazard && (
              <mesh position={[0, hazard.center_of_mass_height_m, d / 2 + 0.04]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                  color={sf < 1.0 ? "#f43f5e" : "#22c55e"}
                  emissive={sf < 1.0 ? "#e11d48" : "#16a34a"}
                  emissiveIntensity={0.9}
                />
              </mesh>
            )}
          </group>
        )}

        {/* ==================== DOUBLE-DOOR ARMOIRE WARDROBE ==================== */}
        {obj.category === "wardrobe" && (
          <group>
            <RoundedBox
              args={[w, h, d]}
              radius={0.02}
              smoothness={4}
              position={[0, h / 2, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={isDanger ? "#7f1d1d" : "#475569"} roughness={0.5} />
            </RoundedBox>
            {[-0.24, 0.24].map((dx, i) => (
              <RoundedBox
                key={i}
                args={[w * 0.45, h * 0.88, 0.025]}
                radius={0.01}
                position={[dx * w, h * 0.5, d / 2 + 0.01]}
                castShadow
              >
                <meshStandardMaterial color={isDanger ? "#991b1b" : "#64748b"} roughness={0.45} />
              </RoundedBox>
            ))}
            {[-0.04, 0.04].map((hx, i) => (
              <mesh key={i} position={[hx, h * 0.52, d / 2 + 0.03]} castShadow>
                <cylinderGeometry args={[0.01, 0.01, 0.22, 12]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
              </mesh>
            ))}
          </group>
        )}

        {/* ==================== STUDY DESK WITH LAMP & SAFE SHELTER GLOW ==================== */}
        {obj.category === "desk" && (
          <group>
            <RoundedBox
              args={[w, 0.05, d]}
              radius={0.012}
              smoothness={4}
              position={[0, h - 0.03, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#b45309" roughness={0.42} />
            </RoundedBox>
            {[
              [-w * 0.44, -d * 0.42],
              [w * 0.44, -d * 0.42],
              [-w * 0.44, d * 0.42],
              [w * 0.44, d * 0.42],
            ].map(([lx, lz], idx) => (
              <mesh key={idx} position={[lx, (h - 0.04) / 2, lz]} castShadow>
                <cylinderGeometry args={[0.025, 0.025, h - 0.04, 12]} />
                <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
              </mesh>
            ))}
            {/* Desk Lamp */}
            <group position={[-w * 0.34, h, -d * 0.24]}>
              <mesh position={[0, 0.14, 0]} rotation={[0, 0, -0.2]}>
                <cylinderGeometry args={[0.01, 0.01, 0.28, 8]} />
                <meshStandardMaterial color="#334155" metalness={0.8} />
              </mesh>
              <mesh position={[0.05, 0.28, 0]} rotation={[0, 0, 0.6]}>
                <coneGeometry args={[0.06, 0.1, 16]} />
                <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.65} />
              </mesh>
            </group>
            {/* Safe Drop-Cover-Hold Shelter Glow Under Desk */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w * 0.85, d * 0.85]} />
              <meshBasicMaterial color="#06b6d4" transparent opacity={0.35} />
            </mesh>
          </group>
        )}

        {/* ==================== ERGONOMIC SWIVEL CHAIR ==================== */}
        {obj.category === "chair" && (
          <group>
            <RoundedBox args={[w, 0.06, d]} radius={0.02} position={[0, 0.44, 0]} castShadow>
              <meshStandardMaterial color="#334155" roughness={0.8} />
            </RoundedBox>
            <RoundedBox args={[w * 0.92, 0.45, 0.05]} radius={0.02} position={[0, 0.7, -d * 0.4]} castShadow>
              <meshStandardMaterial color="#1e293b" roughness={0.75} />
            </RoundedBox>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.04, 0.18, 0.44, 12]} />
              <meshStandardMaterial color="#0f172a" metalness={0.8} />
            </mesh>
          </group>
        )}

        {/* ==================== STANDALONE CAGB FLOOR OBJECTS (BANNERS, TOTEMS, STATUES, BINS) ==================== */}
        {(obj.category === "heavy_item" || obj.category === "tv_monitor" || obj.category === "fragile_glass") && (
          <group>
            <RoundedBox
              args={[w, h, d]}
              radius={0.02}
              smoothness={4}
              position={[0, h / 2, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={
                  obj.category === "tv_monitor"
                    ? "#0ea5e9"
                    : isDanger
                    ? "#dc2626"
                    : "#f59e0b"
                }
                roughness={0.45}
              />
            </RoundedBox>
          </group>
        )}

        {/* Render Stacked Child Items (Heavy Textbooks, Monitors, Fragile Glass) */}
        {childrenItems.map((child) => {
          const levelY =
            obj.category === "desk"
              ? h + child.height_m / 2
              : child.shelf_level === "top"
              ? h * 0.9 + child.height_m / 2
              : child.shelf_level === "middle"
              ? h * 0.62 + child.height_m / 2
              : h * 0.16 + child.height_m / 2;

          return (
            <group key={child.id} position={[0, levelY, 0]}>
              <RoundedBox args={[child.width_m, child.height_m, child.depth_m]} radius={0.015} castShadow>
                <meshStandardMaterial
                  color={
                    child.category === "heavy_item"
                      ? child.shelf_level === "bottom"
                        ? "#10b981"
                        : "#f59e0b"
                      : child.category === "tv_monitor"
                      ? "#0f172a"
                      : "#38bdf8"
                  }
                />
              </RoundedBox>
              <Html position={[0, child.height_m / 2 + 0.14, 0]} center distanceFactor={8}>
                <div
                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap border ${
                    child.shelf_level === "bottom"
                      ? "bg-emerald-950/90 text-emerald-200 border-emerald-400"
                      : "bg-amber-950/90 text-amber-200 border-amber-400"
                  }`}
                >
                  {child.label} ({child.shelf_level?.toUpperCase()})
                </div>
              </Html>
            </group>
          );
        })}

        {/* Floating Physics Telemetry Badge for Main Objects */}
        {(obj.category === "bookshelf" ||
          obj.category === "wardrobe" ||
          obj.category === "bed" ||
          obj.category === "desk" ||
          isSelected) && (
          <Html position={[0, h + 0.24, 0]} center distanceFactor={8}>
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-md border ${
                obj.category === "desk"
                  ? "bg-cyan-950/90 border-cyan-400 text-cyan-200"
                  : isDanger
                  ? "bg-rose-950/95 border-rose-400 text-rose-200"
                  : "bg-slate-900/90 border-emerald-400/70 text-emerald-300"
              }`}
            >
              {obj.label}
              {(obj.category === "bookshelf" || obj.category === "wardrobe") && hazard
                ? ` • SF=${hazard.analytical_safety_factor} (CoM ${hazard.center_of_mass_height_m}m)`
                : ""}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

function ShakingRoomGroup({
  scene,
  verification,
  simState,
  dropHazardMode,
  onFloorClickDropHazard,
  selectedObjectId,
  onSelectObject,
}: RoomCanvas3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { width_m: W, depth_m: D, height_m: H } = scene.room;
  const hardwoodTex = useHardwoodFloorTexture();

  useFrame((state) => {
    if (!groupRef.current) return;
    if (simState === "shaking") {
      const t = state.clock.getElapsedTime();
      const amp = 0.045 * (scene.earthquake.magnitude_mw - 4.5);
      groupRef.current.position.x = Math.sin(t * 28) * amp + Math.cos(t * 17) * amp * 0.6;
      groupRef.current.position.z = Math.cos(t * 24) * amp * 0.85;
      groupRef.current.position.y = Math.sin(t * 42) * amp * 0.2;
    } else {
      groupRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.15);
    }
  });

  const childrenMap = useMemo(() => {
    const map = new Map<string, RoomObjectNode[]>();
    for (const o of scene.objects) {
      if (o.parent_id) {
        const arr = map.get(o.parent_id) ?? [];
        arr.push(o);
        map.set(o.parent_id, arr);
      }
    }
    return map;
  }, [scene.objects]);

  const floorObjects = useMemo(
    () => scene.objects.filter((o) => o.parent_id === null),
    [scene.objects]
  );

  const activeEscapePath =
    simState === "idle"
      ? verification.escape_path_pre_quake_m
      : verification.escape_path_post_quake_m;

  const escapeLinePts = useMemo(() => {
    if (!activeEscapePath || activeEscapePath.length < 2) return null;
    return activeEscapePath.map(
      (p) => new THREE.Vector3(p.x_m - W / 2, 0.04, p.z_m - D / 2)
    );
  }, [activeEscapePath, W, D]);

  const shelterLinePts = useMemo(() => {
    if (!verification.shelter_path_m || verification.shelter_path_m.length < 2) return null;
    return verification.shelter_path_m.map(
      (p) => new THREE.Vector3(p.x_m - W / 2, 0.03, p.z_m - D / 2)
    );
  }, [verification.shelter_path_m, W, D]);

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
    if (!dropHazardMode || !onFloorClickDropHazard) return;
    e.stopPropagation();
    const localPt = e.point;
    const xm = Number((localPt.x + W / 2).toFixed(2));
    const zm = Number((localPt.z + D / 2).toFixed(2));
    onFloorClickDropHazard(xm, zm);
  };

  return (
    <group ref={groupRef}>
      {/* Procedural Warm Oak Hardwood Floor Slab */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={handleFloorClick}
      >
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial
          map={dropHazardMode ? null : hardwoodTex}
          color={dropHazardMode ? "#312e81" : "#d6b08a"}
          roughness={0.62}
        />
      </mesh>

      {/* Metric 0.5m Engineering Grid */}
      <Grid
        position={[0, 0.002, 0]}
        args={[W, D]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#475569"
        sectionSize={1.0}
        sectionThickness={1.0}
        sectionColor="#64748b"
        fadeDistance={18}
      />

      {/* Translucent Architectural Cutaway Walls (North & West Walls) */}
      <mesh position={[0, H / 2, -D / 2]}>
        <boxGeometry args={[W, H, 0.06]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.32} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]}>
        <boxGeometry args={[0.06, H, D]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.32} />
      </mesh>
      {/* Low South & East Boundary Curbs */}
      <mesh position={[0, 0.12, D / 2]}>
        <boxGeometry args={[W, 0.24, 0.06]} />
        <meshStandardMaterial color="#64748b" transparent opacity={0.45} />
      </mesh>
      <mesh position={[W / 2, 0.12, 0]}>
        <boxGeometry args={[0.06, 0.24, D]} />
        <meshStandardMaterial color="#64748b" transparent opacity={0.45} />
      </mesh>

      {/* A* Escape Path Ribbon (Occupant -> Fire Exit Door) */}
      {escapeLinePts && (
        <Line
          points={escapeLinePts}
          color={
            simState !== "idle" && !verification.exit_reachable_post_quake
              ? "#ef4444"
              : "#10b981"
          }
          lineWidth={5}
        />
      )}

      {/* Drop-Cover-Hold Safe Shelter Path Ribbon (Occupant -> Under Sturdy Desk) */}
      {shelterLinePts && (
        <Line
          points={shelterLinePts}
          color="#06b6d4"
          lineWidth={3}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      )}

      {/* Render All Floor & Wall Room Objects */}
      {floorObjects.map((obj) => (
        <FurnitureItem3D
          key={obj.id}
          obj={obj}
          childrenItems={childrenMap.get(obj.id) ?? []}
          hazard={verification.object_results[obj.id]}
          roomW={W}
          roomD={D}
          simState={simState}
          isSelected={selectedObjectId === obj.id}
          onSelect={() => onSelectObject?.(obj.id)}
        />
      ))}
    </group>
  );
}

export default function RoomCanvas3D(props: RoomCanvas3DProps) {
  const [firstPersonMode, setFirstPersonMode] = useState<boolean>(false);
  const [autoWalk, setAutoWalk] = useState<boolean>(false);

  const activeEscapePath =
    props.simState === "idle"
      ? props.verification.escape_path_pre_quake_m
      : props.verification.escape_path_post_quake_m;

  return (
    <div className="w-full h-full relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      {/* Camera Mode Toggle Bar (Cutaway 3D Orbit vs. 1st-Person WASD Inside Room View) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-1 shadow-lg">
        <button
          onClick={() => {
            setFirstPersonMode(false);
            setAutoWalk(false);
          }}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            !firstPersonMode
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-300 hover:text-white"
          }`}
        >
          📐 3D Cutaway Orbit
        </button>
        <button
          onClick={() => setFirstPersonMode(true)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            firstPersonMode
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-300 hover:text-white"
          }`}
        >
          👁️ 1st-Person Inside (WASD)
        </button>
        {firstPersonMode && (
          <button
            onClick={() => setAutoWalk((v) => !v)}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
              autoWalk
                ? "bg-cyan-500 text-slate-950"
                : "bg-slate-800 text-cyan-300 border border-cyan-500/40"
            }`}
          >
            {autoWalk ? "⏸ Auto-Tour" : "▶ Auto-Tour Path"}
          </button>
        )}
      </div>

      <Canvas
        shadows
        camera={{ position: [4.2, 3.8, 4.6], fov: 48 }}
        onPointerMissed={() => props.onSelectObject?.(null)}
      >
        <color attach="background" args={["#090d16"]} />
        <ambientLight intensity={0.85} />
        <directionalLight
          castShadow
          position={[5, 8, 5]}
          intensity={1.45}
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 3, -2]} intensity={0.55} color="#38bdf8" />

        <ShakingRoomGroup {...props} />

        <WalkthroughController
          active={firstPersonMode}
          autoWalk={autoWalk}
          escapePath={activeEscapePath}
          roomWidth={props.scene.room.width_m}
          roomDepth={props.scene.room.depth_m}
        />

        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.45}
          scale={12}
          blur={1.8}
          far={4}
        />
        {!firstPersonMode && (
          <OrbitControls
            makeDefault
            minPolarAngle={0.15}
            maxPolarAngle={Math.PI / 2 - 0.04}
            enableDamping
          />
        )}
      </Canvas>
    </div>
  );
}
