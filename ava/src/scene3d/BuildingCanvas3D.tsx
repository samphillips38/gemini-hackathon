"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Grid, Html, Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  FALLBACK_ROUTE_A_SCENE,
  RouteTwinObject,
  RouteTwinScene,
  buildModel as fallbackBuildModel,
  makeMaterials as fallbackMakeMaterials,
  toRouteTwinThreeCoords,
} from "@/scene3d/cagbRouteTwinModels";
import {
  BuildingFloorGraph,
  EvacuationVerificationResult,
  LiveHazardEvent,
} from "@/types/contracts";

interface BuildingCanvas3DProps {
  graph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  evacuation: EvacuationVerificationResult;
  onSelectStartNode?: (nodeId: string) => void;
  onToggleCorridorHazard?: (nodeId: string) => void;
}

interface ArgonVerificationEntry {
  id: string;
  exists: boolean;
  side_ok: boolean;
  size_ok: boolean;
  corrected_size_m?: [number, number, number];
  note: string;
}

const EVIDENCE_FILES = [
  "H_016_forecourt_planters_steps.jpg",
  "H_020_sliding_doors_outside.jpg",
  "H_026_lobby_reception_planters.jpg",
  "H_028_lobby_wayfinding_totem.jpg",
  "H_033_lobby_digital_totem.jpg",
  "H_037_lobby_marble_statue.jpg",
  "H_050_corridor_glass_and_fire_doors.jpg",
  "H_052_corridor_white_doors.jpg",
  "H_056_hall_jet_engine.jpg",
  "H_064_hall_refreshment_table_extinguishers.jpg",
  "H_068_vestibule_banner_sofa.jpg",
  "H_070_vestibule_bins_oak.jpg",
  "V_018_r200_rear_door_aisle.jpg",
  "V_020_r200_tiers_seats.jpg",
  "V_022_r200_seat_rows.jpg",
  "V_072_r200_front_left_exit.jpg",
  "V_080_hall_rings_benches.jpg",
  "V_085_hall_stone_piers.jpg",
  "V_088_hall_jet_engine_tape.jpg",
  "V_094_corridor_dark_portal.jpg",
  "V_096_corridor_accessible_wc.jpg",
  "V_100_corridor_reception_L2.jpg",
  "V_102_corridor_directory_pylon.jpg",
  "V_106_cg_auto_glass_doors.jpg",
  "V_110_ramp_glass_balustrade.jpg",
  "V_116_lobby_glazing_sculpture.jpg",
  "V_124_inner_sliding_doors.jpg",
  "V_130_frosted_glazing_planter.jpg",
  "V_136_outer_sliding_doors_mat.jpg",
  "V_140_exterior_sign_steps.jpg",
];

function HazardPulse({ x, z, desc }: { x: number; z: number; desc: string }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ringRef.current) return;
    const s = 1 + 0.35 * Math.sin(state.clock.getElapsedTime() * 3.5);
    ringRef.current.scale.set(s, s, 1);
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.1, 0]}>
        <coneGeometry args={[1.3, 2.2, 18]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#dc2626"
          emissiveIntensity={0.85}
          transparent
          opacity={0.78}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.2, 2.6, 32]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 2.5, 0]} center distanceFactor={22}>
        <div className="px-2 py-1 rounded bg-rose-950/95 border border-rose-400 text-[10px] font-bold text-rose-200 whitespace-nowrap shadow-lg">
          LIVE HAZARD: {desc.slice(0, 42)}...
        </div>
      </Html>
    </group>
  );
}

/**
 * CAGB Route Twin R3F Renderer:
 * Loads slava/route_A/scene.json and uses buildModel(THREE, obj, mats) / makeMaterials
 * from slava/viewer/models.js via <primitive object={group} />.
 * Coordinates: three = [X - 150, Z, -(Y - 80)], rotation.y = -yaw°
 */
