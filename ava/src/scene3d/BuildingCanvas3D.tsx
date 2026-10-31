"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Grid, Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
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

function BuildingFloorScene({
  graph,
  hazards,
  evacuation,
  onSelectStartNode,
  onToggleCorridorHazard,
}: BuildingCanvas3DProps) {
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
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      <Grid
        position={[0, 0.01, 0]}
        args={[W, D]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={48}
      />

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
                emissiveIntensity={isStart || isTarget || node.type === "lift_elevator" ? 0.6 : 0.25}
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
  return (
    <div className="w-full h-full relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      <Canvas shadows camera={{ position: [0, 22, 22], fov: 45 }}>
        <color attach="background" args={["#060911"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[12, 24, 10]} intensity={1.3} castShadow />
        <BuildingFloorScene {...props} />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.4} scale={40} blur={2} />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
    </div>
  );
}
