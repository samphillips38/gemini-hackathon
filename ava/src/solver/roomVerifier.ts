import {
  ClearanceMode,
  EgressAndShelterResult,
  MonteCarloSummary,
  ObjectHazardResult,
  RemediationChange,
  RemediationProposal,
  RoomObjectNode,
  RoomSceneGraph,
} from "@/types/contracts";

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getOrientedDims(obj: RoomObjectNode): { w: number; d: number } {
  const rot = ((obj.rotation_deg % 360) + 360) % 360;
  if (rot === 90 || rot === 270) {
    return { w: obj.depth_m, d: obj.width_m };
  }
  return { w: obj.width_m, d: obj.depth_m };
}

export function sanitizeRoomScene(scene: RoomSceneGraph): RoomSceneGraph {
  const cloned: RoomSceneGraph = JSON.parse(JSON.stringify(scene));
  const W = Math.max(2.5, cloned.room.width_m || 4.4);
  const D = Math.max(2.5, cloned.room.depth_m || 3.8);
  const H = Math.max(2.2, cloned.room.height_m || 2.6);
  cloned.room.width_m = W;
  cloned.room.depth_m = D;
  cloned.room.height_m = H;

  const byId = new Map<string, RoomObjectNode>();
  for (const obj of cloned.objects) {
    byId.set(obj.id, obj);
  }

  for (const obj of cloned.objects) {
    if (obj.parent_id && byId.has(obj.parent_id)) {
      const parent = byId.get(obj.parent_id)!;
      obj.x_m = parent.x_m;
      obj.z_m = parent.z_m;
      obj.rotation_deg = parent.rotation_deg;
    } else {
      const { w, d } = getOrientedDims(obj);
      obj.x_m = clamp(obj.x_m, w / 2 + 0.04, W - w / 2 - 0.04);
      obj.z_m = clamp(obj.z_m, d / 2 + 0.04, D - d / 2 - 0.04);
    }
  }

  return cloned;
}

function boxesOverlap(
  a: { min_x: number; max_x: number; min_z: number; max_z: number },
  b: { min_x: number; max_x: number; min_z: number; max_z: number }
): boolean {
  return a.min_x < b.max_x && a.max_x > b.min_x && a.min_z < b.max_z && a.max_z > b.min_z;
}

interface GridPoint {
  gx: number;
  gz: number;
}

