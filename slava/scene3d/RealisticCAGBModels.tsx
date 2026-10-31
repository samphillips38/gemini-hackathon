import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface BaseModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  toppled?: boolean;
  toppleAngleRad?: number;
  shakeTime?: number;
  pgaG?: number;
  highlighted?: boolean;
  onClick?: (e: any) => void;
}

function makeCanvasLabelTexture(
  lines: string[],
  bg: string,
  fg: string,
  accent = '#38bdf8',
  width = 512,
  height = 512
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, width - 24, height - 24);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, idx) => {
      const fontSize = idx === 0 ? Math.floor(width * 0.11) : Math.floor(width * 0.065);
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      const y = height * (0.28 + idx * 0.18);
      ctx.fillText(line, width / 2, y);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 1. Tall Black Retractable Roller Banner ("Sundai" / "Build the Future. Together.")
 * Filmed in walk1 frame_017..018 & walk2 frame_012..014 along Breakout concourse.
 * Topples across the exit path during shaking (h=2.05m, b=0.22m -> critical PGA ~ 0.11g).
 */
export interface RollerBanner3DProps extends BaseModelProps {
  variant?: 'sundai' | 'build_future';
}

export const RollerBanner3D: React.FC<RollerBanner3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  variant = 'sundai',
  toppled = false,
  toppleAngleRad = 1.48,
  highlighted = false,
  onClick,
}) => {
  const bannerTex = useMemo(() => {
    if (variant === 'sundai') {
      return makeCanvasLabelTexture(
        ['SUNDAI', 'AI HACKATHON', 'IMPERIAL CAGB', 'LEVEL 2'],
        '#0f172a',
        '#f8fafc',
        '#f59e0b',
        512,
        1024
      );
    }
    return makeCanvasLabelTexture(
      ['BUILD THE', 'FUTURE.', 'TOGETHER.', 'IMPERIAL'],
      '#090d16',
      '#ffffff',
      '#38bdf8',
      512,
      1024
    );
  }, [variant]);

  const tiltX = toppled ? toppleAngleRad : 0;

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      <group rotation={[tiltX, 0, 0]}>
        {/* Anodized aluminum cassette base */}
        <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.85, 0.08, 0.22]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Two swing-out stabilizer feet */}
        <mesh position={[-0.28, 0.015, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.03, 0.38]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.28, 0.015, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.03, 0.38]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Rear bungee support pole */}
        <mesh position={[0, 1.02, -0.06]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 2.0, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Top clamp rail */}
        <mesh position={[0, 2.02, 0]} castShadow>
          <boxGeometry args={[0.84, 0.035, 0.03]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Retractable vinyl banner sheet */}
        <mesh position={[0, 1.04, 0.01]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 1.94, 0.008]} />
          <meshStandardMaterial
            map={bannerTex}
            roughness={0.4}
            metalness={0.1}
            emissive={highlighted ? '#ef4444' : '#000000'}
            emissiveIntensity={highlighted ? 0.35 : 0}
          />
        </mesh>
      </group>
    </group>
  );
};

/**
 * 2. Wheeled White Steel Catering / Utility Cart on 4 Casters
 * Filmed in walk1 frame_017 & walk2 frame_013..014.
 * Unbraked casters roll & tip into the Breakout concourse during shaking.
 */
export interface WheeledCateringCart3DProps extends BaseModelProps {
  rollOffsetM?: [number, number];
}