function CAGBRouteTwinGroup({
  scene,
  viewerModule,
  onSelectObject,
}: {
  scene: RouteTwinScene;
  viewerModule: {
    makeMaterials?: (T: typeof THREE) => unknown;
    buildModel?: (T: typeof THREE, obj: RouteTwinObject, mats: unknown) => THREE.Object3D;
  } | null;
  onSelectObject?: (obj: RouteTwinObject) => void;
}) {
  const mats = useMemo(() => {
    try {
      if (viewerModule && typeof viewerModule.makeMaterials === "function") {
        return viewerModule.makeMaterials(THREE);
      }
    } catch {
      // fallback
    }
    return fallbackMakeMaterials(THREE);
  }, [viewerModule]);

  const builtObjects = useMemo(() => {
    const list = Array.isArray(scene?.objects) ? scene.objects : [];
    return list.map((obj) => {
      let group: THREE.Object3D;
      try {
        if (viewerModule && typeof viewerModule.buildModel === "function") {
          group = viewerModule.buildModel(THREE, obj, mats);
        } else {
          group = fallbackBuildModel(
            THREE,
            obj,
            mats as ReturnType<typeof fallbackMakeMaterials>
          );
        }
      } catch {
        group = fallbackBuildModel(
          THREE,
          obj,
          fallbackMakeMaterials(THREE)
        );
      }

      const yawDeg = Number(obj.yaw ?? obj.yaw_deg ?? 0);
      const { position, rotationY } = toRouteTwinThreeCoords(obj.pos, yawDeg);
      group.position.set(position[0], position[1], position[2]);
      group.rotation.y = rotationY;
      group.userData = { ...obj };
      return { obj, group, position };
    });
  }, [scene, viewerModule, mats]);

  const waypointPoints = useMemo(() => {
    const wps =
      Array.isArray(scene?.waypoints) && scene.waypoints.length >= 2
        ? scene.waypoints
        : FALLBACK_ROUTE_A_SCENE.waypoints || [];
    return wps.map((wp) => {
      const { position } = toRouteTwinThreeCoords(wp, 0);
      return new THREE.Vector3(position[0], position[1] + 0.18, position[2]);
    });
  }, [scene]);

  return (
    <group name="cagb-route-twin-root">
      {waypointPoints.length >= 2 && (
        <Line points={waypointPoints} color="#10b981" lineWidth={5} />
      )}
      {builtObjects.map(({ obj, group, position }) => (
        <group
          key={obj.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectObject?.(obj);
          }}
        >
          <primitive object={group} />
          <Text
            position={[
              position[0],
              position[1] + (obj.size_m?.[2] ?? 1.8) + 0.45,
              position[2],
            ]}
            fontSize={0.34}
            color={obj.hazard ? "#fca5a5" : "#a7f3d0"}
            anchorX="center"
            anchorY="middle"
          >
            {obj.label || obj.id}
          </Text>
        </group>
      ))}
    </group>
  );
}

