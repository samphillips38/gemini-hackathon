import {
  RoomSceneGraph,
  RoomObjectNode,
  ObjectHazardResult,
  EgressAndShelterResult,
  MonteCarloQuakeSummary,
} from "@/types/contracts";

/**
 * Calculates Peak Ground Acceleration (PGA in g) and Floor Amplification
 * from Richter / Moment Magnitude (Mw) and Building Floor Level.
 */
export function calculateFloorPGA(magnitude_mw: number, floor_level: number): number {
  // Base ground PGA (in g): e.g. 5.0 -> 0.08g, 6.0 -> 0.22g, 6.8 -> 0.44g, 7.5 -> 0.78g
  const basePgaG = 0.04 * Math.pow(10, 0.38 * (magnitude_mw - 4.2));
  // Whiplash / modal amplification on upper floors (approx +11% per floor above 1st)
  const floorAmplification = 1.0 + Math.max(0, floor_level - 1) * 0.11;
  return Number((basePgaG * floorAmplification).toFixed(3));
}

/**
 * Computes effective Center of Mass height (h_CoM) and total mass for a floor object,
 * accounting for stacked child items on "bottom", "middle", or "top" shelves.
 */
export function computeCompositeCoM(
  parent: RoomObjectNode,
  allObjects: RoomObjectNode[]
): { totalMassKg: number; comHeightM: number; effectiveBaseWidthM: number } {
  const children = allObjects.filter((o) => o.parent_id === parent.id);
  let totalMass = parent.mass_kg;
  // Geometric center of parent furniture (slightly weighted toward frame center)
  let weightedHeightSum = parent.mass_kg * (parent.height_m * 0.52);

  for (const child of children) {
    let shelfHeightRatio = 0.5;
    if (child.shelf_level === "bottom") shelfHeightRatio = 0.14;
    else if (child.shelf_level === "middle") shelfHeightRatio = 0.52;
    else if (child.shelf_level === "top") shelfHeightRatio = 0.9;

    const childCenterY = parent.height_m * shelfHeightRatio;
    totalMass += child.mass_kg;
    weightedHeightSum += child.mass_kg * childCenterY;
  }

  const comHeightM = weightedHeightSum / Math.max(1, totalMass);
  // Tipping occurs along the narrower horizontal dimension of the furniture
  const effectiveBaseHalfWidthM = Math.min(parent.width_m, parent.depth_m) / 2;

  return {
    totalMassKg: Number(totalMass.toFixed(1)),
    comHeightM: Number(comHeightM.toFixed(2)),
    effectiveBaseWidthM: Number(effectiveBaseHalfWidthM.toFixed(2)),
  };
}

/**
 * Computes 2D axis-aligned bounding box of a floor object before & after tipping.
 */
function getRestingBBox(
  obj: RoomObjectNode,
  tipped: boolean,
  room: RoomSceneGraph["room"],
  bedObj?: RoomObjectNode,
  doorObj?: RoomObjectNode
): { min_x: number; max_x: number; min_z: number; max_z: number } {
  const isRotated = obj.rotation_deg === 90 || obj.rotation_deg === 270;
  const w = isRotated ? obj.depth_m : obj.width_m;
  const d = isRotated ? obj.width_m : obj.depth_m;

  if (!tipped) {
    return {
      min_x: Number(obj.x_m.toFixed(2)),
      max_x: Number((obj.x_m + w).toFixed(2)),
      min_z: Number(obj.z_m.toFixed(2)),
      max_z: Number((obj.z_m + d).toFixed(2)),
    };
  }

  // When a tall object tips over, its height projects into the room away from the nearest wall
  const fallReach = Math.min(obj.height_m * 0.95, 2.0);
  let min_x = obj.x_m;
  let max_x = obj.x_m + w;
  let min_z = obj.z_m;
  let max_z = obj.z_m + d;

  // Determine fall direction: pitch away from the closest wall or toward center/bed/door
  if (obj.category === "bookshelf" && bedObj) {
    // Bookshelf next to bed pitches across the bed sleep zone
    max_x = Math.min(room.width_m - 0.1, obj.x_m + w + fallReach * 0.65);
    max_z = Math.min(room.depth_m - 0.1, obj.z_m + d + fallReach * 0.55);
  } else if (obj.category === "wardrobe" && doorObj) {
    // Unanchored wardrobe near door pitches across the doorway corridor
    min_x = Math.max(0.1, obj.x_m - fallReach * 0.35);
    max_x = Math.min(room.width_m - 0.05, obj.x_m + w + fallReach * 0.5);
    min_z = Math.max(0.1, obj.z_m - fallReach * 0.45);
    max_z = Math.min(room.depth_m - 0.02, obj.z_m + d + 0.55);
  } else {
    // Generic fall away from nearest wall
    if (obj.x_m < room.width_m / 2) {
      max_x = Math.min(room.width_m - 0.1, obj.x_m + w + fallReach * 0.6);
    } else {
      min_x = Math.max(0.1, obj.x_m - fallReach * 0.6);
    }
  }

  return {
    min_x: Number(min_x.toFixed(2)),
    max_x: Number(max_x.toFixed(2)),
    min_z: Number(min_z.toFixed(2)),
    max_z: Number(max_z.toFixed(2)),
  };
}