export const WheeledCateringCart3D: React.FC<WheeledCateringCart3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  toppled = false,
  rollOffsetM = [0, 0],
  highlighted = false,
  onClick,
}) => {
  const posts: [number, number][] = [
    [-0.42, -0.24],
    [0.42, -0.24],
    [-0.42, 0.24],
    [0.42, 0.24],
  ];
  const shelvesY = [0.16, 0.52, 0.88];

  return (
    <group
      position={[position[0] + rollOffsetM[0], position[1], position[2] + rollOffsetM[1]]}
      rotation={rotation}
      scale={scale}
      onClick={onClick}
    >
      <group rotation={[0, 0, toppled ? 1.25 : 0]}>
        {/* 4 Swivel Casters */}
        {posts.map(([px, pz], i) => (
          <group key={i} position={[px, 0.05, pz]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.03, 16]} />
              <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <boxGeometry args={[0.04, 0.06, 0.04]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* 4 Corner Steel Uprights */}
        {posts.map(([px, pz], i) => (
          <mesh key={`post-${i}`} position={[px, 0.54, pz]} castShadow>
            <cylinderGeometry args={[0.016, 0.016, 0.88, 12]} />
            <meshStandardMaterial color="#f1f5f9" metalness={0.6} roughness={0.25} />
          </mesh>
        ))}

        {/* 3 White Powder-Coated Steel Trays with Lip */}
        {shelvesY.map((sy, idx) => (
          <group key={`shelf-${idx}`} position={[0, sy, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.035, 0.54]} />
              <meshStandardMaterial
                color="#f8fafc"
                metalness={0.35}
                roughness={0.25}
                emissive={highlighted ? '#f97316' : '#000000'}
                emissiveIntensity={highlighted ? 0.25 : 0}
              />
            </mesh>
            {/* Raised perimeter rim */}
            <mesh position={[0, 0.025, -0.26]}>
              <boxGeometry args={[0.9, 0.025, 0.02]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.025, 0.26]}>
              <boxGeometry args={[0.9, 0.025, 0.02]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* Push handle on left side */}
        <mesh position={[-0.48, 0.92, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 0.48, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Supplies / boxes / thermos on top & middle shelves */}
        <mesh position={[-0.18, 0.98, -0.05]} castShadow>
          <boxGeometry args={[0.28, 0.16, 0.24]} />
          <meshStandardMaterial color="#d97706" roughness={0.75} />
        </mesh>
        <mesh position={[0.2, 1.0, 0.06]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.22, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0.05, 0.62, 0]} castShadow>
          <boxGeometry args={[0.38, 0.16, 0.32]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * 3. Multi-Part Rolls-Royce Turbofan Jet Engine Display on White Plinth
 * Filmed in walk1 frame_011 & walk2 frame_008..010 in Breakout concourse.
 * Includes white museum plinth, silver titanium intake cowling, 22-blade fan rotor,
 * orange/red nose spinner cone, blue engine core casing, A-frame cradle, and angled plaque.
 */
export const RollsRoyceTurbine3D: React.FC<BaseModelProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  highlighted = false,
  onClick,
}) => {
  const blades = useMemo(() => Array.from({ length: 22 }, (_, i) => (i * Math.PI * 2) / 22), []);

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {/* White Museum Display Plinth */}
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.48, 1.25]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.08} />
      </mesh>
      {/* Dark recessed plinth toe-kick */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.55, 0.08, 1.15]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>

      {/* Steel Cradle Stand */}
      <mesh position={[-0.25, 0.68, -0.32]} rotation={[0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.55, 0.08]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-0.25, 0.68, 0.32]} rotation={[-0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.55, 0.08]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Main Turbofan Nacelle Assembly (axis along +X) */}
      <group position={[0.05, 1.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
        {/* Outer Polished Aluminum / Brushed Steel Intake Cowling */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.52, 0.46, 0.68, 36, 1, true]} />
          <meshStandardMaterial
            color="#d1d5db"
            metalness={0.88}
            roughness={0.18}
            side={THREE.DoubleSide}
            emissive={highlighted ? '#38bdf8' : '#000000'}
            emissiveIntensity={highlighted ? 0.25 : 0}
          />
        </mesh>

        {/* Front Chrome Intake Lip Ring (Torus) */}
        <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.5, 0.045, 16, 40]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* Dark Interior Acoustic Liner */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.47, 0.43, 0.58, 32, 1, true]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>

        {/* 22 Titanium Wide-Chord Fan Blades */}
        <group position={[0, 0.18, 0]}>
          {blades.map((angle, idx) => (
            <group key={idx} rotation={[0, angle, 0]}>
              <mesh position={[0.24, 0, 0]} rotation={[0.42, 0, 0]} castShadow>
                <boxGeometry args={[0.42, 0.09, 0.012]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Characteristic Orange-Red Conical Nose Spinner (visible in walk1 frame_011 & walk2 frame_008) */}
        <mesh position={[0, 0.32, 0]} castShadow>
          <coneGeometry args={[0.16, 0.32, 24]} />
          <meshStandardMaterial color="#ea580c" roughness={0.25} metalness={0.3} />
        </mesh>
        {/* White spiral stripe accent on spinner tip */}
        <mesh position={[0, 0.42, 0]}>
          <coneGeometry args={[0.06, 0.12, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>

        {/* Rear Rolls-Royce Blue Core Compressor Casing & Exhaust Cone */}
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.24, 0.55, 28]} />
          <meshStandardMaterial color="#1e3a8a" metalness={0.65} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.82, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.22, 0.35, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Angled White Educational Plaque Stand in Front */}
      <group position={[0.68, 0.48, 0.38]}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.44, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.45, 0]} rotation={[0.45, Math.PI / 4, 0]} castShadow>
          <boxGeometry args={[0.36, 0.02, 0.26]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * 4. Suspended Circular Glowing Halo Ring Chandelier
 * Filmed in walk1 frame_010..011 & walk2 frame_011..015 in Breakout concourse.
 * Swings as a spherical pendulum on 3 thin steel aircraft cables during shaking!
 */
export interface HaloChandelier3DProps extends BaseModelProps {
  cableLengthM?: number;
  ringRadiusM?: number;
  swingPhaseOffset?: number;
}

export const HaloChandelier3D: React.FC<HaloChandelier3DProps> = ({
  position = [0, 2.8, 0],
  rotation = [0, 0, 0],
  scale = 1,
  cableLengthM = 0.65,
  ringRadiusM = 0.68,
  shakeTime = 0,
  pgaG = 0,
  swingPhaseOffset = 0,
  onClick,
}) => {
  const pendulumRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!pendulumRef.current) return;
    const t = shakeTime || clock.getElapsedTime();
    const maxAngle = Math.min(0.42, pgaG * 0.75);
    const omega = Math.sqrt(9.81 / Math.max(0.25, cableLengthM));
    pendulumRef.current.rotation.x = Math.sin(t * omega + swingPhaseOffset) * maxAngle;
    pendulumRef.current.rotation.z = Math.cos(t * omega * 0.87 + swingPhaseOffset) * maxAngle * 0.8;
  });

  const cableAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {/* Ceiling rose mount */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
      </mesh>

      <group ref={pendulumRef}>
        {/* 3 Suspension Steel Wires */}
        {cableAngles.map((ang, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(ang) * ringRadiusM * 0.7,
              -cableLengthM / 2,
              Math.sin(ang) * ringRadiusM * 0.7,
            ]}
          >
            <cylinderGeometry args={[0.004, 0.004, cableLengthM, 6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        {/* Glowing Warm-White Circular Halo Ring */}
        <mesh position={[0, -cableLengthM, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[ringRadiusM, 0.045, 16, 48]} />
          <meshStandardMaterial
            color="#fffbeb"
            emissive="#fef3c7"
            emissiveIntensity={1.6}
            roughness={0.15}
          />
        </mesh>
      </group>
    </group>
  );
};

/**
 * 5. Exhibition Road Atrium Suspended Amber/Red/Gold Glass-Disc Chandelier Sculpture
 * Filmed in walk1 frame_013..015 & walk2 frame_005..007 above white plinth & folding tables.
 * In a quake, translucent blown-glass discs oscillate and drop glass hazard shards onto the plinth/floor below.
 */
export interface GlassDiscSculpture3DProps extends BaseModelProps {
  showFallenShards?: boolean;
}

export const GlassDiscSculpture3D: React.FC<GlassDiscSculpture3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  showFallenShards = false,
  highlighted = false,
  onClick,
}) => {
  const discs = useMemo(() => {
    const colors = ['#f59e0b', '#dc2626', '#fbbf24', '#ea580c', '#fde047', '#b91c1c'];
    const items = [];
    for (let i = 0; i < 38; i++) {
      const angle = i * 2.39996; // golden angle spiral
      const r = 0.18 + Math.sqrt(i / 38) * 1.15;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r * 0.82;
      const y = 2.45 + ((i * 7) % 13) * 0.095;
      const radius = 0.13 + (i % 4) * 0.035;
      const color = colors[i % colors.length];
      const tiltX = ((i % 5) - 2) * 0.14;
      const tiltZ = ((i % 7) - 3) * 0.12;
      items.push({ x, y, z, radius, color, tiltX, tiltZ });
    }
    return items;
  }, []);

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {/* Low White Rectangular Plinth Base Under Sculpture */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.28, 2.1]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.05} />
      </mesh>

      {/* Suspended Cluster of Translucent Amber/Red/Gold Blown-Glass Discs */}
      {discs.map((d, idx) => (
        <group key={idx} position={[d.x, d.y, d.z]}>
          {/* Thin suspension filament to atrium truss */}
          <mesh position={[0, (3.85 - d.y) / 2, 0]}>
            <cylinderGeometry args={[0.0025, 0.0025, Math.max(0.2, 3.85 - d.y), 4]} />
            <meshBasicMaterial color="#cbd5e1" transparent opacity={0.45} />
          </mesh>
          {/* Scalloped blown-glass disc */}
          <mesh rotation={[d.tiltX, 0, d.tiltZ]} castShadow>
            <cylinderGeometry args={[d.radius, d.radius * 0.92, 0.025, 20]} />
            <meshPhysicalMaterial
              color={d.color}
              emissive={d.color}
              emissiveIntensity={highlighted ? 0.65 : 0.35}
              roughness={0.12}
              metalness={0.05}
              transmission={0.72}
              transparent
              opacity={0.88}
            />
          </mesh>
        </group>
      ))}

      {/* Post-Quake Fallen Amber/Red Glass Shards & Hazard Zone on Plinth/Floor */}
      {showFallenShards && (
        <group position={[0, 0.29, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 1.85, 32]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.32} side={THREE.DoubleSide} />
          </mesh>
          {discs.slice(0, 14).map((d, i) => (
            <mesh
              key={`shard-${i}`}
              position={[d.x * 0.9, 0.02, d.z * 0.9]}
              rotation={[0.1, i * 0.7, 0.15]}
            >
              <cylinderGeometry args={[0.09, 0.06, 0.015, 6]} />
              <meshStandardMaterial
                color={d.color}
                emissive={d.color}
                emissiveIntensity={0.4}
                roughness={0.15}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

/**
 * 6. Giant Blue "IMPERIAL: Could you be a Laidlaw Scholar?" Freestanding LED Media Totem
 * Filmed in walk1 frame_013..015 & walk2 frame_004..006 (3.2m x 0.6m x 2.2m) in front of curved steel auditorium drum wall.
 */
export const LaidlawLedTotem3D: React.FC<BaseModelProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  toppled = false,
  highlighted = false,
  onClick,
}) => {
  const screenTex = useMemo(
    () =>
      makeCanvasLabelTexture(
        ['IMPERIAL', 'Could you be a', 'Laidlaw Scholar?', 'Leadership & Research'],
        '#1d4ed8',
        '#ffffff',
        '#60a5fa',
        1024,
        512
      ),
    []
  );

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      <group rotation={[toppled ? 0.35 : 0, 0, 0]}>
        {/* Dark steel base plinth */}
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.24, 0.3, 0.62]} />
          <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Main LED cabinet housing */}
        <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.9, 0.38]} />
          <meshStandardMaterial
            color="#1e3a8a"
            metalness={0.5}
            roughness={0.3}
            emissive={highlighted ? '#ef4444' : '#000000'}
            emissiveIntensity={highlighted ? 0.3 : 0}
          />
        </mesh>
        {/* Glowing High-Brightness LED Screen Face */}
        <mesh position={[0, 1.22, 0.195]}>
          <planeGeometry args={[3.08, 1.78]} />
          <meshStandardMaterial
            map={screenTex}
            emissive="#1d4ed8"
            emissiveIntensity={0.55}
            roughness={0.18}
          />
        </mesh>
      </group>
    </group>
  );
};

