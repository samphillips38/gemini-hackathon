import {
  EgressAndShelterResult,
  ObjectHazardResult,
  RoomObjectNode,
  RoomSceneGraph,
} from "@/types/contracts";
import { BBox2D, CircleHazard2D, Point2D, runGridAStar } from "./pathfinder";

// ============================================================================
// PLAN B DETERMINISTIC VERIFIER: Housner Overturning + Post-Collapse A* Egress
// ============================================================================

const GRAVITY = 9.81;

export interface DetailedCoMInfo {
  total_mass_kg: number;
  h_com_m: number;
  effective_base_half_width_m: number;
  floor_accel_g: number;
  safety_factor: number;
}

export function computeObjectCoMAndSafetyFactor(
  obj: RoomObjectNode,
  allObjects: RoomObjectNode[],
  roomFloorLevel: number,
  magnitudeMw: number
): DetailedCoMInfo {
  // Base PGA from Mw (calibrated so 6.8M at ground is ~0.34g, amplified by floor height)
  const basePgaG = Math.max(0.08, 0.34 * Math.pow(10, 0.22 * (magnitudeMw - 6.8)));
  const floorAmplification = 1 + 0.12 * Math.max(0, roomFloorLevel - 1);
  const floorAccelG = Number((basePgaG * floorAmplification).toFixed(3));

  const children = allObjects.filter((c) => c.parent_id === obj.id);

  let weightedHeightSum = obj.mass_kg * (obj.height_m * 0.5);
  let totalMass = obj.mass_kg;

  for (const child of children) {
    const levelFraction =
      child.shelf_level === "bottom"
        ? 0.14
        : child.shelf_level === "middle"
        ? 0.52
        : 0.88; // default top
    const childHeight = obj.height_m * levelFraction;
    weightedHeightSum += child.mass_kg * childHeight;
    totalMass += child.mass_kg;
  }

  const hComM = Number((weightedHeightSum / Math.max(1, totalMass)).toFixed(2));
  // Effective tipping half-width is half of the thinner horizontal dimension
  const thinnerHorizontalM = Math.min(obj.width_m, obj.depth_m);
  const bHalfWidthM = Number((thinnerHorizontalM * 0.5).toFixed(3));

  // If anchored to wall, effective overturning resistance is boosted significantly
  const anchorMultiplier = obj.anchored_to_wall ? 3.2 : 1.0;

  // Low/wide furniture (bed, desk, door, window) doesn't overturn like slender blocks
  const categoryStabilityBonus =
    obj.category === "bed" ||
    obj.category === "desk" ||
    obj.category === "exit_door" ||
    obj.category === "window"
      ? 2.8
      : 1.0;

  // When heavy ballast is placed on the bottom shelf, low CoM + friction provides extra rocking damping
  const bottomBallastMass = children
    .filter((c) => c.shelf_level === "bottom")
    .reduce((acc, c) => acc + c.mass_kg, 0);
  const ballastBonus = bottomBallastMass >= 15 ? 4.2 : 1.0;

  const rawSf =
    ((bHalfWidthM / Math.max(0.15, hComM)) / Math.max(0.05, floorAccelG)) *
    anchorMultiplier *
    categoryStabilityBonus *
    ballastBonus;

  return {
    total_mass_kg: Number(totalMass.toFixed(1)),
    h_com_m: hComM,
    effective_base_half_width_m: bHalfWidthM,
    floor_accel_g: floorAccelG,
    safety_factor: Number(rawSf.toFixed(2)),
  };
}

export function getOrientedFootprintBBox(obj: RoomObjectNode): BBox2D {
  const isRotated = obj.rotation_deg === 90 || obj.rotation_deg === 270;
  const spanX = isRotated ? obj.depth_m : obj.width_m;
  const spanZ = isRotated ? obj.width_m : obj.depth_m;
  return {
    min_x: Number((obj.x_m - spanX / 2).toFixed(2)),
    max_x: Number((obj.x_m + spanX / 2).toFixed(2)),
    min_z: Number((obj.z_m - spanZ / 2).toFixed(2)),
    max_z: Number((obj.z_m + spanZ / 2).toFixed(2)),
    object_id: obj.id,
  };
}

function bboxesOverlap(a: BBox2D, b: BBox2D, margin = 0.05): boolean {
  return (
    a.min_x <= b.max_x + margin &&
    a.max_x >= b.min_x - margin &&
    a.min_z <= b.max_z + margin &&
    a.max_z >= b.min_z - margin
  );
}

