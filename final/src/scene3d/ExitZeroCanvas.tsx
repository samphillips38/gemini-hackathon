"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  BuildingFloorGraph,
  LiveHazardEvent,
  EvacuationVerificationResult,
  NavNode,
  WallSegment,
} from "@/types/contracts";
import {
  getProceduralTexture,
  getProceduralBumpMap,
  getGlassPillTexture,
  getItemTexture,
  getItemBumpMap,
} from "./proceduralTextures";
import {
  WallCollider,
  PhysicsBody,
  stepObjectPhysics,
  resolvePlayerCollisions,
} from "./collisionPhysics";

export interface ExitZeroCanvasProps {
  floorGraph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  verification: EvacuationVerificationResult;
  walkthroughActive: boolean;
  fullScreen?: boolean;
  playerResetCounter?: number;
  showItemLabels?: boolean;
}

function TelemetrySprite({
  position,
  title,
  subtitle,
  statusColor,
  scale = [2.4, 0.56, 1],
}: {
  position: [number, number, number];
  title: string;
  subtitle: string;
  statusColor: string;
  scale?: [number, number, number];
}) {
  const tex = useMemo(
    () =>
      getGlassPillTexture({
        title,
        subtitle,
        badge: statusColor === "#ef4444" ? "ALERT" : "SAFE",
        accentColor: statusColor,
      }),
    [title, subtitle, statusColor]
  );
  if (!tex) return null;
  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
}

/**
 * Physical Obstacles & Interior Room Furniture distributed across the Building Wing
 * so the player can explore every room and navigate around real physical obstacles!
 */
interface WingObstacle {
  id: string;
  label: string;
  category: "bench" | "cart" | "crate" | "debris" | "desk" | "server";
  /** FloorGraph coordinates (0..width_m, 0..depth_m) */
  gx: number;
  gz: number;
  w: number;
  d: number;
  h: number;
  rotY: number;
  movable: boolean;
  lowObstacle?: boolean;
  mass: number;
}

const WING_OBSTACLES: WingObstacle[] = [
  // Corridor obstacles & carts
  {
    id: "wing_cart_1",
    label: "Corridor Avionics Cart (Pushable)",
    category: "cart",
    gx: 9.2,
    gz: 10.6,
    w: 0.9,
    d: 0.6,
    h: 0.9,
    rotY: 0.25,
    movable: true,
    mass: 22,
  },
  {
    id: "wing_crate_1",
    label: "Supply Crate Obstacle (Pushable)",
    category: "crate",
    gx: 7.4,
    gz: 9.3,
    w: 0.75,
    d: 0.75,
    h: 0.65,
    rotY: -0.35,
    movable: true,
    lowObstacle: true,
    mass: 24,
  },
  {
    id: "wing_debris_1",
    label: "Fallen Ceiling Duct Obstacle",
    category: "debris",
    gx: 11.4,
    gz: 9.6,
    w: 1.3,
    d: 0.8,
    h: 0.5,
    rotY: 0.4,
    movable: false,
    lowObstacle: true,
    mass: 160,
  },
  {
    id: "wing_bench_1",
    label: "Atrium Oak Bench",
    category: "bench",
    gx: 14.0,
    gz: 9.8,
    w: 1.8,
    d: 0.65,
    h: 0.55,
    rotY: 0,
    movable: false,
    lowObstacle: true,
    mass: 85,
  },
  {
    id: "wing_cart_2",
    label: "Lab Specimen Trolley (Pushable)",
    category: "cart",
    gx: 15.8,
    gz: 10.4,
    w: 0.85,
    d: 0.58,
    h: 0.88,
    rotY: -0.2,
    movable: true,
    mass: 20,
  },
  // Interior furniture inside rooms along the wing
  {
    id: "rm302_desk",
    label: "Lecture Podium & Console",
    category: "desk",
    gx: 9.0,
    gz: 14.8,
    w: 1.8,
    d: 0.85,
    h: 0.85,
    rotY: 0,
    movable: false,
    mass: 95,
  },
  {
    id: "rm302_crate",
    label: "AV Gear Case (Pushable)",
    category: "crate",
    gx: 10.8,
    gz: 13.8,
    w: 0.7,
    d: 0.7,
    h: 0.6,
    rotY: 0.5,
    movable: true,
    lowObstacle: true,
    mass: 18,
  },
  {
    id: "rm201_server",
    label: "Computing Cluster Rack",
    category: "server",
    gx: 6.5,
    gz: 5.5,
    w: 1.2,
    d: 0.7,
    h: 2.1,
    rotY: 0,
    movable: false,
    mass: 140,
  },
  {
    id: "rm204_desk",
    label: "Design Studio Table",
    category: "desk",
    gx: 20.5,
    gz: 5.8,
    w: 1.9,
    d: 0.95,
    h: 0.82,
    rotY: 0,
    movable: false,
    mass: 90,
  },
];

