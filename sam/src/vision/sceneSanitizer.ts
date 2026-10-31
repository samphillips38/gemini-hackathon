import { RoomSceneGraph, RoomObjectNode } from "@/types/contracts";

/**
 * Deterministic Scene Sanitizer:
 * 1) Snaps floor-standing objects inside the room perimeter [0.05m .. width - w]
 * 2) Snaps stacked child objects (`parent_id !== null`) to their parent's (x_m, z_m)
 * 3) Ensures an `exit_door` and `bed`/`is_occupant_start` exist so A* pathfinding never breaks.
 */
export function sanitizeRoomScene(raw: RoomSceneGraph): RoomSceneGraph {
  const width_m = Math.max(3.0, Math.min(8.0, Number(raw.room?.width_m || 4.4)));
  const depth_m = Math.max(3.0, Math.min(8.0, Number(raw.room?.depth_m || 4.0)));
  const height_m = Math.max(2.4, Math.min(4.0, Number(raw.room?.height_m || 2.7)));
  const floor_level = Math.max(1, Math.min(60, Math.round(Number(raw.room?.floor_level || 1))));
  const renter_no_drill = Boolean(raw.room?.renter_no_drill);

  const sanitizedObjects: RoomObjectNode[] = (raw.objects || []).map((obj, idx) => {
    const w = Math.max(0.15, Math.min(width_m - 0.2, Number(obj.width_m || 0.8)));
    const d = Math.max(0.1, Math.min(depth_m - 0.2, Number(obj.depth_m || 0.6)));
    const h = Math.max(0.2, Math.min(height_m - 0.1, Number(obj.height_m || 1.0)));

    const x_m = Math.max(0.05, Math.min(width_m - w - 0.05, Number(obj.x_m || 0.5)));
    const z_m = Math.max(0.05, Math.min(depth_m - d - 0.05, Number(obj.z_m || 0.5)));

    const validRotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    const rot = validRotations.includes(obj.rotation_deg as 0 | 90 | 180 | 270)
      ? (obj.rotation_deg as 0 | 90 | 180 | 270)
      : 0;

    return {
      ...obj,
      id: obj.id || `${obj.category}_${idx + 1}`,
      width_m: Number(w.toFixed(2)),
      depth_m: Number(d.toFixed(2)),
      height_m: Number(h.toFixed(2)),
      x_m: Number(x_m.toFixed(2)),
      z_m: Number(z_m.toFixed(2)),
      rotation_deg: rot,
      mass_kg: Math.max(1, Number(obj.mass_kg || 20)),
      anchored_to_wall: Boolean(obj.anchored_to_wall),
      is_fragile: Boolean(obj.is_fragile),
    };
  });

  // Snap child objects to their parent's x_m, z_m coordinates
  for (const obj of sanitizedObjects) {
    if (obj.parent_id) {
      const parent = sanitizedObjects.find((p) => p.id === obj.parent_id);
      if (parent) {
        obj.x_m = parent.x_m;
        obj.z_m = parent.z_m;
        if (!obj.shelf_level) obj.shelf_level = "top";
      } else {
        obj.parent_id = null;
      }
    }
  }

  // Ensure an exit door exists
  if (!sanitizedObjects.some((o) => o.category === "exit_door")) {
    sanitizedObjects.push({
      id: "exit_door_1",
      category: "exit_door",
      label: "Room Exit Door",
      parent_id: null,
      x_m: Number((width_m - 1.05).toFixed(2)),
      z_m: Number((depth_m - 0.15).toFixed(2)),
      width_m: 0.9,
      height_m: 2.05,
      depth_m: 0.12,
      rotation_deg: 0,
      mass_kg: 30,
      anchored_to_wall: true,
      is_fragile: false,
    });
  }

  // Ensure at least one occupant start object exists
  if (!sanitizedObjects.some((o) => o.is_occupant_start)) {
    const bed = sanitizedObjects.find((o) => o.category === "bed");
    if (bed) bed.is_occupant_start = true;
    else if (sanitizedObjects.length > 0) sanitizedObjects[0].is_occupant_start = true;
  }

  return {
    room: {
      width_m,
      depth_m,
      height_m,
      floor_level,
      renter_no_drill,
    },
    earthquake: {
      magnitude_mw: Number(raw.earthquake?.magnitude_mw || 6.8),
      duration_s: Number(raw.earthquake?.duration_s || 6.0),
      dominant_axis: raw.earthquake?.dominant_axis || "XZ",
    },
    objects: sanitizedObjects,
  };
}
