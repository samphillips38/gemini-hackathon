"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { ContactShadows, Grid, Html, Line, OrbitControls } from "@react-three/drei";
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
      // Smoothly tip around the bottom edge in tipDir direction
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
      // Slight rocking vibration for stable furniture
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

  // Render Wall-Mounted Window
  if (obj.category === "window") {
    const shattered = simState !== "idle" && hazard?.shattered_or_fell;
    return (
      <group position={[worldX, 1.35, worldZ]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <mesh>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={shattered ? "#f43f5e" : "#38bdf8"}
            transparent
            opacity={shattered ? 0.28 : 0.55}
          />
        </mesh>
        {/* Window Frame */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w + 0.06, h + 0.06, d * 0.8]} />
          <meshStandardMaterial color="#e2e8f0" wireframe />
        </mesh>
        {/* Shattered glass shards on floor below window */}
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
        <mesh>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.45} />
        </mesh>
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
        <mesh>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#dc2626" emissive="#991b1b" emissiveIntensity={0.5} />
        </mesh>
        <Html position={[0, h / 2 + 0.22, 0]} center distanceFactor={8}>
          <div className="px-2 py-0.5 rounded bg-red-950/95 border border-red-400 text-[10px] font-bold text-red-200 whitespace-nowrap shadow-lg">
            LIFT LOCKED (NO SEISMIC/FIRE USE)
          </div>
        </Html>
      </group>
    );
  }

  // Render Dynamic Floor Hazard (Fire / Debris Blockade for Plan C)
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
        {obj.category === "bed" && (
          <group>
            {/* Bed Frame */}
            <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, 0.28, d]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
            {/* Mattress */}
            <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.94, 0.2, d * 0.94]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            {/* Blanket */}
            <mesh position={[0, 0.37, d * 0.15]} castShadow>
              <boxGeometry args={[w * 0.95, 0.21, d * 0.62]} />
              <meshStandardMaterial color={hazard?.hit_occupant_zone && simState !== "idle" ? "#dc2626" : "#3b82f6"} />
            </mesh>
            {/* Pillow */}
            <mesh position={[0, 0.49, -d * 0.32]} castShadow>
              <boxGeometry args={[w * 0.65, 0.1, d * 0.2]} />
              <meshStandardMaterial color="#e2e8f0" />
            </mesh>
          </group>
        )}

        {obj.category === "bookshelf" && (
          <group>
            {/* Outer Frame & Backboard */}
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial
                color={isDanger ? "#991b1b" : "#92400e"}
                transparent
                opacity={0.85}
              />
            </mesh>
            {/* 4 Visible Shelf Planks */}
            {[0.14, 0.38, 0.62, 0.88].map((ratio, i) => (
              <mesh key={i} position={[0, h * ratio, 0]}>
                <boxGeometry args={[w * 1.02, 0.03, d * 0.96]} />
                <meshStandardMaterial color="#fef3c7" />
              </mesh>
            ))}
            {/* Combined Center of Mass (h_CoM) Marker Sphere */}
            {hazard && (
              <mesh position={[0, hazard.center_of_mass_height_m, 0]}>
                <sphereGeometry args={[0.09, 16, 16]} />
                <meshStandardMaterial
                  color={sf < 1.0 ? "#f43f5e" : "#22c55e"}
                  emissive={sf < 1.0 ? "#e11d48" : "#16a34a"}
                  emissiveIntensity={0.9}
                />
              </mesh>
            )}
          </group>
        )}

        {obj.category === "wardrobe" && (
          <group>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={isDanger ? "#7f1d1d" : "#57534e"} />
            </mesh>
            {/* Wardrobe Door Seam */}
            <mesh position={[0, h / 2, d / 2 + 0.005]}>
              <boxGeometry args={[0.02, h * 0.9, 0.01]} />
              <meshStandardMaterial color="#fde68a" />
            </mesh>
          </group>
        )}

        {obj.category === "desk" && (
          <group>
            {/* Tabletop */}
            <mesh position={[0, h - 0.04, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, 0.06, d]} />
              <meshStandardMaterial color="#b45309" />
            </mesh>
            {/* 4 Legs */}
            {[
              [-w * 0.44, -d * 0.42],
              [w * 0.44, -d * 0.42],
              [-w * 0.44, d * 0.42],
              [w * 0.44, d * 0.42],
            ].map(([lx, lz], idx) => (
              <mesh key={idx} position={[lx, (h - 0.04) / 2, lz]} castShadow>
                <boxGeometry args={[0.05, h - 0.04, 0.05]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
            ))}
            {/* Safe Drop-Cover-Hold Shelter Glow Under Desk */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w * 0.85, d * 0.85]} />
              <meshBasicMaterial color="#06b6d4" transparent opacity={0.32} />
            </mesh>
          </group>
        )}

        {obj.category === "chair" && (
          <group>
            <mesh position={[0, 0.44, 0]} castShadow>
              <boxGeometry args={[w, 0.06, d]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            <mesh position={[0, 0.7, -d * 0.4]} castShadow>
              <boxGeometry args={[w, 0.45, 0.06]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.05, 0.2, 0.44, 12]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
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
              <mesh castShadow>
                <boxGeometry args={[child.width_m, child.height_m, child.depth_m]} />
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
              </mesh>
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

  useFrame((state) => {
    if (!groupRef.current) return;
    if (simState === "shaking") {
      const t = state.clock.getElapsedTime();
      const amp = 0.045 * (scene.earthquake.magnitude_mw - 4.5);
      // Synthetic P-wave vertical jolt + S-wave horizontal shear oscillation
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

  // Convert A* path points to Three.js world coordinates
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
      {/* Room Floor Slab */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={handleFloorClick}
      >
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={dropHazardMode ? "#312e81" : "#1e293b"} />
      </mesh>

      {/* Metric 0.5m Engineering Grid */}
      <Grid
        position={[0, 0.002, 0]}
        args={[W, D]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#334155"
        sectionSize={1.0}
        sectionThickness={1.2}
        sectionColor="#475569"
        fadeDistance={18}
      />

      {/* Translucent Architectural Cutaway Walls (North & West Walls) */}
      <mesh position={[0, H / 2, -D / 2]}>
        <boxGeometry args={[W, H, 0.06]} />
        <meshStandardMaterial color="#475569" transparent opacity={0.28} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]}>
        <boxGeometry args={[0.06, H, D]} />
        <meshStandardMaterial color="#475569" transparent opacity={0.28} />
      </mesh>
      {/* Low South & East Boundary Curbs so camera has unobstructed cutaway view */}
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
  return (
    <div className="w-full h-full relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      <Canvas
        shadows
        camera={{ position: [4.2, 3.8, 4.6], fov: 45 }}
        onPointerMissed={() => props.onSelectObject?.(null)}
      >
        <color attach="background" args={["#090d16"]} />
        <ambientLight intensity={0.75} />
        <directionalLight
          castShadow
          position={[5, 8, 5]}
          intensity={1.35}
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 3, -2]} intensity={0.5} color="#38bdf8" />

        <ShakingRoomGroup {...props} />

        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.45}
          scale={12}
          blur={1.8}
          far={4}
        />
        <OrbitControls
          makeDefault
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 - 0.04}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
