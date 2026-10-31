// ============================================================================
// COMMON DETERMINISTIC PATHFINDER (2D Grid A* for Plan B + Graph A* for Plan C)
// ============================================================================

export interface Point2D {
  x_m: number;
  z_m: number;
}

export interface BBox2D {
  min_x: number;
  max_x: number;
  min_z: number;
  max_z: number;
  object_id?: string;
}

export interface CircleHazard2D {
  x_m: number;
  z_m: number;
  radius_m: number;
}

const CELL_SIZE_M = 0.2;

export function runGridAStar(params: {
  roomWidthM: number;
  roomDepthM: number;
  start: Point2D;
  goal: Point2D;
  obstacles: BBox2D[];
  circles?: CircleHazard2D[];
  clearanceRadiusM?: number;
}): {
  reachable: boolean;
  path: Point2D[];
  blockingObjectIds: string[];
} {
  const {
    roomWidthM,
    roomDepthM,
    start,
    goal,
    obstacles,
    circles = [],
    clearanceRadiusM = 0.18,
  } = params;

  const cols = Math.max(4, Math.ceil(roomWidthM / CELL_SIZE_M));
  const rows = Math.max(4, Math.ceil(roomDepthM / CELL_SIZE_M));

  const toGrid = (p: Point2D) => ({
    c: Math.min(cols - 1, Math.max(0, Math.floor(p.x_m / CELL_SIZE_M))),
    r: Math.min(rows - 1, Math.max(0, Math.floor(p.z_m / CELL_SIZE_M))),
  });

  const toWorld = (c: number, r: number): Point2D => ({
    x_m: Number(((c + 0.5) * CELL_SIZE_M).toFixed(2)),
    z_m: Number(((r + 0.5) * CELL_SIZE_M).toFixed(2)),
  });

  const startCell = toGrid(start);
  const goalCell = toGrid(goal);

  const isCellBlocked = (c: number, r: number, ignoreStartGoal = true): string[] => {
    if (
      ignoreStartGoal &&
      ((Math.abs(c - startCell.c) <= 1 && Math.abs(r - startCell.r) <= 1) ||
        (Math.abs(c - goalCell.c) <= 1 && Math.abs(r - goalCell.r) <= 1))
    ) {
      // Still check if an obstacle directly covers the goal doorway
      const wx = (c + 0.5) * CELL_SIZE_M;
      const wz = (r + 0.5) * CELL_SIZE_M;
      if (Math.abs(c - goalCell.c) <= 1 && Math.abs(r - goalCell.r) <= 1) {
        const goalBlockers: string[] = [];
        for (const obs of obstacles) {
          if (
            wx >= obs.min_x - clearanceRadiusM &&
            wx <= obs.max_x + clearanceRadiusM &&
            wz >= obs.min_z - clearanceRadiusM &&
            wz <= obs.max_z + clearanceRadiusM
          ) {
            if (obs.object_id) goalBlockers.push(obs.object_id);
          }
        }
        return goalBlockers;
      }
      return [];
    }

    const wx = (c + 0.5) * CELL_SIZE_M;
    const wz = (r + 0.5) * CELL_SIZE_M;
    const hitIds: string[] = [];

    for (const obs of obstacles) {
      if (
        wx >= obs.min_x - clearanceRadiusM &&
        wx <= obs.max_x + clearanceRadiusM &&
        wz >= obs.min_z - clearanceRadiusM &&
        wz <= obs.max_z + clearanceRadiusM
      ) {
        hitIds.push(obs.object_id ?? "obstacle");
      }
    }

    for (const circle of circles) {
      const dx = wx - circle.x_m;
      const dz = wz - circle.z_m;
      if (Math.hypot(dx, dz) <= circle.radius_m) {
        hitIds.push("glass_hazard");
      }
    }

    return hitIds;
  };

  const key = (c: number, r: number) => `${c},${r}`;
  const openSet = new Set<string>([key(startCell.c, startCell.r)]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(startCell.c, startCell.r), 0]]);
  const fScore = new Map<string, number>([
    [
      key(startCell.c, startCell.r),
      Math.hypot(goalCell.c - startCell.c, goalCell.r - startCell.r),
    ],
  ]);

  const encounteredBlockers = new Set<string>();

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  while (openSet.size > 0) {
    let currentKey = "";
    let lowestF = Infinity;
    for (const k of Array.from(openSet)) {
      const f = fScore.get(k) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentKey = k;
      }
    }

    if (!currentKey) break;
    const [cc, cr] = currentKey.split(",").map(Number);

    if (cc === goalCell.c && cr === goalCell.r) {
      const rawPath: Point2D[] = [];
      let curr: string | undefined = currentKey;
      while (curr) {
        const [pc, pr] = curr.split(",").map(Number);
        rawPath.push(toWorld(pc, pr));
        curr = cameFrom.get(curr);
      }
      rawPath.reverse();
      return {
        reachable: true,
        path: rawPath,
        blockingObjectIds: [],
      };
    }

    openSet.delete(currentKey);

    for (const [dc, dr, cost] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

      const blockers = isCellBlocked(nc, nr);
      if (blockers.length > 0) {
        blockers.forEach((id) => {
          if (id !== "obstacle" && id !== "glass_hazard") {
            encounteredBlockers.add(id);
          }
        });
        continue;
      }

      const nKey = key(nc, nr);
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + cost;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, currentKey);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + Math.hypot(goalCell.c - nc, goalCell.r - nr));
        openSet.add(nKey);
      }
    }
  }

  return {
    reachable: false,
    path: [start, goal],
    blockingObjectIds: Array.from(encounteredBlockers),
  };
}