function bboxesOverlap(
  a: { min_x: number; max_x: number; min_z: number; max_z: number },
  b: { min_x: number; max_x: number; min_z: number; max_z: number },
  margin = 0.05
): boolean {
  return (
    a.min_x - margin < b.max_x &&
    a.max_x + margin > b.min_x &&
    a.min_z - margin < b.max_z &&
    a.max_z + margin > b.min_z
  );
}

/**
 * 2D Grid A* Pathfinder (0.2m cell resolution)
 * Supports variable clearance half-width:
 * - walk (0.4m total width) -> clearanceMarginM = 0.14
 * - wheelchair (0.9m total width) -> clearanceMarginM = 0.34
 */
function findGridPathAStar(
  roomWidthM: number,
  roomDepthM: number,
  startM: { x_m: number; z_m: number },
  goalM: { x_m: number; z_m: number },
  obstacles: Array<{ min_x: number; max_x: number; min_z: number; max_z: number }>,
  glassZones: Array<{ x_m: number; z_m: number; radius_m: number }>,
  clearanceMarginM = 0.12
): Array<{ x_m: number; z_m: number }> {
  const cellSize = 0.2;
  const cols = Math.ceil(roomWidthM / cellSize);
  const rows = Math.ceil(roomDepthM / cellSize);

  const toGrid = (pt: { x_m: number; z_m: number }) => ({
    c: Math.max(0, Math.min(cols - 1, Math.floor(pt.x_m / cellSize))),
    r: Math.max(0, Math.min(rows - 1, Math.floor(pt.z_m / cellSize))),
  });

  const toWorld = (c: number, r: number) => ({
    x_m: Number(((c + 0.5) * cellSize).toFixed(2)),
    z_m: Number(((r + 0.5) * cellSize).toFixed(2)),
  });

  const start = toGrid(startM);
  const goal = toGrid(goalM);

  const isBlocked = (c: number, r: number): boolean => {
    // Always allow the exact start and goal cells
    if ((c === start.c && r === start.r) || (Math.abs(c - goal.c) <= 1 && Math.abs(r - goal.r) <= 1)) {
      return false;
    }
    const wx = (c + 0.5) * cellSize;
    const wz = (r + 0.5) * cellSize;
    for (const obs of obstacles) {
      if (
        wx >= obs.min_x - clearanceMarginM &&
        wx <= obs.max_x + clearanceMarginM &&
        wz >= obs.min_z - clearanceMarginM &&
        wz <= obs.max_z + clearanceMarginM
      ) {
        return true;
      }
    }
    return false;
  };

  const getGlassPenalty = (c: number, r: number): number => {
    const wx = (c + 0.5) * cellSize;
    const wz = (r + 0.5) * cellSize;
    for (const gz of glassZones) {
      const dist = Math.hypot(wx - gz.x_m, wz - gz.z_m);
      if (dist <= gz.radius_m) return 6.0; // Heavy penalty for barefoot shattered glass
    }
    return 0;
  };

  const key = (c: number, r: number) => `${c},${r}`;
  const openSet: Array<{ c: number; r: number; f: number; g: number }> = [
    { c: start.c, r: start.r, g: 0, f: Math.hypot(goal.c - start.c, goal.r - start.r) },
  ];
  const cameFrom = new Map<string, { c: number; r: number }>();
  const gScore = new Map<string, number>();
  gScore.set(key(start.c, start.r), 0);

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [-1, 1, 1.414],
    [1, -1, 1.414],
    [-1, -1, 1.414],
  ];

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (Math.abs(current.c - goal.c) <= 1 && Math.abs(current.r - goal.r) <= 1) {
      const path: Array<{ x_m: number; z_m: number }> = [goalM];
      let currKey = key(current.c, current.r);
      let currNode: { c: number; r: number } | undefined = { c: current.c, r: current.r };
      while (currNode) {
        path.push(toWorld(currNode.c, currNode.r));
        currKey = key(currNode.c, currNode.r);
        currNode = cameFrom.get(currKey);
      }
      path.reverse();
      return path;
    }

    for (const [dc, dr, stepCost] of dirs) {
      const nc = current.c + dc;
      const nr = current.r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      if (isBlocked(nc, nr)) continue;

      const tentativeG =
        (gScore.get(key(current.c, current.r)) ?? Infinity) +
        stepCost +
        getGlassPenalty(nc, nr);
      const nKey = key(nc, nr);
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, { c: current.c, r: current.r });
        gScore.set(nKey, tentativeG);
        const f = tentativeG + Math.hypot(goal.c - nc, goal.r - nr);
        if (!openSet.some((n) => n.c === nc && n.r === nr)) {
          openSet.push({ c: nc, r: nr, g: tentativeG, f });
        }
      }
    }
  }

  return [];
}

