import * as THREE from "three";

export interface WallCollider {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thickness: number;
}

export interface PhysicsBody {
  id: string;
  label: string;
  category: string;
  /** World-space center X */
  x: number;
  /** World-space base Y (0 = floor) */
  y: number;
  /** World-space center Z */
  z: number;
  /** Half-extents in world X and Z (rest state) */
  halfW: number;
  halfD: number;
  height: number;
  /** Current dynamic half-extents (expands when tipped over) */
  currHalfW: number;
  currHalfD: number;
  /** Velocity */
  vx: number;
  vy: number;
  vz: number;
  /** Tipping angles (radians) */
  rotX: number;
  rotZ: number;
  rotY: number;
  angVelX: number;
  angVelZ: number;
  /** Target tipping angles when earthquake topples object */
  targetRotX: number;
  targetRotZ: number;
  willTip: boolean;
  isAnchored: boolean;
  /** Whether the player or other objects can push this body across the floor */
  movable: boolean;
  /** Whether the player can step over this obstacle when jumping */
  lowObstacle?: boolean;
  mass: number;
  friction: number;
  restitution: number;
  collidingWithId: string | null;
}

/**
 * Closest point on a 2D line segment (x1,z1)-(x2,z2) to point (px,pz)
 */
function closestPointOnSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): { cx: number; cz: number; distSq: number } {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-8) {
    const ex = px - x1;
    const ez = pz - z1;
    return { cx: x1, cz: z1, distSq: ex * ex + ez * ez };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  const cx = x1 + t * dx;
  const cz = z1 + t * dz;
  const ex = px - cx;
  const ez = pz - cz;
  return { cx, cz, distSq: ex * ex + ez * ez };
}

/**
 * Steps rigid-body seismic & object-to-object collision physics for all furniture and obstacles.
 */