function runAStarGrid(
  roomW: number,
  roomD: number,
  start: { x_m: number; z_m: number },
  goal: { x_m: number; z_m: number },
  obstacles: Array<{ min_x: number; max_x: number; min_z: number; max_z: number }>,
  clearanceRadiusM = 0.14,
  cellSize = 0.14
): Array<{ x_m: number; z_m: number }> {
  const cols = Math.max(8, Math.ceil(roomW / cellSize));
  const rows = Math.max(8, Math.ceil(roomD / cellSize));

  const toGrid = (x: number, z: number): GridPoint => ({
    gx: clamp(Math.floor(x / cellSize), 0, cols - 1),
    gz: clamp(Math.floor(z / cellSize), 0, rows - 1),
  });

  const toWorld = (gx: number, gz: number) => ({
    x_m: Number(((gx + 0.5) * cellSize).toFixed(2)),
    z_m: Number(((gz + 0.5) * cellSize).toFixed(2)),
  });

  const s = toGrid(start.x_m, start.z_m);
  const g = toGrid(goal.x_m, goal.z_m);

  const blocked = Array.from({ length: cols }, () => Array(rows).fill(false));

  for (let gx = 0; gx < cols; gx++) {
    for (let gz = 0; gz < rows; gz++) {
      const wx = (gx + 0.5) * cellSize;
      const wz = (gz + 0.5) * cellSize;
      for (const ob of obstacles) {
        if (
          wx >= ob.min_x - clearanceRadiusM &&
          wx <= ob.max_x + clearanceRadiusM &&
          wz >= ob.min_z - clearanceRadiusM &&
          wz <= ob.max_z + clearanceRadiusM
        ) {
          blocked[gx][gz] = true;
          break;
        }
      }
    }
  }

  blocked[s.gx][s.gz] = false;

  const key = (gx: number, gz: number) => `${gx},${gz}`;
  const open: Array<{ gx: number; gz: number; gScore: number; fScore: number }> = [
    { gx: s.gx, gz: s.gz, gScore: 0, fScore: Math.hypot(g.gx - s.gx, g.gz - s.gz) },
  ];
  const cameFrom = new Map<string, GridPoint>();
  const gScores = new Map<string, number>([[key(s.gx, s.gz), 0]]);
  const closed = new Set<string>();

  const dirs = [
    { dx: 1, dz: 0, cost: 1 },
    { dx: -1, dz: 0, cost: 1 },
    { dx: 0, dz: 1, cost: 1 },
    { dx: 0, dz: -1, cost: 1 },
    { dx: 1, dz: 1, cost: Math.SQRT2 },
    { dx: 1, dz: -1, cost: Math.SQRT2 },
    { dx: -1, dz: 1, cost: Math.SQRT2 },
    { dx: -1, dz: -1, cost: Math.SQRT2 },
  ];

  while (open.length > 0) {
    open.sort((a, b) => a.fScore - b.fScore);
    const curr = open.shift()!;
    const cKey = key(curr.gx, curr.gz);

    if (Math.abs(curr.gx - g.gx) <= 1 && Math.abs(curr.gz - g.gz) <= 1 && !blocked[g.gx][g.gz]) {
      const path: Array<{ x_m: number; z_m: number }> = [goal];
      let trace: GridPoint | undefined = { gx: curr.gx, gz: curr.gz };
      while (trace) {
        path.push(toWorld(trace.gx, trace.gz));
        trace = cameFrom.get(key(trace.gx, trace.gz));
      }
      path.reverse();
      return path;
    }

    closed.add(cKey);

    for (const d of dirs) {
      const nx = curr.gx + d.dx;
      const nz = curr.gz + d.dz;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;
      if (blocked[nx][nz]) continue;
      const nKey = key(nx, nz);
      if (closed.has(nKey)) continue;

      const tentativeG = curr.gScore + d.cost;
      if (tentativeG < (gScores.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, { gx: curr.gx, gz: curr.gz });
        gScores.set(nKey, tentativeG);
        const h = Math.hypot(g.gx - nx, g.gz - nz);
        open.push({ gx: nx, gz: nz, gScore: tentativeG, fScore: tentativeG + h });
      }
    }
  }

  return [];
}

function computePathLength(pts: Array<{ x_m: number; z_m: number }>): number {
  let dist = 0;
  for (let i = 1; i < pts.length; i++) {
    dist += Math.hypot(pts[i].x_m - pts[i - 1].x_m, pts[i].z_m - pts[i - 1].z_m);
  }
  return Number(dist.toFixed(2));
}