/**
 * Full Deterministic QuakeRoom Physics + Post-Collapse A* Egress & Shelter Verifier
 */
export function evaluateRoomScene(scene: RoomSceneGraph): EgressAndShelterResult {
  const pgaG = calculateFloorPGA(scene.earthquake.magnitude_mw, scene.room.floor_level);
  const bedObj =
    scene.objects.find((o) => o.is_occupant_start) ||
    scene.objects.find((o) => o.category === "bed");
  const doorObj = scene.objects.find((o) => o.category === "exit_door");
  const deskObj = scene.objects.find((o) => o.category === "desk");

  const bedBBox = bedObj
    ? getRestingBBox(bedObj, false, scene.room)
    : { min_x: 0.3, max_x: 1.4, min_z: 1.4, max_z: 3.4 };

  const doorCorridorBBox = doorObj
    ? {
        min_x: Math.max(0, doorObj.x_m - 0.35),
        max_x: Math.min(scene.room.width_m, doorObj.x_m + doorObj.width_m + 0.35),
        min_z: Math.max(0, doorObj.z_m - 0.85),
        max_z: scene.room.depth_m,
      }
    : { min_x: 3.0, max_x: 4.2, min_z: 3.1, max_z: 4.0 };

  const objectResults: ObjectHazardResult[] = [];
  const blockingObjectIds: string[] = [];
  const glassHazardZones: Array<{ x_m: number; z_m: number; radius_m: number }> = [];
  const postQuakeObstacles: Array<{ min_x: number; max_x: number; min_z: number; max_z: number }> = [];

  for (const obj of scene.objects) {
    if (obj.category === "exit_door") continue;

    // Window glass shatter physics
    if (obj.category === "window") {
      const shatters = scene.earthquake.magnitude_mw >= 6.2 && obj.is_fragile;
      const gx = Number((obj.x_m + obj.width_m / 2).toFixed(2));
      const gz = Number((obj.z_m + 0.75).toFixed(2));
      if (shatters) {
        glassHazardZones.push({ x_m: gx, z_m: gz, radius_m: 1.15 });
      }
      const glassHitsBed =
        shatters &&
        Math.hypot(
          gx - (bedBBox.min_x + bedBBox.max_x) / 2,
          gz - (bedBBox.min_z + bedBBox.max_z) / 2
        ) < 1.35;

      objectResults.push({
        object_id: obj.id,
        analytical_safety_factor: shatters ? 0.68 : 1.5,
        com_height_m: 1.4,
        pga_ratio_g: pgaG,
        tipped_over: false,
        shattered_or_fell: shatters,
        hit_occupant_zone: glassHitsBed,
        blocked_exit_corridor: false,
        peak_kinetic_energy_joules: shatters ? 95 : 0,
        resting_bbox_2d: getRestingBBox(obj, false, scene.room),
      });
      continue;
    }

    // Stacked child item (e.g. heavy_books_1 on bookshelf_1 or tv_monitor_1 on desk_1)
    if (obj.parent_id) {
      const parent = scene.objects.find((p) => p.id === obj.parent_id);
      const shelfHeightM =
        obj.shelf_level === "top"
          ? (parent?.height_m ?? 1.8) * 0.9
          : obj.shelf_level === "middle"
          ? (parent?.height_m ?? 1.8) * 0.52
          : 0.22;

      const sf = obj.anchored_to_wall
        ? 3.1
        : Number(((0.22 / Math.max(0.25, shelfHeightM * 0.55)) / Math.max(0.05, pgaG)).toFixed(2));
      const fell = !obj.anchored_to_wall && sf < 1.0;
      const ke = fell ? Math.round(obj.mass_kg * 9.81 * shelfHeightM) : 0;
      const parentBBox = parent
        ? getRestingBBox(parent, false, scene.room)
        : getRestingBBox(obj, false, scene.room);
      const hitBed =
        fell &&
        bboxesOverlap(
          {
            min_x: parentBBox.min_x - 0.45,
            max_x: parentBBox.max_x + 0.65,
            min_z: parentBBox.min_z - 0.35,
            max_z: parentBBox.max_z + 0.65,
          },
          bedBBox
        );

      objectResults.push({
        object_id: obj.id,
        analytical_safety_factor: sf,
        com_height_m: Number(shelfHeightM.toFixed(2)),
        pga_ratio_g: pgaG,
        tipped_over: fell,
        shattered_or_fell: fell,
        hit_occupant_zone: hitBed,
        blocked_exit_corridor: false,
        peak_kinetic_energy_joules: ke,
        resting_bbox_2d: parentBBox,
      });
      continue;
    }

    // Floor-standing furniture: Housner Overturning Stability Analysis
    const { totalMassKg, comHeightM, effectiveBaseWidthM } = computeCompositeCoM(
      obj,
      scene.objects
    );

    // Analytical Safety Factor: SF = (b / h_CoM) / (a_floor / g)
    const rawSF = (effectiveBaseWidthM / Math.max(0.2, comHeightM)) / Math.max(0.05, pgaG);
    const safetyFactor = obj.anchored_to_wall
      ? Number(Math.max(2.4, rawSF * 2.8).toFixed(2))
      : Number(rawSF.toFixed(2));

    const canTipCategory =
      obj.category === "bookshelf" ||
      obj.category === "wardrobe" ||
      ((obj.category === "heavy_item" || obj.category === "tv_monitor") &&
        obj.height_m >= 0.95);
    const tippedOver = canTipCategory && !obj.anchored_to_wall && safetyFactor < 1.0;

    const restingBBox = getRestingBBox(obj, tippedOver, scene.room, bedObj, doorObj);
    const hitOccupant =
      tippedOver && obj.id !== bedObj?.id && bboxesOverlap(restingBBox, bedBBox, 0.08);
    const blockedExit =
      tippedOver && bboxesOverlap(restingBBox, doorCorridorBBox, 0.05);

    if (blockedExit) {
      blockingObjectIds.push(obj.id);
    }

    // Keep non-bed obstacles for A* floor grid
    if (obj.id !== bedObj?.id && obj.category !== "chair") {
      postQuakeObstacles.push(restingBBox);
    }

    const keJoules = tippedOver
      ? Math.round(totalMassKg * 9.81 * comHeightM * 0.72)
      : 0;

    objectResults.push({
      object_id: obj.id,
      analytical_safety_factor: safetyFactor,
      com_height_m: comHeightM,
      pga_ratio_g: pgaG,
      tipped_over: tippedOver,
      shattered_or_fell: tippedOver,
      hit_occupant_zone: hitOccupant,
      blocked_exit_corridor: blockedExit,
      peak_kinetic_energy_joules: keJoules,
      resting_bbox_2d: restingBBox,
    });
  }

  // Occupant start point (side of bed) & Exit door goal point
  const occupantStart = bedObj
    ? {
        x_m: Number((bedObj.x_m + bedObj.width_m + 0.25).toFixed(2)),
        z_m: Number((bedObj.z_m + bedObj.depth_m * 0.5).toFixed(2)),
      }
    : { x_m: 1.5, z_m: 2.2 };

  const exitGoal = doorObj
    ? {
        x_m: Number((doorObj.x_m + doorObj.width_m * 0.5).toFixed(2)),
        z_m: Number(Math.max(0.3, doorObj.z_m - 0.15).toFixed(2)),
      }
    : { x_m: 3.7, z_m: 3.7 };

  // If a wardrobe or tall object blocked the door corridor, A* cannot pass the doorway
  const escapePath =
    blockingObjectIds.length > 0
      ? []
      : findGridPathAStar(
          scene.room.width_m,
          scene.room.depth_m,
          occupantStart,
          exitGoal,
          postQuakeObstacles,
          glassHazardZones,
          0.12 // 0.4m walking clearance
        );

  const wheelchairPath =
    blockingObjectIds.length > 0
      ? []
      : findGridPathAStar(
          scene.room.width_m,
          scene.room.depth_m,
          occupantStart,
          exitGoal,
          postQuakeObstacles,
          glassHazardZones,
          0.32 // 0.9m wheelchair clearance
        );

  const exitReachable = blockingObjectIds.length === 0 && escapePath.length > 1;
  const wheelchairReachable =
    blockingObjectIds.length === 0 && wheelchairPath.length > 1;

  // Safe Drop-Cover-Hold spot under the desk
  const safeShelterSpot = deskObj
    ? {
        x_m: Number((deskObj.x_m + deskObj.width_m * 0.5).toFixed(2)),
        z_m: Number((deskObj.z_m + deskObj.depth_m * 0.65).toFixed(2)),
        label: `Drop-Cover-Hold Under ${deskObj.label}`,
      }
    : null;

  const shelterDistM = safeShelterSpot
    ? Math.hypot(
        safeShelterSpot.x_m - occupantStart.x_m,
        safeShelterSpot.z_m - occupantStart.z_m
      )
    : 2.5;
  const shelterReachTimeS = Number((shelterDistM / 1.45).toFixed(2));

  const anyCasualtyHit = objectResults.some((r) => r.hit_occupant_zone);
  const survivable = !anyCasualtyHit && exitReachable;

  const monteCarlo = runMonteCarloQuakeSimulation(scene, 50, 42);

  return {
    survivable,
    exit_reachable_post_quake: exitReachable,
    wheelchair_reachable_post_quake: wheelchairReachable,
    escape_path_points_m: escapePath,
    safe_shelter_spot_m: safeShelterSpot,
    shelter_reach_time_s: shelterReachTimeS,
    blocking_object_ids: blockingObjectIds,
    glass_hazard_zones_m: glassHazardZones,
    object_results: objectResults,
    monte_carlo: monteCarlo,
  };
}