export function stepObjectPhysics(
  bodies: PhysicsBody[],
  walls: WallCollider[],
  delta: number,
  isShaking: boolean,
  hasCollapsed: boolean,
  pgaG: number,
  elapsedTime: number
): void {
  const dt = Math.min(delta, 0.05);

  // 1. Apply seismic ground excitation & tipping dynamics
  for (const b of bodies) {
    b.collidingWithId = null;

    if (isShaking) {
      // Seismic ground acceleration wave
      const waveX =
        Math.sin(elapsedTime * 19.5 + b.x * 1.7) *
        Math.cos(elapsedTime * 7.3) *
        pgaG *
        9.81;
      const waveZ =
        Math.cos(elapsedTime * 16.2 + b.z * 1.3) *
        Math.sin(elapsedTime * 9.1) *
        pgaG *
        9.81;

      if (!b.isAnchored && b.movable) {
        // Sliding acceleration if seismic force overcomes friction
        const slideFactor = Math.max(0, pgaG - b.friction * 0.45);
        b.vx += waveX * slideFactor * dt * 1.65;
        b.vz += waveZ * slideFactor * dt * 1.65;
      }

      if (b.willTip && !b.isAnchored) {
        // Accelerate tipping toward targetRotX / targetRotZ
        const diffX = b.targetRotX - b.rotX;
        const diffZ = b.targetRotZ - b.rotZ;
        b.angVelX += diffX * 4.5 * dt;
        b.angVelZ += diffZ * 4.5 * dt;
      } else {
        // Elastic rocking during shaking
        const rockAmp = b.isAnchored ? 0.012 : 0.055;
        const targetRockX = Math.sin(elapsedTime * 22 + b.x * 2) * rockAmp;
        const targetRockZ = Math.cos(elapsedTime * 20 + b.z * 2) * rockAmp;
        b.rotX = THREE.MathUtils.lerp(b.rotX, targetRockX, 0.25);
        b.rotZ = THREE.MathUtils.lerp(b.rotZ, targetRockZ, 0.25);
      }
    } else if (hasCollapsed) {
      if (b.willTip && !b.isAnchored) {
        const diffX = b.targetRotX - b.rotX;
        const diffZ = b.targetRotZ - b.rotZ;
        b.angVelX += diffX * 6.0 * dt;
        b.angVelZ += diffZ * 6.0 * dt;
      } else {
        b.rotX = THREE.MathUtils.lerp(b.rotX, 0, 0.18);
        b.rotZ = THREE.MathUtils.lerp(b.rotZ, 0, 0.18);
      }
    } else {
      // Reset state when neither shaking nor collapsed
      b.rotX = THREE.MathUtils.lerp(b.rotX, 0, 0.2);
      b.rotZ = THREE.MathUtils.lerp(b.rotZ, 0, 0.2);
      b.angVelX = 0;
      b.angVelZ = 0;
    }

    // Integrate angular velocity for tipping objects
    if ((isShaking || hasCollapsed) && b.willTip && !b.isAnchored) {
      b.angVelX *= 0.9;
      b.angVelZ *= 0.9;
      b.rotX += b.angVelX * dt;
      b.rotZ += b.angVelZ * dt;

      // Clamp to floor impact angle
      if (Math.abs(b.targetRotX) > 0.01) {
        if (b.targetRotX > 0) b.rotX = Math.min(b.rotX, b.targetRotX);
        else b.rotX = Math.max(b.rotX, b.targetRotX);
      }
      if (Math.abs(b.targetRotZ) > 0.01) {
        if (b.targetRotZ > 0) b.rotZ = Math.min(b.rotZ, b.targetRotZ);
        else b.rotZ = Math.max(b.rotZ, b.targetRotZ);
      }
    }

    // Dynamically expand footprint AABB as tall furniture tips over
    const tiltSinX = Math.abs(Math.sin(b.rotX));
    const tiltSinZ = Math.abs(Math.sin(b.rotZ));
    b.currHalfW = b.halfW + tiltSinZ * (b.height * 0.48);
    b.currHalfD = b.halfD + tiltSinX * (b.height * 0.48);

    // Integrate linear velocity & apply floor friction damping
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    const damping = Math.max(0, 1 - b.friction * 5.5 * dt);
    b.vx *= damping;
    b.vz *= damping;
    if (Math.abs(b.vx) < 0.002) b.vx = 0;
    if (Math.abs(b.vz) < 0.002) b.vz = 0;
  }

  // 2. Object-to-Object AABB Collision Resolution (2 iterations for stability)
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const A = bodies[i];
        const B = bodies[j];

        const dx = B.x - A.x;
        const dz = B.z - A.z;
        const overlapX = A.currHalfW + B.currHalfW - Math.abs(dx);
        const overlapZ = A.currHalfD + B.currHalfD - Math.abs(dz);

        if (overlapX > 0 && overlapZ > 0) {
          A.collidingWithId = B.id;
          B.collidingWithId = A.id;

          // If one is tipping into a sturdy object, arrest its angular velocity partially
          if (A.willTip && (isShaking || hasCollapsed)) {
            A.angVelX *= -0.25;
            A.angVelZ *= -0.25;
          }
          if (B.willTip && (isShaking || hasCollapsed)) {
            B.angVelX *= -0.25;
            B.angVelZ *= -0.25;
          }

          const aCanMove = A.movable && !A.isAnchored;
          const bCanMove = B.movable && !B.isAnchored;
          if (!aCanMove && !bCanMove) continue;

          // Resolve along minimum penetration axis
          const totalMass = (aCanMove ? A.mass : 0) + (bCanMove ? B.mass : 0);
          const ratioA = aCanMove
            ? bCanMove
              ? B.mass / Math.max(1, totalMass)
              : 1.0
            : 0.0;
          const ratioB = bCanMove
            ? aCanMove
              ? A.mass / Math.max(1, totalMass)
              : 1.0
            : 0.0;

          if (overlapX < overlapZ) {
            const sign = dx >= 0 ? 1 : -1;
            A.x -= sign * overlapX * ratioA;
            B.x += sign * overlapX * ratioB;
            const relVx = B.vx - A.vx;
            if (relVx * sign < 0) {
              const impulse =
                (-(1 + Math.min(A.restitution, B.restitution)) * relVx) / 2;
              if (aCanMove) A.vx -= impulse * ratioA;
              if (bCanMove) B.vx += impulse * ratioB;
            }
          } else {
            const sign = dz >= 0 ? 1 : -1;
            A.z -= sign * overlapZ * ratioA;
            B.z += sign * overlapZ * ratioB;
            const relVz = B.vz - A.vz;
            if (relVz * sign < 0) {
              const impulse =
                (-(1 + Math.min(A.restitution, B.restitution)) * relVz) / 2;
              if (aCanMove) A.vz -= impulse * ratioA;
              if (bCanMove) B.vz += impulse * ratioB;
            }
          }
        }
      }
    }

    // 3. Object-to-Wall Collision Resolution
    for (const b of bodies) {
      if (!b.movable || b.isAnchored) continue;
      const radius = Math.min(b.currHalfW, b.currHalfD);
      for (const w of walls) {
        const minR = radius + w.thickness * 0.5;
        const { cx, cz, distSq } = closestPointOnSegment(
          b.x,
          b.z,
          w.x1,
          w.z1,
          w.x2,
          w.z2
        );
        if (distSq < minR * minR && distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const nx = (b.x - cx) / dist;
          const nz = (b.z - cz) / dist;
          const pen = minR - dist;
          b.x += nx * pen;
          b.z += nz * pen;
          const vn = b.vx * nx + b.vz * nz;
          if (vn < 0) {
            b.vx -= (1 + b.restitution) * vn * nx;
            b.vz -= (1 + b.restitution) * vn * nz;
          }
        }
      }
    }
  }
}

