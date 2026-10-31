"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  BuildingFloorGraph,
  LiveHazardEvent,
  EvacuationVerificationResult,
  NavNode,
  WallSegment,
} from "@/types/contracts";

interface ExitZeroCanvasProps {
  floorGraph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  verification: EvacuationVerificationResult;
  walkthroughActive: boolean;
  fullScreen?: boolean;
}

/**
 * Procedural Architectural Terrazzo / Polished Corridor Tile Texture
 */
function useArchitecturalFloorTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Warm architectural stone/terrazzo base
    ctx.fillStyle = "#e2e6ec";
    ctx.fillRect(0, 0, 512, 512);

    // Tile grid (64x64px tiles)
    const tileSize = 64;
    for (let y = 0; y < 512; y += tileSize) {
      for (let x = 0; x < 512; x += tileSize) {
        const shade = (x / tileSize + y / tileSize) % 2 === 0 ? "#dde2e9" : "#e5e9ef";
        ctx.fillStyle = shade;
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // Subtle terrazzo speckles
        ctx.fillStyle = "rgba(100, 116, 139, 0.12)";
        for (let s = 0; s < 8; s++) {
          const sx = x + ((s * 19 + x) % (tileSize - 6)) + 3;
          const sy = y + ((s * 29 + y) % (tileSize - 6)) + 3;
          ctx.fillRect(sx, sy, 2, 2);
        }
      }
    }

    // Grout lines
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 512; i += tileSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 10);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/**
 * Safely load the actual Imperial CAGB Level 2 floorplan image if available
 */
function useFloorplanImageTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url || typeof window === "undefined") return;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.needsUpdate = true;
        setTexture(loaded);
      },
      undefined,
      () => {
        setTexture(null);
      }
    );
  }, [url]);

  return texture;
}

/**
 * First-Person Inside Building Controller (360° Mouse Drag Look + WASD Walk + Optional Auto-Walk along Verified Route)
 */
function BuildingWalkthroughCamera({
  active,
  autoWalk,
  routeNodes,
  widthM,
  depthM,
}: {
  active: boolean;
  autoWalk: boolean;
  routeNodes: Array<{ x_m: number; z_m: number; label: string }>;
  widthM: number;
  depthM: number;
}) {
  const { camera, gl } = useThree();
  const progressRef = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const isDragging = useRef(false);
  const yawRef = useRef(-Math.PI / 2); // Looking East down the main CAGB corridor
  const pitchRef = useRef(-0.04);

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
      const startNode = routeNodes[0] || { x_m: 10.0, z_m: 12.5 };
      camera.position.set(
        startNode.x_m - widthM / 2,
        1.68,
        startNode.z_m - depthM / 2
      );
      if (routeNodes.length >= 2) {
        const nextNode = routeNodes[1];
        yawRef.current = Math.atan2(
          -(nextNode.x_m - startNode.x_m),
          -(nextNode.z_m - startNode.z_m)
        );
      } else {
        yawRef.current = -Math.PI / 2;
      }
      pitchRef.current = -0.04;
    } else {
      camera.position.set(0, 26, 25);
      camera.lookAt(0, 0, 0);
    }
  }, [active, camera, routeNodes, widthM, depthM]);

  useFrame((_, delta) => {
    if (!active) return;

    const moveSpeed = 4.2 * delta;
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
      -widthM / 2 + 1.8,
      widthM / 2 - 1.8
    );
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z,
      -depthM / 2 + 1.8,
      depthM / 2 - 1.8
    );
    camera.position.y = 1.68;

    if (autoWalk && !manualMoved && !isDragging.current && routeNodes.length >= 2) {
      progressRef.current = (progressRef.current + delta * 0.14) % 1;
      const fIdx = progressRef.current * (routeNodes.length - 1);
      const i = Math.floor(fIdx);
      const t = fIdx - i;

      const curr = routeNodes[i];
      const next = routeNodes[Math.min(i + 1, routeNodes.length - 1)];

      const x = THREE.MathUtils.lerp(curr.x_m, next.x_m, t) - widthM / 2;
      const z = THREE.MathUtils.lerp(curr.z_m, next.z_m, t) - depthM / 2;

      const lookNext = routeNodes[Math.min(i + 2, routeNodes.length - 1)];
      const lx = lookNext.x_m - widthM / 2;
      const lz = lookNext.z_m - depthM / 2;

      camera.position.lerp(new THREE.Vector3(x, 1.68, z), 0.12);
      camera.lookAt(lx, 1.55, lz);
    } else {
      const lookDir = new THREE.Vector3(
        -Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        Math.sin(pitchRef.current),
        -Math.cos(yawRef.current) * Math.cos(pitchRef.current)
      );
      const target = camera.position.clone().add(lookDir.multiplyScalar(5));
      camera.lookAt(target);
    }
  });

  return null;
}

/**
 * Animated 3D Evacuee Avatar moving along the active verified escape route
 */