/**
 * 7. Green / Black / Blue Hooded Cylindrical Recycling Bin Trio + Blue Level 2 Directory Sign
 * Filmed in walk1 frame_018 & walk2 frame_015 outside Room 200 alcove.
 */
export const RecyclingBinTrio3D: React.FC<BaseModelProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
}) => {
  const bins = [
    { offset: -0.38, hoodColor: '#16a34a', label: 'MIXED RECYCLING' },
    { offset: 0, hoodColor: '#1e293b', label: 'GENERAL WASTE' },
    { offset: 0.38, hoodColor: '#2563eb', label: 'PAPER & CARD' },
  ];

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {bins.map((b, i) => (
        <group key={i} position={[b.offset, 0, 0]}>
          {/* Dark grey cylindrical body */}
          <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.15, 0.72, 20]} />
            <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.3} />
          </mesh>
          {/* Color-coded domed recycling hood */}
          <mesh position={[0, 0.76, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.165, 0.14, 20]} />
            <meshStandardMaterial color={b.hoodColor} roughness={0.3} metalness={0.15} />
          </mesh>
          {/* Front aperture slot */}
          <mesh position={[0, 0.75, 0.155]}>
            <boxGeometry args={[0.14, 0.06, 0.02]} />
            <meshBasicMaterial color="#020617" />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * 8. Royal-Blue Modular Lounge Sofa & Ottoman with Angled Wooden Legs + White Electric Kettle
 * Filmed in walk1 frame_016 & walk2 frame_011..013 along Breakout west facade.
 */
export interface BlueLoungeSofa3DProps extends BaseModelProps {
  includeOttoman?: boolean;
  includeKettle?: boolean;
}

export const BlueLoungeSofa3D: React.FC<BlueLoungeSofa3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  includeOttoman = true,
  includeKettle = true,
  onClick,
}) => {
  const legCoords: [number, number][] = [
    [-0.82, -0.34],
    [0.82, -0.34],
    [-0.82, 0.34],
    [0.82, 0.34],
  ];

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {/* 4 Angled Natural Oak Legs */}
      {legCoords.map(([lx, lz], idx) => (
        <mesh key={idx} position={[lx, 0.11, lz]} rotation={[lz * 0.3, 0, -lx * 0.15]} castShadow>
          <cylinderGeometry args={[0.022, 0.015, 0.22, 10]} />
          <meshStandardMaterial color="#d4a373" roughness={0.55} />
        </mesh>
      ))}

      {/* Royal-Blue Upholstered Seat Cushion */}
      <mesh position={[0, 0.31, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.22, 0.82]} />
        <meshStandardMaterial color="#1d5bbf" roughness={0.78} />
      </mesh>

      {/* Low Modern Upholstered Backrest */}
      <mesh position={[0, 0.58, -0.28]} castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.36, 0.24]} />
        <meshStandardMaterial color="#1e40af" roughness={0.8} />
      </mesh>

      {/* Matching Royal-Blue Ottoman */}
      {includeOttoman && (
        <group position={[0, 0, 0.78]}>
          <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 0.26, 0.55]} />
            <meshStandardMaterial color="#2563eb" roughness={0.75} />
          </mesh>
        </group>
      )}

      {/* White Electric Kettle spotted on the blue sofa in walk1 frame_016 & walk2 frame_012 */}
      {includeKettle && (
        <group position={[0.48, 0.44, 0.05]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.065, 0.085, 0.2, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
          </mesh>
          <mesh position={[-0.08, 0.1, 0]}>
            <torusGeometry args={[0.045, 0.012, 8, 16]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
};

/**
 * 9. Room 200 Auditorium Tiered Seating Row (Royal-Blue Flip-Up Chairs + White Continuous Laminate Desk)
 * Filmed in walk1 frame_001..007 & walk2 frame_016..017.
 */
export interface AuditoriumTierRow3DProps extends BaseModelProps {
  seatCount?: number;
  rowWidthM?: number;
  stepElevationM?: number;
}

export const AuditoriumTierRow3D: React.FC<AuditoriumTierRow3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  seatCount = 14,
  rowWidthM = 9.2,
  stepElevationM = 0.15,
  onClick,
}) => {
  const seatPositions = useMemo(() => {
    const arr: number[] = [];
    const spacing = (rowWidthM - 0.8) / Math.max(1, seatCount - 1);
    for (let i = 0; i < seatCount; i++) {
      arr.push(-rowWidthM / 2 + 0.4 + i * spacing);
    }
    return arr;
  }, [seatCount, rowWidthM]);

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {/* Dark Grey Carpeted Tier Platform */}
      <mesh position={[0, stepElevationM / 2, 0]} receiveShadow>
        <boxGeometry args={[rowWidthM + 1.2, stepElevationM, 0.92]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
      {/* Brushed Aluminum Step Nosing Strip */}
      <mesh position={[0, stepElevationM + 0.005, 0.45]}>
        <boxGeometry args={[rowWidthM + 1.2, 0.015, 0.03]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Continuous White Laminate Writing Desk along front of tier */}
      <mesh position={[0, stepElevationM + 0.72, 0.34]} castShadow receiveShadow>
        <boxGeometry args={[rowWidthM, 0.03, 0.32]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.25} metalness={0.05} />
      </mesh>
      {/* Dark Steel Desk Pedestal Supports */}
      {[-rowWidthM * 0.42, 0, rowWidthM * 0.42].map((dx, idx) => (
        <mesh key={idx} position={[dx, stepElevationM + 0.36, 0.38]} castShadow>
          <boxGeometry args={[0.05, 0.72, 0.05]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Royal-Blue Upholstered Flip-Up Lecture Theatre Seats (#1d5bbf) */}
      {seatPositions.map((sx, idx) => (
        <group key={idx} position={[sx, stepElevationM, -0.08]}>
          {/* Steel pedestal leg */}
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.04, 0.44, 0.06]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* Folded/tipped royal-blue seat cushion */}
          <mesh position={[0, 0.44, 0.06]} castShadow>
            <boxGeometry args={[0.46, 0.09, 0.42]} />
            <meshStandardMaterial color="#1d5bbf" roughness={0.75} />
          </mesh>
          {/* Ergonomic royal-blue backrest */}
          <mesh position={[0, 0.68, -0.12]} rotation={[-0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.46, 0.44, 0.08]} />
            <meshStandardMaterial color="#1d5bbf" roughness={0.72} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * 10. Royal-Blue Acoustic Double Fire Door with Stainless Steel Kickplates, Vertical Vision Glass & Glowing Green EXIT Sign
 * Filmed in walk1 frame_000, frame_006..008 & walk2 frame_016..017.
 */
export interface BlueFireDoor3DProps extends BaseModelProps {
  widthM?: number;
  heightM?: number;
  showExitSign?: boolean;
  openAngleRad?: number;
}

export const BlueFireDoor3D: React.FC<BlueFireDoor3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  widthM = 1.88,
  heightM = 2.15,
  showExitSign = true,
  openAngleRad = 0.18,
  onClick,
}) => {
  const leafW = widthM / 2 - 0.02;

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {/* Door Frame */}
      <mesh position={[0, heightM / 2, 0]}>
        <boxGeometry args={[widthM + 0.12, heightM + 0.08, 0.14]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.45} />
      </mesh>

      {/* Left & Right Royal-Blue Acoustic Door Leaves */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[(side * widthM) / 2, 0, 0]}
          rotation={[0, side * openAngleRad, 0]}
        >
          <group position={[(-side * leafW) / 2, heightM / 2, 0]}>
            {/* Royal-Blue Door Leaf (#1e40af) */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[leafW, heightM, 0.06]} />
              <meshStandardMaterial color="#1d4ed8" roughness={0.4} metalness={0.1} />
            </mesh>
            {/* Stainless Steel Bottom Kickplate */}
            <mesh position={[0, -heightM / 2 + 0.14, 0.034]}>
              <boxGeometry args={[leafW - 0.04, 0.26, 0.008]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.18} />
            </mesh>
            {/* Vertical Vision Glass Panel */}
            <mesh position={[side * (leafW * 0.22), 0.12, 0]}>
              <boxGeometry args={[0.16, 0.95, 0.07]} />
              <meshPhysicalMaterial
                color="#bae6fd"
                transmission={0.78}
                transparent
                opacity={0.7}
                roughness={0.1}
              />
            </mesh>
            {/* Stainless Push Plate / Handle */}
            <mesh position={[side * (leafW * 0.36), -0.05, 0.038]}>
              <boxGeometry args={[0.08, 0.32, 0.015]} />
              <meshStandardMaterial color="#f1f5f9" metalness={0.92} roughness={0.15} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Illuminated Green Emergency EXIT Sign Above Door */}
      {showExitSign && (
        <mesh position={[0, heightM + 0.22, 0.06]}>
          <boxGeometry args={[0.52, 0.18, 0.05]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={1.5}
            roughness={0.2}
          />
        </mesh>
      )}
    </group>
  );
};

export default {
  RollerBanner3D,
  WheeledCateringCart3D,
  RollsRoyceTurbine3D,
  HaloChandelier3D,
  GlassDiscSculpture3D,
  LaidlawLedTotem3D,
  RecyclingBinTrio3D,
  BlueLoungeSofa3D,
  AuditoriumTierRow3D,
  BlueFireDoor3D,
};