function BuildingFloorScene({
  graph,
  hazards,
  evacuation,
  onSelectStartNode,
  onToggleCorridorHazard,
  showRouteTwin,
  routeTwinScene,
  viewerModule,
  onSelectTwinObj,
}: BuildingCanvas3DProps & {
  showRouteTwin: boolean;
  routeTwinScene: RouteTwinScene;
  viewerModule: {
    makeMaterials?: (T: typeof THREE) => unknown;
    buildModel?: (T: typeof THREE, obj: RouteTwinObject, mats: unknown) => THREE.Object3D;
  } | null;
  onSelectTwinObj: (obj: RouteTwinObject) => void;
}) {
  const W = graph.width_m;
  const D = graph.depth_m;

  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes]
  );

  const verifiedRoutePoints = useMemo(() => {
    if (!evacuation.verified_safe_route) return null;
    const pts = evacuation.verified_safe_route.node_ids
      .map((id) => nodeMap.get(id))
      .filter(Boolean)
      .map((n) => new THREE.Vector3(n!.x_m - W / 2, 0.22, n!.z_m - D / 2));
    return pts.length >= 2 ? pts : null;
  }, [evacuation.verified_safe_route, nodeMap, W, D]);

  const naiveRoutePoints = useMemo(() => {
    const pts = evacuation.naive_shortest_route.node_ids
      .map((id) => nodeMap.get(id))
      .filter(Boolean)
      .map((n) => new THREE.Vector3(n!.x_m - W / 2, 0.14, n!.z_m - D / 2));
    return pts.length >= 2 ? pts : null;
  }, [evacuation.naive_shortest_route, nodeMap, W, D]);

  return (
    <group>
      {/* Floor Slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[W * 2.2, D * 2.2]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      <Grid
        position={[0, 0.01, 0]}
        args={[W * 2, D * 2]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={55}
      />

      {showRouteTwin && (
        <CAGBRouteTwinGroup
          scene={routeTwinScene}
          viewerModule={viewerModule}
          onSelectObject={onSelectTwinObj}
        />
      )}

      {/* Extruded 3D Wall Segments */}
      {graph.walls.map((w, idx) => {
        const dx = w.x2_m - w.x1_m;
        const dz = w.z2_m - w.z1_m;
        const len = Math.hypot(dx, dz);
        const cx = (w.x1_m + w.x2_m) / 2 - W / 2;
        const cz = (w.z1_m + w.z2_m) / 2 - D / 2;
        const angle = -Math.atan2(dz, dx);
        const wallH = w.is_doorway ? 0.45 : w.height_m * 0.65;
        const wallY = w.is_doorway ? w.height_m * 0.65 - 0.22 : wallH / 2;

        return (
          <mesh
            key={idx}
            position={[cx, wallY, cz]}
            rotation={[0, angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[len, wallH, 0.22]} />
            <meshStandardMaterial
              color={w.is_doorway ? "#38bdf8" : "#475569"}
              transparent
              opacity={w.is_doorway ? 0.35 : 0.65}
            />
          </mesh>
        );
      })}

      {/* Topological Corridor Edges */}
      {graph.edges.map((e) => {
        const a = nodeMap.get(e.from_node_id);
        const b = nodeMap.get(e.to_node_id);
        if (!a || !b) return null;
        return (
          <Line
            key={e.id}
            points={[
              new THREE.Vector3(a.x_m - W / 2, 0.05, a.z_m - D / 2),
              new THREE.Vector3(b.x_m - W / 2, 0.05, b.z_m - D / 2),
            ]}
            color="#334155"
            lineWidth={2}
          />
        );
      })}

      {/* Rejected Naive Route (Red Dashed) */}
      {naiveRoutePoints && (
        <Line
          points={naiveRoutePoints}
          color="#ef4444"
          lineWidth={4}
          dashed
          dashSize={0.6}
          gapSize={0.4}
        />
      )}

      {/* Verified Safe Evacuation Route (Glowing Green Ribbon) */}
      {verifiedRoutePoints && (
        <Line points={verifiedRoutePoints} color="#10b981" lineWidth={7} />
      )}

      {/* Dynamic Hazards */}
      {hazards.map((h) => {
        const hNode = nodeMap.get(h.location_node_id);
        if (!hNode) return null;
        return (
          <HazardPulse
            key={h.id}
            x={hNode.x_m - W / 2}
            z={hNode.z_m - D / 2}
            desc={h.description}
          />
        );
      })}

      {/* Navigation Nodes */}
      {graph.nodes.map((node) => {
        const nx = node.x_m - W / 2;
        const nz = node.z_m - D / 2;
        const isStart = evacuation.user_start_node_id === node.id;
        const isTarget =
          evacuation.verified_safe_route?.node_ids[
            evacuation.verified_safe_route.node_ids.length - 1
          ] === node.id;

        const color =
          node.type === "lift_elevator"
            ? "#dc2626"
            : node.type === "stairwell_exit"
            ? "#10b981"
            : node.type === "accessible_refuge"
            ? "#06b6d4"
            : isStart
            ? "#6366f1"
            : "#94a3b8";

        return (
          <group
            key={node.id}
            position={[nx, 0.35, nz]}
            onClick={(e) => {
              e.stopPropagation();
              if (node.type === "room") {
                onSelectStartNode?.(node.id);
              } else if (node.type === "corridor_junction") {
                onToggleCorridorHazard?.(node.id);
              }
            }}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.65, 0.65, 0.6, 20]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={
                  isStart || isTarget || node.type === "lift_elevator" ? 0.6 : 0.25
                }
              />
            </mesh>
            <Html position={[0, 0.9, 0]} center distanceFactor={24}>
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border shadow ${
                  node.type === "lift_elevator"
                    ? "bg-red-950/95 border-red-400 text-red-200"
                    : isStart
                    ? "bg-indigo-950/95 border-indigo-400 text-indigo-200"
                    : isTarget
                    ? "bg-emerald-950/95 border-emerald-400 text-emerald-200"
                    : "bg-slate-900/90 border-slate-600 text-slate-200"
                }`}
              >
                {isStart ? "YOU ARE HERE: " : ""}
                {node.label}
                {node.type === "lift_elevator" ? " [LOCKED]" : ""}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function BuildingCanvas3D(props: BuildingCanvas3DProps) {
  const [showRouteTwin, setShowRouteTwin] = useState<boolean>(true);
  const [routeTwinScene, setRouteTwinScene] = useState<RouteTwinScene>(
    FALLBACK_ROUTE_A_SCENE
  );
  const [routeTwinSource, setRouteTwinSource] = useState<string>("fallback");
  const [viewerModule, setViewerModule] = useState<{
    makeMaterials?: (T: typeof THREE) => unknown;
    buildModel?: (T: typeof THREE, obj: RouteTwinObject, mats: unknown) => THREE.Object3D;
  } | null>(null);
  const [selectedTwinObj, setSelectedTwinObj] = useState<RouteTwinObject | null>(
    null
  );
  const [argonMap, setArgonMap] = useState<Record<string, ArgonVerificationEntry>>(
    {}
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/route-twin")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.scene?.objects?.length) {
          setRouteTwinScene(data.scene);
          setRouteTwinSource(data.source || "slava/route_A/scene.json");
          setSelectedTwinObj(data.scene.objects[0]);
        }
        if (data?.modelsJsSource && typeof data.modelsJsSource === "string") {
          try {
            const sanitized = data.modelsJsSource
              .replace(/export\s+function\s+/g, "function ")
              .replace(/export\s+const\s+/g, "const ")
              .replace(/export\s+\{[^}]*\};?/g, "");
            const factory = new Function(
              `${sanitized}\nreturn { makeMaterials: typeof makeMaterials !== "undefined" ? makeMaterials : undefined, buildModel: typeof buildModel !== "undefined" ? buildModel : undefined };`
            );
            const mod = factory();
            if (mod?.buildModel) setViewerModule(mod);
          } catch {
            // fallback used automatically
          }
        }
      })
      .catch(() => {});

    fetch("/evidence/argon_verification.json")
      .then((r) => r.json())
      .then((list: ArgonVerificationEntry[]) => {
        if (cancelled || !Array.isArray(list)) return;
        const map: Record<string, ArgonVerificationEntry> = {};
        for (const item of list) {
          if (item?.id) map[item.id] = item;
        }
        setArgonMap(map);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full h-full relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      {/* Top-Right CAGB Route Twin Toggle & Selected Object Inspector (Cross-Merged from slava/ + pushkar/ + sam/) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 max-w-xs">
        <button
          onClick={() => setShowRouteTwin((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition border shadow-lg ${
            showRouteTwin
              ? "bg-emerald-950/95 border-emerald-400 text-emerald-200"
              : "bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {showRouteTwin
            ? `🧭 CAGB Route Twin: ON (${routeTwinScene.objects.length} Walk Objs • 9.52 px/m)`
            : "🧭 Show CAGB Route Twin (52 Walk Objs)"}
        </button>

        {showRouteTwin && selectedTwinObj && (
          <div className="p-2.5 rounded-lg bg-slate-950/95 border border-emerald-500/40 text-[11px] space-y-1 shadow-xl w-full">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-emerald-300 truncate">
                {selectedTwinObj.label || selectedTwinObj.id}
              </strong>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedTwinObj.model || selectedTwinObj.type}
              </span>
            </div>
            <div className="text-slate-300 text-[10px] font-mono">
              pos={JSON.stringify(selectedTwinObj.pos)} • yaw=
              {selectedTwinObj.yaw ?? selectedTwinObj.yaw_deg ?? 0}° •{" "}
              {selectedTwinObj.mass_kg ?? "?"}kg
            </div>
            {argonMap[selectedTwinObj.id] && (
              <div className="text-cyan-300 text-[10px] font-medium bg-cyan-950/50 border border-cyan-500/30 rounded px-1.5 py-1">
                ✓ Argon Verified (52/52 • 0.157m err):{" "}
                {argonMap[selectedTwinObj.id].note}
              </div>
            )}
            {(() => {
              const ev = selectedTwinObj.evidence as unknown;
              const rawFrame = Array.isArray(ev)
                ? String(ev[0] || "")
                : String(
                    (ev as { frame?: string; image?: string })?.frame ||
                      (ev as { frame?: string; image?: string })?.image ||
                      ""
                  );
              const prefix = rawFrame.replace(/\s+/g, "_");
              const matched = EVIDENCE_FILES.find(
                (f) =>
                  f === rawFrame ||
                  (prefix && f.startsWith(prefix)) ||
                  f.includes(selectedTwinObj.id)
              );
              if (!matched) return null;
              return (
                <div className="mt-1">
                  <img
                    src={"/evidence/" + matched}
                    alt={selectedTwinObj.label || selectedTwinObj.id}
                    className="w-full h-24 object-cover rounded border border-slate-700"
                  />
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                    slava/route_A/evidence/{matched} ({routeTwinSource})
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <Canvas shadows camera={{ position: [0, 22, 22], fov: 45 }}>
        <color attach="background" args={["#060911"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[12, 24, 10]} intensity={1.3} castShadow />
        <BuildingFloorScene
          {...props}
          showRouteTwin={showRouteTwin}
          routeTwinScene={routeTwinScene}
          viewerModule={viewerModule}
          onSelectTwinObj={setSelectedTwinObj}
        />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.4} scale={40} blur={2} />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
    </div>
  );
}