/**
 * Resolves Player Capsule vs Walls and Player Capsule vs All Furniture/Obstacles.
 * Also allows the player to physically push movable objects (chairs, carts, crates)!
 */
export function resolvePlayerCollisions(
  playerPos: THREE.Vector3,
  playerRadius: number,
  isJumping: boolean,
  walls: WallCollider[],
  bodies: PhysicsBody[]
): { collidedObjectLabel: string | null; pushedObjectLabel: string | null } {
  let collidedObjectLabel: string | null = null;
  let pushedObjectLabel: string | null = null;

  // 1. Player vs Furniture & Dynamic Obstacles
  for (const b of bodies) {
    // If jumping over a low obstacle, allow clearance
    if (isJumping && b.lowObstacle && playerPos.y > 1.85) {
      continue;
    }

    // Closest point on body AABB to player (x, z)
    const minX = b.x - b.currHalfW;
    const maxX = b.x + b.currHalfW;
    const minZ = b.z - b.currHalfD;
    const maxZ = b.z + b.currHalfD;

    const closestX = Math.max(minX, Math.min(playerPos.x, maxX));
    const closestZ = Math.max(minZ, Math.min(playerPos.z, maxZ));

    const dx = playerPos.x - closestX;
    const dz = playerPos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < playerRadius * playerRadius) {
      collidedObjectLabel = b.label;
      let nx = 0;
      let nz = 0;
      let pen = 0;

      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        nx = dx / dist;
        nz = dz / dist;
        pen = playerRadius - dist;
      } else {
        // Player center is inside AABB: push out along nearest edge
        const leftPen = playerPos.x - minX;
        const rightPen = maxX - playerPos.x;
        const topPen = playerPos.z - minZ;
        const botPen = maxZ - playerPos.z;
        const minEdge = Math.min(leftPen, rightPen, topPen, botPen);
        if (minEdge === leftPen) {
          nx = -1;
          pen = leftPen + playerRadius;
        } else if (minEdge === rightPen) {
          nx = 1;
          pen = rightPen + playerRadius;
        } else if (minEdge === topPen) {
          nz = -1;
          pen = topPen + playerRadius;
        } else {
          nz = 1;
          pen = botPen + playerRadius;
        }
      }

      if (b.movable && !b.isAnchored && b.mass <= 45) {
        // Pushable obstacle! Transfer push impulse to the object & share separation
        pushedObjectLabel = b.label;
        const pushRatio = 0.55;
        playerPos.x += nx * pen * (1 - pushRatio);
        playerPos.z += nz * pen * (1 - pushRatio);
        b.x -= nx * pen * pushRatio;
        b.z -= nz * pen * pushRatio;
        b.vx -= nx * 1.35;
        b.vz -= nz * 1.35;
      } else {
        // Solid heavy obstacle / furniture: slide player smoothly along edge
        playerPos.x += nx * pen;
        playerPos.z += nz * pen;
      }
    }
  }

  // 2. Player vs Architectural Walls (with doorway gaps)
  for (const w of walls) {
    const minR = playerRadius + w.thickness * 0.5;
    const { cx, cz, distSq } = closestPointOnSegment(
      playerPos.x,
      playerPos.z,
      w.x1,
      w.z1,
      w.x2,
      w.z2
    );
    if (distSq < minR * minR && distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const nx = (playerPos.x - cx) / dist;
      const nz = (playerPos.z - cz) / dist;
      const pen = minR - dist;
      playerPos.x += nx * pen;
      playerPos.z += nz * pen;
    }
  }

  return { collidedObjectLabel, pushedObjectLabel };
}