/**
 * Deterministic Seeded N=50 Monte Carlo Seismic Simulation (Slava + Ana Spec)
 * Evaluates exit reachability across 50 stochastic ground-motion realizations
 * for both walking (0.4m) and wheelchair (0.9m) clearance profiles.
 */
export function runMonteCarloQuakeSimulation(
  scene: RoomSceneGraph,
  runs = 50,
  seed = 42
): MonteCarloQuakeSummary {
  // Mulberry32 deterministic PRNG
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const basePga = calculateFloorPGA(
    scene.earthquake.magnitude_mw,
    scene.room.floor_level
  );
  const minPga = Number(Math.max(0.12, basePga * 0.65).toFixed(2));
  const maxPga = Number((basePga * 1.32).toFixed(2));

  const bedObj =
    scene.objects.find((o) => o.is_occupant_start) ||
    scene.objects.find((o) => o.category === "bed");
  const doorObj = scene.objects.find((o) => o.category === "exit_door");

  const doorCorridorBBox = doorObj
    ? {
        min_x: Math.max(0, doorObj.x_m - 0.35),
        max_x: Math.min(scene.room.width_m, doorObj.x_m + doorObj.width_m + 0.35),
        min_z: Math.max(0, doorObj.z_m - 0.85),
        max_z: scene.room.depth_m,
      }
    : { min_x: 3.0, max_x: 4.2, min_z: 3.1, max_z: 4.0 };

  const occupantStart = bedObj
    ? {
        x_m: Number((bedObj.x_m + bedObj.width_m + 0.25).toFixed(2)),
        z_m: Number((bedObj.z_m + bedObj.depth_m * 0.5).toFixed(2)),
      }
    : { x_m: 1.5, z_m: 2.2 };

  const exitGoal = doorObj
    ? {
        x_m: Number((doorObj.x_m + doorObj.width_m * 0.5).toFixed(2)),
        z_m: Number(Math.max(0.3, doorObj.z_m - 0.15).toFixed(2)),
      }
    : { x_m: 3.7, z_m: 3.7 };

  let walkClearCount = 0;
  let wheelchairClearCount = 0;
  const blockCounts = new Map<string, number>();

  for (let i = 0; i < runs; i++) {
    const samplePga = minPga + rand() * (maxPga - minPga);
    const directionalFactor = 0.8 + rand() * 0.45; // Random dominant wave azimuth
    const effectivePga = samplePga * directionalFactor;

    let doorBlockedInRun = false;
    const obstacles: Array<{
      min_x: number;
      max_x: number;
      min_z: number;
      max_z: number;
    }> = [];

    for (const obj of scene.objects) {
      if (obj.category === "exit_door" || obj.category === "window" || obj.parent_id) {
        continue;
      }

      const { comHeightM, effectiveBaseWidthM } = computeCompositeCoM(
        obj,
        scene.objects
      );
      const rawSF =
        effectiveBaseWidthM / Math.max(0.2, comHeightM) / Math.max(0.05, effectivePga);
      const sf = obj.anchored_to_wall ? Math.max(2.4, rawSF * 2.8) : rawSF;
      const canTip =
        obj.category === "bookshelf" ||
        obj.category === "wardrobe" ||
        ((obj.category === "heavy_item" || obj.category === "tv_monitor") &&
          obj.height_m >= 0.95);
      const tipped = canTip && !obj.anchored_to_wall && sf < 1.0;

      const bbox = getRestingBBox(obj, tipped, scene.room, bedObj, doorObj);
      if (tipped && bboxesOverlap(bbox, doorCorridorBBox, 0.05)) {
        doorBlockedInRun = true;
        blockCounts.set(obj.id, (blockCounts.get(obj.id) ?? 0) + 1);
      }

      if (obj.id !== bedObj?.id && obj.category !== "chair") {
        obstacles.push(bbox);
      }
    }

    if (!doorBlockedInRun) {
      const walkPath = findGridPathAStar(
        scene.room.width_m,
        scene.room.depth_m,
        occupantStart,
        exitGoal,
        obstacles,
        [],
        0.12
      );
      if (walkPath.length > 1) walkClearCount++;

      const wcPath = findGridPathAStar(
        scene.room.width_m,
        scene.room.depth_m,
        occupantStart,
        exitGoal,
        obstacles,
        [],
        0.32
      );
      if (wcPath.length > 1) wheelchairClearCount++;
    }
  }

  const topBlocking = Array.from(blockCounts.entries())
    .map(([id, count]) => ({
      id,
      block_rate: Number((count / runs).toFixed(2)),
    }))
    .sort((a, b) => b.block_rate - a.block_rate);

  return {
    runs,
    seed,
    pga_g_range: [minPga, maxPga],
    exit_clear_walk_count: walkClearCount,
    exit_clear_wheelchair_count: wheelchairClearCount,
    exit_reachable_p: {
      walk: Number((walkClearCount / runs).toFixed(2)),
      wheelchair: Number((wheelchairClearCount / runs).toFixed(2)),
    },
    top_blocking_objects: topBlocking,
  };
}

