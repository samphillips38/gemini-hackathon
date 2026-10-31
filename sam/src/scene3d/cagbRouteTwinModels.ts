import * as THREE from "three";

export interface RouteTwinEvidence {
  video?: string;
  frame?: string;
  image?: string;
  t_s?: number;
  timestamp_s?: number;
  quote?: string;
}

export interface RouteTwinObject {
  id: string;
  type: string;
  label?: string;
  model?: string;
  pos: [number, number, number] | [number, number] | { x: number; y: number; z?: number };
  yaw?: number;
  yaw_deg?: number;
  size_m?: [number, number, number];
  mass_kg?: number;
  anchored?: boolean;
  glass?: boolean;
  hazard?: boolean | string;
  side?: "left" | "right" | "centre";
  evidence?: RouteTwinEvidence;
}

export interface RouteTwinScene {
  version?: string;
  route_id?: string;
  title?: string;
  floor?: string;
  scale_px_per_m?: number;
  waypoints?: Array<[number, number, number] | [number, number]>;
  objects: RouteTwinObject[];
}

/**
 * Canonical coordinate conversion specified by Slava:
 * Building metric frame: X east, Y north, Z up (at 9.52 px/m on cagb-L2-graph.json)
 * Three.js frame: three = [X - 150, Z, -(Y - 80)], rotation.y = -yaw (deg -> rad)
 */
export function toRouteTwinThreeCoords(
  pos: RouteTwinObject["pos"] | undefined,
  yawDeg: number = 0
): {
  position: [number, number, number];
  rotationY: number;
} {
  let X = 150;
  let Y = 80;
  let Z = 0;

  if (Array.isArray(pos)) {
    X = Number(pos[0] ?? 150);
    Y = Number(pos[1] ?? 80);
    Z = Number(pos[2] ?? 0);
  } else if (pos && typeof pos === "object") {
    X = Number(pos.x ?? 150);
    Y = Number(pos.y ?? 80);
    Z = Number(pos.z ?? 0);
  }

  const threeX = X - 150;
  const threeY = Z;
  const threeZ = -(Y - 80);
  const rotationY = -((yawDeg * Math.PI) / 180);

  return {
    position: [threeX, threeY, threeZ],
    rotationY,
  };
}

export function makeMaterials(T: typeof THREE = THREE) {
  return {
    metal: new T.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 }),
    darkMetal: new T.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 }),
    chrome: new T.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 }),
    wood: new T.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.65 }),
    lightWood: new T.MeshStandardMaterial({ color: 0xc29b61, roughness: 0.55 }),
    white: new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
    plastic: new T.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 }),
    glass: new T.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.38,
      metalness: 0.2,
      roughness: 0.1,
    }),
    hazardGlass: new T.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.45,
    }),
    hazardRed: new T.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    }),
    safeGreen: new T.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    }),
    warningAmber: new T.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    }),
    screenGlow: new T.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.2,
    }),
    fabricBlue: new T.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8 }),
    concrete: new T.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }),
    fireRed: new T.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.3 }),
    recycleGreen: new T.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 }),
  };
}

/**
 * Fallback procedural model builder matching slava/viewer/models.js signature:
 * buildModel(THREE, obj, mats) -> THREE.Group
 * Used if slava/viewer/models.js has not yet landed on disk, or as a fallback.
 */
