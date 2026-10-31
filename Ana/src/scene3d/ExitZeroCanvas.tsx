"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Line,
  RoundedBox,
  ContactShadows,
  Sky,
} from "@react-three/drei";
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
  LiveHazardEvent,
  EvacuationVerificationResult,
} from "@/types/contracts";

interface ExitZeroCanvasProps {
  floorGraph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  verification: EvacuationVerificationResult;
  walkthroughActive: boolean;
  freeWalkMode?: boolean;
  quakeActive?: boolean;
  showRouteTwin?: boolean;
  spawnTarget?: { x_m: number; z_m: number; yaw: number } | null;
  fullScreen?: boolean;
  onHudUpdate?: (status: string) => void;
  onSelectRouteTwinObject?: (obj: RouteTwinObject) => void;
}

/**
 * Falling Ceiling Plaster & Dust Particles across the Building Twin during Seismic Shaking
 */
function BuildingDebrisParticles({
  active,
  widthM,
  depthM,
}: {
  active: boolean;
  widthM: number;
  depthM: number;
}) {
  const count = 95;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: ((i * 43) % (widthM - 2)) - widthM / 2 + 1,
        y: 2.2 + ((i * 19) % 15) * 0.1,
        z: ((i * 31) % (depthM - 2)) - depthM / 2 + 1,
        vy: 1.4 + (i % 6) * 0.45,
        rx: (i % 5) * 0.5,
        rz: (i % 7) * 0.4,
        scale: 0.03 + (i % 4) * 0.018,
      })),
    [widthM, depthM]
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    particles.forEach((p, idx) => {
      if (!active) {
        dummy.scale.set(0, 0, 0);
      } else {
        p.y -= p.vy * delta;
        if (p.y < 0.05) {
          p.y = 3.35;
        }
        const sway = Math.sin(t * 14 + idx) * 0.06;
        dummy.position.set(p.x + sway, p.y, p.z);
        dummy.rotation.set(t * 2.5 + p.rx, t * 1.8, t * 2.2 + p.rz);
        dummy.scale.set(p.scale, p.scale * 0.65, p.scale);
      }
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(idx, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
    </instancedMesh>
  );
}

/**
 * Animated 3D Holographic Escape Route Ribbon + Pulsing Directional Chevrons
 */
function AnimatedBuildingRoute({
  points,
  color = "#10b981",
}: {
  points: Array<[number, number, number]>;
  color?: string;
}) {
  const chevronsRef = useRef<THREE.Group>(null);

  const segments = useMemo(() => {
    const out: Array<{ pos: [number, number, number]; yaw: number }> = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, , z1] = points[i];
      const [x2, , z2] = points[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const dist = Math.hypot(dx, dz);
      const steps = Math.max(2, Math.floor(dist / 1.15));
      const yaw = Math.atan2(dx, dz);
      for (let s = 0; s < steps; s++) {
        const alpha = (s + 0.4) / steps;
        out.push({
          pos: [x1 + dx * alpha, 0.14, z1 + dz * alpha],
          yaw,
        });
      }
    }
    return out;
  }, [points]);

  useFrame((state) => {
    if (!chevronsRef.current) return;
    const t = state.clock.getElapsedTime();
    chevronsRef.current.children.forEach((child, idx) => {
      const wave = (Math.sin(t * 6.5 - idx * 0.65) + 1) * 0.5;
      child.position.y = 0.12 + wave * 0.08;
      const scale = 0.85 + wave * 0.4;
      child.scale.set(scale, scale, scale);
    });
  });

  if (points.length < 2) return null;

  return (
    <group>
      {/* Glowing floor guide ribbon */}
      <Line points={points} color={color} lineWidth={5.5} />
      <Line
        points={points.map(([x, y, z]) => [x, y - 0.05, z] as [number, number, number])}
        color="#34d399"
        lineWidth={10}
        transparent
        opacity={0.28}
      />

      {/* Animated directional 3D chevrons guiding the occupant */}
      <group ref={chevronsRef}>
        {segments.map((seg, i) => (
          <group key={i} position={seg.pos} rotation={[0, seg.yaw, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.22, 0.46, 4]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={1.5}
                transparent
                opacity={0.92}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Volumetric Expanding Smoke, Fallen Ceiling Grid & Toppled Vending Machine at LiveHazardEvent Node
 */
function DynamicHazardZone({
  x,
  z,
  spreadRate,
  description,
  quakeActive,
}: {
  x: number;
  z: number;
  spreadRate: number;
  description: string;
  quakeActive: boolean;
}) {
  const smokeRef = useRef<THREE.Mesh>(null);
  const sparkLightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (smokeRef.current) {
      const scale =
        1.45 + Math.sin(t * 2.5) * 0.25 + (spreadRate > 0 ? (t % 8) * 0.18 : 0);
      smokeRef.current.scale.set(scale, 0.95, scale);
    }
    if (sparkLightRef.current) {
      const flicker = Math.sin(t * 28) > 0.35 ? 2.4 : 0.3;
      sparkLightRef.current.intensity = quakeActive ? flicker : 0.9;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Toppled Heavy Vending Machine blocking the East Corridor */}
      <group position={[-0.35, 0.52, -0.25]} rotation={[0.12, 0.35, -1.32]}>
        <RoundedBox args={[0.95, 1.95, 0.85]} radius={0.04} castShadow receiveShadow>
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
        </RoundedBox>
        {/* Illuminated vending front glass */}
        <mesh position={[0, 0.15, 0.44]}>
          <boxGeometry args={[0.75, 1.35, 0.02]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.75}
          />
        </mesh>
      </group>

      {/* Collapsed Suspended Ceiling Tiles & Girder Rubble */}
      {[
        [0.45, 0.16, 0.3, 0.4, 0.2, 0.1],
        [-0.6, 0.12, 0.55, -0.2, 0.7, -0.15],
        [0.15, 0.22, -0.5, 0.3, -0.4, 0.25],
        [0.75, 0.1, -0.2, 0.1, 0.9, -0.3],
      ].map(([rx, ry, rz, ax, ay, az], idx) => (
        <mesh
          key={idx}
          position={[rx, ry, rz]}
          rotation={[ax, ay, az]}
          castShadow
        >
          <boxGeometry args={[0.75, 0.08, 0.55]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
        </mesh>
      ))}

      {/* Fallen Steel Ceiling Conduit */}
      <mesh position={[0.2, 0.45, 0.1]} rotation={[0.4, 0.2, -0.85]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 2.2, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Sparking Hazard Light */}
      <pointLight
        ref={sparkLightRef}
        position={[0, 1.6, 0]}
        color="#ef4444"
        intensity={1.6}
        distance={6}
      />

      {/* Volumetric Smoke & Dust Plume */}
      <mesh ref={smokeRef} position={[0, 1.15, 0]}>
        <sphereGeometry args={[1.3, 24, 24]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#991b1b"
          emissiveIntensity={0.65}
          transparent
          opacity={0.36}
        />
      </mesh>

      <Text position={[0, 2.65, 0]} fontSize={0.42} color="#fca5a5" anchorX="center">
        LIVE HAZARD: CORRIDOR COLLAPSE + SMOKE
      </Text>
      <Text position={[0, 2.2, 0]} fontSize={0.28} color="#fecaca" anchorX="center">
        {description.slice(0, 52)}
      </Text>
    </group>
  );
}

/**
 * Complete Architectural Interiors for All Rooms in Imperial CAGB Level 2
 * Coordinates are relative to building center (-widthM/2, -depthM/2).
 */
function BuildingRoomInteriors({
  widthM,
  depthM,
  quakeActive,
}: {
  widthM: number;
  depthM: number;
  quakeActive: boolean;
}) {
  const ox = -widthM / 2;
  const oz = -depthM / 2;

  const rackingServerRef = useRef<THREE.Group>(null);
  const theatreTrussRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (rackingServerRef.current) {
      rackingServerRef.current.rotation.z = quakeActive
        ? -0.24 + Math.sin(t * 16) * 0.08
        : 0;
    }
    if (theatreTrussRef.current) {
      theatreTrussRef.current.rotation.x = quakeActive
        ? Math.sin(t * 9) * 0.14
        : 0;
      theatreTrussRef.current.rotation.z = quakeActive
        ? Math.cos(t * 7.5) * 0.1
        : 0;
    }
  });

  return (
    <group>
      {/* =====================================================================
          1. ROOM 203 — COMPUTER & ROBOTICS LAB (North-West Wing: x 1..12, z 1..9)
          ===================================================================== */}
      <group position={[ox + 6.5, 0, oz + 5.0]}>
        {/* Anti-static Lab Flooring */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[10.6, 0.02, 7.6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} />
        </mesh>

        {/* 2 Rows of 3 Dual-Monitor Computer Lab Workstations */}
        {[-2.8, 0, 2.8].map((dx, colIdx) =>
          [-1.6, 1.2].map((dz, rowIdx) => (
            <group key={`desk-${colIdx}-${rowIdx}`} position={[dx, 0, dz]}>
              {/* Workbench tabletop */}
              <RoundedBox
                args={[2.1, 0.06, 1.05]}
                radius={0.015}
                position={[0, 0.74, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
              </RoundedBox>
              {/* Steel desk legs */}
              {[-0.95, 0.95].map((lx, li) => (
                <mesh key={li} position={[lx, 0.37, 0]} castShadow>
                  <boxGeometry args={[0.06, 0.74, 0.9]} />
                  <meshStandardMaterial color="#334155" metalness={0.7} />
                </mesh>
              ))}
              {/* Dual glowing monitors per bench */}
              {[-0.52, 0.52].map((mx, mi) => (
                <group key={mi} position={[mx, 1.02, -0.25]}>
                  <RoundedBox args={[0.72, 0.42, 0.03]} radius={0.01} castShadow>
                    <meshStandardMaterial color="#0f172a" roughness={0.3} />
                  </RoundedBox>
                  <mesh position={[0, 0, 0.018]}>
                    <planeGeometry args={[0.66, 0.36]} />
                    <meshStandardMaterial
                      color="#0284c7"
                      emissive="#38bdf8"
                      emissiveIntensity={0.85}
                    />
                  </mesh>
                  {/* Monitor stand */}
                  <mesh position={[0, -0.24, -0.02]}>
                    <boxGeometry args={[0.08, 0.14, 0.08]} />
                    <meshStandardMaterial color="#475569" />
                  </mesh>
                </group>
              ))}
              {/* Lab Task Chairs */}
              {[-0.52, 0.52].map((cx, ci) => (
                <group key={ci} position={[cx, 0, 0.55]}>
                  <RoundedBox args={[0.46, 0.06, 0.46]} radius={0.02} position={[0, 0.46, 0]}>
                    <meshStandardMaterial color="#0284c7" roughness={0.6} />
                  </RoundedBox>
                  <RoundedBox args={[0.44, 0.44, 0.06]} radius={0.02} position={[0, 0.72, 0.2]}>
                    <meshStandardMaterial color="#0369a1" roughness={0.6} />
                  </RoundedBox>
                  <mesh position={[0, 0.23, 0]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.45, 8]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.8} />
                  </mesh>
                </group>
              ))}
            </group>
          ))
        )}

        {/* High-Voltage Server Racks along West Wall (One unbolted rack rocking in quake!) */}
        <group position={[-4.6, 0, -2.1]}>
          <RoundedBox args={[0.85, 2.1, 0.95]} radius={0.03} position={[0, 1.05, 0]} castShadow>
            <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.35} />
          </RoundedBox>
          {/* Blinking Server LEDs */}
          {[0.5, 0.9, 1.3, 1.7].map((sy, si) => (
            <mesh key={si} position={[0.43, sy, 0]}>
              <boxGeometry args={[0.02, 0.08, 0.7]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#10b981"
                emissiveIntensity={1.4}
              />
            </mesh>
          ))}
        </group>

        {/* Second Server Rack (Unanchored — rocks during earthquake!) */}
        <group ref={rackingServerRef} position={[-4.6, 0, -0.8]}>
          <RoundedBox args={[0.85, 2.1, 0.95]} radius={0.03} position={[0, 1.05, 0]} castShadow>
            <meshStandardMaterial color="#1e1b4b" metalness={0.6} roughness={0.35} />
          </RoundedBox>
          {[0.5, 0.9, 1.3, 1.7].map((sy, si) => (
            <mesh key={si} position={[0.43, sy, 0]}>
              <boxGeometry args={[0.02, 0.08, 0.7]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#ef4444"
                emissiveIntensity={1.6}
              />
            </mesh>
          ))}
        </group>

        {/* Room 203 Overhead Signage */}
        <Text position={[0, 2.75, -3.65]} fontSize={0.34} color="#38bdf8" anchorX="center">
          CAGB ROOM 203 — ROBOTICS & COMPUTING LAB
        </Text>
      </group>

      {/* =====================================================================
          2. ROOM 200 — 350-SEAT LECTURE THEATRE (North-Center Wing: x 12..23, z 1..9)
          ===================================================================== */}
      <group position={[ox + 17.5, 0, oz + 5.0]}>
        {/* Deep Crimson Auditorium Carpet */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[10.6, 0.02, 7.6]} />
          <meshStandardMaterial color="#3b1d2e" roughness={0.9} />
        </mesh>

        {/* Giant Illuminated Front Projection Screen on North Wall */}
        <group position={[0, 1.85, -3.72]}>
          <RoundedBox args={[6.4, 2.35, 0.08]} radius={0.02}>
            <meshStandardMaterial color="#0f172a" />
          </RoundedBox>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[6.1, 2.1]} />
            <meshStandardMaterial
              color="#e0f2fe"
              emissive="#38bdf8"
              emissiveIntensity={0.65}
            />
          </mesh>
          <Text position={[0, 0.35, 0.07]} fontSize={0.28} color="#0f172a" anchorX="center">
            IMPERIAL COLLEGE LONDON — CAGB ROOM 200
          </Text>
          <Text position={[0, -0.1, 0.07]} fontSize={0.22} color="#0369a1" anchorX="center">
            EMERGENCY PROTOCOL: FOLLOW GREEN FLOOR CHEVRONS TO WEST EXIT
          </Text>
        </group>

        {/* Lecturer Stage & Oak Podium */}
        <RoundedBox
          args={[7.2, 0.22, 1.5]}
          radius={0.03}
          position={[0, 0.11, -2.75]}
          receiveShadow
        >
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          args={[0.95, 1.15, 0.65]}
          radius={0.03}
          position={[2.1, 0.75, -2.55]}
          castShadow
        >
          <meshStandardMaterial color="#92400e" roughness={0.5} />
        </RoundedBox>

        {/* 4 Tiered Raked Auditorium Seating Rows + Writing Desks */}
        {[
          { dz: -1.1, y: 0.08 },
          { dz: 0.1, y: 0.24 },
          { dz: 1.3, y: 0.4 },
          { dz: 2.5, y: 0.56 },
        ].map((tier, ti) => (
          <group key={ti} position={[0, tier.y, tier.dz]}>
            {/* Tier platform riser */}
            <mesh position={[0, -tier.y / 2, 0]} receiveShadow>
              <boxGeometry args={[8.8, tier.y + 0.04, 1.05]} />
              <meshStandardMaterial color="#334155" roughness={0.85} />
            </mesh>
            {/* Left & Right Lecture Desk Banks (leaving central aisle clear!) */}
            {[-2.4, 2.4].map((bankX, bi) => (
              <group key={bi} position={[bankX, 0, 0]}>
                {/* Continuous curved oak lecture desk */}
                <RoundedBox
                  args={[3.4, 0.06, 0.38]}
                  radius={0.015}
                  position={[0, 0.72, -0.22]}
                  castShadow
                >
                  <meshStandardMaterial color="#b45309" roughness={0.5} />
                </RoundedBox>
                {/* 4 Upholstered Red Auditorium Seats per Bank */}
                {[-1.2, -0.4, 0.4, 1.2].map((sx, si) => (
                  <group key={si} position={[sx, 0, 0.15]}>
                    <RoundedBox
                      args={[0.52, 0.1, 0.46]}
                      radius={0.03}
                      position={[0, 0.44, 0]}
                      castShadow
                    >
                      <meshStandardMaterial color="#be123c" roughness={0.65} />
                    </RoundedBox>
                    <RoundedBox
                      args={[0.52, 0.52, 0.09]}
                      radius={0.03}
                      position={[0, 0.72, 0.2]}
                      castShadow
                    >
                      <meshStandardMaterial color="#9f1239" roughness={0.65} />
                    </RoundedBox>
                  </group>
                ))}
              </group>
            ))}
          </group>
        ))}

        {/* Swaying Overhead Auditorium Lighting Truss */}
        <group ref={theatreTrussRef} position={[0, 3.25, 0]}>
          <mesh position={[0, -0.35, 0]}>
            <boxGeometry args={[6.5, 0.08, 0.08]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} />
          </mesh>
          {[-2.4, 0, 2.4].map((lx, li) => (
            <mesh key={li} position={[lx, -0.46, 0]}>
              <cylinderGeometry args={[0.16, 0.22, 0.18, 12]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#facc15"
                emissiveIntensity={1.1}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* =====================================================================
          3. BREAKOUT LOUNGE & ACCESSIBLE REFUGE BAY R2 (South-West Wing: x 1..15, z 13..21)
          ===================================================================== */}
      <group position={[ox + 8.0, 0, oz + 17.0]}>
        {/* Warm Oak Lounge Flooring */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[13.6, 0.02, 7.6]} />
          <meshStandardMaterial color="#451a03" roughness={0.7} />
        </mesh>

        {/* FIRE-RATED ACCESSIBLE REFUGE BAY R2 (x=4, z=17 -> local dx=-4, dz=0) */}
        <group position={[-4.0, 0, 0]}>
          {/* Glowing Purple/Emerald Tactile Floor Mat */}
          <RoundedBox
            args={[3.4, 0.04, 3.4]}
            radius={0.02}
            position={[0, 0.03, 0]}
            receiveShadow
          >
            <meshStandardMaterial
              color="#581c87"
              emissive="#9333ea"
              emissiveIntensity={0.55}
              roughness={0.5}
            />
          </RoundedBox>
          {/* Emergency 2-Way Voice Intercom Pillar */}
          <RoundedBox
            args={[0.35, 1.65, 0.25]}
            radius={0.03}
            position={[-1.4, 0.85, -1.2]}
            castShadow
          >
            <meshStandardMaterial color="#7e22ce" metalness={0.4} roughness={0.3} />
          </RoundedBox>
          <mesh position={[-1.21, 1.25, -1.2]}>
            <boxGeometry args={[0.02, 0.28, 0.18]} />
            <meshStandardMaterial
              color="#4ade80"
              emissive="#22c55e"
              emissiveIntensity={1.5}
            />
          </mesh>
          <Text position={[0, 2.35, 0]} fontSize={0.32} color="#e9d5ff" anchorX="center">
            ACCESSIBLE REFUGE R2 (60-MIN FIRE CORE + 2-WAY INTERCOM)
          </Text>
        </group>

        {/* Student Breakout Lounge Sofas & Collaborative Round Tables (local dx=+2.2) */}
        <group position={[2.2, 0, 0]}>
          {/* L-Shaped Modern Teal Sofa */}
          <RoundedBox
            args={[3.2, 0.42, 0.95]}
            radius={0.08}
            position={[0, 0.22, 1.8]}
            castShadow
          >
            <meshStandardMaterial color="#0d9488" roughness={0.75} />
          </RoundedBox>
          <RoundedBox
            args={[3.2, 0.55, 0.24]}
            radius={0.06}
            position={[0, 0.62, 2.15]}
            castShadow
          >
            <meshStandardMaterial color="#0f766e" roughness={0.8} />
          </RoundedBox>

          {/* 2 Collaborative Round Tables + Chairs */}
          {[-1.4, 1.4].map((tx, ti) => (
            <group key={ti} position={[tx, 0, -0.6]}>
              <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.75, 0.75, 0.05, 24]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.36, 0]}>
                <cylinderGeometry args={[0.08, 0.28, 0.7, 16]} />
                <meshStandardMaterial color="#334155" metalness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* =====================================================================
          4. CENTRAL LIFTS LOBBY — SEISMIC LOCKOUT (South-Center Wing: x 15..26, z 13..21)
          ===================================================================== */}
      <group position={[ox + 20.5, 0, oz + 17.0]}>
        {/* Polished Granite Lift Lobby Floor */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[10.4, 0.02, 7.6]} />
          <meshStandardMaterial color="#1e1b4b" roughness={0.35} metalness={0.2} />
        </mesh>

        {/* 3 Brushed-Steel Elevator Shaft Portals on South Wall */}
        {[-3.0, 0, 3.0].map((lx, li) => (
          <group key={li} position={[lx, 0, 3.65]}>
            {/* Outer Steel Frame */}
            <RoundedBox args={[1.85, 2.55, 0.25]} radius={0.02} position={[0, 1.28, 0]}>
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.25} />
            </RoundedBox>
            {/* Closed Twin Lift Doors */}
            {[-0.42, 0.42].map((dx, di) => (
              <mesh key={di} position={[dx, 1.22, -0.14]}>
                <boxGeometry args={[0.78, 2.3, 0.04]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
              </mesh>
            ))}
            {/* Red LED Lockout Header above each Lift */}
            <mesh position={[0, 2.42, -0.15]}>
              <boxGeometry args={[1.45, 0.22, 0.04]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#dc2626"
                emissiveIntensity={1.6}
              />
            </mesh>
          </group>
        ))}

        {/* Holographic Red Lockout Cordon across Lift Lobby */}
        <Text position={[0, 2.8, 1.2]} fontSize={0.38} color="#f87171" anchorX="center">
          SEISMIC LOCKOUT — DO NOT USE LIFTS IN EARTHQUAKE / FIRE
        </Text>
      </group>

      {/* =====================================================================
          5. WEST MAIN EXIT — EXHIBITION ROAD 2.10M DOUBLE DOORS (x=1, z=11)
          ===================================================================== */}
      <group position={[ox + 1.2, 0, oz + 11.0]}>
        {/* Glowing Emerald Exit Portal Archway */}
        <RoundedBox args={[0.35, 2.8, 3.2]} radius={0.04} position={[-0.2, 1.4, 0]}>
          <meshStandardMaterial
            color="#065f46"
            emissive="#10b981"
            emissiveIntensity={0.95}
          />
        </RoundedBox>
        {/* Illuminated ISO Green Exit Sign */}
        <RoundedBox args={[0.18, 0.48, 2.2]} radius={0.03} position={[0.15, 2.65, 0]}>
          <meshStandardMaterial
            color="#10b981"
            emissive="#34d399"
            emissiveIntensity={1.8}
          />
        </RoundedBox>
        <Text
          position={[0.28, 2.65, 0]}
          rotation={[0, Math.PI / 2, 0]}
          fontSize={0.26}
          color="#ecfdf5"
          anchorX="center"
        >
          EXHIBITION RD EXIT (2.10m CLEAR)
        </Text>
      </group>

      {/* =====================================================================
          6. EAST STAIRWELL CORE & DALBY COURT EXIT (x 23..35, z 1..9)
          ===================================================================== */}
      <group position={[ox + 29.0, 0, oz + 5.0]}>
        {/* 10-Step Concrete Staircase Flight */}
        {Array.from({ length: 8 }).map((_, si) => (
          <mesh
            key={si}
            position={[-2.0 + si * 0.45, 0.12 + si * 0.18, -1.2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.45, 0.18, 2.2]} />
            <meshStandardMaterial color="#64748b" roughness={0.8} />
          </mesh>
        ))}
        <Text position={[0, 2.5, -1.2]} fontSize={0.3} color="#fbbf24" anchorX="center">
          DALBY COURT STAIRS (10 STEPS) + 1.12m AUTO DOOR
        </Text>
      </group>

      {/* =====================================================================
          7. CENTRAL SPINE CORRIDOR CEILING LIGHT STRIPS (z=11, x=4..32)
          ===================================================================== */}
      {[-12, -6, 0, 6, 12].map((cx, ci) => (
        <group key={ci} position={[cx, 3.32, 0]}>
          <mesh>
            <boxGeometry args={[2.8, 0.06, 0.35]} />
            <meshStandardMaterial
              color="#e0f2fe"
              emissive="#38bdf8"
              emissiveIntensity={1.1}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Interactive & Auto-Guided First-Person Building Walkthrough Controller
 * Supports:
 * - Auto-Guided Evacuation Drill along the verified green chevron route (with footsteps head-bob + seismic tremor)
 * - Free-Walk WASD / Arrow Keys + Mouse-Drag 360° Look + Crouch (C/Shift) to explore every room!
 */
function BuildingWalkthroughCamera({
  active,
  freeWalkMode,
  quakeActive,
  routeNodes,
  widthM,
  depthM,
  spawnTarget,
  onHudUpdate,
}: {
  active: boolean;
  freeWalkMode: boolean;
  quakeActive: boolean;
  routeNodes: Array<{ x_m: number; z_m: number; label: string }>;
  widthM: number;
  depthM: number;
  spawnTarget: { x_m: number; z_m: number; yaw: number } | null;
  onHudUpdate: (status: string) => void;
}) {
  const { camera, gl } = useThree();
  const progressRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const yawRef = useRef(-Math.PI / 2);
  const pitchRef = useRef(0);
  const draggingRef = useRef(false);
  const lastHudRef = useRef("");

  // Teleport camera whenever user clicks a Room Spawn button or enters walkthrough
  useEffect(() => {
    if (!active) return;
    if (spawnTarget) {
      camera.position.set(
        spawnTarget.x_m - widthM / 2,
        1.68,
        spawnTarget.z_m - depthM / 2
      );
      yawRef.current = spawnTarget.yaw;
      pitchRef.current = 0;
    } else if (routeNodes.length > 0) {
      const start = routeNodes[0];
      camera.position.set(start.x_m - widthM / 2, 1.68, start.z_m - depthM / 2);
    }
  }, [active, spawnTarget, routeNodes, widthM, depthM, camera]);

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    const onMouseDown = () => {
      draggingRef.current = true;
    };
    const onMouseUp = () => {
      draggingRef.current = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      yawRef.current -= e.movementX * 0.0045;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - e.movementY * 0.0045,
        -Math.PI / 2.6,
        Math.PI / 2.6
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const dom = gl.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [active, gl.domElement]);

  useFrame((state, delta) => {
    if (!active) return;
    const t = state.clock.getElapsedTime();
    const keys = keysRef.current;

    const anyMoveKey =
      keys["KeyW"] ||
      keys["ArrowUp"] ||
      keys["KeyS"] ||
      keys["ArrowDown"] ||
      keys["KeyA"] ||
      keys["ArrowLeft"] ||
      keys["KeyD"] ||
      keys["ArrowRight"];

    const isCrouching = keys["KeyC"] || keys["ShiftLeft"] || keys["ShiftRight"];

    // Seismic camera tremor when earthquake is active
    const quakeShakeX = quakeActive ? Math.sin(t * 28) * 0.045 : 0;
    const quakeShakeY = quakeActive ? Math.cos(t * 34) * 0.035 : 0;

    if (!freeWalkMode && !anyMoveKey && routeNodes.length >= 2) {
      // AUTO-GUIDED EVACUATION DRILL ALONG VERIFIED GREEN ROUTE
      progressRef.current = (progressRef.current + delta * 0.11) % 1;
      const fIdx = progressRef.current * (routeNodes.length - 1);
      const idx = Math.floor(fIdx);
      const nextIdx = Math.min(routeNodes.length - 1, idx + 1);
      const alpha = fIdx - idx;

      const p1 = routeNodes[idx];
      const p2 = routeNodes[nextIdx];
      const cx = THREE.MathUtils.lerp(p1.x_m, p2.x_m, alpha) - widthM / 2;
      const cz = THREE.MathUtils.lerp(p1.z_m, p2.z_m, alpha) - depthM / 2;
      const headBob = Math.sin(t * 10) * 0.035;

      camera.position.lerp(
        new THREE.Vector3(cx + quakeShakeX, 1.65 + headBob + quakeShakeY, cz),
        0.16
      );

      const lookNode = routeNodes[nextIdx];
      const targetLook = new THREE.Vector3(
        lookNode.x_m - widthM / 2,
        1.45 + quakeShakeY,
        lookNode.z_m - depthM / 2
      );
      camera.lookAt(targetLook);

      const msg = `AUTO-GUIDED EVACUATION: Passing ${p1.label} ➔ Heading to ${p2.label}`;
      if (lastHudRef.current !== msg) {
        lastHudRef.current = msg;
        onHudUpdate(msg);
      }
    } else {
      // FREE-WALK FIRST-PERSON EXPLORATION (WASD + Mouse Drag Look)
      const speed = (isCrouching ? 2.6 : 4.8) * delta;
      const forward = new THREE.Vector3(
        Math.sin(yawRef.current),
        0,
        Math.cos(yawRef.current)
      ).normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

      if (keys["KeyW"] || keys["ArrowUp"]) {
        camera.position.addScaledVector(forward, speed);
      }
      if (keys["KeyS"] || keys["ArrowDown"]) {
        camera.position.addScaledVector(forward, -speed);
      }
      if (keys["KeyA"] || keys["ArrowLeft"]) {
        camera.position.addScaledVector(right, speed);
      }
      if (keys["KeyD"] || keys["ArrowRight"]) {
        camera.position.addScaledVector(right, -speed);
      }

      // Clamp inside building footprint
      const halfW = widthM / 2 - 0.6;
      const halfD = depthM / 2 - 0.6;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -halfW, halfW);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -halfD, halfD);

      const baseEyeY = isCrouching ? 0.95 : 1.68;
      const walkBob = anyMoveKey ? Math.sin(t * 11) * 0.03 : 0;
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        baseEyeY + walkBob + quakeShakeY,
        0.25
      );

      const lookTarget = new THREE.Vector3(
        camera.position.x + Math.sin(yawRef.current) * Math.cos(pitchRef.current) + quakeShakeX,
        camera.position.y + Math.sin(pitchRef.current) + quakeShakeY,
        camera.position.z + Math.cos(yawRef.current) * Math.cos(pitchRef.current)
      );
      camera.lookAt(lookTarget);

      // Determine which room the occupant is currently inside
      const bx = camera.position.x + widthM / 2;
      const bz = camera.position.z + depthM / 2;
      let zoneLabel = "Central Spine Corridor";
      if (bz < 9 && bx < 12) zoneLabel = "Room 203 — Robotics & Computing Lab";
      else if (bz < 9 && bx >= 12 && bx < 23) zoneLabel = "Room 200 — 350-Seat Lecture Theatre";
      else if (bz < 9 && bx >= 23) zoneLabel = "East Stairwell & Dalby Court Core";
      else if (bz > 13 && bx < 15) zoneLabel = "Breakout Lounge & Accessible Refuge Bay R2";
      else if (bz > 13 && bx >= 15) zoneLabel = "Central Lifts Lobby (Seismic Lockout)";

      const msg = `FREE-WALK IN ${zoneLabel.toUpperCase()} — Follow Green Floor Chevrons to Exit`;
      if (lastHudRef.current !== msg) {
        lastHudRef.current = msg;
        onHudUpdate(msg);
      }
    }
  });

  return null;
}


/**
 * CAGB Route Twin R3F Renderer:
 * Loads slava/route_A/scene.json and uses buildModel(THREE, obj, mats) / makeMaterials
 * from slava/viewer/models.js for each object inside the existing R3F Canvas via <primitive object={group} />.
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
    if (!Array.isArray(scene?.waypoints) || scene.waypoints.length < 2) {
      return FALLBACK_ROUTE_A_SCENE.waypoints!.map((wp) => {
        const { position } = toRouteTwinThreeCoords(wp, 0);
        return [position[0], position[1] + 0.18, position[2]] as [number, number, number];
      });
    }
    return scene.waypoints.map((wp) => {
      const { position } = toRouteTwinThreeCoords(wp, 0);
      return [position[0], position[1] + 0.18, position[2]] as [number, number, number];
    });
  }, [scene]);

  return (
    <group name="cagb-route-twin-root">
      {/* Route A Waypoint Ribbon in [X-150, Z, -(Y-80)] space */}
      {waypointPoints.length >= 2 && (
        <AnimatedBuildingRoute points={waypointPoints} color="#10b981" />
      )}

      {/* Each object from slava/route_A/scene.json rendered via <primitive object={group} /> */}
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
            position={[position[0], position[1] + (obj.size_m?.[2] ?? 1.8) + 0.45, position[2]]}
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

export default function ExitZeroCanvas({
  floorGraph,
  hazards,
  verification,
  walkthroughActive,
  freeWalkMode = true,
  quakeActive: propQuakeActive,
  showRouteTwin = true,
  spawnTarget = null,
  fullScreen = true,
  onHudUpdate,
  onSelectRouteTwinObject,
}: ExitZeroCanvasProps) {
  const { width_m, depth_m } = floorGraph;

  // Earthquake simulation state inside the building twin
  const [internalQuakeActive, setInternalQuakeActive] = useState<boolean>(
    verification.emergency_type === "earthquake"
  );
  const quakeActive = propQuakeActive ?? internalQuakeActive;

  const [routeTwinScene, setRouteTwinScene] = useState<RouteTwinScene>(
    FALLBACK_ROUTE_A_SCENE
  );
  const [slavaViewerModule, setSlavaViewerModule] = useState<{
    makeMaterials?: (T: typeof THREE) => unknown;
    buildModel?: (
      T: typeof THREE,
      obj: RouteTwinObject,
      mats: unknown
    ) => THREE.Object3D;
  } | null>(null);

  // Sync quakeActive when emergency_type changes
  useEffect(() => {
    setInternalQuakeActive(verification.emergency_type === "earthquake");
  }, [verification.emergency_type]);

  // Fetch Slava CAGB Route A Twin scene & viewer models
  useEffect(() => {
    let cancelled = false;
    fetch("/api/route-twin")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.scene?.objects?.length) {
          setRouteTwinScene(data.scene);
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
            if (mod?.buildModel) setSlavaViewerModule(mod);
          } catch {
            // fallback used automatically
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const nodeMap = useMemo(() => {
    const map = new Map<string, { x_m: number; z_m: number; label: string }>();
    floorGraph.nodes.forEach((n) =>
      map.set(n.id, { x_m: n.x_m, z_m: n.z_m, label: n.label })
    );
    return map;
  }, [floorGraph]);

  const verifiedPoints = useMemo(() => {
    if (!verification.verified_safe_route) return [];
    return verification.verified_safe_route.node_ids
      .map((id: string) => nodeMap.get(id))
      .filter((n): n is { x_m: number; z_m: number; label: string } => Boolean(n))
      .map(
        (n) =>
          [n.x_m - width_m / 2, 0.25, n.z_m - depth_m / 2] as [
            number,
            number,
            number
          ]
      );
  }, [verification, nodeMap, width_m, depth_m]);

  const naivePoints = useMemo(() => {
    return verification.naive_shortest_route.node_ids
      .map((id: string) => nodeMap.get(id))
      .filter((n): n is { x_m: number; z_m: number; label: string } => Boolean(n))
      .map(
        (n) =>
          [n.x_m - width_m / 2, 0.18, n.z_m - depth_m / 2] as [
            number,
            number,
            number
          ]
      );
  }, [verification, nodeMap, width_m, depth_m]);

  const routeNodes = useMemo(() => {
    if (!verification.verified_safe_route) return [];
    return verification.verified_safe_route.node_ids
      .map((id: string) => nodeMap.get(id))
      .filter((n): n is { x_m: number; z_m: number; label: string } => Boolean(n));
  }, [verification, nodeMap]);

  return (
    <div
      className={`relative w-full bg-[#050608] overflow-hidden ${
        fullScreen
          ? "h-screen rounded-none border-0"
          : "h-full min-h-[480px] rounded-xl border border-slate-800 shadow-2xl"
      }`}
    >
      <Canvas shadows camera={{ position: [0, 25, 22], fov: 50 }}>
        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", 26, 68]} />
        {!walkthroughActive && (
          <Sky sunPosition={[40, 25, 30]} turbidity={7} rayleigh={1.5} />
        )}

        <ambientLight intensity={0.72} />
        <directionalLight
          castShadow
          position={[18, 30, 16]}
          intensity={1.35}
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight
          position={[0, 10, 0]}
          intensity={quakeActive ? 1.1 : 0.6}
          color={quakeActive ? "#f87171" : "#38bdf8"}
        />

        {/* Building Main Structural Floor Slab */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[width_m, depth_m]} />
          <meshStandardMaterial color="#0f172a" roughness={0.85} />
        </mesh>

        {/* Central Spine Corridor Terrazzo Flooring */}
        <mesh position={[0, 0.01, 0]} receiveShadow>
          <boxGeometry args={[width_m - 2, 0.015, 4.0]} />
          <meshStandardMaterial color="#1e293b" roughness={0.55} />
        </mesh>

        <gridHelper
          args={[Math.max(width_m, depth_m), 36, "#1e293b", "#0f172a"]}
          position={[0, 0.02, 0]}
        />

        {/* Indoor Suspended Ceiling + LED Light Panels when in 1st-Person View */}
        {walkthroughActive && (
          <group position={[0, 3.38, 0]}>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[width_m, 0.08, depth_m]} />
              <meshStandardMaterial color="#1e293b" roughness={0.85} />
            </mesh>
            {[-12, -6, 0, 6, 12].map((lx) =>
              [-6, 0, 6].map((lz) => (
                <mesh
                  key={`${lx}_${lz}`}
                  position={[lx, -0.01, lz]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <planeGeometry args={[1.4, 0.45]} />
                  <meshBasicMaterial
                    color={quakeActive ? "#fca5a5" : "#e0f2fe"}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              ))
            )}
          </group>
        )}

        {/* Slava CAGB Route Twin Objects rendered via <primitive object={group} /> */}
        {showRouteTwin && (
          <CAGBRouteTwinGroup
            scene={routeTwinScene}
            viewerModule={slavaViewerModule}
            onSelectObject={(obj) => {
              onSelectRouteTwinObject?.(obj);
            }}
          />
        )}

        {/* Complete 3D Room Interiors (Lecture Theatre, Robotics Lab, Breakout & Refuge R2, Lifts, Exits) */}
        <BuildingRoomInteriors
          widthM={width_m}
          depthM={depth_m}
          quakeActive={quakeActive}
        />

        {/* Falling Ceiling Plaster & Dust Particles during Earthquake */}
        <BuildingDebrisParticles
          active={quakeActive}
          widthM={width_m}
          depthM={depth_m}
        />

        {/* Extruded 3D Walls & Open Walkable Doorways with Overhead Lintels */}
        {floorGraph.walls.map((w, idx) => {
          const dx = w.x2_m - w.x1_m;
          const dz = w.z2_m - w.z1_m;
          const length = Math.hypot(dx, dz);
          const angle = Math.atan2(dz, dx);
          const cx = (w.x1_m + w.x2_m) / 2 - width_m / 2;
          const cz = (w.z1_m + w.z2_m) / 2 - depth_m / 2;
          const wallH = walkthroughActive ? 3.4 : 2.75;

          if (w.is_doorway) {
            // Render an open walkable doorway with overhead lintel + glass double doors swung open
            return (
              <group
                key={`door-${idx}`}
                position={[cx, 0, cz]}
                rotation={[0, -angle, 0]}
              >
                {/* Overhead Lintel Beam */}
                <mesh position={[0, wallH - 0.35, 0]} castShadow>
                  <boxGeometry args={[length, 0.7, 0.24]} />
                  <meshStandardMaterial color="#334155" roughness={0.6} />
                </mesh>
                {/* Door Frame Jambs */}
                {[-length / 2 + 0.08, length / 2 - 0.08].map((jx, ji) => (
                  <mesh key={ji} position={[jx, (wallH - 0.7) / 2, 0]} castShadow>
                    <boxGeometry args={[0.14, wallH - 0.7, 0.26]} />
                    <meshStandardMaterial color="#0ea5e9" metalness={0.5} />
                  </mesh>
                ))}
                {/* Illuminated Green Doorway Threshold Strip */}
                <mesh position={[0, 0.025, 0]}>
                  <boxGeometry args={[length - 0.2, 0.02, 0.25]} />
                  <meshStandardMaterial
                    color="#10b981"
                    emissive="#10b981"
                    emissiveIntensity={0.8}
                  />
                </mesh>
              </group>
            );
          }

          return (
            <mesh
              key={`wall-${idx}`}
              position={[cx, wallH / 2, cz]}
              rotation={[0, -angle, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[length, wallH, 0.22]} />
              <meshStandardMaterial
                color="#334155"
                roughness={0.55}
                transparent={!walkthroughActive}
                opacity={walkthroughActive ? 0.96 : 0.78}
              />
            </mesh>
          );
        })}

        {/* Navigation Nodes & Semantic Room Markers */}
        {floorGraph.nodes.map((n) => {
          const x = n.x_m - width_m / 2;
          const z = n.z_m - depth_m / 2;
          const isLockedLift =
            n.type === "lift_elevator" && verification.lift_override_triggered;
          const color = isLockedLift
            ? "#ef4444"
            : n.type === "stairwell_exit"
            ? "#10b981"
            : n.type === "accessible_refuge"
            ? "#a855f7"
            : "#38bdf8";

          return (
            <group key={n.id} position={[x, 0.15, z]}>
              <mesh>
                <cylinderGeometry args={[0.42, 0.42, 0.16, 20]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.55}
                />
              </mesh>
              {!walkthroughActive && (
                <Text
                  position={[0, 2.95, 0]}
                  fontSize={0.42}
                  color="#f8fafc"
                  anchorX="center"
                  anchorY="middle"
                >
                  {isLockedLift ? `🔒 ${n.label} (LOCKED)` : n.label}
                </Text>
              )}
            </group>
          );
        })}

        {/* Live Hazard Zones (Toppled Vending Machine, Ceiling Collapse & Smoke) */}
        {hazards.map((h) => {
          const n = nodeMap.get(h.location_node_id);
          if (!n) return null;
          return (
            <DynamicHazardZone
              key={h.id}
              x={n.x_m - width_m / 2}
              z={n.z_m - depth_m / 2}
              spreadRate={h.spread_rate_m_per_s}
              description={h.description}
              quakeActive={quakeActive}
            />
          );
        })}

        {/* Naive Shortest Path (Red Hazard Line — Rejected due to Collapse/Smoke/Lift) */}
        {naivePoints.length >= 2 && (
          <Line
            points={naivePoints}
            color="#ef4444"
            lineWidth={3.5}
            dashed
            dashScale={1.5}
          />
        )}

        {/* Verified Safe Route (Glowing Emerald Ribbon + Animated 3D Directional Chevrons) */}
        {verifiedPoints.length >= 2 && (
          <AnimatedBuildingRoute points={verifiedPoints} color="#10b981" />
        )}

        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.45}
          scale={42}
          blur={2.2}
          far={6}
        />

        <BuildingWalkthroughCamera
          active={walkthroughActive}
          freeWalkMode={freeWalkMode}
          quakeActive={quakeActive}
          routeNodes={routeNodes}
          widthM={width_m}
          depthM={depth_m}
          spawnTarget={spawnTarget}
          onHudUpdate={(s) => onHudUpdate?.(s)}
        />

        {!walkthroughActive && (
          <OrbitControls
            makeDefault
            minPolarAngle={0.15}
            maxPolarAngle={Math.PI / 2 - 0.04}
          />
        )}
      </Canvas>
    </div>
  );
}