/**
 * Stage 1 -> Stage 2 Coordinate Converter (Slava RECONSTRUCTION_PLAN.md)
 * Converts CAGB Level 2 floorplan pixels (u, v) on cagb-L2.jpg (1934x1366)
 * into right-handed Building Metric coordinates (X_b, Y_b) using
 * AccessAble scale reference (2.10m Exhibition Rd doors = 24px -> 9.52 px/m).
 */
export function floorplanPxToBuildingMetric(
  u_px: number,
  v_px: number,
  planPxPerM = 9.52,
  imageHeightPx = 1366
): { x_m: number; y_m: number } {
  return {
    x_m: Number((u_px / planPxPerM).toFixed(2)),
    y_m: Number(((imageHeightPx - v_px) / planPxPerM).toFixed(2)),
  };
}

/**
 * Stage 3 -> Stage 4 Coordinate Converter (Slava HANDOFF.md Section 8)
 * Converts MuJoCo z-up pose ([x,y,z], quat [w,x,y,z]) to Three.js y-up pose
 * ([x, z, -y], quat [qx, qz, -qy, w]) in a single place.
 */
export function mujocoToThreePose(
  posMj: [number, number, number],
  quatMj: [number, number, number, number]
): {
  position: [number, number, number];
  quaternion: [number, number, number, number];
} {
  const [xm, ym, zm] = posMj;
  const [wm, qx, qy, qz] = quatMj;
  return {
    position: [xm, zm, -ym],
    quaternion: [qx, qz, -qy, wm],
  };
}