export function buildModel(
  T: typeof THREE,
  obj: RouteTwinObject,
  mats: ReturnType<typeof makeMaterials> = makeMaterials(T)
): THREE.Group {
  const group = new T.Group();
  group.name = obj.id || obj.model || obj.type || "route_twin_obj";

  const size = obj.size_m ?? [0.85, 0.65, 1.8];
  const sx = Math.max(0.15, Number(size[0] ?? 0.85));
  const sy = Math.max(0.15, Number(size[1] ?? 0.65));
  const sz = Math.max(0.15, Number(size[2] ?? 1.8));
  const kind = String(obj.model || obj.type || "box").toLowerCase();
  const isHazard = Boolean(obj.hazard) || (!obj.anchored && ( (obj.mass_kg ?? 0) >= 35 || Boolean(obj.glass) ));

  if (kind.includes("vending")) {
    const body = new T.Mesh(new T.BoxGeometry(sx, sz, sy), mats.darkMetal);
    body.position.set(0, sz / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const windowMesh = new T.Mesh(
      new T.BoxGeometry(sx * 0.68, sz * 0.62, 0.03),
      obj.glass ? mats.hazardGlass : mats.glass
    );
    windowMesh.position.set(-sx * 0.08, sz * 0.56, sy / 2 + 0.01);
    group.add(windowMesh);

    const panel = new T.Mesh(new T.BoxGeometry(sx * 0.16, sz * 0.45, 0.03), mats.screenGlow);
    panel.position.set(sx * 0.35, sz * 0.55, sy / 2 + 0.01);
    group.add(panel);
  } else if (kind.includes("display") || kind.includes("case") || kind.includes("cabinet")) {
    const baseH = Math.min(0.45, sz * 0.25);
    const base = new T.Mesh(new T.BoxGeometry(sx, baseH, sy), mats.wood);
    base.position.set(0, baseH / 2, 0);
    base.castShadow = true;
    group.add(base);

    const glassCase = new T.Mesh(
      new T.BoxGeometry(sx * 0.96, sz - baseH, sy * 0.94),
      mats.hazardGlass
    );
    glassCase.position.set(0, baseH + (sz - baseH) / 2, 0);
    glassCase.castShadow = true;
    group.add(glassCase);

    for (let i = 1; i <= 3; i++) {
      const shelf = new T.Mesh(
        new T.BoxGeometry(sx * 0.9, 0.03, sy * 0.86),
        mats.lightWood
      );
      shelf.position.set(0, baseH + ((sz - baseH) * i) / 4, 0);
      group.add(shelf);
    }
  } else if (kind.includes("shelf") || kind.includes("shelving") || kind.includes("book") || kind.includes("rack")) {
    const frame = new T.Mesh(new T.BoxGeometry(sx, sz, sy), mats.wood);
    frame.position.set(0, sz / 2, 0);
    frame.castShadow = true;
    group.add(frame);

    const shelves = 4;
    for (let i = 1; i <= shelves; i++) {
      const shelf = new T.Mesh(
        new T.BoxGeometry(sx * 0.92, 0.04, sy * 0.95),
        mats.darkMetal
      );
      shelf.position.set(0, (sz * i) / (shelves + 1), 0.01);
      group.add(shelf);
    }
  } else if (kind.includes("lift") || kind.includes("elevator")) {
    const shaft = new T.Mesh(new T.BoxGeometry(sx, sz, sy), mats.concrete);
    shaft.position.set(0, sz / 2, 0);
    shaft.castShadow = true;
    group.add(shaft);

    const doorL = new T.Mesh(new T.BoxGeometry(sx * 0.42, sz * 0.82, 0.04), mats.chrome);
    doorL.position.set(-sx * 0.22, sz * 0.41, sy / 2 + 0.02);
    group.add(doorL);

    const doorR = new T.Mesh(new T.BoxGeometry(sx * 0.42, sz * 0.82, 0.04), mats.chrome);
    doorR.position.set(sx * 0.22, sz * 0.41, sy / 2 + 0.02);
    group.add(doorR);

    const lockoutBar = new T.Mesh(new T.BoxGeometry(sx * 0.9, 0.14, 0.06), mats.hazardRed);
    lockoutBar.position.set(0, sz * 0.5, sy / 2 + 0.04);
    group.add(lockoutBar);
  } else if (kind.includes("door") || kind.includes("exit")) {
    const frame = new T.Mesh(new T.BoxGeometry(sx, sz, Math.max(0.18, sy)), mats.metal);
    frame.position.set(0, sz / 2, 0);
    group.add(frame);

    const glassLeaf = new T.Mesh(new T.BoxGeometry(sx * 0.88, sz * 0.88, Math.max(0.08, sy * 0.5)), mats.safeGreen);
    glassLeaf.position.set(0, sz * 0.46, 0);
    group.add(glassLeaf);
  } else if (kind.includes("table") || kind.includes("desk") || kind.includes("bench")) {
    const top = new T.Mesh(new T.BoxGeometry(sx, 0.06, sy), mats.lightWood);
    top.position.set(0, sz - 0.03, 0);
    top.castShadow = true;
    group.add(top);

    const legOffsets = [
      [-sx / 2 + 0.06, -sy / 2 + 0.06],
      [sx / 2 - 0.06, -sy / 2 + 0.06],
      [-sx / 2 + 0.06, sy / 2 - 0.06],
      [sx / 2 - 0.06, sy / 2 - 0.06],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, sz - 0.06, 10), mats.darkMetal);
      leg.position.set(lx, (sz - 0.06) / 2, lz);
      group.add(leg);
    }
  } else if (kind.includes("totem") || kind.includes("sign") || kind.includes("board") || kind.includes("poster")) {
    const stand = new T.Mesh(new T.BoxGeometry(sx, sz, sy), mats.darkMetal);
    stand.position.set(0, sz / 2, 0);
    stand.castShadow = true;
    group.add(stand);

    const screen = new T.Mesh(new T.BoxGeometry(sx * 0.86, sz * 0.65, sy + 0.02), mats.screenGlow);
    screen.position.set(0, sz * 0.58, 0);
    group.add(screen);
  } else if (kind.includes("bin") || kind.includes("recycle")) {
    const bin = new T.Mesh(new T.BoxGeometry(sx, sz, sy), mats.recycleGreen);
    bin.position.set(0, sz / 2, 0);
    bin.castShadow = true;
    group.add(bin);
  } else if (kind.includes("extinguisher") || kind.includes("fire")) {
    const cyl = new T.Mesh(
      new T.CylinderGeometry(Math.min(sx, sy) * 0.45, Math.min(sx, sy) * 0.45, sz, 16),
      mats.fireRed
    );
    cyl.position.set(0, sz / 2, 0);
    cyl.castShadow = true;
    group.add(cyl);
  } else if (kind.includes("glass") || kind.includes("partition") || kind.includes("window")) {
    const pane = new T.Mesh(new T.BoxGeometry(sx, sz, Math.max(0.08, sy)), mats.hazardGlass);
    pane.position.set(0, sz / 2, 0);
    pane.castShadow = true;
    group.add(pane);
  } else if (kind.includes("column") || kind.includes("pillar")) {
    const col = new T.Mesh(
      new T.CylinderGeometry(sx / 2, sx / 2, sz, 20),
      mats.concrete
    );
    col.position.set(0, sz / 2, 0);
    col.castShadow = true;
    group.add(col);
  } else {
    const box = new T.Mesh(
      new T.BoxGeometry(sx, sz, sy),
      isHazard ? mats.warningAmber : obj.glass ? mats.hazardGlass : mats.metal
    );
    box.position.set(0, sz / 2, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }

  // Base footprint outline ring (red for unanchored/glass hazard, green for anchored/safe)
  const ringMat = isHazard ? mats.hazardRed : mats.safeGreen;
  const basePlate = new T.Mesh(new T.BoxGeometry(sx + 0.12, 0.025, sy + 0.12), ringMat);
  basePlate.position.set(0, 0.012, 0);
  group.add(basePlate);

  group.userData = { ...obj };
  return group;
}

