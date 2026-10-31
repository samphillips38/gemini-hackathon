"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  BuildingFloorGraph,
  LiveHazardEvent,
  EvacuationVerificationResult,
} from "@/types/contracts";

interface ExitZeroCanvasProps {
  floorGraph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  verification: EvacuationVerificationResult;
  walkthroughActive: boolean;
}

/**
 * Guided First-Person Evacuation Walkthrough along the Verified Safe Route
 */
function BuildingWalkthroughCamera({
  active,
  routeNodes,
  widthM,
  depthM,
}: {
  active: boolean;
  routeNodes: Array<{ x_m: number; z_m: number; label: string }>;
  widthM: number;
  depthM: number;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (!active || routeNodes.length < 2) return;
    progressRef.current = (progressRef.current + delta * 0.16) % 1;
    const fIdx = progressRef.current * (routeNodes.length - 1);
    const idx = Math.floor(fIdx);
    const nextIdx = Math.min(routeNodes.length - 1, idx + 1);
    const alpha = fIdx - idx;

    const p1 = routeNodes[idx];
    const p2 = routeNodes[nextIdx];
    const cx = THREE.MathUtils.lerp(p1.x_m, p2.x_m, alpha) - widthM / 2;
    const cz = THREE.MathUtils.lerp(p1.z_m, p2.z_m, alpha) - depthM / 2;

    camera.position.lerp(new THREE.Vector3(cx, 1.7, cz), 0.12);
    const lookNode = routeNodes[nextIdx];
    camera.lookAt(
      lookNode.x_m - widthM / 2,
      1.3,
      lookNode.z_m - depthM / 2
    );
  });

  return null;
}

/**
 * Volumetric Expanding Smoke & Debris Sphere at LiveHazardEvent Node
 */
function DynamicHazardZone({
  x,
  z,
  spreadRate,
  description,
}: {
  x: number;
  z: number;
  spreadRate: number;
  description: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const scale = 1.6 + Math.sin(t * 2.5) * 0.35 + (spreadRate > 0 ? (t % 8) * 0.25 : 0);
    meshRef.current.scale.set(scale, 1.1, scale);
  });

  return (
    <group position={[x, 1.1, z]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.4, 24, 24]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#b91c1c"
          emissiveIntensity={0.75}
          transparent
          opacity={0.42}
        />
      </mesh>
      <Text position={[0, 2.5, 0]} fontSize={0.55} color="#fca5a5" anchorX="center">
        LIVE HAZARD: BLOCKED + SMOKE
      </Text>
      <Text position={[0, 1.85, 0]} fontSize={0.36} color="#fecaca" anchorX="center">
        {description.slice(0, 48)}
      </Text>
    </group>
  );
}