function AnimatedEvacueeAvatar({
  routeNodes,
  widthM,
  depthM,
}: {
  routeNodes: Array<{ x_m: number; z_m: number; label: string }>;
  widthM: number;
  depthM: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current || routeNodes.length < 2) return;
    progressRef.current = (progressRef.current + delta * 0.18) % 1;
    const fIdx = progressRef.current * (routeNodes.length - 1);
    const i = Math.floor(fIdx);
    const t = fIdx - i;

    const curr = routeNodes[i];
    const next = routeNodes[Math.min(i + 1, routeNodes.length - 1)];

    const x = THREE.MathUtils.lerp(curr.x_m, next.x_m, t) - widthM / 2;
    const z = THREE.MathUtils.lerp(curr.z_m, next.z_m, t) - depthM / 2;
    const angle = Math.atan2(next.x_m - curr.x_m, next.z_m - curr.z_m);

    const bounce = Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.08;
    groupRef.current.position.set(x, bounce, z);
    groupRef.current.rotation.y = angle;
  });

  if (routeNodes.length < 2) return null;

  return (
    <group ref={groupRef}>
      {/* Glowing emerald base locator disk */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.52, 24]} />
        <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.1, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.45, 6, 10]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      <mesh position={[0.1, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.45, 6, 10]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      {/* High-vis safety jacket torso */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.48, 8, 14]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#059669"
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.52, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#f1c27d" roughness={0.5} />
      </mesh>
      {/* Direction pointer arrow */}
      <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.14, 0.34, 12]} />
        <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Architectural Extruded Wall Segment with Top Cap, Skirting, Pilasters, and Glazing
 */
