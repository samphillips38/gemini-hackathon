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
  /** Elapsed time under seismic excitation (used for pre-tip rocking threshold) */
  shakeDuration?: number;
  /** Normalized tipping progress from 0 (upright) to 1 (horizontal on floor) */
  tipProgress?: number;
  /** Decaying impact shockwave intensity (0..1) triggered upon hitting the floor */
  impactIntensity?: number;
  /** Bottom-edge hinge pivot offsets so tipping furniture pivots on its base edge instead of sinking into the floor */
  pivotOffsetX?: number;
  pivotOffsetY?: number;
  pivotOffsetZ?: number;
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

  // 1. Apply seismic ground excitation & inverted-pendulum tipping dynamics
  for (const b of bodies) {
    b.collidingWithId = null;
    b.impactIntensity = Math.max(0, (b.impactIntensity ?? 0) - dt * 1.65);

    if (isShaking) {
      b.shakeDuration = (b.shakeDuration ?? 0) + dt;

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
        const slideFactor = Math.max(0, pgaG - b.friction * 0.42);
        b.vx += waveX * slideFactor * dt * 1.75;
        b.vz += waveZ * slideFactor * dt * 1.75;
      }

      if (b.willTip && !b.isAnchored) {
        // Staggered critical rocking window before center of mass crosses tipping threshold
        const staggerDelay =
          0.22 + Math.abs(Math.sin(b.x * 2.7 + b.z * 1.9)) * 0.28;

        if (b.shakeDuration < staggerDelay && (b.tipProgress ?? 0) < 0.12) {
          // Stage 1: Violent pre-tip rocking on bottom base corners
          const rockRamp = b.shakeDuration / staggerDelay;
          const rockFreq = 24.0;
          const signX = Math.sign(b.targetRotX);
          const signZ = Math.sign(b.targetRotZ);
          b.rotX =
            signX *
            (0.03 * rockRamp +
              Math.sin(elapsedTime * rockFreq + b.x) * 0.065 * rockRamp);
          b.rotZ =
            signZ *
            (0.03 * rockRamp +
              Math.cos(elapsedTime * rockFreq + b.z) * 0.065 * rockRamp);
        } else {
          // Stage 2: Inverted-pendulum gravitational overturning torque
          if (Math.abs(b.targetRotX) > 0.01) {
            const signX = Math.sign(b.targetRotX);
            const absX = Math.abs(b.rotX);
            const gravAccelX =
              signX *
              (2.2 + 12.8 * Math.sin(Math.min(Math.PI * 0.5, Math.max(0.14, absX))));
            b.angVelX += gravAccelX * dt;
          }
          if (Math.abs(b.targetRotZ) > 0.01) {
            const signZ = Math.sign(b.targetRotZ);
            const absZ = Math.abs(b.rotZ);
            const gravAccelZ =
              signZ *
              (2.2 + 12.8 * Math.sin(Math.min(Math.PI * 0.5, Math.max(0.14, absZ))));
            b.angVelZ += gravAccelZ * dt;
          }
        }
      } else {
        // Elastic rocking during shaking
        const rockAmp = b.isAnchored ? 0.012 : b.movable ? 0.075 : 0.045;
        const targetRockX =
          Math.sin(elapsedTime * 23 + b.x * 2.3) *
          Math.cos(elapsedTime * 9.5) *
          rockAmp;
        const targetRockZ =
          Math.cos(elapsedTime * 21 + b.z * 2.1) *
          Math.sin(elapsedTime * 11.2) *
          rockAmp;
        b.rotX = THREE.MathUtils.lerp(b.rotX, targetRockX, 0.3);
        b.rotZ = THREE.MathUtils.lerp(b.rotZ, targetRockZ, 0.3);
      }
    } else if (hasCollapsed) {
      if (b.willTip && !b.isAnchored) {
        if (Math.abs(b.targetRotX) > 0.01) {
          const signX = Math.sign(b.targetRotX);
          const absX = Math.abs(b.rotX);
          const gravAccelX =
            signX *
            (2.8 + 13.5 * Math.sin(Math.min(Math.PI * 0.5, Math.max(0.15, absX))));
          b.angVelX += gravAccelX * dt;
        }
        if (Math.abs(b.targetRotZ) > 0.01) {
          const signZ = Math.sign(b.targetRotZ);
          const absZ = Math.abs(b.rotZ);
          const gravAccelZ =
            signZ *
            (2.8 + 13.5 * Math.sin(Math.min(Math.PI * 0.5, Math.max(0.15, absZ))));
          b.angVelZ += gravAccelZ * dt;
        }
      } else {
        b.rotX = THREE.MathUtils.lerp(b.rotX, 0, 0.18);
        b.rotZ = THREE.MathUtils.lerp(b.rotZ, 0, 0.18);
      }
    } else {
      // Reset state when neither shaking nor collapsed
      b.shakeDuration = 0;
      b.rotX = THREE.MathUtils.lerp(b.rotX, 0, 0.2);
      b.rotZ = THREE.MathUtils.lerp(b.rotZ, 0, 0.2);
      b.angVelX = 0;
      b.angVelZ = 0;
      b.impactIntensity = 0;
    }

    // Integrate angular velocity & Stage 3 floor impact restitution bounce
    if ((isShaking || hasCollapsed) && b.willTip && !b.isAnchored) {
      b.angVelX *= Math.pow(0.96, dt * 60);
      b.angVelZ *= Math.pow(0.96, dt * 60);
      b.rotX += b.angVelX * dt;
      b.rotZ += b.angVelZ * dt;

      // Floor impact & multi-bounce restitution along X rotation axis
      if (Math.abs(b.targetRotX) > 0.01) {
        const signX = Math.sign(b.targetRotX);
        if (signX > 0 && b.rotX >= b.targetRotX) {
          b.rotX = b.targetRotX;
          if (b.angVelX > 0.55) {
            b.impactIntensity = Math.max(
              b.impactIntensity ?? 0,
              Math.min(1.0, b.angVelX / 3.8)
            );
            b.angVelX = -b.angVelX * 0.27;
          } else {
            b.angVelX = 0;
          }
        } else if (signX < 0 && b.rotX <= b.targetRotX) {
          b.rotX = b.targetRotX;
          if (b.angVelX < -0.55) {
            b.impactIntensity = Math.max(
              b.impactIntensity ?? 0,
              Math.min(1.0, Math.abs(b.angVelX) / 3.8)
            );
            b.angVelX = -b.angVelX * 0.27;
          } else {
            b.angVelX = 0;
          }
        }
      }

      // Floor impact & multi-bounce restitution along Z rotation axis
      if (Math.abs(b.targetRotZ) > 0.01) {
        const signZ = Math.sign(b.targetRotZ);
        if (signZ > 0 && b.rotZ >= b.targetRotZ) {
          b.rotZ = b.targetRotZ;
          if (b.angVelZ > 0.55) {
            b.impactIntensity = Math.max(
              b.impactIntensity ?? 0,
              Math.min(1.0, b.angVelZ / 3.8)
            );
            b.angVelZ = -b.angVelZ * 0.27;
          } else {
            b.angVelZ = 0;
          }
        } else if (signZ < 0 && b.rotZ <= b.targetRotZ) {
          b.rotZ = b.targetRotZ;
          if (b.angVelZ < -0.55) {
            b.impactIntensity = Math.max(
              b.impactIntensity ?? 0,
              Math.min(1.0, Math.abs(b.angVelZ) / 3.8)
            );
            b.angVelZ = -b.angVelZ * 0.27;
          } else {
            b.angVelZ = 0;
          }
        }
      }
    }

    // Compute normalized tipping progress (0..1) and bottom-edge hinge pivot offsets
    const maxTargetAngle = Math.max(
      0.01,
      Math.hypot(b.targetRotX, b.targetRotZ)
    );
    const currentTiltAngle = Math.hypot(b.rotX, b.rotZ);
    b.tipProgress = b.willTip
      ? THREE.MathUtils.clamp(currentTiltAngle / maxTargetAngle, 0, 1)
      : 0;

    // Hinge pivot offset keeps the bottom leading edge pinned on the floor (y >= 0)
    const absSinX = Math.abs(Math.sin(b.rotX));
    const absSinZ = Math.abs(Math.sin(b.rotZ));
    b.pivotOffsetY = absSinX * b.halfD + absSinZ * b.halfW;
    b.pivotOffsetZ = Math.sign(b.rotX) * (1 - Math.cos(b.rotX)) * b.halfD;
    b.pivotOffsetX = -Math.sign(b.rotZ) * (1 - Math.cos(b.rotZ)) * b.halfW;

    // Dynamically expand footprint AABB as tall furniture tips over
    b.currHalfW = b.halfW + absSinZ * (b.height * 0.48);
    b.currHalfD = b.halfD + absSinX * (b.height * 0.48);

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