export default function ExitZeroCanvas({
  floorGraph,
  hazards,
  verification,
  walkthroughActive,
}: ExitZeroCanvasProps) {
  const { width_m, depth_m, walls, nodes } = floorGraph;
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const naivePoints = useMemo(() => {
    return verification.naive_shortest_route.node_ids
      .map((id) => nodeMap.get(id))
      .filter(Boolean)
      .map(
        (n) => new THREE.Vector3(n!.x_m - width_m / 2, 0.25, n!.z_m - depth_m / 2)
      );
  }, [verification.naive_shortest_route.node_ids, nodeMap, width_m, depth_m]);

  const verifiedRouteNodes = useMemo(() => {
    if (!verification.verified_safe_route) return [];
    return verification.verified_safe_route.node_ids
      .map((id) => nodeMap.get(id))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
  }, [verification.verified_safe_route, nodeMap]);

  const verifiedPoints = useMemo(() => {
    return verifiedRouteNodes.map(
      (n) => new THREE.Vector3(n.x_m - width_m / 2, 0.35, n.z_m - depth_m / 2)
    );
  }, [verifiedRouteNodes, width_m, depth_m]);

  return (
    <div className="relative w-full h-full min-h-[440px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        <span className="px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200">
          {floorGraph.building_name}
        </span>
        {verification.lift_override_triggered && (
          <span className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/50 text-xs font-bold text-red-300 animate-pulse">
            LIFT LOCKOUT OVERRIDE ACTIVE
          </span>
        )}
      </div>

      <Canvas shadows camera={{ position: [0, 26, 22], fov: 45 }}>
        <color attach="background" args={["#050914"]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[12, 25, 10]} intensity={1.1} castShadow />

        {/* Extruded Building Floor Base */}
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <boxGeometry args={[width_m + 2, 0.2, depth_m + 2]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <gridHelper args={[width_m, 36, "#1e293b", "#0f172a"]} position={[0, 0.02, 0]} />

        {/* Extruded 3D Wall Segments */}
        {walls.map((w, idx) => {
          const dx = w.x2_m - w.x1_m;
          const dz = w.z2_m - w.z1_m;
          const length = Math.hypot(dx, dz);
          const angle = Math.atan2(dz, dx);
          const cx = (w.x1_m + w.x2_m) / 2 - width_m / 2;
          const cz = (w.z1_m + w.z2_m) / 2 - depth_m / 2;
          const wallHeight = w.is_doorway ? 0.6 : w.height_m * 0.65;
          const wallY = w.is_doorway ? w.height_m * 0.65 - 0.3 : wallHeight / 2;

          return (
            <mesh
              key={idx}
              position={[cx, wallY, cz]}
              rotation={[0, -angle, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[length, wallHeight, 0.22]} />
              <meshStandardMaterial
                color={w.is_doorway ? "#38bdf8" : "#334155"}
                transparent
                opacity={w.is_doorway ? 0.35 : 0.85}
              />
            </mesh>
          );
        })}

        {/* Topological Navigation Nodes */}
        {nodes.map((n) => {
          const nx = n.x_m - width_m / 2;
          const nz = n.z_m - depth_m / 2;
          const isStart = n.id === verification.user_start_node_id;
          let color = "#38bdf8";
          if (n.type === "stairwell_exit") color = "#10b981";
          if (n.type === "lift_elevator") color = "#ef4444";
          if (n.type === "accessible_refuge") color = "#a855f7";
          if (isStart) color = "#f59e0b";

          return (
            <group key={n.id} position={[nx, 0.4, nz]}>
              <mesh>
                <cylinderGeometry args={[0.7, 0.7, 0.6, 24]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.55}
                />
              </mesh>
              <Text
                position={[0, 1.25, 0]}
                fontSize={0.5}
                color="#f8fafc"
                anchorX="center"
              >
                {isStart ? `YOU ARE HERE: ${n.label}` : n.label}
              </Text>
              {n.type === "lift_elevator" && (
                <Text
                  position={[0, 1.9, 0]}
                  fontSize={0.44}
                  color="#fca5a5"
                  anchorX="center"
                >
                  LOCKED OUT (SEISMIC/FIRE)
                </Text>
              )}
            </group>
          );
        })}

        {/* Naive Rejected Route (Red Dashed Ribbon) */}
        {naivePoints.length > 1 && (
          <Line
            points={naivePoints}
            color="#ef4444"
            lineWidth={3}
            dashed
            dashSize={0.6}
            gapSize={0.4}
          />
        )}

        {/* Verified Safe Route (Glowing Green Ribbon) */}
        {verifiedPoints.length > 1 && (
          <Line points={verifiedPoints} color="#10b981" lineWidth={6} />
        )}

        {/* Dynamic Hazards */}
        {hazards.map((h) => {
          const hNode = nodeMap.get(h.location_node_id);
          if (!hNode) return null;
          return (
            <DynamicHazardZone
              key={h.id}
              x={hNode.x_m - width_m / 2}
              z={hNode.z_m - depth_m / 2}
              spreadRate={h.spread_rate_m_per_s}
              description={h.description}
            />
          );
        })}

        <BuildingWalkthroughCamera
          active={walkthroughActive}
          routeNodes={verifiedRouteNodes}
          widthM={width_m}
          depthM={depth_m}
        />

        {!walkthroughActive && (
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            maxPolarAngle={Math.PI / 2 - 0.08}
          />
        )}
      </Canvas>
    </div>
  );
}
