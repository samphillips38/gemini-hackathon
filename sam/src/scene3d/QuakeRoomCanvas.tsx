"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
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
 * First-Person WASD + Guided Escape Walkthrough Controller
 */
function WalkthroughController({
  active,
  escapePath,
  shelterSpot,
  roomWidth,
  roomDepth,
}: {
  active: boolean;
  escapePath: Array<{ x_m: number; z_m: number }>;
  shelterSpot: { x_m: number; z_m: number; label: string } | null;
  roomWidth: number;
  roomDepth: number;
}) {
  const { camera } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  const progressRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (active) {
      progressRef.current = 0;
      const startPt = escapePath[0] || { x_m: 1.4, z_m: 2.2 };
      camera.position.set(
        startPt.x_m - roomWidth / 2,
        1.55,
        startPt.z_m - roomDepth / 2
      );
    } else {
      camera.position.set(0, 4.8, 5.2);
      camera.lookAt(0, 0.5, 0);
    }
  }, [active, camera, escapePath, roomWidth, roomDepth]);

  useFrame((_, delta) => {
    if (!active) return;

    const moveSpeed = 2.4 * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

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

    // If user isn't pressing WASD, smoothly glide along the verified A* escape path
    if (!manualMoved && escapePath.length > 1) {
      progressRef.current = (progressRef.current + delta * 0.25) % 1;
      const floatIdx = progressRef.current * (escapePath.length - 1);
      const idx = Math.floor(floatIdx);
      const nextIdx = Math.min(escapePath.length - 1, idx + 1);
      const alpha = floatIdx - idx;

      const p1 = escapePath[idx];
      const p2 = escapePath[nextIdx];
      const wx = THREE.MathUtils.lerp(p1.x_m, p2.x_m, alpha) - roomWidth / 2;
      const wz = THREE.MathUtils.lerp(p1.z_m, p2.z_m, alpha) - roomDepth / 2;

      camera.position.lerp(new THREE.Vector3(wx, 1.48, wz), 0.12);
      const lookTarget = escapePath[escapePath.length - 1];
      camera.lookAt(
        lookTarget.x_m - roomWidth / 2,
        1.1,
        lookTarget.z_m - roomDepth / 2
      );
    } else if (!manualMoved && shelterSpot) {
      camera.lookAt(
        shelterSpot.x_m - roomWidth / 2,
        0.6,
        shelterSpot.z_m - roomDepth / 2
      );
    }
  });

  return null;
}