/**
 * Fallback CAGB Level 2 Route A (Room 200 -> Breakout -> Main Corridor -> Exhibition Rd Exit)
 * in the exact slava/route_A/scene.json schema:
 * objects: [{ id, type, label, model, pos, yaw, size_m, mass_kg, anchored, glass, hazard, evidence }]
 * Building coordinates X east, Y north, Z up (calibrated at 9.52 px/m on cagb-L2-graph.json).
 */
export const FALLBACK_ROUTE_A_SCENE: RouteTwinScene = {
  version: "1.0",
  route_id: "route_A",
  title: "CAGB Level 2 Route A — Room 200 Lecture Theatre → Exhibition Road Main Exit",
  floor: "City and Guilds Building, Level 2",
  scale_px_per_m: 9.52,
  waypoints: [
    [141.6, 55.0, 0],
    [136.3, 55.0, 0],
    [134.2, 55.0, 0],
    [134.2, 61.5, 0],
    [134.2, 70.4, 0],
    [134.2, 80.3, 0],
    [142.5, 80.3, 0],
    [153.8, 80.3, 0],
  ],
  objects: [
    {
      id: "room200_doors",
      type: "double_door",
      label: "Room 200 Rear West Double Doors (Evacuation Start)",
      model: "double_door",
      pos: [139.5, 55.0, 0],
      yaw: 90,
      size_m: [1.8, 0.25, 2.2],
      mass_kg: 90,
      anchored: true,
      glass: false,
      hazard: false,
      side: "centre",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_01_room200_doors.jpg",
        t_s: 4.0,
        quote: "Starting at Room 200 lecture theatre rear double doors heading into Breakout space.",
      },
    },
    {
      id: "breakout_totem_sign",
      type: "totem",
      label: "Freestanding Wayfinding Digital Totem",
      model: "totem",
      pos: [135.4, 53.6, 0],
      yaw: 0,
      size_m: [0.75, 0.45, 1.95],
      mass_kg: 68,
      anchored: false,
      glass: true,
      hazard: true,
      side: "left",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_02_breakout_totem.jpg",
        t_s: 12.5,
        quote: "Unanchored tall digital wayfinding totem outside Room 200 vestibule.",
      },
    },
    {
      id: "breakout_study_bench",
      type: "desk",
      label: "Breakout Space Heavy Timber Study Table (Shelter Candidate)",
      model: "desk",
      pos: [131.8, 54.2, 0],
      yaw: 0,
      size_m: [2.2, 0.9, 0.78],
      mass_kg: 55,
      anchored: true,
      glass: false,
      hazard: false,
      side: "left",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_03_breakout_bench.jpg",
        t_s: 18.0,
        quote: "Sturdy timber breakout table away from exterior glazing.",
      },
    },
    {
      id: "corridor_vending_machine",
      type: "vending_machine",
      label: "Unanchored Drinks Vending Machine (Topple Hazard)",
      model: "vending_machine",
      pos: [132.9, 60.2, 0],
      yaw: 90,
      size_m: [1.05, 0.85, 1.95],
      mass_kg: 260,
      anchored: false,
      glass: true,
      hazard: true,
      side: "left",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_04_vending_machine.jpg",
        t_s: 29.0,
        quote: "Heavy glass-front vending machine on left side of north spine corridor.",
      },
    },
    {
      id: "corridor_recycling_station",
      type: "recycling_bin",
      label: "3-Bin Recycling Station",
      model: "recycling_bin",
      pos: [135.4, 63.0, 0],
      yaw: -90,
      size_m: [1.2, 0.5, 0.95],
      mass_kg: 28,
      anchored: false,
      glass: false,
      hazard: false,
      side: "right",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_05_recycling_bins.jpg",
        t_s: 36.0,
        quote: "Recycling bin bank along right corridor wall before lifts.",
      },
    },
    {
      id: "central_lifts_bank",
      type: "lift",
      label: "Central 4-Car Lift Bank (DO NOT USE IN QUAKE)",
      model: "lift",
      pos: [131.6, 68.8, 0],
      yaw: 90,
      size_m: [3.2, 1.4, 2.6],
      mass_kg: 1200,
      anchored: true,
      glass: false,
      hazard: true,
      side: "left",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_06_lifts_bank.jpg",
        t_s: 45.0,
        quote: "Lifts on left — locked out during seismic evacuation.",
      },
    },
    {
      id: "corridor_display_cabinet",
      type: "display_case",
      label: "Tall Heritage Glass Display Cabinet",
      model: "display_case",
      pos: [135.6, 72.5, 0],
      yaw: -90,
      size_m: [1.6, 0.55, 2.05],
      mass_kg: 145,
      anchored: false,
      glass: true,
      hazard: true,
      side: "right",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_07_display_cabinet.jpg",
        t_s: 54.0,
        quote: "Tall glass-paned heritage cabinet along east wall opposite lift lobby.",
      },
    },
    {
      id: "foyer_glass_partition",
      type: "glass_panel",
      label: "Main Foyer Glazed Partition Screen",
      model: "glass_panel",
      pos: [143.2, 78.2, 0],
      yaw: 0,
      size_m: [3.4, 0.18, 2.5],
      mass_kg: 180,
      anchored: true,
      glass: true,
      hazard: true,
      side: "right",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_08_foyer_glass.jpg",
        t_s: 68.0,
        quote: "Floor-to-ceiling glass partition along main foyer colonnade.",
      },
    },
    {
      id: "foyer_column_north",
      type: "column",
      label: "Main Foyer Structural Column",
      model: "column",
      pos: [146.5, 82.4, 0],
      yaw: 0,
      size_m: [0.65, 0.65, 3.0],
      mass_kg: 900,
      anchored: true,
      glass: false,
      hazard: false,
      side: "left",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_09_foyer_column.jpg",
        t_s: 74.0,
        quote: "Reinforced concrete structural column in Exhibition Road foyer.",
      },
    },
    {
      id: "exhibition_main_exit_doors",
      type: "double_door",
      label: "Exhibition Road Main Double Doors (2.10m Clear Scale Reference)",
      model: "double_door",
      pos: [153.8, 80.3, 0],
      yaw: 90,
      size_m: [2.1, 0.3, 2.4],
      mass_kg: 130,
      anchored: true,
      glass: true,
      hazard: false,
      side: "centre",
      evidence: {
        video: "captures/walk1.mp4",
        frame: "frame_10_exhibition_doors.jpg",
        t_s: 85.0,
        quote: "Main entrance Exhibition Road double doors, 2.10 metres clear opening.",
      },
    },
  ],
};
