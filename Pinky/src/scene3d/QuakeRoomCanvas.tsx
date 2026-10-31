"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  EgressAndShelterResult,
  ObjectHazardResult,
  RoomObjectNode,
  RoomSceneGraph,
} from "@/types/contracts";
import { computeObjectCoMAndSafetyFactor } from "@/solver";

interface QuakeRoomCanvasProps {
  scene: RoomSceneGraph;
  verification: EgressAndShelterResult;
  isShaking: boolean;
  postQuakeCollapsed: boolean;
  titleBadge?: string;
}

function ShakeTableGroup({
  scene,
  verification,
  isShaking,
  postQuakeCollapsed,
}: Omit<QuakeRoomCanvasProps, "titleBadge">) {
  const tableRef = useRef<THREE.Group>(null);
  const clockRef = useRef(0);

  const resultMap = useMemo(() => {
    const map = new Map<string, ObjectHazardResult>();
    verification.object_results.forEach((r) => map.set(r.object_id, r));
    return map;
  }, [verification]);

  useFrame((_, delta) => {
    if (!tableRef.current) return;
    if (isShaking) {
      clockRef.current += delta;
      const t = clockRef.current;
      const amp =
        0.045 *
        (scene.earthquake.magnitude_mw / 6.8) *
        (1 + 0.06 * (scene.room.floor_level - 1));
      // P-wave + S-wave horizontal oscillation
      tableRef.current.position.x =
        Math.sin(t * 24) * amp + Math.cos(t * 13) * amp * 0.5;
      tableRef.current.position.z =
        Math.cos(t * 19) * amp + Math.sin(t * 11) * amp * 0.6;
      tableRef.current.rotation.z = Math.sin(t * 17) * 0.012;
    } else {
      tableRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.15);
      tableRef.current.rotation.z = THREE.MathUtils.lerp(
        tableRef.current.rotation.z,
        0,
        0.15
      );
    }
  });

  const cx = scene.room.width_m / 2;
  const cz = scene.room.depth_m / 2;

  const floorObjects = scene.objects.filter((o) => o.parent_id === null);
  const childObjects = scene.objects.filter((o) => o.parent_id !== null);

  const escapePoints3D = useMemo(() => {
    return verification.escape_path_points_m.map(
      (pt) => new THREE.Vector3(pt.x_m - cx, 0.06, pt.z_m - cz)
    );
  }, [verification.escape_path_points_m, cx, cz]);

  return (
    <group ref={tableRef}>
      {/* Room Floor Slab */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry
          args={[scene.room.width_m + 0.2, 0.12, scene.room.depth_m + 0.2]}
        />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>

      <Grid
        position={[0, 0.005, 0]}
        args={[scene.room.width_m, scene.room.depth_m]}
        cellSize={0.2}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={1.0}
        sectionThickness={1.0}
        sectionColor="#475569"
        fadeDistance={18}
      />

      {/* Translucent Back & West Walls */}
      <mesh
        position={[0, scene.room.height_m / 2, -cz - 0.04]}
        receiveShadow
      >
        <boxGeometry
          args={[scene.room.width_m, scene.room.height_m, 0.08]}
        />
        <meshStandardMaterial
          color="#334155"
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh
        position={[-cx - 0.04, scene.room.height_m / 2, 0]}
        receiveShadow
      >
        <boxGeometry
          args={[0.08, scene.room.height_m, scene.room.depth_m]}
        />
        <meshStandardMaterial
          color="#334155"
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Post-Collapse Fall Shadows & Glass Hazard Rings */}
      {verification.object_results.map((res) => {
        if (!res.tipped_over) return null;
        const w = res.resting_bbox_2d.max_x - res.resting_bbox_2d.min_x;
        const d = res.resting_bbox_2d.max_z - res.resting_bbox_2d.min_z;
        const bx = (res.resting_bbox_2d.min_x + res.resting_bbox_2d.max_x) / 2 - cx;
        const bz = (res.resting_bbox_2d.min_z + res.resting_bbox_2d.max_z) / 2 - cz;
        return (
          <mesh
            key={`shadow_${res.object_id}`}
            position={[bx, 0.015, bz]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial
              color={res.blocked_exit_corridor || res.hit_occupant_zone ? "#ef4444" : "#f97316"}
              transparent
              opacity={postQuakeCollapsed || isShaking ? 0.42 : 0.18}
            />
          </mesh>
        );
      })}

      {verification.glass_hazard_zones_m.map((gz, idx) => (
        <mesh
          key={`glass_${idx}`}
          position={[gz.x_m - cx, 0.02, gz.z_m - cz]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[gz.radius_m, 28]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={postQuakeCollapsed ? 0.45 : 0.2}
          />
        </mesh>
      ))}

      {/* Safe Drop-Cover-Hold Spot */}
      {verification.safe_shelter_spot_m && (
        <group
          position={[
            verification.safe_shelter_spot_m.x_m - cx,
            0.03,
            verification.safe_shelter_spot_m.z_m - cz,
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.32, 0.45, 28]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} />
          </mesh>
        </group>
      )}

      {/* A* Escape Path Tube/Line */}
      {escapePoints3D.length >= 2 && (
        <Line
          points={escapePoints3D}
          color={verification.exit_reachable_post_quake ? "#10b981" : "#ef4444"}
          lineWidth={4.5}
          dashed={!verification.exit_reachable_post_quake}
          dashSize={0.2}
          gapSize={0.12}
        />
      )}

      {/* Render Floor-Standing Furniture & Stacked Children */}
      {floorObjects.map((obj) => {
        const res = resultMap.get(obj.id);
        const children = childObjects.filter((c) => c.parent_id === obj.id);
        const comInfo = computeObjectCoMAndSafetyFactor(
          obj,
          scene.objects,
          scene.room.floor_level,
          scene.earthquake.magnitude_mw
        );
        return (
          <FurniturePrefab
            key={obj.id}
            obj={obj}
            childrenItems={children}
            hazardResult={res}
            hComM={comInfo.h_com_m}
            safetyFactor={comInfo.safety_factor}
            cx={cx}
            cz={cz}
            collapsed={Boolean(
              (postQuakeCollapsed || isShaking) && res?.tipped_over
            )}
          />
        );
      })}
    </group>
  );
}

function FurniturePrefab({
  obj,
  childrenItems,
  hazardResult,
  hComM,
  safetyFactor,
  cx,
  cz,
  collapsed,
}: {
  obj: RoomObjectNode;
  childrenItems: RoomObjectNode[];
  hazardResult?: ObjectHazardResult;
  hComM: number;
  safetyFactor: number;
  cx: number;
  cz: number;
  collapsed: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rotRad = (obj.rotation_deg * Math.PI) / 180;

  useFrame(() => {
    if (!groupRef.current) return;
    const targetTilt = collapsed ? Math.PI * 0.46 : 0;
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      obj.x_m < cx ? -targetTilt : targetTilt,
      0.12
    );
  });

  const colorByCategory: Record<RoomObjectNode["category"], string> = {
    bed: "#3b82f6",
    bookshelf: "#d97706",
    wardrobe: "#9333ea",
    desk: "#0d9488",
    chair: "#64748b",
    tv_monitor: "#0f172a",
    heavy_item: "#ef4444",
    fragile_glass: "#38bdf8",
    window: "#7dd3fc",
    exit_door: "#10b981",
  };

  const baseColor =
    hazardResult?.tipped_over && collapsed
      ? "#dc2626"
      : colorByCategory[obj.category] || "#94a3b8";

  const yBase = obj.category === "window" ? 0.85 : 0;

  return (
    <group
      position={[obj.x_m - cx, yBase, obj.z_m - cz]}
      rotation={[0, rotRad, 0]}
    >
      <group ref={groupRef}>
        <mesh
          position={[0, obj.height_m / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[obj.width_m, obj.height_m, obj.depth_m]} />
          <meshStandardMaterial
            color={baseColor}
            transparent={obj.category === "window"}
            opacity={obj.category === "window" ? 0.55 : 0.92}
            roughness={0.5}
          />
        </mesh>

        {/* Render stacked child objects (e.g., 20kg textbooks on top vs bottom shelf!) */}
        {childrenItems.map((child) => {
          const yFactor =
            child.shelf_level === "bottom"
              ? 0.16
              : child.shelf_level === "middle"
              ? 0.52
              : 0.86;
          return (
            <mesh
              key={child.id}
              position={[0, obj.height_m * yFactor, 0]}
              castShadow
            >
              <boxGeometry
                args={[
                  Math.min(obj.width_m * 0.9, child.width_m),
                  child.height_m,
                  Math.min(obj.depth_m * 0.85, child.depth_m),
                ]}
              />
              <meshStandardMaterial
                color={
                  child.shelf_level === "bottom" ? "#22c55e" : "#f43f5e"
                }
              />
            </mesh>
          );
        })}

        {/* Floating Telemetry Tag for Tall/Key Objects */}
        {(obj.category === "bookshelf" ||
          obj.category === "wardrobe" ||
          obj.category === "bed" ||
          obj.category === "exit_door") && (
          <Html
            position={[0, obj.height_m + 0.22, 0]}
            center
            distanceFactor={8}
          >
            <div className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono whitespace-nowrap text-slate-100 shadow-lg">
              <span className="font-semibold">{obj.label}</span>
              {(obj.category === "bookshelf" ||
                obj.category === "wardrobe") && (
                <span
                  className={`ml-1.5 px-1 rounded ${
                    safetyFactor < 1.0
                      ? "bg-red-500/30 text-red-300"
                      : "bg-emerald-500/30 text-emerald-300"
                  }`}
                >
                  hCoM:{hComM}m | SF:{safetyFactor}
                </span>
              )}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

export function QuakeRoomCanvas(props: QuakeRoomCanvasProps) {
  return (
    <div className="relative w-full h-full min-h-[380px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      {props.titleBadge && (
        <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200">
          {props.titleBadge}
        </div>
      )}
      <Canvas
        shadows
        camera={{ position: [4.2, 4.4, 4.8], fov: 45 }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.1}
          castShadow
        />
        <ShakeTableGroup {...props} />
        <OrbitControls
          makeDefault
          enablePan
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      </Canvas>
    </div>
  );
}