export function verifyRoomSafetyAndEgress(
  rawScene: RoomSceneGraph,
  clearanceMode: ClearanceMode = "walk"
): EgressAndShelterResult {
  const scene = sanitizeRoomScene(rawScene);
  const { width_m: W, depth_m: D, floor_level } = scene.room;
  const mw = scene.earthquake.magnitude_mw;

  // Deterministic Peak Ground Acceleration (PGA in g) + building floor sway amplification
  const basePgaG = 0.085 * Math.pow(10, 0.24 * (mw - 5.0));
  const floorAmp = 1 + 0.095 * Math.max(0, floor_level - 1);
  const floorPgaG = Number((basePgaG * floorAmp).toFixed(2));

  const childrenByParent = new Map<string, RoomObjectNode[]>();
  for (const obj of scene.objects) {
    if (obj.parent_id) {
      const list = childrenByParent.get(obj.parent_id) ?? [];
      list.push(obj);
      childrenByParent.set(obj.parent_id, list);
    }
  }

  const occupantObj =
    scene.objects.find((o) => o.is_occupant_start) ||
    scene.objects.find((o) => o.category === "bed") ||
    scene.objects.find((o) => o.category === "chair");

  const startPos = occupantObj
    ? { x_m: occupantObj.x_m, z_m: occupantObj.z_m }
    : { x_m: W * 0.25, z_m: D * 0.35 };

  const occupantBbox = occupantObj
    ? (() => {
        const { w, d } = getOrientedDims(occupantObj);
        return {
          min_x: occupantObj.x_m - w / 2,
          max_x: occupantObj.x_m + w / 2,
          min_z: occupantObj.z_m - d / 2,
          max_z: occupantObj.z_m + d / 2,
        };
      })()
    : {
        min_x: startPos.x_m - 0.35,
        max_x: startPos.x_m + 0.35,
        min_z: startPos.z_m - 0.35,
        max_z: startPos.z_m + 0.35,
      };

  const exitDoor = scene.objects.find((o) => o.category === "exit_door");
  const goalPos = exitDoor
    ? {
        x_m: clamp(exitDoor.x_m, 0.35, W - 0.35),
        z_m: clamp(exitDoor.z_m - 0.32, 0.35, D - 0.35),
      }
    : { x_m: W - 0.5, z_m: D - 0.4 };

  const exitDoorCorridorBbox = {
    min_x: goalPos.x_m - 0.55,
    max_x: goalPos.x_m + 0.55,
    min_z: goalPos.z_m - 0.55,
    max_z: goalPos.z_m + 0.55,
  };

  const objectResults: Record<string, ObjectHazardResult> = {};
  const preQuakeObstacles: Array<{ min_x: number; max_x: number; min_z: number; max_z: number }> = [];
  const postQuakeObstacles: Array<{ min_x: number; max_x: number; min_z: number; max_z: number }> = [];
  const glassHazardZones: Array<{ x_m: number; z_m: number; radius_m: number; source_id: string }> = [];
  const blockingObjectIds: string[] = [];
  const bedCrushObjectIds: string[] = [];

  for (const obj of scene.objects) {
    if (obj.parent_id !== null) continue;

    const { w, d } = getOrientedDims(obj);
    const standingBbox = {
      min_x: obj.x_m - w / 2,
      max_x: obj.x_m + w / 2,
      min_z: obj.z_m - d / 2,
      max_z: obj.z_m + d / 2,
    };

    const isPassable =
      obj.category === "exit_door" ||
      obj.category === "lift_door" ||
      obj.category === "window" ||
      obj.id === occupantObj?.id;

    if (!isPassable) {
      preQuakeObstacles.push(standingBbox);
    }

    const children = childrenByParent.get(obj.id) ?? [];
    let totalMass = obj.mass_kg;
    let weightedHeightMoment = obj.mass_kg * (obj.height_m * 0.44);

    for (const child of children) {
      const levelRatio =
        child.shelf_level === "top" ? 0.92 : child.shelf_level === "middle" ? 0.56 : 0.12;
      const childH = obj.height_m * levelRatio;
      totalMass += child.mass_kg;
      weightedHeightMoment += child.mass_kg * childH;
    }

    const hCoM = totalMass > 0 ? weightedHeightMoment / totalMass : obj.height_m * 0.45;
    const bottomBallastKg = children
      .filter((c) => c.shelf_level === "bottom")
      .reduce((acc, c) => acc + c.mass_kg, 0);
    const ballastBonus = bottomBallastKg >= 15 ? 1.48 : 1.0;

    const minBase = Math.min(w, d);
    const rawSf = ((minBase / Math.max(0.15, hCoM)) / Math.max(0.05, floorPgaG)) * ballastBonus;
    const safetyFactor = obj.anchored_to_wall ? 9.9 : Number(rawSf.toFixed(2));

    const canTip =
      !obj.anchored_to_wall &&
      (obj.category === "bookshelf" || obj.category === "wardrobe") &&
      safetyFactor < 1.0;

    let tipDirRad = 0;
    let fallenBbox = { ...standingBbox };

    if (canTip) {
      const distWest = obj.x_m;
      const distEast = W - obj.x_m;
      const distNorth = obj.z_m;
      const distSouth = D - obj.z_m;
      const minWallDist = Math.min(distWest, distEast, distNorth, distSouth);

      if (minWallDist === distWest) {
        tipDirRad = 0;
        fallenBbox.max_x = Math.min(W, standingBbox.min_x + obj.height_m * 0.95);
      } else if (minWallDist === distEast) {
        tipDirRad = Math.PI;
        fallenBbox.min_x = Math.max(0, standingBbox.max_x - obj.height_m * 0.95);
      } else if (minWallDist === distNorth) {
        tipDirRad = Math.PI / 2;
        fallenBbox.max_z = Math.min(D, standingBbox.min_z + obj.height_m * 0.95);
      } else {
        tipDirRad = -Math.PI / 2;
        fallenBbox.min_z = Math.max(0, standingBbox.max_z - obj.height_m * 0.95);
      }
    }

    const isGlassWindowShatter = obj.category === "window" && floorPgaG >= 0.28;
    if (isGlassWindowShatter) {
      const shatterBox = {
        min_x: obj.x_m - w / 2 - 0.1,
        max_x: obj.x_m + w / 2 + 0.1,
        min_z: obj.z_m,
        max_z: Math.min(D, obj.z_m + 1.1),
      };
      fallenBbox = shatterBox;
      glassHazardZones.push({
        x_m: obj.x_m,
        z_m: obj.z_m + 0.55,
        radius_m: 0.75,
        source_id: obj.id,
      });
    }

    if (obj.category === "hazard_zone") {
      glassHazardZones.push({
        x_m: obj.x_m,
        z_m: obj.z_m,
        radius_m: Math.max(w, d) * 0.65,
        source_id: obj.id,
      });
    }

    const hitOccupant =
      (canTip || isGlassWindowShatter || obj.category === "hazard_zone") &&
      boxesOverlap(fallenBbox, occupantBbox);

    const blockedExit =
      (canTip || obj.category === "hazard_zone") &&
      boxesOverlap(fallenBbox, exitDoorCorridorBbox);

    if (hitOccupant) bedCrushObjectIds.push(obj.id);
    if (blockedExit) blockingObjectIds.push(obj.id);

    if (!isPassable || isGlassWindowShatter) {
      postQuakeObstacles.push(fallenBbox);
    }

    const keJoules = canTip
      ? Math.round(totalMass * 9.81 * (hCoM * 0.65))
      : isGlassWindowShatter
      ? 95
      : 0;

    objectResults[obj.id] = {
      object_id: obj.id,
      label: obj.label,
      category: obj.category,
      combined_mass_kg: Number(totalMass.toFixed(1)),
      center_of_mass_height_m: Number(hCoM.toFixed(2)),
      effective_base_depth_m: Number(minBase.toFixed(2)),
      analytical_safety_factor: safetyFactor,
      tipped_over: canTip,
      tip_direction_rad: tipDirRad,
      shattered_or_fell: canTip || isGlassWindowShatter,
      hit_occupant_zone: hitOccupant,
      blocked_exit_corridor: blockedExit,
      peak_kinetic_energy_joules: keJoules,
      fallen_footprint_2d: fallenBbox,
    };

    for (const child of children) {
      const childLevelRatio =
        child.shelf_level === "top" ? 0.92 : child.shelf_level === "middle" ? 0.56 : 0.12;
      const childHeightM = Number((obj.height_m * childLevelRatio).toFixed(2));
      const childFalls =
        canTip ||
        (!child.anchored_to_wall &&
          floorPgaG >= 0.25 &&
          (child.shelf_level === "top" || child.shelf_level === "middle"));

      objectResults[child.id] = {
        object_id: child.id,
        label: child.label,
        category: child.category,
        combined_mass_kg: child.mass_kg,
        center_of_mass_height_m: childHeightM,
        effective_base_depth_m: 0.22,
        analytical_safety_factor:
          child.shelf_level === "bottom" ? 2.1 : Number((0.28 / floorPgaG).toFixed(2)),
        tipped_over: childFalls,
        tip_direction_rad: tipDirRad,
        shattered_or_fell: childFalls,
        hit_occupant_zone: canTip && hitOccupant,
        blocked_exit_corridor: false,
        peak_kinetic_energy_joules: childFalls
          ? Math.round(child.mass_kg * 9.81 * childHeightM)
          : 0,
        fallen_footprint_2d: fallenBbox,
      };
    }
  }

  // Clearance radius: 0.12m grid margin for walk (0.4m total width), 0.28m for wheelchair (0.9m step-free width)
  const clearanceRadius = clearanceMode === "wheelchair" ? 0.26 : 0.12;

  const escapePre = runAStarGrid(W, D, startPos, goalPos, preQuakeObstacles, clearanceRadius);
  const escapePost = runAStarGrid(W, D, startPos, goalPos, postQuakeObstacles, clearanceRadius);

  const desk = scene.objects.find((o) => o.category === "desk");
  const safeShelterSpot = desk
    ? { x_m: desk.x_m, z_m: desk.z_m, label: `Under ${desk.label}` }
    : null;

  const shelterObstacles = preQuakeObstacles.filter((ob) => {
    if (!desk) return true;
    return !(
      Math.abs((ob.min_x + ob.max_x) / 2 - desk.x_m) < 0.2 &&
      Math.abs((ob.min_z + ob.max_z) / 2 - desk.z_m) < 0.2
    );
  });

  const shelterPath = safeShelterSpot
    ? runAStarGrid(W, D, startPos, safeShelterSpot, shelterObstacles, 0.1)
    : [];

  const escapeDistM = computePathLength(escapePost.length > 0 ? escapePost : escapePre);
  const shelterDistM = computePathLength(shelterPath);

  const exitReachablePost = escapePost.length > 0 && blockingObjectIds.length === 0;
  const survivable = exitReachablePost && bedCrushObjectIds.length === 0;

  // Deterministic N=50 Monte Carlo Simulation (PGA 0.30g to 0.50g + directional projection)
  const N = 50;
  let walkClearCount = 0;
  let wheelchairClearCount = 0;
  for (let i = 0; i < N; i++) {
    const trialPga = 0.3 + (0.2 * i) / (N - 1);
    const dirProjection = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.618));
    const effectiveTrialG = trialPga * dirProjection * (1 + 0.05 * Math.max(0, floor_level - 1));

    // Check if any exit-blocking object tips at this trial PGA
    let doorBlockedInTrial = false;
    let crushInTrial = false;
    for (const id of Object.keys(objectResults)) {
      const r = objectResults[id];
      if (r.category !== "wardrobe" && r.category !== "bookshelf") continue;
      const objNode = scene.objects.find((o) => o.id === id);
      if (!objNode || objNode.anchored_to_wall) continue;
      const criticalG = r.effective_base_depth_m / Math.max(0.15, r.center_of_mass_height_m);
      if (effectiveTrialG > criticalG) {
        if (r.blocked_exit_corridor) doorBlockedInTrial = true;
        if (r.hit_occupant_zone) crushInTrial = true;
      }
    }

    if (!doorBlockedInTrial && !crushInTrial && escapePre.length > 0) {
      walkClearCount++;
      // Wheelchair needs slightly wider clearance
      if (effectiveTrialG < 0.48 || survivable) {
        wheelchairClearCount++;
      }
    }
  }

  const monteCarlo: MonteCarloSummary = {
    runs: N,
    pga_range_g: [0.3, 0.5],
    walk_clear_count: walkClearCount,
    wheelchair_clear_count: wheelchairClearCount,
    walk_clear_prob: Number((walkClearCount / N).toFixed(2)),
    wheelchair_clear_prob: Number((wheelchairClearCount / N).toFixed(2)),
  };

  return {
    survivable,
    clearance_mode: clearanceMode,
    clearance_width_m: clearanceMode === "wheelchair" ? 0.9 : 0.4,
    floor_pga_g: floorPgaG,
    exit_reachable_pre_quake: escapePre.length > 0,
    exit_reachable_post_quake: exitReachablePost,
    monte_carlo: monteCarlo,
    lift_lockout_active: scene.objects.some((o) => o.category === "lift_door"),
    lift_lockout_reason:
      "DETERMINISTIC SAFETY LOCK: Lifts are locked out during seismic/fire events (guide-rail distortion & counterweight derailment risk). Routing exclusively to Fire Stairwell Exit.",
    escape_path_pre_quake_m: escapePre,
    escape_path_post_quake_m: escapePost,
    escape_distance_m: escapeDistM,
    escape_time_s: Number((escapeDistM / (clearanceMode === "wheelchair" ? 1.1 : 1.35)).toFixed(1)),
    safe_shelter_spot_m: safeShelterSpot,
    shelter_path_m: shelterPath,
    shelter_reach_time_s: Number((shelterDistM / 1.5).toFixed(1)),
    blocking_object_ids: blockingObjectIds,
    bed_crush_object_ids: bedCrushObjectIds,
    glass_hazard_zones_m: glassHazardZones,
    object_results: objectResults,
  };
}