function WingScene({
  floorGraph,
  hazards,
  verification,
  walkthroughActive,
  playerResetCounter,
  showItemLabels = false,
  onHudUpdate,
}: {
  floorGraph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  verification: EvacuationVerificationResult;
  walkthroughActive: boolean;
  playerResetCounter?: number;
  showItemLabels?: boolean;
  onHudUpdate: (info: {
    zoneName: string;
    collidedWith: string | null;
    pushedObject: string | null;
    distToGoalM: number;
  }) => void;
}) {
  const { camera, gl } = useThree();
  const W = floorGraph.width_m;
  const D = floorGraph.depth_m;

  // Lecture Theatre Procedural Textures
  const marbleTex = useMemo(() => getProceduralTexture("marble"), []);
  const marbleBump = useMemo(() => getProceduralBumpMap("marble"), []);
  const stoneTex = useMemo(() => getProceduralTexture("stone"), []);
  const stoneBump = useMemo(() => getProceduralBumpMap("stone"), []);
  const woodTex = useMemo(() => getProceduralTexture("wood"), []);
  const carpetTex = useMemo(() => getProceduralTexture("carpet"), []);
  const carpetBump = useMemo(() => getProceduralBumpMap("carpet"), []);
  const starTex = useMemo(() => getProceduralTexture("stars"), []);

  // Rich Procedural Item Surface Textures & Bump Maps
  const walnutTex = useMemo(() => getItemTexture("walnut_wood"), []);
  const walnutBump = useMemo(() => getItemBumpMap("walnut_wood"), []);
  const steelTex = useMemo(() => getItemTexture("brushed_steel"), []);
  const steelBump = useMemo(() => getItemBumpMap("brushed_steel"), []);
  const crateTex = useMemo(() => getItemTexture("weathered_crate"), []);
  const crateBump = useMemo(() => getItemBumpMap("weathered_crate"), []);
  const rubbleTex = useMemo(() => getItemTexture("fractured_rubble"), []);
  const rubbleBump = useMemo(() => getItemBumpMap("fractured_rubble"), []);

  const nodeMap = useMemo(() => {
    const map = new Map<string, NavNode>();
    for (const n of floorGraph.nodes) map.set(n.id, n);
    return map;
  }, [floorGraph.nodes]);

  const verifiedRouteNodes = useMemo(() => {
    const ids = verification.verified_safe_route?.node_ids || [];
    return ids.map((id: string) => nodeMap.get(id)).filter(Boolean) as NavNode[];
  }, [verification, nodeMap]);

  // Convert floorGraph walls into WallColliders
  const wallColliders = useMemo<WallCollider[]>(() => {
    return floorGraph.walls.map((w: WallSegment, idx: number) => ({
      id: `fw_${idx}`,
      x1: w.x1_m - W / 2,
      z1: w.z1_m - D / 2,
      x2: w.x2_m - W / 2,
      z2: w.z2_m - D / 2,
      thickness: 0.22,
    }));
  }, [floorGraph.walls, W, D]);

  // Physics bodies for wing obstacles + live hazards
  const bodiesRef = useRef<PhysicsBody[]>([]);
  useEffect(() => {
    const list: PhysicsBody[] = WING_OBSTACLES.map((o) => ({
      id: o.id,
      label: o.label,
      category: o.category,
      x: o.gx - W / 2,
      y: 0,
      z: o.gz - D / 2,
      halfW: o.w / 2,
      halfD: o.d / 2,
      height: o.h,
      currHalfW: o.w / 2,
      currHalfD: o.d / 2,
      vx: 0,
      vy: 0,
      vz: 0,
      rotX: 0,
      rotZ: 0,
      rotY: o.rotY,
      angVelX: 0,
      angVelZ: 0,
      targetRotX: 0,
      targetRotZ: 0,
      willTip: false,
      isAnchored: !o.movable,
      movable: o.movable,
      lowObstacle: o.lowObstacle,
      mass: o.mass,
      friction: 0.5,
      restitution: 0.3,
      collidingWithId: null,
    }));

    // Add live hazard rubble colliders so the blocked corridor is physically impassable
    for (const h of hazards) {
      const hNode = nodeMap.get(h.location_node_id);
      const hx = (hNode?.x_m ?? W / 2) - W / 2;
      const hz = (hNode?.z_m ?? D / 2) - D / 2;
      const hRadius = 2.2;
      list.push({
        id: h.id,
        label: h.description || "Structural Collapse Barricade",
        category: "debris",
        x: hx,
        y: 0,
        z: hz,
        halfW: Math.min(hRadius * 0.65, 1.45),
        halfD: Math.min(hRadius * 0.65, 1.45),
        height: 1.8,
        currHalfW: Math.min(hRadius * 0.65, 1.45),
        currHalfD: Math.min(hRadius * 0.65, 1.45),
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotZ: 0,
        rotY: 0,
        angVelX: 0,
        angVelZ: 0,
        targetRotX: 0,
        targetRotZ: 0,
        willTip: false,
        isAnchored: true,
        movable: false,
        mass: 500,
        friction: 0.9,
        restitution: 0.1,
        collidingWithId: null,
      });
    }

    bodiesRef.current = list;
  }, [W, D, hazards]);

  // Player controller state
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(-4.0, 1.68, 2.5));
  const playerYawRef = useRef<number>(-Math.PI / 2);
  const playerPitchRef = useRef<number>(-0.05);
  const playerVelYRef = useRef<number>(0);
  const isJumpingRef = useRef<boolean>(false);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const isDraggingRef = useRef<boolean>(false);
  const lastHudRef = useRef<number>(0);

  // Spawn player at start node of verified route
  useEffect(() => {
    const startNode = verifiedRouteNodes[0] || floorGraph.nodes[0];
    if (startNode) {
      playerPosRef.current.set(
        startNode.x_m - W / 2,
        1.68,
        startNode.z_m - D / 2
      );
      if (verifiedRouteNodes.length >= 2) {
        const nextNode = verifiedRouteNodes[1];
        playerYawRef.current = Math.atan2(
          -(nextNode.x_m - startNode.x_m),
          -(nextNode.z_m - startNode.z_m)
        );
      }
    }
  }, [verifiedRouteNodes, floorGraph.nodes, W, D, playerResetCounter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      keysRef.current[e.code] = true;
      if (e.code === "Space" && !isJumpingRef.current) {
        isJumpingRef.current = true;
        playerVelYRef.current = 4.0;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    const dom = gl.domElement;
    const onPointerDown = () => {
      isDraggingRef.current = true;
    };
    const onPointerUp = () => {
      isDraggingRef.current = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!walkthroughActive || !isDraggingRef.current) return;
      playerYawRef.current -= e.movementX * 0.0042;
      playerPitchRef.current = THREE.MathUtils.clamp(
        playerPitchRef.current - e.movementY * 0.0035,
        -0.8,
        0.7
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [walkthroughActive, gl.domElement]);

  useEffect(() => {
    if (!walkthroughActive) {
      camera.position.set(0, 22, 21);
      camera.lookAt(0, 0, 0);
    }
  }, [walkthroughActive, camera]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    stepObjectPhysics(
      bodiesRef.current,
      wallColliders,
      dt,
      false,
      false,
      0.35,
      t
    );

    const isSprinting =
      keysRef.current["ShiftLeft"] || keysRef.current["ShiftRight"];
    const speed = (isSprinting ? 6.2 : 3.8) * dt;

    if (keysRef.current["KeyQ"]) playerYawRef.current += 1.8 * dt;
    if (keysRef.current["KeyE"]) playerYawRef.current -= 1.8 * dt;

    const forward = new THREE.Vector3(
      -Math.sin(playerYawRef.current),
      0,
      -Math.cos(playerYawRef.current)
    ).normalize();
    const right = new THREE.Vector3().crossVectors(
      forward,
      new THREE.Vector3(0, 1, 0)
    );

    if (keysRef.current["KeyW"] || keysRef.current["ArrowUp"]) {
      playerPosRef.current.addScaledVector(forward, speed);
    }
    if (keysRef.current["KeyS"] || keysRef.current["ArrowDown"]) {
      playerPosRef.current.addScaledVector(forward, -speed);
    }
    if (keysRef.current["KeyA"] || keysRef.current["ArrowLeft"]) {
      playerPosRef.current.addScaledVector(right, -speed);
    }
    if (keysRef.current["KeyD"] || keysRef.current["ArrowRight"]) {
      playerPosRef.current.addScaledVector(right, speed);
    }

    if (isJumpingRef.current) {
      playerPosRef.current.y += playerVelYRef.current * dt;
      playerVelYRef.current -= 9.81 * dt;
      if (playerPosRef.current.y <= 1.68) {
        playerPosRef.current.y = 1.68;
        playerVelYRef.current = 0;
        isJumpingRef.current = false;
      }
    }

    const { collidedObjectLabel, pushedObjectLabel } = resolvePlayerCollisions(
      playerPosRef.current,
      0.32,
      isJumpingRef.current,
      wallColliders,
      bodiesRef.current
    );

    playerPosRef.current.x = THREE.MathUtils.clamp(
      playerPosRef.current.x,
      -W / 2 + 0.5,
      W / 2 - 0.5
    );
    playerPosRef.current.z = THREE.MathUtils.clamp(
      playerPosRef.current.z,
      -D / 2 + 0.5,
      D / 2 - 0.5
    );

    if (walkthroughActive) {
      camera.position.copy(playerPosRef.current);
      const lookDir = new THREE.Vector3(
        -Math.sin(playerYawRef.current) * Math.cos(playerPitchRef.current),
        Math.sin(playerPitchRef.current),
        -Math.cos(playerYawRef.current) * Math.cos(playerPitchRef.current)
      );
      camera.lookAt(camera.position.clone().add(lookDir.multiplyScalar(5)));
    }

    if (t - lastHudRef.current > 0.12) {
      lastHudRef.current = t;
      const px = playerPosRef.current.x + W / 2;
      const pz = playerPosRef.current.z + D / 2;
      let nearestNode = floorGraph.nodes[0];
      let minDist = Infinity;
      for (const n of floorGraph.nodes) {
        const d = Math.hypot(n.x_m - px, n.z_m - pz);
        if (d < minDist) {
          minDist = d;
          nearestNode = n;
        }
      }
      const goalNode =
        verifiedRouteNodes[verifiedRouteNodes.length - 1] || nearestNode;
      const distGoal = goalNode
        ? Math.hypot(goalNode.x_m - px, goalNode.z_m - pz)
        : 0;
      onHudUpdate({
        zoneName: nearestNode?.label || "Main Wing Corridor",
        collidedWith: collidedObjectLabel,
        pushedObject: pushedObjectLabel,
        distToGoalM: Number(distGoal.toFixed(1)),
      });
    }
  });

  // Glowing 3D Optimal Safe Route Tube
  const verifiedTubeGeom = useMemo(() => {
    if (verifiedRouteNodes.length < 2) return null;
    const pts = verifiedRouteNodes.map(
      (n) => new THREE.Vector3(n.x_m - W / 2, 0.14, n.z_m - D / 2)
    );
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
    return new THREE.TubeGeometry(curve, 64, 0.12, 12, false);
  }, [verifiedRouteNodes, W, D]);

  // Player avatar in 3D orbit view
  const playerAvatarRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!playerAvatarRef.current) return;
    const p = playerPosRef.current;
    playerAvatarRef.current.position.set(p.x, p.y - 1.68, p.z);
    playerAvatarRef.current.rotation.y = playerYawRef.current;
  });

  return (
    <group>
      {/* Nocturnal Starfield Sky Dome */}
      <mesh>
        <sphereGeometry args={[70, 32, 32]} />
        <meshBasicMaterial
          map={starTex}
          side={THREE.BackSide}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Concrete Outer Plinth & Anodized Aluminum Safety Trim */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[W + 1.8, 0.32, D + 1.8]} />
        <meshStandardMaterial
          map={marbleTex}
          bumpMap={marbleBump}
          bumpScale={0.015}
          roughness={0.55}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[W + 0.6, 0.04, D + 0.6]} />
        <meshStandardMaterial color="#dde2ea" metalness={0.45} roughness={0.32} />
      </mesh>

      {/* Main Wing Lecture Theatre Charcoal Loop-Pile Carpet Floor with Step Edging */}
      <mesh
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial
          map={carpetTex}
          bumpMap={carpetBump}
          bumpScale={0.025}
          roughness={0.82}
          metalness={0.04}
        />
      </mesh>

      {/* Extruded Lecture Hall Walls (Off-White Plaster & Honey-Oak Veneer) */}
      {floorGraph.walls.map((w: WallSegment, idx: number) => {
        const x1 = w.x1_m - W / 2;
        const z1 = w.z1_m - D / 2;
        const x2 = w.x2_m - W / 2;
        const z2 = w.z2_m - D / 2;
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        const ang = Math.atan2(dz, dx);
        const wallH = walkthroughActive ? 3.1 : 2.1;
        const isInteriorWall = Math.abs(cx) < W * 0.44 && Math.abs(cz) < D * 0.44;

        return (
          <group key={idx} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
            <mesh position={[0, wallH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[len, wallH, 0.22]} />
              <meshStandardMaterial
                map={isInteriorWall ? woodTex : stoneTex}
                bumpMap={stoneBump}
                bumpScale={0.015}
                roughness={isInteriorWall ? 0.48 : 0.68}
                metalness={0.04}
              />
            </mesh>
            <mesh position={[0, wallH - 0.04, 0]}>
              <boxGeometry args={[len + 0.02, 0.08, 0.26]} />
              <meshStandardMaterial
                color="#e5e9f0"
                metalness={0.35}
                roughness={0.35}
              />
            </mesh>
          </group>
        );
      })}

      {/* Navigation Nodes & Room Beacons */}
      {floorGraph.nodes.map((node) => {
        const nx = node.x_m - W / 2;
        const nz = node.z_m - D / 2;
        const isStair = node.type === "stairwell_exit";
        const isLift = node.type === "lift_elevator";
        const isRefuge = node.type === "accessible_refuge";
        const color = isStair
          ? "#10b981"
          : isLift
          ? "#ef4444"
          : isRefuge
          ? "#a855f7"
          : "#d4af37";

        return (
          <group key={node.id} position={[nx, 0.02, nz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.42, 0.56, 28]} />
              <meshBasicMaterial color={color} transparent opacity={0.75} />
            </mesh>
            {showItemLabels && (
              <TelemetrySprite
                position={[0, 2.35, 0]}
                title={node.label.toUpperCase()}
                subtitle={
                  isStair
                    ? "VERIFIED SAFE EXIT"
                    : isLift
                    ? "DO NOT USE IN SEISMIC/FIRE"
                    : isRefuge
                    ? "ACCESSIBLE REFUGE POINT"
                    : "EXPLORABLE ROOM / JUNCTION"
                }
                statusColor={color}
                scale={[2.25, 0.48, 1]}
              />
            )}
          </group>
        );
      })}

      {/* Live Structural Collapse / Fire Hazards */}
      {hazards.map((haz) => {
        const hNode = nodeMap.get(haz.location_node_id);
        const hx = (hNode?.x_m ?? W / 2) - W / 2;
        const hz = (hNode?.z_m ?? D / 2) - D / 2;
        return (
          <group key={haz.id} position={[hx, 0, hz]}>
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[2.2, 32]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.28} />
            </mesh>
            {/* Physical Fallen Masonry Barricade with Fractured Rubble Texture */}
            <RoundedBox
              args={[1.8, 1.35, 1.8]}
              radius={0.05}
              position={[0, 0.68, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                map={rubbleTex}
                bumpMap={rubbleBump}
                bumpScale={0.045}
                color="#b91c1c"
                roughness={0.85}
              />
            </RoundedBox>
            {showItemLabels && (
              <TelemetrySprite
                position={[0, 2.45, 0]}
                title={`HAZARD: ${haz.hazard_type.toUpperCase()}`}
                subtitle={haz.description}
                statusColor="#ef4444"
                scale={[2.6, 0.55, 1]}
              />
            )}
          </group>
        );
      })}

      {/* Physical Obstacles & Pushable Carts/Crates across the Wing */}
      {WING_OBSTACLES.map((item) => {
        const body = bodiesRef.current.find((b) => b.id === item.id);
        const bx = body ? body.x : item.gx - W / 2;
        const bz = body ? body.z : item.gz - D / 2;
        const statusColor = item.movable ? "#38bdf8" : "#f59e0b";

        const isCrate = item.category === "crate";
        const isServerOrCart =
          item.category === "server" || item.category === "cart";

        return (
          <group
            key={item.id}
            position={[bx, 0, bz]}
            rotation={[0, item.rotY, 0]}
          >
            <RoundedBox
              args={[item.w, item.h, item.d]}
              radius={0.03}
              position={[0, item.h / 2, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                map={
                  isCrate
                    ? crateTex
                    : isServerOrCart
                    ? steelTex
                    : walnutTex
                }
                bumpMap={
                  isCrate
                    ? crateBump
                    : isServerOrCart
                    ? steelBump
                    : walnutBump
                }
                bumpScale={0.03}
                color={
                  item.category === "cart"
                    ? "#7dd3fc"
                    : item.category === "crate"
                    ? "#f5d0a9"
                    : item.category === "server"
                    ? "#cbd5e1"
                    : "#e2c7a8"
                }
                metalness={isServerOrCart ? 0.72 : 0.15}
                roughness={isCrate ? 0.68 : 0.38}
              />
            </RoundedBox>
            {showItemLabels && (
              <TelemetrySprite
                position={[0, item.h + 0.45, 0]}
                title={item.label.toUpperCase()}
                subtitle={
                  item.movable
                    ? "PUSHABLE OBSTACLE (WALK INTO)"
                    : "SOLID OBSTACLE (WALK AROUND)"
                }
                statusColor={statusColor}
                scale={[1.85, 0.42, 1]}
              />
            )}
          </group>
        );
      })}

      {/* Glowing Optimal Safe Evacuation Tube */}
      {verifiedTubeGeom && (
        <mesh geometry={verifiedTubeGeom}>
          <meshStandardMaterial
            color="#10b981"
            emissive="#059669"
            emissiveIntensity={1.35}
            roughness={0.2}
            metalness={0.5}
          />
        </mesh>
      )}

      {/* Player Avatar */}
      <group ref={playerAvatarRef}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.42, 28]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
        </mesh>
        {!walkthroughActive && (
          <group>
            <mesh position={[0, 0.75, 0]} castShadow>
              <cylinderGeometry args={[0.24, 0.28, 1.15, 16]} />
              <meshStandardMaterial
                map={steelTex}
                bumpMap={steelBump}
                bumpScale={0.015}
                color="#0284c7"
                emissive="#0369a1"
                emissiveIntensity={0.45}
              />
            </mesh>
            <mesh position={[0, 1.5, 0]} castShadow>
              <sphereGeometry args={[0.22, 20, 20]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            {showItemLabels && (
              <TelemetrySprite
                position={[0, 2.2, 0]}
                title="YOU (PLAYER)"
                subtitle="WASD / ARROWS TO WALK"
                statusColor="#38bdf8"
                scale={[1.9, 0.45, 1]}
              />
            )}
          </group>
        )}
      </group>

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.5}
        scale={36}
        blur={2.4}
        far={6}
      />
    </group>
  );
}

export default function ExitZeroCanvas({
  floorGraph,
  hazards,
  verification,
  walkthroughActive,
  fullScreen = true,
  playerResetCounter = 0,
  showItemLabels = false,
}: ExitZeroCanvasProps) {
  const [hudInfo, setHudInfo] = useState<{
    zoneName: string;
    collidedWith: string | null;
    pushedObject: string | null;
    distToGoalM: number;
  }>({
    zoneName: "Room 302 (Lecture Theatre 1)",
    collidedWith: null,
    pushedObject: null,
    distToGoalM: 14.5,
  });

  return (
    <div
      className={`relative w-full ${
        fullScreen
          ? "h-screen"
          : "h-[680px] rounded-2xl border border-slate-800"
      } overflow-hidden bg-[#050811] select-none`}
    >
      {/* Bottom-Left Player Telemetry & Controls Pill */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <div className="px-3.5 py-2 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-cyan-500/30 text-xs text-slate-200 shadow-2xl flex items-center gap-3">
          <span className="font-bold text-cyan-300">{hudInfo.zoneName}</span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-300 font-mono">
            Optimal Exit: {hudInfo.distToGoalM}m
          </span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-300 hidden sm:inline">
            <strong>WASD / Arrows</strong> Walk • <strong>Shift</strong> Sprint •{" "}
            <strong>Space</strong> Jump • <strong>Drag</strong> Look
          </span>
        </div>

        {(hudInfo.pushedObject || hudInfo.collidedWith) && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-400/50 text-xs font-bold text-amber-200 shadow-lg">
            {hudInfo.pushedObject
              ? `⚡ Pushing Obstacle: ${hudInfo.pushedObject}`
              : `🛡️ Colliding with: ${hudInfo.collidedWith}`}
          </div>
        )}
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 22, 21], fov: 50 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
        }}
      >
        <color attach="background" args={["#050811"]} />
        <fog attach="fog" args={["#050811", 22, 65]} />

        <ambientLight intensity={0.55} color="#e2e8f0" />
        <directionalLight
          position={[12, 24, 14]}
          intensity={1.35}
          color="#fffbeb"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-6, 3.2, 0]} intensity={0.65} color="#fde68a" />
        <pointLight position={[6, 3.2, 0]} intensity={0.65} color="#38bdf8" />

        <WingScene
          floorGraph={floorGraph}
          hazards={hazards}
          verification={verification}
          walkthroughActive={walkthroughActive}
          playerResetCounter={playerResetCounter}
          showItemLabels={showItemLabels}
          onHudUpdate={setHudInfo}
        />

        {!walkthroughActive && (
          <OrbitControls
            makeDefault
            enablePan={true}
            enableZoom={true}
            maxPolarAngle={Math.PI / 2 - 0.04}
            minDistance={5}
            maxDistance={42}
          />
        )}
      </Canvas>
    </div>
  );
}
