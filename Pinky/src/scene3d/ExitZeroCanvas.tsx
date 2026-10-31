"use client";

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Html, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  BuildingFloorGraph,
  EvacuationVerificationResult,
  LiveHazardEvent,
  NavNode,
} from "@/types/contracts";

interface ExitZeroCanvasProps {
  graph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  verification: EvacuationVerificationResult;
}

export function ExitZeroCanvas({
  graph,
  hazards,
  verification,
}: ExitZeroCanvasProps) {
  const cx = graph.width_m / 2;
  const cz = graph.depth_m / 2;

  const nodeMap = useMemo(() => {
    const m = new Map<string, NavNode>();
    graph.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graph.nodes]);

  const naivePoints = useMemo(() => {
    return verification.naive_shortest_route.node_ids
      .map((id) => nodeMap.get(id))
      .filter((n): n is NavNode => Boolean(n))
      .map((n) => new THREE.Vector3(n.x_m - cx, 0.25, n.z_m - cz));
  }, [verification.naive_shortest_route.node_ids, nodeMap, cx, cz]);

  const safePoints = useMemo(() => {
    if (!verification.verified_safe_route) return [];
    return verification.verified_safe_route.node_ids
      .map((id) => nodeMap.get(id))
      .filter((n): n is NavNode => Boolean(n))
      .map((n) => new THREE.Vector3(n.x_m - cx, 0.35, n.z_m - cz));
  }, [verification.verified_safe_route, nodeMap, cx, cz]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200">
        {graph.building_name} — 3D Extruded Evacuation Twin
      </div>
      <Canvas camera={{ position: [0, 28, 24], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[12, 25, 10]} intensity={1.1} />

        <group>
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[graph.width_m, 0.2, graph.depth_m]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>

          <Grid
            position={[0, 0.02, 0]}
            args={[graph.width_m, graph.depth_m]}
            cellSize={1}
            cellColor="#1e293b"
            sectionSize={5}
            sectionColor="#334155"
            fadeDistance={60}
          />

          {/* 3D Extruded Wall Segments */}
          {graph.walls.map((w, idx) => {
            const dx = w.x2_m - w.x1_m;
            const dz = w.z2_m - w.z1_m;
            const len = Math.hypot(dx, dz);
            const midX = (w.x1_m + w.x2_m) / 2 - cx;
            const midZ = (w.z1_m + w.z2_m) / 2 - cz;
            const angle = Math.atan2(dz, dx);
            return (
              <mesh
                key={`wall_${idx}`}
                position={[midX, w.height_m / 2, midZ]}
                rotation={[0, -angle, 0]}
              >
                <boxGeometry args={[len, w.height_m, 0.24]} />
                <meshStandardMaterial
                  color="#475569"
                  transparent
                  opacity={0.55}
                />
              </mesh>
            );
          })}

          {/* Navigation Nodes */}
          {graph.nodes.map((node) => {
            const isStart = node.id === verification.user_start_node_id;
            const color =
              node.type === "stairwell_exit"
                ? "#10b981"
                : node.type === "lift_elevator"
                ? "#ef4444"
                : node.type === "accessible_refuge"
                ? "#38bdf8"
                : isStart
                ? "#f59e0b"
                : "#94a3b8";

            return (
              <group
                key={node.id}
                position={[node.x_m - cx, 0.35, node.z_m - cz]}
              >
                <mesh>
                  <cylinderGeometry args={[0.65, 0.65, 0.5, 24]} />
                  <meshStandardMaterial color={color} />
                </mesh>
                <Html position={[0, 1.2, 0]} center distanceFactor={26}>
                  <div className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono text-slate-100 whitespace-nowrap">
                    {node.label}
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Live Hazard Zones */}
          {hazards.map((h) => {
            const hNode = nodeMap.get(h.location_node_id);
            if (!hNode) return null;
            return (
              <group
                key={h.id}
                position={[hNode.x_m - cx, 1.2, hNode.z_m - cz]}
              >
                <mesh>
                  <sphereGeometry args={[3.2, 24, 24]} />
                  <meshStandardMaterial
                    color="#ef4444"
                    transparent
                    opacity={0.38}
                  />
                </mesh>
                <Html position={[0, 2.6, 0]} center distanceFactor={28}>
                  <div className="px-2 py-1 rounded bg-red-950/90 border border-red-500 text-[10px] font-mono text-red-200 whitespace-nowrap">
                    HAZARD: {h.hazard_type.toUpperCase()} ({h.spread_rate_m_per_s}m/s)
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Naive Blocked / Lift Route (Red Dashed) */}
          {naivePoints.length >= 2 && (
            <Line
              points={naivePoints}
              color="#ef4444"
              lineWidth={3}
              dashed
              dashSize={0.8}
              gapSize={0.5}
            />
          )}

          {/* Verified Safe Route (Glowing Green) */}
          {safePoints.length >= 2 && (
            <Line points={safePoints} color="#10b981" lineWidth={5} />
          )}
        </group>

        <OrbitControls makeDefault enablePan maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
    </div>
  );
}