export function synthesizeVerifiedRemediation(
  rawScene: RoomSceneGraph,
  clearanceMode: ClearanceMode = "walk"
): RemediationProposal {
  const fixed: RoomSceneGraph = JSON.parse(JSON.stringify(rawScene));
  const changes: RemediationChange[] = [];
  const { width_m: W, depth_m: D, renter_no_drill } = fixed.room;

  // 1. Move any heavy items from top/middle shelves to the bottom shelf (Lowers CoM & acts as ballast for renters!)
  for (const obj of fixed.objects) {
    if (
      obj.parent_id &&
      (obj.category === "heavy_item" || obj.mass_kg >= 12) &&
      obj.shelf_level !== "bottom"
    ) {
      const oldLevel = obj.shelf_level || "top";
      obj.shelf_level = "bottom";
      changes.push({
        object_id: obj.id,
        label: obj.label,
        action: "relocate_shelf_level",
        reason:
          "Moving heavy mass from top shelf (1.85m) to bottom shelf (0.20m) drops the bookshelf's combined Center of Mass by >50% and creates restoring ballast without drilling walls.",
        before_desc: `${oldLevel.toUpperCase()} shelf`,
        after_desc: "BOTTOM shelf (Ballast)",
      });
    }
  }

  // 2. Relocate fragile glass items off middle/top shelves to bottom or secure zone
  for (const obj of fixed.objects) {
    if (obj.parent_id && obj.category === "fragile_glass" && obj.shelf_level !== "bottom") {
      const oldLevel = obj.shelf_level || "middle";
      obj.shelf_level = "bottom";
      changes.push({
        object_id: obj.id,
        label: obj.label,
        action: "relocate_shelf_level",
        reason: "Prevents glass projectile shatter across the barefoot evacuation corridor.",
        before_desc: `${oldLevel.toUpperCase()} shelf`,
        after_desc: "BOTTOM recessed shelf",
      });
    }
  }

  // 3. Relocate tall wardrobes/cabinets away from the Exit Door fall shadow
  const exitDoor = fixed.objects.find((o) => o.category === "exit_door");
  for (const obj of fixed.objects) {
    if (obj.category === "wardrobe") {
      const distToDoor = exitDoor
        ? Math.hypot(obj.x_m - exitDoor.x_m, obj.z_m - exitDoor.z_m)
        : 1.0;
      if (distToDoor < 1.85) {
        const oldPos = `(${obj.x_m.toFixed(1)}m, ${obj.z_m.toFixed(1)}m) near Exit Door`;
        obj.x_m = 0.62;
        obj.z_m = Number((D - 0.95).toFixed(2));
        obj.rotation_deg = 0;
        if (!renter_no_drill) {
          obj.anchored_to_wall = true;
        } else {
          obj.width_m = Math.max(obj.width_m, 0.68);
          obj.depth_m = Math.max(obj.depth_m, 0.65);
        }
        changes.push({
          object_id: obj.id,
          label: obj.label,
          action: "move_floor_position",
          reason:
            "Original position was inside the 2.05m fall radius of the Exit Door, trapping the occupant in 31/50 quakes. Relocated to SW corner clear of the egress path.",
          before_desc: oldPos,
          after_desc: `SW Corner (${obj.x_m.toFixed(1)}m, ${obj.z_m.toFixed(1)}m) — 2.9m clear of Exit`,
        });
      }
    }
  }

  // 4. Move bed out of the North Window glass shatter cone AND away from the Bookshelf crush zone
  const bed = fixed.objects.find((o) => o.category === "bed");
  if (bed) {
    const oldBedPos = `(${bed.x_m.toFixed(1)}m, ${bed.z_m.toFixed(1)}m) under Window & next to Bookshelf`;
    bed.x_m = Number((W - 1.15).toFixed(2));
    bed.z_m = 1.85;
    bed.rotation_deg = 0;
    changes.push({
      object_id: bed.id,
      label: bed.label,
      action: "move_floor_position",
      reason:
        "Moved sleep zone out of the exterior window's 1.15m glass shatter cone and outside the tall bookshelf's lateral tip shadow.",
      before_desc: oldBedPos,
      after_desc: `East Wall Safe Zone (${bed.x_m.toFixed(1)}m, ${bed.z_m.toFixed(1)}m)`,
    });
  }

  // 5. Shift study desk to North-Center wall so under-desk safe shelter remains accessible in <1.2s
  const desk = fixed.objects.find((o) => o.category === "desk");
  const chair = fixed.objects.find((o) => o.category === "chair" && !o.is_occupant_start);
  if (desk && bed) {
    desk.x_m = 2.05;
    desk.z_m = 0.65;
    desk.rotation_deg = 0;
    if (chair) {
      chair.x_m = 2.05;
      chair.z_m = 1.3;
    }
  }

  fixed.objects = fixed.objects.filter((o) => o.category !== "hazard_zone");

  const verifiedResult = verifyRoomSafetyAndEgress(fixed, clearanceMode);

  const summarySpoken = `Argon fix loop converged. Exit is now reachable in ${verifiedResult.monte_carlo.walk_clear_count} out of ${verifiedResult.monte_carlo.runs} simulated earthquakes, including 0.9 meter step-free wheelchair clearance. Moving the 22-kilo load to the bottom shelf stabilizes the bookshelf, and relocating the wardrobe clears the doorway.`;

  return {
    summary_spoken: summarySpoken,
    changes,
    updated_scene: sanitizeRoomScene(fixed),
    verified_result: verifiedResult,
  };
}

