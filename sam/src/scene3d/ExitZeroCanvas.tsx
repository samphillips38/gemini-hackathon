"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Line,
  PerspectiveCamera,
  RoundedBox,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import {
  BuildingFloorGraph,
  EvacuationVerificationResult,
  LiveHazardEvent,
  NavNode,
} from "@/types/contracts";
import {
  getProceduralTexture,
  getProceduralBumpMap,
  getGlassPillTexture,
} from "./proceduralTextures";

export interface ExitZeroCanvasProps {
  graph: BuildingFloorGraph;
  evacPlan: EvacuationVerificationResult;
  liveHazards: LiveHazardEvent[];
  selectedStartNodeId: string;
  onSelectStartNode: (nodeId: string) => void;
  walkthroughMode: boolean;
  onToggleWalkthrough: () => void;
  buildingQuakeActive?: boolean;
}

/**
 * Memory Palace Starfield Dome & Floating Sanctuary Motes for Building Scale
 */
function BuildingAtmosphere({ quakeActive }: { quakeActive: boolean }) {
  const dustRef = useRef<THREE.Points>(null);

  const starMap = useMemo(() => {
    const tex = getProceduralTexture("stars").clone();
    tex.repeat.set(5, 3);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { positions, phases, colors } = useMemo(() => {
    const count = 420;
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const gold = new THREE.Color("#fde68a");
    const emerald = new THREE.Color("#34d399");
    const cyan = new THREE.Color("#38bdf8");

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.sin(i * 91.7) - 0.5) * 44;
      pos[i * 3 + 1] = ((i * 29.3) % 7.5) + 0.3;
      pos[i * 3 + 2] = (Math.cos(i * 53.1) - 0.5) * 30;
      ph[i] = i * 0.37;

      const c = i % 4 === 0 ? emerald : i % 6 === 0 ? cyan : gold;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, phases: ph, colors: col };
  }, []);

  useFrame(({ clock }) => {
    if (!dustRef.current) return;
    const t = clock.getElapsedTime();
    const posAttr = dustRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const speed = quakeActive ? 4.2 : 0.4;
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      const x = posAttr.getX(i) + Math.sin(t * speed + p) * 0.004;
      let y = posAttr.getY(i) + (quakeActive ? 0.018 : 0.0022);
      const z = posAttr.getZ(i) + Math.cos(t * speed + p) * 0.004;
      if (y > 7.8) y = 0.25;
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[95, 32, 24]} />
        <meshBasicMaterial map={starMap} side={THREE.BackSide} fog={false} />
      </mesh>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={quakeActive ? 0.12 : 0.085}
          vertexColors
          transparent
          opacity={quakeActive ? 0.85 : 0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

/**
 * Memory Palace Architectural Wall Extrusion with Ashlar Stone, Dark Slate Baseboards,
 * and Brushed Gold Crown Moldings (`#d4af37`)
 */
function ExtrudedWallSegment({
  x1,
  z1,
  x2,
  z2,
  heightM,
  isDoorway,
  widthM,
  depthM,
  stoneTex,
  stoneBump,
}: {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  heightM: number;
  isDoorway?: boolean;
  widthM: number;
  depthM: number;
  stoneTex: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
}) {
  if (isDoorway) {
    // Render a Memory Palace Gold Portal Architrave Lintels above doorway openings!
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const midX = (x1 + x2) / 2 - widthM / 2;
    const midZ = (z1 + z2) / 2 - depthM / 2;
    const angle = Math.atan2(dz, dx);
    return (
      <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
        <mesh position={[0, heightM - 0.22, 0]} castShadow>
          <boxGeometry args={[length, 0.44, 0.24]} />
          <meshStandardMaterial color="#d4af37" metalness={0.86} roughness={0.22} />
        </mesh>
      </group>
    );
  }

  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return null;

  const midX = (x1 + x2) / 2 - widthM / 2;
  const midZ = (z1 + z2) / 2 - depthM / 2;
  const angle = Math.atan2(dz, dx);
  const isExterior = heightM >= 3.15;
  const thickness = isExterior ? 0.28 : 0.18;

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      <mesh position={[0, heightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, heightM, thickness]} />
        <meshStandardMaterial
          map={stoneTex}
          bumpMap={stoneBump}
          bumpScale={0.02}
          color={isExterior ? "#334155" : "#475569"}
          roughness={0.58}
          metalness={0.12}
        />
      </mesh>
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <boxGeometry args={[length + 0.02, 0.18, thickness + 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.38} metalness={0.3} />
      </mesh>
      <mesh position={[0, heightM + 0.025, 0]}>
        <boxGeometry args={[length + 0.04, 0.05, thickness + 0.05]} />
        <meshStandardMaterial
          color={isExterior ? "#d4af37" : "#94a3b8"}
          metalness={0.86}
          roughness={0.22}
        />
      </mesh>
    </group>
  );
}

/**
 * Rich 3D Architectural Wing Interiors with Procedural Textures, Gold Medallions & Glassmorphic Plaques
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

  const labRackDangerRef = useRef<THREE.Group>(null);
  const chandelierRefs = useRef<Array<THREE.Group | null>>([]);

  const { cyberTex, carpetTex, woodTex, marbleTex } = useMemo(() => {
    const cy = getProceduralTexture("cyber").clone();
    cy.repeat.set(3, 2);
    cy.needsUpdate = true;

    const ca = getProceduralTexture("carpet").clone();
    ca.repeat.set(2, 2);
    ca.needsUpdate = true;

    const wo = getProceduralTexture("wood").clone();
    wo.repeat.set(3, 2);
    wo.needsUpdate = true;

    const ma = getProceduralTexture("marble").clone();
    ma.repeat.set(2, 2);
    ma.needsUpdate = true;

    return { cyberTex: cy, carpetTex: ca, woodTex: wo, marbleTex: ma };
  }, []);

  const wingSprites = useMemo(
    () => ({
      lab: getGlassPillTexture({
        badge: "203",
        title: "Robotics & AI Lab",
        subtitle: "North-West Wing • High-Voltage Racks",
        accentColor: "#38bdf8",
        badgeBg: "#0284c7",
      }),
      theatre: getGlassPillTexture({
        badge: "200",
        title: "Main Lecture Theatre",
        subtitle: "North-Center Wing • 350 Seats",
        accentColor: "#f59e0b",
        badgeBg: "#d97706",
      }),
      refuge: getGlassPillTexture({
        badge: "REF",
        title: "Accessible Refuge Bay R2",
        subtitle: "60-Min Fire Core + 2-Way Intercom",
        accentColor: "#a855f7",
        badgeBg: "#7e22ce",
      }),
      lifts: getGlassPillTexture({
        badge: "LOCK",
        title: "Central Lifts Lobby",
        subtitle: "SEISMIC LOCKOUT • Do Not Use",
        accentColor: "#ef4444",
        badgeBg: "#dc2626",
      }),
      westExit: getGlassPillTexture({
        badge: "EXIT",
        title: "Exhibition Rd Double Doors",
        subtitle: "2.10m Step-Free Primary Egress",
        accentColor: "#10b981",
        badgeBg: "#059669",
      }),
      eastStairs: getGlassPillTexture({
        badge: "STAIR",
        title: "Dalby Court Stair Core",
        subtitle: "10 Steps • Blocked by Debris",
        accentColor: "#ef4444",
        badgeBg: "#b45309",
      }),
    }),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (labRackDangerRef.current) {
      const targetTilt = quakeActive ? 0.42 + Math.sin(t * 18) * 0.08 : 0.06;
      labRackDangerRef.current.rotation.z = THREE.MathUtils.lerp(
        labRackDangerRef.current.rotation.z,
        targetTilt,
        0.12
      );
    }

    chandelierRefs.current.forEach((ch, idx) => {
      if (!ch) return;
      ch.rotation.z = quakeActive
        ? Math.sin(t * 15 + idx) * 0.22
        : Math.sin(t * 1.2 + idx) * 0.015;
    });
  });

  return (
    <group>
      {/* 1. ROBOTICS & AI LAB — ROOM 203 */}
      <group position={[ox + 6.5, 0, oz + 5.0]}>
        <mesh position={[0, 0.018, 0]} receiveShadow>
          <boxGeometry args={[10.6, 0.025, 7.6]} />
          <meshStandardMaterial
            map={cyberTex}
            roughness={0.35}
            metalness={0.22}
          />
        </mesh>

        <sprite position={[0, 3.85, 0]} scale={[3.8, 0.95, 1]}>
          <spriteMaterial
            map={wingSprites.lab}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>

        {[-2.2, 1.8].map((bx, bi) => (
          <group key={bi} position={[bx, 0, -1.2]}>
            <RoundedBox
              args={[3.2, 0.08, 1.3]}
              radius={0.02}
              position={[0, 0.82, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#0f766e"
                roughness={0.32}
                metalness={0.2}
              />
            </RoundedBox>
            {[
              [-1.4, -0.5],
              [1.4, -0.5],
              [-1.4, 0.5],
              [1.4, 0.5],
            ].map(([lx, lz], li) => (
              <mesh key={li} position={[lx, 0.41, lz]} castShadow>
                <boxGeometry args={[0.08, 0.82, 0.08]} />
                <meshStandardMaterial
                  color="#cbd5e1"
                  metalness={0.8}
                  roughness={0.2}
                />
              </mesh>
            ))}

            {[-0.8, 0.8].map((mx, mi) => (
              <group key={mi} position={[mx, 1.12, -0.25]}>
                <RoundedBox args={[0.72, 0.42, 0.04]} radius={0.01} castShadow>
                  <meshStandardMaterial color="#0f172a" roughness={0.25} />
                </RoundedBox>
                <mesh position={[0, 0, 0.022]}>
                  <planeGeometry args={[0.66, 0.36]} />
                  <meshStandardMaterial
                    color="#38bdf8"
                    emissive="#0284c7"
                    emissiveIntensity={0.95}
                  />
                </mesh>
              </group>
            ))}

            <group position={[0, 0.86, 0.15]}>
              <mesh position={[0, 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.2, 0.16, 16]} />
                <meshStandardMaterial
                  color="#d4af37"
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
              <mesh
                position={[0, 0.35, 0]}
                rotation={[0, 0, 0.28]}
                castShadow
              >
                <cylinderGeometry args={[0.055, 0.065, 0.5, 12]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  metalness={0.6}
                  roughness={0.25}
                />
              </mesh>
              <mesh
                position={[0.18, 0.62, 0]}
                rotation={[0, 0, -0.6]}
                castShadow
              >
                <cylinderGeometry args={[0.045, 0.055, 0.42, 12]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  metalness={0.65}
                  roughness={0.22}
                />
              </mesh>
            </group>
          </group>
        ))}

        {[-2.2, 0, 2.2].map((rz, ri) => (
          <group
            key={ri}
            ref={ri === 2 ? labRackDangerRef : undefined}
            position={[4.2, 0, rz]}
          >
            <RoundedBox
              args={[0.85, 2.25, 0.95]}
              radius={0.03}
              position={[0, 1.125, 0]}
              castShadow
            >
              <meshStandardMaterial
                color={ri === 2 ? "#7f1d1d" : "#1e293b"}
                metalness={0.65}
                roughness={0.3}
              />
            </RoundedBox>
            {[0.4, 0.8, 1.2, 1.6, 2.0].map((ly, li) => (
              <mesh key={li} position={[-0.43, ly, 0]}>
                <boxGeometry args={[0.02, 0.06, 0.72]} />
                <meshStandardMaterial
                  color={ri === 2 ? "#ef4444" : "#38bdf8"}
                  emissive={ri === 2 ? "#dc2626" : "#0284c7"}
                  emissiveIntensity={1.4}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* 2. MAIN LECTURE THEATRE — ROOM 200 */}
      <group position={[ox + 17.5, 0, oz + 5.0]}>
        <mesh position={[0, 0.018, 0]} receiveShadow>
          <boxGeometry args={[10.4, 0.025, 7.6]} />
          <meshStandardMaterial map={carpetTex} roughness={0.78} />
        </mesh>

        <sprite position={[0, 3.85, 0]} scale={[3.8, 0.95, 1]}>
          <spriteMaterial
            map={wingSprites.theatre}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>

        <mesh position={[0, 1.85, -3.66]}>
          <boxGeometry args={[7.0, 2.2, 0.05]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.85}
            roughness={0.22}
          />
        </mesh>
        <mesh position={[0, 1.85, -3.62]}>
          <boxGeometry args={[6.8, 2.0, 0.04]} />
          <meshStandardMaterial
            color="#e0f2fe"
            emissive="#0284c7"
            emissiveIntensity={0.48}
            roughness={0.2}
          />
        </mesh>

        <RoundedBox
          args={[7.2, 0.22, 1.5]}
          radius={0.03}
          position={[0, 0.11, -2.75]}
          receiveShadow
        >
          <meshStandardMaterial color="#1e293b" roughness={0.55} />
        </RoundedBox>
        <RoundedBox
          args={[0.95, 1.15, 0.65]}
          radius={0.03}
          position={[2.1, 0.75, -2.55]}
          castShadow
        >
          <meshStandardMaterial color="#5c2d0c" roughness={0.4} />
        </RoundedBox>

        {[
          { dz: -1.1, y: 0.08 },
          { dz: 0.1, y: 0.24 },
          { dz: 1.3, y: 0.4 },
          { dz: 2.5, y: 0.56 },
        ].map((tier, ti) => (
          <group key={ti} position={[0, tier.y, tier.dz]}>
            <mesh position={[0, -tier.y / 2, 0]} receiveShadow>
              <boxGeometry args={[8.8, tier.y + 0.04, 1.05]} />
              <meshStandardMaterial color="#1e293b" roughness={0.75} />
            </mesh>
            {[-2.4, 2.4].map((bankX, bi) => (
              <group key={bi} position={[bankX, 0, 0]}>
                <RoundedBox
                  args={[3.4, 0.06, 0.38]}
                  radius={0.015}
                  position={[0, 0.72, -0.22]}
                  castShadow
                >
                  <meshStandardMaterial color="#78350f" roughness={0.4} />
                </RoundedBox>
                {[-1.2, -0.4, 0.4, 1.2].map((sx, si) => (
                  <group key={si} position={[sx, 0, 0.15]}>
                    <RoundedBox
                      args={[0.52, 0.1, 0.46]}
                      radius={0.03}
                      position={[0, 0.44, 0]}
                      castShadow
                    >
                      <meshStandardMaterial color="#9f1239" roughness={0.55} />
                    </RoundedBox>
                    <RoundedBox
                      args={[0.52, 0.52, 0.09]}
                      radius={0.03}
                      position={[0, 0.72, 0.2]}
                      castShadow
                    >
                      <meshStandardMaterial color="#881337" roughness={0.55} />
                    </RoundedBox>
                  </group>
                ))}
              </group>
            ))}
          </group>
        ))}
      </group>

      {/* 3. BREAKOUT LOUNGE & ACCESSIBLE REFUGE BAY R2 */}
      <group position={[ox + 8.0, 0, oz + 17.0]}>
        <mesh position={[0, 0.018, 0]} receiveShadow>
          <boxGeometry args={[13.6, 0.025, 7.6]} />
          <meshStandardMaterial
            map={woodTex}
            roughness={0.36}
            metalness={0.08}
          />
        </mesh>

        <group position={[-4.0, 0, 0]}>
          <RoundedBox
            args={[3.4, 0.04, 3.4]}
            radius={0.02}
            position={[0, 0.03, 0]}
            receiveShadow
          >
            <meshStandardMaterial
              color="#581c87"
              emissive="#9333ea"
              emissiveIntensity={0.65}
              roughness={0.35}
            />
          </RoundedBox>
          <RoundedBox
            args={[0.35, 1.65, 0.25]}
            radius={0.03}
            position={[-1.4, 0.85, -1.2]}
            castShadow
          >
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.85}
              roughness={0.22}
            />
          </RoundedBox>
          <sprite position={[0, 3.4, 0]} scale={[3.8, 0.95, 1]}>
            <spriteMaterial
              map={wingSprites.refuge}
              transparent
              depthTest={false}
              depthWrite={false}
            />
          </sprite>
        </group>

        <group position={[2.2, 0, 0]}>
          <RoundedBox
            args={[3.2, 0.42, 0.95]}
            radius={0.08}
            position={[0, 0.22, 1.8]}
            castShadow
          >
            <meshStandardMaterial color="#0d9488" roughness={0.6} />
          </RoundedBox>
          <RoundedBox
            args={[3.2, 0.55, 0.24]}
            radius={0.06}
            position={[0, 0.62, 2.15]}
            castShadow
          >
            <meshStandardMaterial color="#0f766e" roughness={0.65} />
          </RoundedBox>

          {[-1.4, 1.4].map((tx, ti) => (
            <group key={ti} position={[tx, 0, -0.6]}>
              <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.78, 0.78, 0.05, 28]} />
                <meshStandardMaterial
                  map={marbleTex}
                  roughness={0.22}
                  metalness={0.15}
                />
              </mesh>
              <mesh position={[0, 0.36, 0]}>
                <cylinderGeometry args={[0.08, 0.28, 0.7, 16]} />
                <meshStandardMaterial
                  color="#d4af37"
                  metalness={0.88}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* 4. CENTRAL LIFTS LOBBY — SEISMIC LOCKOUT */}
      <group position={[ox + 20.5, 0, oz + 17.0]}>
        <mesh position={[0, 0.018, 0]} receiveShadow>
          <boxGeometry args={[10.4, 0.025, 7.6]} />
          <meshStandardMaterial
            color="#1e1b4b"
            roughness={0.3}
            metalness={0.25}
          />
        </mesh>

        {[-3.0, 0, 3.0].map((lx, li) => (
          <group key={li} position={[lx, 0, 3.65]}>
            <RoundedBox
              args={[1.85, 2.55, 0.25]}
              radius={0.02}
              position={[0, 1.28, 0]}
            >
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.85}
                roughness={0.22}
              />
            </RoundedBox>
            {[-0.42, 0.42].map((dx, di) => (
              <mesh key={di} position={[dx, 1.22, -0.14]}>
                <boxGeometry args={[0.78, 2.3, 0.04]} />
                <meshStandardMaterial
                  color="#94a3b8"
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
            ))}
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

        <sprite position={[0, 3.6, 1.2]} scale={[3.8, 0.95, 1]}>
          <spriteMaterial
            map={wingSprites.lifts}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      </group>

      {/* 5. WEST MAIN EXIT — EXHIBITION ROAD 2.10M GRAND PORTAL */}
      <group position={[ox + 1.2, 0, oz + 11.0]}>
        <RoundedBox
          args={[0.42, 3.1, 3.5]}
          radius={0.04}
          position={[-0.22, 1.55, 0]}
        >
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.88}
            roughness={0.2}
          />
        </RoundedBox>
        <RoundedBox
          args={[0.35, 2.8, 3.1]}
          radius={0.04}
          position={[-0.15, 1.4, 0]}
        >
          <meshStandardMaterial
            color="#065f46"
            emissive="#10b981"
            emissiveIntensity={1.1}
          />
        </RoundedBox>
        <sprite position={[0.4, 3.8, 0]} scale={[3.8, 0.95, 1]}>
          <spriteMaterial
            map={wingSprites.westExit}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      </group>

      {/* 6. EAST STAIRWELL CORE & DALBY COURT EXIT */}
      <group position={[ox + 29.0, 0, oz + 5.0]}>
        {Array.from({ length: 8 }).map((_, si) => (
          <mesh
            key={si}
            position={[-2.0 + si * 0.45, 0.12 + si * 0.18, -1.2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.45, 0.18, 2.2]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
          </mesh>
        ))}
        <sprite position={[0, 3.6, -1.2]} scale={[3.6, 0.9, 1]}>
          <spriteMaterial
            map={wingSprites.eastStairs}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      </group>

      {/* 7. CENTRAL SPINE CORRIDOR COMPASS MEDALLIONS & CHANDELIERS */}
      {[-11, -3.5, 4, 11.5].map((cx, ci) => (
        <group key={ci} position={[cx, 0, 0]}>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 0.98, 40]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.38, 0.45, 32]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#059669"
              emissiveIntensity={0.6}
            />
          </mesh>

          <group
            ref={(el) => {
              chandelierRefs.current[ci] = el;
            }}
            position={[0, 3.35, 0]}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.65, 0.035, 12, 32]} />
              <meshStandardMaterial
                color="#d4af37"
                metalness={0.9}
                roughness={0.18}
              />
            </mesh>
            <mesh position={[0, -0.1, 0]}>
              <octahedronGeometry args={[0.14, 0]} />
              <meshStandardMaterial
                color="#fef3c7"
                emissive="#fbbf24"
                emissiveIntensity={1.3}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * Interactive & Auto-Guided First-Person Building Walkthrough Controller
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
  routeNodes: NavNode[];
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
      yawRef.current -= e.movementX * 0.0036;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - e.movementY * 0.0028,
        -Math.PI / 2.8,
        Math.PI / 2.8
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
  }, [active, gl]);

  useFrame((_, delta) => {
    if (!active) return;

    const crouch =
      keysRef.current["KeyC"] ||
      keysRef.current["ShiftLeft"] ||
      keysRef.current["ControlLeft"];
    const baseHeight = crouch ? 0.92 : 1.68;
    const tremor = quakeActive
      ? Math.sin(performance.now() * 0.048) * 0.075
      : 0;

    if (freeWalkMode) {
      const speed = (crouch ? 3.2 : 5.5) * delta;
      const forward = new THREE.Vector3(
        -Math.sin(yawRef.current),
        0,
        -Math.cos(yawRef.current)
      ).normalize();
      const right = new THREE.Vector3(
        Math.cos(yawRef.current),
        0,
        -Math.sin(yawRef.current)
      ).normalize();

      let moved = false;
      if (keysRef.current["KeyW"] || keysRef.current["ArrowUp"]) {
        camera.position.addScaledVector(forward, speed);
        moved = true;
      }
      if (keysRef.current["KeyS"] || keysRef.current["ArrowDown"]) {
        camera.position.addScaledVector(forward, -speed);
        moved = true;
      }
      if (keysRef.current["KeyA"] || keysRef.current["ArrowLeft"]) {
        camera.position.addScaledVector(right, -speed);
        moved = true;
      }
      if (keysRef.current["KeyD"] || keysRef.current["ArrowRight"]) {
        camera.position.addScaledVector(right, speed);
        moved = true;
      }

      camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        -widthM / 2 + 1.2,
        widthM / 2 - 1.2
      );
      camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        -depthM / 2 + 1.2,
        depthM / 2 - 1.2
      );

      const bob = moved ? Math.sin(performance.now() * 0.012) * 0.04 : 0;
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        baseHeight + bob + tremor,
        0.22
      );

      const lookTarget = new THREE.Vector3(
        camera.position.x -
          Math.sin(yawRef.current) * Math.cos(pitchRef.current),
        camera.position.y + Math.sin(pitchRef.current),
        camera.position.z -
          Math.cos(yawRef.current) * Math.cos(pitchRef.current)
      );
      camera.lookAt(lookTarget);

      const status =
        "FREE-WALK EXPLORER — WASD / Arrows to walk inside any room, Drag mouse 360° look, C to crouch";
      if (lastHudRef.current !== status) {
        lastHudRef.current = status;
        onHudUpdate(status);
      }
      return;
    }

    if (routeNodes.length < 2) return;
    progressRef.current = (progressRef.current + delta * 0.16) % 1;
    const totalSegments = routeNodes.length - 1;
    const exactIndex = progressRef.current * totalSegments;
    const segIdx = Math.min(Math.floor(exactIndex), totalSegments - 1);
    const localT = exactIndex - segIdx;

    const curr = routeNodes[segIdx];
    const next = routeNodes[segIdx + 1];

    const cx = THREE.MathUtils.lerp(curr.x_m, next.x_m, localT) - widthM / 2;
    const cz = THREE.MathUtils.lerp(curr.z_m, next.z_m, localT) - depthM / 2;
    const bob = Math.sin(progressRef.current * Math.PI * 18) * 0.04;

    camera.position.set(cx, baseHeight + bob + tremor, cz);

    const lookX = next.x_m - widthM / 2;
    const lookZ = next.z_m - depthM / 2;
    camera.lookAt(lookX, baseHeight - 0.12, lookZ);

    const status = `AUTO-EVACUATION DRILL: ${curr.label} → ${next.label}`;
    if (lastHudRef.current !== status) {
      lastHudRef.current = status;
      onHudUpdate(status);
    }
  });

  return null;
}

/**
 * Memory Palace Catmull-Rom 3D Glowing Evacuation Tube + Floating Octahedron Diamond Beacons
 */
function AnimatedBuildingRoute({
  points3D,
}: {
  points3D: Array<[number, number, number]>;
}) {
  const beaconGroupRef = useRef<THREE.Group>(null);

  const { tubeGeo, beaconPositions } = useMemo(() => {
    if (points3D.length < 2) {
      return { tubeGeo: null, beaconPositions: [] as THREE.Vector3[] };
    }
    const vecs = points3D.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.18);
    const tube = new THREE.TubeGeometry(curve, 80, 0.12, 16, false);

    const totalLen = curve.getLength();
    const count = Math.max(6, Math.min(18, Math.floor(totalLen / 2.2)));
    const beacons: THREE.Vector3[] = [];
    for (let i = 1; i <= count; i++) {
      beacons.push(curve.getPointAt(i / (count + 1)));
    }
    return { tubeGeo: tube, beaconPositions: beacons };
  }, [points3D]);

  useFrame(({ clock }) => {
    if (!beaconGroupRef.current) return;
    const t = clock.getElapsedTime();
    beaconGroupRef.current.children.forEach((child, idx) => {
      child.position.y = 0.42 + Math.sin(t * 4.2 - idx * 0.65) * 0.08;
      child.rotation.y = t * 2.2 + idx * 0.4;
    });
  });

  if (!tubeGeo) return null;

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          color="#10b981"
          emissive="#059669"
          emissiveIntensity={1.6}
          roughness={0.18}
        />
      </mesh>

      <group ref={beaconGroupRef}>
        {beaconPositions.map((pt, idx) => (
          <mesh key={idx} position={[pt.x, 0.42, pt.z]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial
              color="#fde68a"
              emissive="#10b981"
              emissiveIntensity={1.5}
              metalness={0.5}
              roughness={0.15}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Building-Scale Seismic Ground-Motion Wrapper
 */
function BuildingSeismicShakeWrapper({
  quakeActive,
  children,
}: {
  quakeActive: boolean;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (quakeActive) {
      const t = clock.getElapsedTime();
      groupRef.current.position.x =
        Math.sin(t * 32) * 0.14 + Math.cos(t * 19) * 0.06;
      groupRef.current.position.z =
        Math.cos(t * 27) * 0.12 + Math.sin(t * 15) * 0.05;
    } else {
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        0,
        0.18
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        0,
        0.18
      );
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function ExitZeroCanvas({
  graph,
  evacPlan,
  liveHazards,
  selectedStartNodeId,
  onSelectStartNode,
  walkthroughMode,
  onToggleWalkthrough,
  buildingQuakeActive = false,
}: ExitZeroCanvasProps) {
  const { width_m, depth_m } = graph;
  const [freeWalkMode, setFreeWalkMode] = useState(false);
  const [spawnTarget, setSpawnTarget] = useState<{
    x_m: number;
    z_m: number;
    yaw: number;
  } | null>(null);
  const [hudStatus, setHudStatus] = useState(
    "AUTO-EVACUATION DRILL: Following verified green route to step-free exit"
  );

  const { marbleTex, marbleBump, stoneTex, stoneBump } = useMemo(() => {
    const mTex = getProceduralTexture("marble").clone();
    mTex.repeat.set(8, 5);
    mTex.needsUpdate = true;

    const mBump = getProceduralBumpMap("marble").clone();
    mBump.repeat.set(8, 5);
    mBump.needsUpdate = true;

    const sTex = getProceduralTexture("stone").clone();
    sTex.repeat.set(3, 1);
    sTex.needsUpdate = true;

    const sBump = getProceduralBumpMap("stone").clone();
    sBump.repeat.set(3, 1);
    sBump.needsUpdate = true;

    return {
      marbleTex: mTex,
      marbleBump: mBump,
      stoneTex: sTex,
      stoneBump: sBump,
    };
  }, []);

  const nodeMap = useMemo(() => {
    const m = new Map<string, NavNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph.nodes]);

  const activeNodeIds = useMemo(
    () => evacPlan.verified_safe_route?.node_ids ?? [],
    [evacPlan.verified_safe_route]
  );

  const destinationNodeId =
    activeNodeIds.length > 0 ? activeNodeIds[activeNodeIds.length - 1] : null;

  const activeRoutePoints3D = useMemo(() => {
    const pts: Array<[number, number, number]> = [];
    for (const nid of activeNodeIds) {
      const n = nodeMap.get(nid);
      if (n) {
        pts.push([n.x_m - width_m / 2, 0.14, n.z_m - depth_m / 2]);
      }
    }
    return pts;
  }, [activeNodeIds, nodeMap, width_m, depth_m]);

  const rejectedRoutePoints3D = useMemo(() => {
    const pts: Array<[number, number, number]> = [];
    for (const nid of evacPlan.naive_shortest_route.node_ids) {
      const n = nodeMap.get(nid);
      if (n) {
        pts.push([n.x_m - width_m / 2, 0.08, n.z_m - depth_m / 2]);
      }
    }
    return pts;
  }, [evacPlan.naive_shortest_route.node_ids, nodeMap, width_m, depth_m]);

  const walkthroughNodes = useMemo(() => {
    return activeNodeIds
      .map((nid: string) => nodeMap.get(nid))
      .filter((n): n is NavNode => Boolean(n));
  }, [activeNodeIds, nodeMap]);

  const handleTeleportRoom = (x_m: number, z_m: number, yaw: number) => {
    setSpawnTarget({ x_m, z_m, yaw });
    setFreeWalkMode(true);
    if (!walkthroughMode) {
      onToggleWalkthrough();
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050811]">
      {/* Sleek 1st-Person Walkthrough Sub-Bar */}
      {walkthroughMode && (
        <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2 bg-slate-950/90 backdrop-blur-xl border border-emerald-400/40 px-4 py-2 rounded-2xl shadow-2xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-semibold text-emerald-100">
            {hudStatus}
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={() => {
                setSpawnTarget(null);
                setFreeWalkMode(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                !freeWalkMode
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Auto-Evac Drill
            </button>
            <button
              onClick={() => setFreeWalkMode(true)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                freeWalkMode
                  ? "bg-sky-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              WASD Explorer
            </button>
            <button
              onClick={() => handleTeleportRoom(6.5, 5.5, 0)}
              className="px-2 py-1 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Lab 203
            </button>
            <button
              onClick={() => handleTeleportRoom(17.5, 6.8, 0)}
              className="px-2 py-1 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Theatre 200
            </button>
            <button
              onClick={() => handleTeleportRoom(4.5, 17.0, 0)}
              className="px-2 py-1 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Refuge R2
            </button>
            <button
              onClick={onToggleWalkthrough}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600"
            >
              Orbital View
            </button>
          </div>
        </div>
      )}

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#050811"]} />
        <fogExp2 attach="fog" args={["#050811", 0.015]} />

        <PerspectiveCamera makeDefault position={[0, 23, 21]} fov={45} />

        {!walkthroughMode && (
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={6}
            maxDistance={46}
            maxPolarAngle={Math.PI / 2 - 0.04}
            target={[0, 0.5, 0]}
            dampingFactor={0.06}
          />
        )}

        <BuildingWalkthroughCamera
          active={walkthroughMode}
          freeWalkMode={freeWalkMode}
          quakeActive={buildingQuakeActive}
          routeNodes={walkthroughNodes}
          widthM={width_m}
          depthM={depth_m}
          spawnTarget={spawnTarget}
          onHudUpdate={setHudStatus}
        />

        <ambientLight intensity={0.62} color="#e2e8f0" />
        <hemisphereLight
          intensity={0.55}
          color="#fef3c7"
          groundColor="#0f172a"
        />
        <directionalLight
          position={[14, 28, 16]}
          intensity={1.65}
          color="#fffbeb"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight
          position={[-14, 18, -12]}
          intensity={0.55}
          color="#38bdf8"
        />

        <BuildingAtmosphere quakeActive={buildingQuakeActive} />

        <ContactShadows
          position={[0, 0.005, 0]}
          opacity={0.5}
          scale={42}
          blur={2.2}
          far={6}
        />

        <BuildingSeismicShakeWrapper quakeActive={buildingQuakeActive}>
          <RoundedBox
            args={[width_m + 1.2, 0.32, depth_m + 1.2]}
            radius={0.08}
            position={[0, -0.22, 0]}
            receiveShadow
          >
            <meshStandardMaterial
              color="#0f172a"
              roughness={0.4}
              metalness={0.3}
            />
          </RoundedBox>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[width_m + 0.6, 0.04, depth_m + 0.6]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>

          <mesh position={[0, -0.02, 0]} receiveShadow>
            <boxGeometry args={[width_m, 0.06, depth_m]} />
            <meshStandardMaterial
              map={marbleTex}
              bumpMap={marbleBump}
              bumpScale={0.015}
              color="#cbd5e1"
              roughness={0.32}
              metalness={0.12}
            />
          </mesh>

          <BuildingRoomInteriors
            widthM={width_m}
            depthM={depth_m}
            quakeActive={buildingQuakeActive}
          />

          {graph.walls.map((w, idx) => (
            <ExtrudedWallSegment
              key={idx}
              x1={w.x1_m}
              z1={w.z1_m}
              x2={w.x2_m}
              z2={w.z2_m}
              heightM={w.height_m}
              isDoorway={w.is_doorway}
              widthM={width_m}
              depthM={depth_m}
              stoneTex={stoneTex}
              stoneBump={stoneBump}
            />
          ))}

          {graph.nodes.map((node) => {
            const nx = node.x_m - width_m / 2;
            const nz = node.z_m - depth_m / 2;
            const isSelected = node.id === selectedStartNodeId;
            const isDestination = node.id === destinationNodeId;

            const color = isSelected
              ? "#38bdf8"
              : isDestination
                ? "#10b981"
                : node.type === "accessible_refuge"
                  ? "#a855f7"
                  : node.type === "lift_elevator"
                    ? "#ef4444"
                    : node.type === "stairwell_exit"
                      ? "#f59e0b"
                      : "#94a3b8";

            return (
              <group
                key={node.id}
                position={[nx, 0.08, nz]}
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    node.type === "room" ||
                    node.type === "corridor_junction"
                  ) {
                    onSelectStartNode(node.id);
                  }
                }}
              >
                <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry
                    args={[
                      isSelected || isDestination ? 0.85 : 0.55,
                      isSelected || isDestination ? 1.05 : 0.68,
                      36,
                    ]}
                  />
                  <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={isSelected || isDestination ? 0.85 : 0.45}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                <mesh position={[0, 0.14, 0]} castShadow>
                  <cylinderGeometry
                    args={[
                      isSelected || isDestination ? 0.52 : 0.34,
                      isSelected || isDestination ? 0.62 : 0.42,
                      0.28,
                      24,
                    ]}
                  />
                  <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={isSelected || isDestination ? 0.85 : 0.3}
                    metalness={0.4}
                    roughness={0.25}
                  />
                </mesh>

                <mesh position={[0, 0.29, 0]}>
                  <cylinderGeometry
                    args={[
                      isSelected || isDestination ? 0.54 : 0.36,
                      isSelected || isDestination ? 0.54 : 0.36,
                      0.03,
                      24,
                    ]}
                  />
                  <meshStandardMaterial
                    color="#d4af37"
                    metalness={0.9}
                    roughness={0.18}
                  />
                </mesh>

                {(isSelected || isDestination) && (
                  <Text
                    position={[0, 1.45, 0]}
                    fontSize={0.34}
                    color={isSelected ? "#bae6fd" : "#a7f3d0"}
                    anchorX="center"
                    anchorY="middle"
                  >
                    {isSelected
                      ? `YOU ARE HERE (${node.label})`
                      : `SAFE TARGET (${node.label})`}
                  </Text>
                )}
              </group>
            );
          })}

          {rejectedRoutePoints3D.length >= 2 && (
            <Line
              points={rejectedRoutePoints3D}
              color="#ef4444"
              lineWidth={3}
              dashed
              dashSize={0.6}
              gapSize={0.4}
            />
          )}

          <AnimatedBuildingRoute points3D={activeRoutePoints3D} />

          {liveHazards.map((hz) => {
            const hNode = nodeMap.get(hz.location_node_id);
            const hx = (hNode?.x_m ?? 27) - width_m / 2;
            const hzCoord = (hNode?.z_m ?? 11) - depth_m / 2;
            const radiusM = 2.6;
            return (
              <group key={hz.id} position={[hx, 0, hzCoord]}>
                <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[radiusM * 0.82, radiusM, 40]} />
                  <meshBasicMaterial
                    color="#ef4444"
                    transparent
                    opacity={0.75}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh position={[0, 0.65, 0]}>
                  <cylinderGeometry
                    args={[radiusM, radiusM, 1.3, 32, 1, true]}
                  />
                  <meshStandardMaterial
                    color="#ef4444"
                    emissive="#dc2626"
                    emissiveIntensity={0.85}
                    transparent
                    opacity={0.22}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <Text
                  position={[0, 1.95, 0]}
                  fontSize={0.32}
                  color="#fecaca"
                  anchorX="center"
                >
                  {`HAZARD: ${hz.description.slice(0, 48)}...`}
                </Text>
              </group>
            );
          })}
        </BuildingSeismicShakeWrapper>
      </Canvas>
    </div>
  );
}