export function verifyRoomScene(scene: RoomSceneGraph): EgressAndShelterResult {
  const floorObjects = scene.objects.filter((o) => o.parent_id === null);
  const occupantObj =
    floorObjects.find((o) => o.is_occupant_start) ??
    floorObjects.find((o) => o.category === "bed") ??
    floorObjects[0];
  const exitDoorObj =
    floorObjects.find((o) => o.category === "exit_door") ??
    floorObjects[floorObjects.length - 1];

  const occupantBBox = occupantObj
    ? getOrientedFootprintBBox(occupantObj)
    : { min_x: 0.5, max_x: 1.5, min_z: 0.5, max_z: 1.5 };
  const exitDoorBBox = exitDoorObj
    ? getOrientedFootprintBBox(exitDoorObj)
    : {
        min_x: scene.room.width_m - 1,
        max_x: scene.room.width_m,
        min_z: scene.room.depth_m - 0.5,
        max_z: scene.room.depth_m,
      };

  const objectResults: ObjectHazardResult[] = [];
  const postCollapseObstacles: BBox2D[] = [];
  const glassHazardZones: CircleHazard2D[] = [];
  const blockingObjectIds = new Set<string>();

  for (const obj of scene.objects) {
    // Stacked child items inherit parent stability or slide off if unanchored on high shelves
    if (obj.parent_id !== null) {
      const parent = scene.objects.find((p) => p.id === obj.parent_id);
      const parentMetrics = parent
        ? computeObjectCoMAndSafetyFactor(
            parent,
            scene.objects,
            scene.room.floor_level,
            scene.earthquake.magnitude_mw
          )
        : null;
      const parentTips = parentMetrics ? parentMetrics.safety_factor < 1.0 : false;
      const highShelfFall =
        obj.shelf_level === "top" || (obj.shelf_level === "middle" && obj.is_fragile);
      const fell = parentTips || (highShelfFall && scene.earthquake.magnitude_mw >= 6.0);

      const baseBox = parent ? getOrientedFootprintBBox(parent) : getOrientedFootprintBBox(obj);
      const restingBox: BBox2D = fell
        ? {
            min_x: Number((baseBox.min_x - 0.25).toFixed(2)),
            max_x: Number((baseBox.max_x + 0.55).toFixed(2)),
            min_z: Number((baseBox.min_z - 0.25).toFixed(2)),
            max_z: Number((baseBox.max_z + 0.25).toFixed(2)),
            object_id: obj.id,
          }
        : baseBox;

      if (fell && obj.is_fragile) {
        glassHazardZones.push({
          x_m: Number(((restingBox.min_x + restingBox.max_x) / 2).toFixed(2)),
          z_m: Number(((restingBox.min_z + restingBox.max_z) / 2).toFixed(2)),
          radius_m: 0.65,
        });
      }

      const hitOccupant = fell && bboxesOverlap(restingBox, occupantBBox, 0.15);
      const dropHeight =
        obj.shelf_level === "top" ? 1.65 : obj.shelf_level === "middle" ? 1.05 : 0.25;
      const ke = fell ? Math.round(obj.mass_kg * GRAVITY * dropHeight) : 0;

      objectResults.push({
        object_id: obj.id,
        analytical_safety_factor: parentMetrics ? parentMetrics.safety_factor : 1.2,
        tipped_over: fell,
        shattered_or_fell: fell,
        hit_occupant_zone: hitOccupant,
        blocked_exit_corridor: false,
        peak_kinetic_energy_joules: ke,
        resting_bbox_2d: {
          min_x: restingBox.min_x,
          max_x: restingBox.max_x,
          min_z: restingBox.min_z,
          max_z: restingBox.max_z,
        },
      });
      continue;
    }

    const metrics = computeObjectCoMAndSafetyFactor(
      obj,
      scene.objects,
      scene.room.floor_level,
      scene.earthquake.magnitude_mw
    );
    const tippedOver = metrics.safety_factor < 1.0 && !obj.anchored_to_wall;
    const shattered =
      obj.is_fragile &&
      (scene.earthquake.magnitude_mw >= 6.4 || tippedOver);

    const uprightBox = getOrientedFootprintBBox(obj);
    let restingBox: BBox2D = { ...uprightBox, object_id: obj.id };

    if (tippedOver) {
      // Project fall shadow along the direction into the room interior (toward bed or door)
      const fallReachM = Number((obj.height_m * 0.92).toFixed(2));
      if (obj.x_m < scene.room.width_m * 0.45) {
        restingBox.max_x = Number(Math.min(scene.room.width_m, uprightBox.max_x + fallReachM).toFixed(2));
      } else {
        restingBox.min_x = Number(Math.max(0, uprightBox.min_x - fallReachM * 0.45).toFixed(2));
      }
      if (obj.z_m > scene.room.depth_m * 0.55) {
        restingBox.max_z = Number(Math.min(scene.room.depth_m, uprightBox.max_z + fallReachM * 0.85).toFixed(2));
      }
    }

    if (shattered && obj.category === "window") {
      const glassZone: CircleHazard2D = {
        x_m: obj.x_m,
        z_m: Number((obj.z_m + 0.75).toFixed(2)),
        radius_m: 0.95,
      };
      glassHazardZones.push(glassZone);
    }

    const hitOccupant =
      (tippedOver && bboxesOverlap(restingBox, occupantBBox, 0.12)) ||
      (shattered &&
        obj.category === "window" &&
        Math.hypot(
          occupantObj.x_m - obj.x_m,
          occupantObj.z_m - (obj.z_m + 0.75)
        ) <= 1.25);

    const blockedExit =
      tippedOver && bboxesOverlap(restingBox, exitDoorBBox, 0.55);

    if (blockedExit) {
      blockingObjectIds.add(obj.id);
    }

    const keJoules = tippedOver
      ? Math.round(metrics.total_mass_kg * GRAVITY * metrics.h_com_m * 0.62)
      : 0;

    if (
      obj.category !== "exit_door" &&
      obj.category !== "window" &&
      obj.id !== occupantObj?.id
    ) {
      postCollapseObstacles.push(restingBox);
    }

    objectResults.push({
      object_id: obj.id,
      analytical_safety_factor: metrics.safety_factor,
      tipped_over: tippedOver,
      shattered_or_fell: tippedOver || shattered,
      hit_occupant_zone: hitOccupant,
      blocked_exit_corridor: blockedExit,
      peak_kinetic_energy_joules: keJoules,
      resting_bbox_2d: {
        min_x: restingBox.min_x,
        max_x: restingBox.max_x,
        min_z: restingBox.min_z,
        max_z: restingBox.max_z,
      },
    });
  }

  const startPt: Point2D = occupantObj
    ? { x_m: occupantObj.x_m, z_m: occupantObj.z_m }
    : { x_m: 0.9, z_m: 1.2 };
  const goalPt: Point2D = exitDoorObj
    ? { x_m: exitDoorObj.x_m, z_m: Math.max(0.3, exitDoorObj.z_m - 0.25) }
    : { x_m: scene.room.width_m - 0.5, z_m: scene.room.depth_m - 0.3 };

  const aStarResult = runGridAStar({
    roomWidthM: scene.room.width_m,
    roomDepthM: scene.room.depth_m,
    start: startPt,
    goal: goalPt,
    obstacles: postCollapseObstacles,
    circles: glassHazardZones,
    clearanceRadiusM: 0.16,
  });

  aStarResult.blockingObjectIds.forEach((id) => blockingObjectIds.add(id));

  const exitReachable = aStarResult.reachable && blockingObjectIds.size === 0;
  const anyOccupantHit = objectResults.some((r) => r.hit_occupant_zone);

  // Safe Drop-Cover-Hold spot (prefer sturdy desk outside fall zones)
  const deskObj = floorObjects.find((o) => o.category === "desk");
  const safeShelterSpot = deskObj
    ? {
        x_m: deskObj.x_m,
        z_m: deskObj.z_m,
        label: `Under ${deskObj.label} (Drop-Cover-Hold)`,
      }
    : {
        x_m: Number((scene.room.width_m * 0.5).toFixed(2)),
        z_m: Number((scene.room.depth_m * 0.5).toFixed(2)),
        label: "Interior Clear Floor Zone",
      };

  const distToShelter = Math.hypot(
    safeShelterSpot.x_m - startPt.x_m,
    safeShelterSpot.z_m - startPt.z_m
  );
  const shelterReachTimeS = Number((distToShelter / 1.35).toFixed(1));

  return {
    survivable: exitReachable && !anyOccupantHit,
    exit_reachable_post_quake: exitReachable,
    escape_path_points_m: aStarResult.path,
    safe_shelter_spot_m: safeShelterSpot,
    shelter_reach_time_s: shelterReachTimeS,
    blocking_object_ids: Array.from(blockingObjectIds),
    glass_hazard_zones_m: glassHazardZones,
    object_results: objectResults,
  };
}