/**
 * Individual 3D Procedural Furniture Prefab with Dynamic Tipping & CoM Marker
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

  // Convert SW corner (x_m, z_m) to centered Three.js coordinates
  const centerX = obj.x_m + effW / 2 - roomWidth / 2;
  const centerZ = obj.z_m + effD / 2 - roomDepth / 2;

  const childrenItems = useMemo(
    () => allObjects.filter((c) => c.parent_id === obj.id),
    [allObjects, obj.id]
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    const shouldTip = Boolean(hazard?.tipped_over && (isShaking || hasCollapsed));

    if (shouldTip) {
      const targetAngle = obj.category === "wardrobe" ? -Math.PI * 0.46 : Math.PI * 0.45;
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
      // Gentle rocking if shaking but SF >= 1.0 (survives!)
      const rockAngle = isShaking
        ? Math.sin(t * 24) * (obj.anchored_to_wall ? 0.012 : 0.045)
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

  if (obj.parent_id !== null) return null; // Rendered inside parent furniture

  const sf = hazard?.analytical_safety_factor ?? 1.5;
  const isDanger = sf < 1.0 && !obj.anchored_to_wall;

  return (
    <group ref={groupRef} position={[centerX, 0, centerZ]} rotation={[0, rotRad, 0]}>
      {/* BED PREFAB */}
      {obj.category === "bed" && (
        <group>
          {/* Frame */}
          <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
            <boxGeometry args={[obj.width_m, 0.28, obj.depth_m]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Mattress */}
          <mesh position={[0, 0.38, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[obj.width_m * 0.94, 0.22, obj.depth_m * 0.92]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          {/* Blanket */}
          <mesh position={[0, 0.41, 0.28]} castShadow>
            <boxGeometry args={[obj.width_m * 0.95, 0.23, obj.depth_m * 0.62]} />
            <meshStandardMaterial color="#2563eb" />
          </mesh>
          {/* Pillow */}
          <mesh position={[0, 0.52, -obj.depth_m * 0.34]} castShadow>
            <boxGeometry args={[obj.width_m * 0.65, 0.1, 0.35]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Headboard */}
          <mesh position={[0, 0.55, -obj.depth_m / 2 + 0.05]} castShadow>
            <boxGeometry args={[obj.width_m, 0.9, 0.08]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      )}

      {/* BOOKSHELF PREFAB WITH STACKED ITEMS */}
      {obj.category === "bookshelf" && (
        <group>
          <mesh position={[0, obj.height_m / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[obj.width_m, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial
              color={isDanger ? "#991b1b" : "#854d0e"}
              roughness={0.6}
            />
          </mesh>
          {/* Shelf dividers */}
          {[0.2, 0.55, 0.9, 1.35, 1.75].map((sy, i) => (
            <mesh key={i} position={[0, sy, 0.02]}>
              <boxGeometry args={[obj.width_m * 0.95, 0.04, obj.depth_m * 0.92]} />
              <meshStandardMaterial color="#fef08a" />
            </mesh>
          ))}
          {/* Child items (e.g., 20kg textbooks on top vs bottom shelf!) */}
          {childrenItems.map((child) => {
            const cy =
              child.shelf_level === "top"
                ? obj.height_m * 0.88
                : child.shelf_level === "middle"
                ? obj.height_m * 0.52
                : 0.24;
            return (
              <group key={child.id} position={[0, cy, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.28, 0.26, obj.depth_m * 0.75]} />
                  <meshStandardMaterial
                    color={child.shelf_level === "top" ? "#ef4444" : "#10b981"}
                    emissive={child.shelf_level === "top" ? "#7f1d1d" : "#064e3b"}
                    emissiveIntensity={0.4}
                  />
                </mesh>
                <Text
                  position={[0, 0.24, 0]}
                  fontSize={0.11}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                >
                  {`${child.mass_kg}kg (${child.shelf_level?.toUpperCase()})`}
                </Text>
              </group>
            );
          })}
          {/* Center of Mass (h_CoM) Indicator Sphere */}
          {hazard?.com_height_m && (
            <mesh position={[0, hazard.com_height_m, obj.depth_m / 2 + 0.08]}>
              <sphereGeometry args={[0.09, 16, 16]} />
              <meshStandardMaterial
                color={isDanger ? "#ff2222" : "#22c55e"}
                emissive={isDanger ? "#ff0000" : "#16a34a"}
                emissiveIntensity={0.8}
              />
            </mesh>
          )}
        </group>
      )}

      {/* WARDROBE PREFAB */}
      {obj.category === "wardrobe" && (
        <group>
          <mesh position={[0, obj.height_m / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[obj.width_m, obj.height_m, obj.depth_m]} />
            <meshStandardMaterial color={isDanger ? "#7f1d1d" : "#78350f"} />
          </mesh>
          {/* Door seam */}
          <mesh position={[0, obj.height_m / 2, -obj.depth_m / 2 - 0.01]}>
            <boxGeometry args={[0.02, obj.height_m * 0.9, 0.02]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
        </group>
      )}

      {/* DESK PREFAB (SAFE SHELTER) */}
      {obj.category === "desk" && (
        <group>
          {/* Tabletop */}
          <mesh position={[0, obj.height_m, 0]} castShadow receiveShadow>
            <boxGeometry args={[obj.width_m, 0.06, obj.depth_m]} />
            <meshStandardMaterial color="#0f766e" />
          </mesh>
          {/* 4 Sturdy Steel Legs */}
          {[
            [-obj.width_m / 2 + 0.06, -obj.depth_m / 2 + 0.06],
            [obj.width_m / 2 - 0.06, -obj.depth_m / 2 + 0.06],
            [-obj.width_m / 2 + 0.06, obj.depth_m / 2 - 0.06],
            [obj.width_m / 2 - 0.06, obj.depth_m / 2 - 0.06],
          ].map(([lx, lz], idx) => (
            <mesh key={idx} position={[lx, obj.height_m / 2, lz]} castShadow>
              <boxGeometry args={[0.07, obj.height_m, 0.07]} />
              <meshStandardMaterial color="#cbd5e1" />
            </mesh>
          ))}
          {/* Monitor on Desk */}
          {childrenItems.map((child) => (
            <mesh key={child.id} position={[0, obj.height_m + 0.25, -0.12]} castShadow>
              <boxGeometry args={[0.65, 0.4, 0.06]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          ))}
        </group>
      )}

      {/* CHAIR PREFAB */}
      {obj.category === "chair" && (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.48, 0.08, 0.48]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 0.72, -0.2]} castShadow>
            <boxGeometry args={[0.46, 0.48, 0.07]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      )}

      {/* WINDOW PREFAB */}
      {obj.category === "window" && (
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[obj.width_m, obj.height_m, 0.08]} />
          <meshStandardMaterial
            color={hazard?.shattered_or_fell && hasCollapsed ? "#f87171" : "#38bdf8"}
            transparent
            opacity={0.55}
          />
        </mesh>
      )}

      {/* EXIT DOOR PREFAB */}
      {obj.category === "exit_door" && (
        <group position={[0, obj.height_m / 2, 0]}>
          <mesh>
            <boxGeometry args={[obj.width_m, obj.height_m, 0.1]} />
            <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.35} />
          </mesh>
          <Text
            position={[0, 0.7, -0.08]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.16}
            color="#ffffff"
          >
            EXIT DOOR
          </Text>
        </group>
      )}

      {/* Floating Safety Factor Telemetry Badge */}
      {obj.category !== "window" && obj.category !== "exit_door" && obj.category !== "chair" && (
        <Text
          position={[0, obj.height_m + 0.28, 0]}
          fontSize={0.13}
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
 * Shake Table Platform that oscillates during an active earthquake
 */
function ShakeTableRoom({
  scene,
  evaluation,
  isShaking,
  hasCollapsed,
}: {
  scene: RoomSceneGraph;
  evaluation: EgressAndShelterResult;
  isShaking: boolean;
  hasCollapsed: boolean;
}) {
  const tableRef = useRef<THREE.Group>(null);
  const { width_m, depth_m, height_m, floor_level } = scene.room;
  const { magnitude_mw } = scene.earthquake;

  useFrame((state) => {
    if (!tableRef.current) return;
    if (isShaking) {
      const t = state.clock.getElapsedTime();
      const amp = 0.035 * Math.pow(1.45, magnitude_mw - 5.5) * (1 + floor_level * 0.05);
      tableRef.current.position.x =
        Math.sin(t * 28) * amp + Math.cos(t * 17) * amp * 0.6;
      tableRef.current.position.z =
        Math.cos(t * 23) * amp + Math.sin(t * 31) * amp * 0.5;
    } else {
      tableRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.18);
    }
  });

  const escapeLinePoints = useMemo(() => {
    if (!evaluation.escape_path_points_m || evaluation.escape_path_points_m.length < 2) {
      return [];
    }
    return evaluation.escape_path_points_m.map(
      (p) =>
        new THREE.Vector3(p.x_m - width_m / 2, 0.08, p.z_m - depth_m / 2)
    );
  }, [evaluation.escape_path_points_m, width_m, depth_m]);

  return (
    <group ref={tableRef}>
      {/* Floor Slab */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[width_m + 0.3, 0.16, depth_m + 0.3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <gridHelper args={[Math.max(width_m, depth_m), 20, "#334155", "#0f172a"]} position={[0, 0.01, 0]} />

      {/* Back & Left Cutaway Walls */}
      <mesh position={[0, height_m / 2, -depth_m / 2]} receiveShadow>
        <boxGeometry args={[width_m, height_m, 0.1]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.75} />
      </mesh>
      <mesh position={[-width_m / 2, height_m / 2, 0]} receiveShadow>
        <boxGeometry args={[0.1, height_m, depth_m]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.75} />
      </mesh>

      {/* Glass Shatter Hazard Zone Cones */}
      {evaluation.glass_hazard_zones_m.map((gz, i) => (
        <mesh
          key={i}
          position={[gz.x_m - width_m / 2, 0.03, gz.z_m - depth_m / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[gz.radius_m, 32]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.5}
            transparent
            opacity={hasCollapsed || isShaking ? 0.45 : 0.2}
          />
        </mesh>
      ))}

      {/* Post-Quake Resting / Fall Shadow Bounding Boxes */}
      {evaluation.object_results
        .filter((r) => r.tipped_over || r.analytical_safety_factor < 1.0)
        .map((r) => {
          const w = r.resting_bbox_2d.max_x - r.resting_bbox_2d.min_x;
          const d = r.resting_bbox_2d.max_z - r.resting_bbox_2d.min_z;
          const cx = (r.resting_bbox_2d.min_x + r.resting_bbox_2d.max_x) / 2 - width_m / 2;
          const cz = (r.resting_bbox_2d.min_z + r.resting_bbox_2d.max_z) / 2 - depth_m / 2;
          return (
            <mesh key={`shadow_${r.object_id}`} position={[cx, 0.025, cz]}>
              <boxGeometry args={[w, 0.04, d]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#dc2626"
                emissiveIntensity={0.6}
                transparent
                opacity={0.45}
              />
            </mesh>
          );
        })}

      {/* Safe Shelter Spot (Under Desk) */}
      {evaluation.safe_shelter_spot_m && (
        <group
          position={[
            evaluation.safe_shelter_spot_m.x_m - width_m / 2,
            0.05,
            evaluation.safe_shelter_spot_m.z_m - depth_m / 2,
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.32, 0.48, 32]} />
            <meshStandardMaterial
              color="#22c55e"
              emissive="#16a34a"
              emissiveIntensity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Text position={[0, 0.25, 0]} fontSize={0.12} color="#4ade80">
            SAFE DROP-COVER-HOLD
          </Text>
        </group>
      )}

      {/* A* Escape Path Ribbon */}
      {escapeLinePoints.length > 1 && (
        <Line
          points={escapeLinePoints}
          color="#10b981"
          lineWidth={5}
          dashed={false}
        />
      )}

      {/* Blocked Door Alert Marker */}
      {!evaluation.exit_reachable_post_quake && (
        <Text
          position={[width_m / 2 - 0.65, 1.15, depth_m / 2 - 0.35]}
          fontSize={0.18}
          color="#ef4444"
          anchorX="center"
        >
          EXIT BLOCKED BY WARDROBE!
        </Text>
      )}

      {/* Render All Furniture Prefabs */}
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
  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      {titleBadge && (
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2">
          <span>{titleBadge}</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              evaluation.survivable
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-red-500/20 text-red-300 border border-red-500/40"
            }`}
          >
            {evaluation.survivable ? "VERIFIED SURVIVABLE" : "FATAL / EXIT BLOCKED"}
          </span>
        </div>
      )}

      {walkthroughActive && (
        <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-600/50 text-xs text-emerald-200">
          First-Person Walkthrough Active: Auto-gliding along A* Escape Route (or use WASD / Arrow Keys)
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 4.8, 5.2], fov: 46 }}>
        <color attach="background" args={["#060b16"]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-3, 3, -2]} intensity={0.5} color="#38bdf8" />

        <ShakeTableRoom
          scene={scene}
          evaluation={evaluation}
          isShaking={isShaking}
          hasCollapsed={hasCollapsed}
        />

        <WalkthroughController
          active={walkthroughActive}
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
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
        )}
      </Canvas>
    </div>
  );
}