function ArchitecturalWall({
  w,
  widthM,
  depthM,
}: {
  w: WallSegment;
  widthM: number;
  depthM: number;
}) {
  const x1 = w.x1_m - widthM / 2;
  const z1 = w.z1_m - depthM / 2;
  const x2 = w.x2_m - widthM / 2;
  const z2 = w.z2_m - depthM / 2;

  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const midX = (x1 + x2) / 2;
  const midZ = (z1 + z2) / 2;
  const height = w.is_doorway ? 0.7 : w.height_m || 3.1;
  const yCenter = w.is_doorway ? 2.45 : height / 2;
  const thickness = 0.24;

  const isExterior =
    Math.abs(w.z1_m - 1.5) < 0.8 ||
    Math.abs(w.z1_m - (depthM - 1.5)) < 0.8 ||
    Math.abs(w.x1_m - 1.5) < 0.8 ||
    Math.abs(w.x1_m - (widthM - 1.5)) < 0.8;

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      {/* Main architectural concrete/plaster wall */}
      <mesh position={[0, yCenter, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, height, thickness]} />
        <meshStandardMaterial
          color={isExterior ? "#cbd5e1" : "#f1f5f9"}
          roughness={0.78}
          metalness={0.05}
        />
      </mesh>

      {/* Architectural Cutaway Dark Slate Top Cap (makes walls read crisply in 3D) */}
      <mesh position={[0, (w.height_m || 3.1) + 0.03, 0]}>
        <boxGeometry args={[length + 0.04, 0.06, thickness + 0.05]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>

      {/* Dark Timber/Aluminum Baseboard Skirting on Both Sides */}
      {!w.is_doorway && (
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[length + 0.02, 0.14, thickness + 0.04]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
      )}

      {/* End Structural Pilasters / Columns */}
      <mesh position={[-length / 2, (w.height_m || 3.1) / 2, 0]} castShadow>
        <boxGeometry args={[thickness * 1.35, (w.height_m || 3.1) + 0.08, thickness * 1.35]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
      </mesh>
      <mesh position={[length / 2, (w.height_m || 3.1) / 2, 0]} castShadow>
        <boxGeometry args={[thickness * 1.35, (w.height_m || 3.1) + 0.08, thickness * 1.35]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
      </mesh>

      {/* Exterior Curtain Wall Windows if Exterior North/South/East/West Wall */}
      {isExterior && length > 6 && !w.is_doorway && (
        <group position={[0, height * 0.55, 0]}>
          {[-0.32, 0, 0.32].map((frac, idx) => (
            <group key={idx} position={[length * frac, 0, 0]}>
              <mesh>
                <boxGeometry args={[length * 0.22, height * 0.52, thickness + 0.06]} />
                <meshStandardMaterial
                  color="#bae6fd"
                  transparent
                  opacity={0.48}
                  roughness={0.1}
                  metalness={0.3}
                />
              </mesh>
              {/* Window Frame Mullion */}
              <mesh>
                <boxGeometry args={[0.08, height * 0.54, thickness + 0.08]} />
                <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

/**
 * Realistic Interior Room Furnishings (Lecture Theatre 200, East Lab 203, Corridor Double Fire Doors)
 */
function BuildingInteriorFurnishings({
  widthM,
  depthM,
}: {
  widthM: number;
  depthM: number;
}) {
  return (
    <group>
      {/* ======================================================== */}
      {/* 1. ROOM 200 — CAGB MAIN LECTURE THEATRE                  */}
      {/* ======================================================== */}
      <group position={[9.0 - widthM / 2, 0, 5.5 - depthM / 2]}>
        {/* Lecture Theatre Carpeted Floor Inset */}
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[9.8, 0.03, 6.2]} />
          <meshStandardMaterial color="#1e3a5f" roughness={0.92} />
        </mesh>

        {/* Dual Wide Projection Screens on West Wall */}
        {[-1.6, 1.6].map((zOff, i) => (
          <group key={i} position={[-4.6, 1.85, zOff]}>
            <mesh>
              <boxGeometry args={[0.08, 1.5, 2.5]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>
            <mesh position={[0.05, 0, 0]}>
              <boxGeometry args={[0.02, 1.35, 2.3]} />
              <meshStandardMaterial
                color="#e0f2fe"
                emissive="#38bdf8"
                emissiveIntensity={0.28}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* Lecturer Oak Podium / Lectern */}
        <group position={[-3.2, 0, 0]}>
          <RoundedBox args={[0.75, 1.12, 1.1]} radius={0.04} position={[0, 0.56, 0]} castShadow>
            <meshStandardMaterial color="#78350f" roughness={0.6} />
          </RoundedBox>
          <mesh position={[0.1, 1.24, 0]} rotation={[0, 0, -0.35]}>
            <boxGeometry args={[0.04, 0.28, 0.45]} />
            <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={0.4} />
          </mesh>
        </group>

        {/* 4 Tiered Rows of Lecture Theatre Desks & Upholstered Seats */}
        {[-1.4, -0.1, 1.2, 2.5].map((rowX, rIdx) => {
          const tierY = rIdx * 0.14;
          return (
            <group key={rIdx} position={[rowX, tierY, 0]}>
              {/* Raised Tier Platform */}
              <mesh position={[0, -tierY / 2 + 0.04, 0]} receiveShadow>
                <boxGeometry args={[1.2, tierY + 0.08, 5.2]} />
                <meshStandardMaterial color="#334155" roughness={0.85} />
              </mesh>
              {/* Long Continuous Oak Writing Desk */}
              <RoundedBox
                args={[0.4, 0.74, 4.9]}
                radius={0.02}
                position={[-0.24, 0.37, 0]}
                castShadow
              >
                <meshStandardMaterial color="#b45309" roughness={0.55} />
              </RoundedBox>
              {/* 6 Auditorium Seats per Row */}
              {[-1.9, -1.15, -0.4, 0.35, 1.1, 1.85].map((seatZ, sIdx) => (
                <group key={sIdx} position={[0.2, 0, seatZ]}>
                  <RoundedBox args={[0.4, 0.1, 0.44]} radius={0.03} position={[0, 0.44, 0]} castShadow>
                    <meshStandardMaterial color="#991b1b" roughness={0.75} />
                  </RoundedBox>
                  <RoundedBox args={[0.1, 0.5, 0.44]} radius={0.03} position={[0.17, 0.7, 0]} castShadow>
                    <meshStandardMaterial color="#b91c1c" roughness={0.75} />
                  </RoundedBox>
                </group>
              ))}
            </group>
          );
        })}
      </group>

      {/* ======================================================== */}
      {/* 2. ROOM 203 — EAST WING COMPUTER & ROBOTICS LAB          */}
      {/* ======================================================== */}
      <group position={[30.5 - widthM / 2, 0, 5.5 - depthM / 2]}>
        {/* Anti-static Lab Flooring Inset */}
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[9.0, 0.03, 6.2]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.65} />
        </mesh>

        {/* 3 Lab Island Workbenches with Dual Glowing Monitors */}
        {[-2.4, 0, 2.4].map((islandX, iIdx) => (
          <group key={iIdx} position={[islandX, 0, 0]}>
            <RoundedBox args={[1.3, 0.07, 4.4]} radius={0.02} position={[0, 0.76, 0]} castShadow>
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </RoundedBox>
            {[-1.9, 0, 1.9].map((legZ, lIdx) => (
              <mesh key={lIdx} position={[0, 0.38, legZ]} castShadow>
                <boxGeometry args={[1.15, 0.76, 0.08]} />
                <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}
            {[-1.4, 0, 1.4].map((wsZ, wIdx) => (
              <group key={wIdx} position={[0, 0.8, wsZ]}>
                <mesh position={[-0.24, 0.24, 0]}>
                  <boxGeometry args={[0.04, 0.35, 0.6]} />
                  <meshStandardMaterial
                    color="#0f172a"
                    emissive="#0284c7"
                    emissiveIntensity={0.45}
                  />
                </mesh>
                <mesh position={[0.24, 0.24, 0]}>
                  <boxGeometry args={[0.04, 0.35, 0.6]} />
                  <meshStandardMaterial
                    color="#0f172a"
                    emissive="#0284c7"
                    emissiveIntensity={0.45}
                  />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>

      {/* ======================================================== */}
      {/* 3. CORRIDOR DOUBLE FIRE DOORS WITH VISION PANELS         */}
      {/* ======================================================== */}
      {[
        { x: 15.0, z: 12.5, rotY: Math.PI / 2 },
        { x: 25.0, z: 12.5, rotY: Math.PI / 2 },
        { x: 9.0, z: 9.0, rotY: 0 },
        { x: 30.5, z: 9.0, rotY: 0 },
      ].map((door, idx) => (
        <group
          key={idx}
          position={[door.x - widthM / 2, 0, door.z - depthM / 2]}
          rotation={[0, door.rotY, 0]}
        >
          {[-0.55, 0.55].map((leafX, lIdx) => (
            <group
              key={lIdx}
              position={[leafX, 1.05, 0]}
              rotation={[0, lIdx === 0 ? 0.35 : -0.35, 0]}
            >
              <RoundedBox args={[0.95, 2.1, 0.07]} radius={0.015} castShadow>
                <meshStandardMaterial color="#b45309" roughness={0.55} />
              </RoundedBox>
              <mesh position={[0, 0.15, 0]}>
                <boxGeometry args={[0.22, 1.1, 0.09]} />
                <meshStandardMaterial color="#bae6fd" transparent opacity={0.6} roughness={0.1} />
              </mesh>
              <mesh position={[0, -0.05, 0.05]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.018, 0.018, 0.72, 8]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
              </mesh>
            </group>
          ))}

          {/* Glowing Overhead Green ISO EXIT Lightbox */}
          <group position={[0, 2.48, 0]}>
            <RoundedBox args={[0.85, 0.28, 0.12]} radius={0.02}>
              <meshStandardMaterial
                color="#10b981"
                emissive="#10b981"
                emissiveIntensity={0.95}
              />
            </RoundedBox>
            <Text position={[0, 0, 0.07]} fontSize={0.13} color="#ffffff" anchorX="center" anchorY="middle">
              EXIT
            </Text>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * Realistic 3D Stairwell Core, Elevator Shaft, or Accessible Refuge Bay
 */
function ArchitecturalBuildingNode({
  node,
  widthM,
  depthM,
  isTarget,
  isOnRoute,
  isUserStart,
  liftLocked,
}: {
  node: NavNode;
  widthM: number;
  depthM: number;
  isTarget: boolean;
  isOnRoute: boolean;
  isUserStart: boolean;
  liftLocked: boolean;
}) {
  const x = node.x_m - widthM / 2;
  const z = node.z_m - depthM / 2;

  // 1. REALISTIC 3D MULTI-FLIGHT CONCRETE STAIRWELL CORE
  if (node.type === "stairwell_exit") {
    const numSteps = 9;
    return (
      <group position={[x, 0, z]}>
        {/* Stairwell Safety Core Floor Pad */}
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <boxGeometry args={[3.4, 0.06, 3.2]} />
          <meshStandardMaterial
            color={isTarget ? "#065f46" : "#1e293b"}
            emissive={isTarget ? "#059669" : "#000000"}
            emissiveIntensity={isTarget ? 0.35 : 0}
            roughness={0.7}
          />
        </mesh>

        {/* Concrete Stair Flight with Yellow High-Vis Step Nosings */}
        <group position={[-0.7, 0.06, -0.9]}>
          {Array.from({ length: numSteps }).map((_, sIdx) => (
            <group key={sIdx} position={[0, sIdx * 0.22, sIdx * 0.22]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[1.35, 0.22, 0.24]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.75} />
              </mesh>
              <mesh position={[0, 0.112, -0.1]}>
                <boxGeometry args={[1.33, 0.015, 0.04]} />
                <meshStandardMaterial color="#facc15" emissive="#eab308" emissiveIntensity={0.3} />
              </mesh>
            </group>
          ))}
          {[-0.62, 0.62].map((railX, rIdx) => (
            <mesh
              key={rIdx}
              position={[railX, 1.35, 0.88]}
              rotation={[Math.PI / 4, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.025, 0.025, 2.75, 8]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
            </mesh>
          ))}
        </group>

        {/* Glowing Green Fire Exit Beacon Column */}
        <mesh position={[1.1, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 2.8, 16]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={isTarget ? 1.1 : 0.45}
            transparent
            opacity={0.85}
          />
        </mesh>

        {isTarget && (
          <pointLight position={[0, 2.6, 0]} intensity={1.8} distance={8} color="#10b981" />
        )}

        {/* Overhead Architectural Signboard */}
        <group position={[0, 3.35, 0]}>
          <RoundedBox args={[3.4, 0.55, 0.12]} radius={0.04}>
            <meshStandardMaterial
              color={isTarget ? "#059669" : "#0f172a"}
              emissive={isTarget ? "#10b981" : "#064e3b"}
              emissiveIntensity={isTarget ? 0.6 : 0.2}
            />
          </RoundedBox>
          <Text position={[0, 0.05, 0.08]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle">
            {node.label}
          </Text>
          <Text position={[0, -0.16, 0.08]} fontSize={0.13} color="#a7f3d0" anchorX="center" anchorY="middle">
            {isTarget ? "★ VERIFIED SAFE STAIR EXIT" : "EMERGENCY STAIR CORE"}
          </Text>
        </group>
      </group>
    );
  }

  // 2. REALISTIC 3D ELEVATOR SHAFT & LOCKED LIFT LOBBY
  if (node.type === "lift_elevator") {
    return (
      <group position={[x, 0, z]}>
        {/* Elevator Shaft Structural Tower */}
        <mesh position={[0, 1.65, -0.65]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 3.3, 1.5]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.3} />
        </mesh>

        {/* Brushed Stainless Steel Double Elevator Doors */}
        {[-0.48, 0.48].map((doorX, dIdx) => (
          <mesh key={dIdx} position={[doorX, 1.15, 0.12]} castShadow>
            <boxGeometry args={[0.92, 2.25, 0.06]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
          </mesh>
        ))}

        {/* Red "DO NOT USE LIFT IN FIRE / EARTHQUAKE" Crossbar Barrier */}
        {liftLocked && (
          <group position={[0, 1.2, 0.28]}>
            <mesh rotation={[0, 0, 0.42]}>
              <boxGeometry args={[2.3, 0.16, 0.06]} />
              <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.9} />
            </mesh>
            <mesh rotation={[0, 0, -0.42]}>
              <boxGeometry args={[2.3, 0.16, 0.06]} />
              <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.9} />
            </mesh>
            <pointLight position={[0, 0.6, 0.4]} intensity={1.4} distance={6} color="#ef4444" />
          </group>
        )}

        {/* Overhead Lift Lockout Warning Sign */}
        <group position={[0, 3.6, 0]}>
          <RoundedBox args={[3.4, 0.58, 0.12]} radius={0.04}>
            <meshStandardMaterial color="#7f1d1d" emissive="#dc2626" emissiveIntensity={0.7} />
          </RoundedBox>
          <Text position={[0, 0.06, 0.08]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle">
            ⛔ LIFT LOCKED OUT
          </Text>
          <Text position={[0, -0.15, 0.08]} fontSize={0.13} color="#fecaca" anchorX="center" anchorY="middle">
            SEISMIC / FIRE OVERRIDE — DO NOT USE
          </Text>
        </group>
      </group>
    );
  }

  // 3. REALISTIC 3D WHEELCHAIR ACCESSIBLE REFUGE BAY
  if (node.type === "accessible_refuge") {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <boxGeometry args={[2.8, 0.05, 2.2]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#2563eb"
            emissiveIntensity={isTarget ? 0.65 : 0.25}
            roughness={0.4}
          />
        </mesh>
        <RoundedBox args={[0.38, 1.65, 0.28]} radius={0.04} position={[0, 0.82, -0.8]} castShadow>
          <meshStandardMaterial color="#7c3aed" metalness={0.3} roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 1.35, -0.64]}>
          <boxGeometry args={[0.24, 0.28, 0.03]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} />
        </mesh>
        <Text position={[0, 2.35, 0]} fontSize={0.22} color="#c4b5fd" anchorX="center" anchorY="middle">
          {`♿ ${node.label}`}
        </Text>
      </group>
    );
  }

  // 4. STANDARD ROOM / CORRIDOR JUNCTION WAYPOINT MARKER
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry
          args={[
            isUserStart ? 0.45 : isOnRoute ? 0.34 : 0.24,
            isUserStart ? 0.45 : isOnRoute ? 0.34 : 0.24,
            0.28,
            20,
          ]}
        />
        <meshStandardMaterial
          color={
            isUserStart
              ? "#38bdf8"
              : isOnRoute
              ? "#10b981"
              : node.type === "room"
              ? "#0284c7"
              : "#475569"
          }
          emissive={isUserStart ? "#0284c7" : isOnRoute ? "#10b981" : "#000000"}
          emissiveIntensity={isUserStart || isOnRoute ? 0.65 : 0}
        />
      </mesh>
      {(node.type === "room" || isOnRoute || isUserStart) && (
        <Text
          position={[0, 2.85, 0]}
          fontSize={isUserStart ? 0.28 : node.type === "room" ? 0.24 : 0.19}
          color={isUserStart ? "#38bdf8" : isOnRoute ? "#6ee7b7" : "#f8fafc"}
          anchorX="center"
          anchorY="middle"
        >
          {isUserStart ? `📍 YOU: ${node.label}` : node.label}
        </Text>
      )}
    </group>
  );
}

/**
 * Realistic 3D Dynamic Corridor Hazard (Collapsed Masonry Rubble, Toppled Beams, Fire/Smoke Plume)
 */
function RealisticHazardZone3D({
  hazard,
  nodes,
  widthM,
  depthM,
}: {
  hazard: LiveHazardEvent;
  nodes: NavNode[];
  widthM: number;
  depthM: number;
}) {
  const locNode = nodes.find((n) => n.id === hazard.location_node_id);
  const x = (locNode ? locNode.x_m : widthM / 2) - widthM / 2;
  const z = (locNode ? locNode.z_m : depthM / 2) - depthM / 2;
  const radiusM = hazard.severity === "blocked" ? 2.4 : 1.7;

  const smokeGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!smokeGroupRef.current) return;
    const t = state.clock.elapsedTime;
    smokeGroupRef.current.position.y = 1.25 + Math.sin(t * 2.2) * 0.14;
    smokeGroupRef.current.rotation.y = t * 0.35;
  });

  const debrisBlocks = useMemo(() => {
    return [
      { pos: [-0.8, 0.32, -0.4], size: [1.1, 0.64, 0.85], rot: [0.2, 0.4, -0.15] },
      { pos: [0.65, 0.28, 0.5], size: [0.95, 0.55, 0.9], rot: [-0.15, 0.8, 0.25] },
      { pos: [0.1, 0.58, -0.1], size: [1.3, 0.42, 0.7], rot: [0.35, -0.3, 0.4] },
      { pos: [-0.4, 0.22, 0.75], size: [0.85, 0.44, 0.65], rot: [0.1, 1.1, -0.2] },
      { pos: [0.9, 0.4, -0.6], size: [0.75, 0.8, 0.6], rot: [-0.4, 0.2, 0.5] },
    ];
  }, []);

  return (
    <group position={[x, 0, z]}>
      {/* Danger Perimeter Floor Ring */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.4, radiusM - 0.28), radiusM, 40]} />
        <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radiusM, 40]} />
        <meshStandardMaterial color="#dc2626" transparent opacity={0.28} />
      </mesh>

      {/* 3D Fallen Ceiling Beams & Concrete Rubble Pile */}
      {debrisBlocks.map((b, idx) => (
        <RoundedBox
          key={idx}
          args={b.size as [number, number, number]}
          radius={0.04}
          position={b.pos as [number, number, number]}
          rotation={b.rot as [number, number, number]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={idx % 2 === 0 ? "#64748b" : "#475569"}
            roughness={0.9}
          />
        </RoundedBox>
      ))}

      {/* Toppled Steel Corridor Beam */}
      <mesh position={[0, 0.72, 0]} rotation={[0.25, 0.6, 1.32]} castShadow>
        <boxGeometry args={[0.28, 3.2, 0.28]} />
        <meshStandardMaterial color="#b91c1c" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Volumetric Rising Smoke & Fire Glow */}
      <group ref={smokeGroupRef} position={[0, 1.25, 0]}>
        {[
          { pos: [0, 0, 0], r: 0.75, op: 0.42 },
          { pos: [-0.55, 0.45, 0.3], r: 0.6, op: 0.34 },
          { pos: [0.5, 0.65, -0.35], r: 0.65, op: 0.3 },
        ].map((s, idx) => (
          <mesh key={idx} position={s.pos as [number, number, number]}>
            <sphereGeometry args={[s.r, 16, 16]} />
            <meshStandardMaterial
              color={hazard.hazard_type === "fire_smoke" ? "#1e293b" : "#64748b"}
              emissive={hazard.hazard_type === "fire_smoke" ? "#ea580c" : "#7f1d1d"}
              emissiveIntensity={0.38}
              transparent
              opacity={s.op}
            />
          </mesh>
        ))}
      </group>

      <pointLight position={[0, 1.6, 0]} intensity={2.2} distance={8} color="#ef4444" />

      {/* Overhead 3D Hazard Alert Callout */}
      <group position={[0, 3.4, 0]}>
        <RoundedBox args={[4.2, 0.55, 0.1]} radius={0.04}>
          <meshStandardMaterial color="#7f1d1d" emissive="#dc2626" emissiveIntensity={0.75} />
        </RoundedBox>
        <Text position={[0, 0, 0.07]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle">
          {`⚠️ ${hazard.description.slice(0, 36).toUpperCase()}`}
        </Text>
      </group>
    </group>
  );
}

export default function ExitZeroCanvas({
  floorGraph,
  hazards,
  verification,
  walkthroughActive,
  fullScreen = true,
}: ExitZeroCanvasProps) {
  const { width_m: widthM, depth_m: depthM } = floorGraph;
  const tileTexture = useArchitecturalFloorTexture();
  const floorplanImageTex = useFloorplanImageTexture("/floorplans/cagb-L2-1280.jpg");
  const [autoWalk, setAutoWalk] = useState(true);

  const verifiedIds = useMemo(
    () => verification.verified_safe_route?.node_ids ?? [],
    [verification.verified_safe_route]
  );

  const chosenPathSet = useMemo(() => new Set(verifiedIds), [verifiedIds]);

  const routeNodes = useMemo(() => {
    return verifiedIds
      .map((id: string) => floorGraph.nodes.find((n) => n.id === id))
      .filter((n): n is NavNode => Boolean(n));
  }, [floorGraph.nodes, verifiedIds]);

  const routePoints3D = useMemo(() => {
    return routeNodes.map(
      (n: NavNode) => [n.x_m - widthM / 2, 0.24, n.z_m - depthM / 2] as [number, number, number]
    );
  }, [routeNodes, widthM, depthM]);

  const naivePoints3D = useMemo(() => {
    const ids = verification.naive_shortest_route?.node_ids ?? [];
    return ids
      .map((id: string) => floorGraph.nodes.find((n) => n.id === id))
      .filter((n): n is NavNode => Boolean(n))
      .map(
        (n: NavNode) => [n.x_m - widthM / 2, 0.16, n.z_m - depthM / 2] as [number, number, number]
      );
  }, [floorGraph.nodes, verification.naive_shortest_route]);

  const targetExitId =
    verifiedIds.length > 0 ? verifiedIds[verifiedIds.length - 1] : null;

  // Perimeter structural columns below Level 2 slab (multi-story building cutaway feel)
  const lowerColumns = useMemo(() => {
    const cols: Array<[number, number]> = [];
    const stepX = widthM / 5;
    const stepZ = depthM / 3;
    for (let x = -widthM / 2 + 1.5; x <= widthM / 2 - 1.2; x += stepX) {
      cols.push([x, -depthM / 2 + 1.5]);
      cols.push([x, depthM / 2 - 1.5]);
    }
    for (let z = -depthM / 2 + stepZ; z < depthM / 2 - 2; z += stepZ) {
      cols.push([-widthM / 2 + 1.5, z]);
      cols.push([widthM / 2 - 1.5, z]);
    }
    return cols;
  }, [widthM, depthM]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-950 ${
        fullScreen
          ? "h-screen rounded-none border-0"
          : "h-[580px] rounded-2xl border border-slate-800 shadow-2xl"
      }`}
    >
      {/* Top Overlay Status Pill */}
      <div className="absolute top-20 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
        <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase bg-slate-900/85 backdrop-blur-md text-slate-100 border border-slate-700 shadow-lg">
          {floorGraph.building_name} • Level {floorGraph.floor_number}
        </span>
        <span
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase backdrop-blur-md shadow-lg ${
            verification.verified_safe_route
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-red-500/20 text-red-300 border border-red-500/40"
          }`}
        >
          {verification.verified_safe_route
            ? `VERIFIED EXIT: ${verification.verified_safe_route.target_exit_label}`
            : "NO UNBLOCKED ROUTE — SEEK REFUGE"}
        </span>
        {verification.lift_override_triggered && (
          <span className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-950/90 text-red-300 border border-red-700/60 shadow-lg">
            ⛔ LIFTS LOCKED (SEISMIC/FIRE OVERRIDE)
          </span>
        )}
      </div>

      {/* Bottom First-Person Controls & Legend */}
      <div className="absolute bottom-5 left-4 z-10 flex flex-wrap items-center gap-2">
        {walkthroughActive && (
          <>
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-emerald-500/40 text-xs text-emerald-200 shadow-lg">
              👁️ <strong>First-Person Inside Building:</strong> Drag mouse to look 360° • Use <strong>W A S D / Arrow Keys</strong> to walk
            </div>
            <button
              onClick={() => setAutoWalk((v) => !v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-lg ${
                autoWalk
                  ? "bg-emerald-600 text-white border-emerald-400"
                  : "bg-slate-900/90 text-slate-200 border-slate-700 hover:border-emerald-500/50"
              }`}
            >
              {autoWalk ? "🚶 Auto-Walk Verified Route: ON" : "🚶 Auto-Walk Verified Route: OFF"}
            </button>
          </>
        )}
        <div className="flex flex-wrap gap-3 text-xs bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-slate-300 pointer-events-none shadow-lg">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            Verified Stairwell Route
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Blocked Naive Path / 3D Hazard Zone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
            Accessible Refuge Bay
          </span>
        </div>
      </div>

      <Canvas shadows camera={{ position: [-10, 1.68, 0], fov: 56 }}>
        <color attach="background" args={["#0b1120"]} />
        <fog attach="fog" args={["#0b1120", 38, 78]} />

        {/* Architectural Cutaway Lighting */}
        <ambientLight intensity={0.62} />
        <hemisphereLight args={["#f8fafc", "#1e293b", 0.65]} />
        <directionalLight
          position={[18, 32, 16]}
          intensity={1.35}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-16, 22, -12]} intensity={0.45} color="#bae6fd" />

        {/* Warm interior ceiling lighting across the corridor & rooms */}
        <pointLight position={[-8, 3.2, -3]} intensity={0.7} distance={16} color="#fef3c7" />
        <pointLight position={[0, 3.2, 0]} intensity={0.8} distance={18} color="#f8fafc" />
        <pointLight position={[9, 3.2, -3]} intensity={0.7} distance={16} color="#e0f2fe" />

        {/* ======================================================== */}
        {/* LEVEL 2 ARCHITECTURAL STRUCTURAL SLAB & LOWER COLUMNS    */}
        {/* ======================================================== */}
        <mesh position={[0, -0.22, 0]} receiveShadow castShadow>
          <boxGeometry args={[widthM + 0.8, 0.44, depthM + 0.8]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} />
        </mesh>

        {/* Architectural Terrazzo / Tile Floor Surface */}
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[widthM, depthM]} />
          <meshStandardMaterial
            map={tileTexture}
            color="#e2e8f0"
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>

        {/* Authentic Imperial CAGB Level 2 Architectural Blueprint Overlay */}
        {floorplanImageTex && (
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[widthM - 2.0, depthM - 2.0]} />
            <meshStandardMaterial
              map={floorplanImageTex}
              transparent
              opacity={0.38}
              roughness={0.7}
            />
          </mesh>
        )}

        {/* Structural Concrete Columns Extending Down to Level 1 */}
        {lowerColumns.map(([cx, cz], idx) => (
          <mesh key={idx} position={[cx, -2.1, cz]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 3.4, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.7} />
          </mesh>
        ))}

        {/* Ground Shadow Plinth */}
        <ContactShadows
          position={[0, -3.75, 0]}
          opacity={0.5}
          scale={52}
          blur={2.4}
          far={8}
        />

        {/* ======================================================== */}
        {/* EXTRUDED ARCHITECTURAL WALLS + INTERIOR ROOM FURNISHINGS */}
        {/* ======================================================== */}
        {floorGraph.walls.map((w, idx) => (
          <ArchitecturalWall key={idx} w={w} widthM={widthM} depthM={depthM} />
        ))}

        <BuildingInteriorFurnishings widthM={widthM} depthM={depthM} />

        {/* ======================================================== */}
        {/* TOPOLOGICAL CORRIDOR GRAPH EDGES                         */}
        {/* ======================================================== */}
        {floorGraph.edges.map((edge) => {
          const fromNode = floorGraph.nodes.find((n) => n.id === edge.from_node_id);
          const toNode = floorGraph.nodes.find((n) => n.id === edge.to_node_id);
          if (!fromNode || !toNode) return null;

          const p1: [number, number, number] = [
            fromNode.x_m - widthM / 2,
            0.09,
            fromNode.z_m - depthM / 2,
          ];
          const p2: [number, number, number] = [
            toNode.x_m - widthM / 2,
            0.09,
            toNode.z_m - depthM / 2,
          ];

          return (
            <Line
              key={edge.id}
              points={[p1, p2]}
              color="#475569"
              lineWidth={1.5}
              dashed
              dashSize={0.45}
              gapSize={0.28}
            />
          );
        })}

        {/* ======================================================== */}
        {/* BLOCKED / NAIVE SHORTEST ROUTE (RED DASHED LINE)         */}
        {/* ======================================================== */}
        {naivePoints3D.length >= 2 &&
          verification.naive_shortest_route.status !== "SURVIVABLE" && (
            <Line
              points={naivePoints3D}
              color="#ef4444"
              lineWidth={4}
              dashed
              dashSize={0.5}
              gapSize={0.3}
            />
          )}

        {/* ======================================================== */}
        {/* VERIFIED GREEN 3D EVACUATION RIBBON + ANIMATED EVACUEE   */}
        {/* ======================================================== */}
        {routePoints3D.length >= 2 && (
          <group>
            <Line points={routePoints3D} color="#10b981" lineWidth={6} />
            <Line
              points={routePoints3D.map(
                ([px, , pz]: [number, number, number]) =>
                  [px, 0.06, pz] as [number, number, number]
              )}
              color="#34d399"
              lineWidth={11}
            />
            <AnimatedEvacueeAvatar
              routeNodes={routeNodes}
              widthM={widthM}
              depthM={depthM}
            />
          </group>
        )}

        {/* ======================================================== */}
        {/* 3D STAIRWELL CORES, ELEVATOR BANK, AND REFUGE BAYS       */}
        {/* ======================================================== */}
        {floorGraph.nodes.map((node) => {
          const isTarget = targetExitId === node.id;
          const isOnRoute = chosenPathSet.has(node.id);
          const isUserStart = verification.user_start_node_id === node.id;
          return (
            <ArchitecturalBuildingNode
              key={node.id}
              node={node}
              widthM={widthM}
              depthM={depthM}
              isTarget={isTarget}
              isOnRoute={isOnRoute}
              isUserStart={isUserStart}
              liftLocked={verification.lift_override_triggered}
            />
          );
        })}

        {/* ======================================================== */}
        {/* REALISTIC 3D COLLAPSE DEBRIS & SMOKE HAZARD ZONES        */}
        {/* ======================================================== */}
        {hazards.map((hz) => (
          <RealisticHazardZone3D
            key={hz.id}
            hazard={hz}
            nodes={floorGraph.nodes}
            widthM={widthM}
            depthM={depthM}
          />
        ))}

        {/* ======================================================== */}
        {/* SUSPENDED ACOUSTIC CEILING & LED CORRIDOR PANELS (IN 1ST PERSON) */}
        {/* ======================================================== */}
        {walkthroughActive && (
          <group position={[0, 3.12, 0]}>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[widthM, 0.08, depthM]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
            </mesh>
            {[-14, -7, 0, 7, 14].map((lx, idx) => (
              <mesh key={idx} position={[lx, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[2.2, 0.65]} />
                <meshBasicMaterial color="#f8fafc" side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        )}

        <BuildingWalkthroughCamera
          active={walkthroughActive}
          autoWalk={autoWalk}
          routeNodes={routeNodes}
          widthM={widthM}
          depthM={depthM}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2 - 0.04}
          enabled={!walkthroughActive}
        />
      </Canvas>
    </div>
  );
}
