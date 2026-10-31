import {
  BuildingFloorGraph,
  RoomObjectNode,
  RoomSceneGraph,
} from "@/types/contracts";

// ============================================================================
// DETERMINISTIC SCENE SANITIZER (Common for Plan B Room & Plan C Building)
// ============================================================================

export function sanitizeRoomSceneGraph(raw: RoomSceneGraph): RoomSceneGraph {
  const widthM = Math.min(12, Math.max(2.5, Number(raw.room?.width_m || 4.4)));
  const depthM = Math.min(12, Math.max(2.5, Number(raw.room?.depth_m || 3.8)));
  const heightM = Math.min(4.5, Math.max(2.2, Number(raw.room?.height_m || 2.7)));
  const floorLevel = Math.min(60, Math.max(1, Math.round(raw.room?.floor_level || 1)));

  const objects: RoomObjectNode[] = (raw.objects || []).map((obj, idx) => {
    const validRotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    const snappedRot = validRotations.reduce((prev, curr) =>
      Math.abs(curr - (obj.rotation_deg || 0)) < Math.abs(prev - (obj.rotation_deg || 0))
        ? curr
        : prev
    );

    const w = Math.max(0.15, Number(obj.width_m || 0.6));
    const d = Math.max(0.15, Number(obj.depth_m || 0.6));
    const h = Math.max(0.15, Number(obj.height_m || 0.8));

    const clampedX = Math.min(widthM - w * 0.35, Math.max(w * 0.35, Number(obj.x_m || 1.0)));
    const clampedZ = Math.min(depthM - d * 0.35, Math.max(d * 0.35, Number(obj.z_m || 1.0)));

    return {
      ...obj,
      id: obj.id || `${obj.category}_${idx + 1}`,
      width_m: Number(w.toFixed(2)),
      depth_m: Number(d.toFixed(2)),
      height_m: Number(h.toFixed(2)),
      x_m: Number(clampedX.toFixed(2)),
      z_m: Number(clampedZ.toFixed(2)),
      rotation_deg: snappedRot,
      mass_kg: Math.max(0.5, Number(obj.mass_kg || 15)),
      parent_id: obj.parent_id || null,
    };
  });

  // Snap stacked child objects to their parent's (x_m, z_m) coordinates
  const byId = new Map<string, RoomObjectNode>();
  objects.forEach((o) => byId.set(o.id, o));

  for (const obj of objects) {
    if (obj.parent_id && byId.has(obj.parent_id)) {
      const parent = byId.get(obj.parent_id)!;
      obj.x_m = parent.x_m;
      obj.z_m = parent.z_m;
      if (!obj.shelf_level) {
        obj.shelf_level = "top";
      }
    }
  }

  return {
    room: {
      width_m: Number(widthM.toFixed(2)),
      depth_m: Number(depthM.toFixed(2)),
      height_m: Number(heightM.toFixed(2)),
      floor_level: floorLevel,
      renter_no_drill: Boolean(raw.room?.renter_no_drill),
    },
    earthquake: {
      magnitude_mw: Number(raw.earthquake?.magnitude_mw || 6.8),
      duration_s: Number(raw.earthquake?.duration_s || 6.0),
      dominant_axis: raw.earthquake?.dominant_axis || "XZ",
    },
    objects,
  };
}

export function sanitizeBuildingFloorGraph(
  raw: BuildingFloorGraph
): BuildingFloorGraph {
  const widthM = Math.max(10, Number(raw.width_m || 40));
  const depthM = Math.max(10, Number(raw.depth_m || 24));
  const nodeMap = new Map(raw.nodes.map((n) => [n.id, n]));

  const validEdges = (raw.edges || [])
    .filter((e) => nodeMap.has(e.from_node_id) && nodeMap.has(e.to_node_id))
    .map((e) => {
      const a = nodeMap.get(e.from_node_id)!;
      const b = nodeMap.get(e.to_node_id)!;
      const euclid = Math.hypot(a.x_m - b.x_m, a.z_m - b.z_m);
      return {
        ...e,
        length_m: Number((e.length_m > 0 ? e.length_m : euclid).toFixed(1)),
        width_m: Number((e.width_m > 0 ? e.width_m : 2.0).toFixed(1)),
      };
    });

  return {
    building_name: raw.building_name || "Scanned Building Floor Twin",
    floor_number: Number(raw.floor_number || 3),
    width_m: widthM,
    depth_m: depthM,
    walls: raw.walls || [],
    nodes: raw.nodes || [],
    edges: validEdges,
  };
}