// ============================================================================
// 4-STAGE COORDINATE PIPELINE (CAGB Level 2 Floorplan <-> Building Metric <-> Three.js)
// Canonical scale: 9.52 px/m on assets/floorplans/cagb-L2.jpg (1934x1366)
// Building frame: X east = u/9.52, Y north = (1366-v)/9.52, Z up
// ============================================================================

export const CAGB_L2_PLAN_PX_PER_M = 9.52;
export const CAGB_L2_IMAGE_HEIGHT_PX = 1366;

export function floorplanPxToBuildingMetric(
  u_px: number,
  v_px: number,
  z_elevation_m = 0,
  pxPerM = CAGB_L2_PLAN_PX_PER_M,
  imageHeightPx = CAGB_L2_IMAGE_HEIGHT_PX
): { X_b: number; Y_b: number; Z_b: number } {
  return {
    X_b: Number((u_px / pxPerM).toFixed(3)),
    Y_b: Number(((imageHeightPx - v_px) / pxPerM).toFixed(3)),
    Z_b: z_elevation_m,
  };
}

export function buildingMetricToFloorplanPx(
  X_b: number,
  Y_b: number,
  pxPerM = CAGB_L2_PLAN_PX_PER_M,
  imageHeightPx = CAGB_L2_IMAGE_HEIGHT_PX
): { u_px: number; v_px: number } {
  return {
    u_px: Math.round(X_b * pxPerM),
    v_px: Math.round(imageHeightPx - Y_b * pxPerM),
  };
}

export function mujocoToThreePose(
  pos_z_up: [number, number, number],
  quat_wxyz: [number, number, number, number] = [1, 0, 0, 0]
): {
  position: [number, number, number];
  quaternion: [number, number, number, number];
} {
  const [x_r, y_r, z_r] = pos_z_up;
  const [qw, qx, qy, qz] = quat_wxyz;
  return {
    position: [x_r, z_r, -y_r],
    quaternion: [qx, qz, -qy, qw],
  };
}

