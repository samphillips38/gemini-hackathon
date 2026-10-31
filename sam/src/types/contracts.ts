// ============================================================================
// PLAN B (QuakeRoom) & PLAN C (ExitZero) — Unified TypeScript Contracts
// ============================================================================

// ----------------------------------------------------------------------------
// PLAN B: QuakeRoom — Seismic Room Collapse, Safe-Shelter & Escape Verifier
// ----------------------------------------------------------------------------

export type ObjectCategory =
  | "bed"
  | "bookshelf"
  | "wardrobe"
  | "desk"
  | "chair"
  | "tv_monitor"
  | "heavy_item"
  | "fragile_glass"
  | "window"
  | "exit_door";

export interface RoomObjectNode {
  id: string;
  category: ObjectCategory;
  label: string;
  // Floor-standing objects have parent_id = null and (x_m, z_m) relative to room SW corner (0,0)
  // Stacked items have parent_id = "bookshelf_1" | "desk_1" and shelf_level = "bottom" | "middle" | "top"
  parent_id: string | null;
  shelf_level?: "bottom" | "middle" | "top";
  x_m: number;
  z_m: number;
  width_m: number;
  height_m: number;
  depth_m: number;
  rotation_deg: 0 | 90 | 180 | 270;
  mass_kg: number;
  anchored_to_wall: boolean;
  is_fragile: boolean;
  is_occupant_start?: boolean; // e.g., true for bed or desk chair
}

export interface RoomSceneGraph {
  room: {
    width_m: number;
    depth_m: number;
    height_m: number;
    floor_level: number; // From voice input (default 1; higher floors amplify PGA)
    renter_no_drill: boolean; // From voice input: if true, fixes cannot just say "bolt everything"
  };
  earthquake: {
    magnitude_mw: number; // e.g., 6.8
    duration_s: number;   // e.g., 6.0
    dominant_axis: "X" | "Z" | "XZ";
  };
  objects: RoomObjectNode[];
}

export interface ObjectHazardResult {
  object_id: string;
  analytical_safety_factor: number; // SF = (b / h_CoM) / (a_floor / g); < 1.0 means tips
  com_height_m?: number;            // Effective center-of-mass height including shelf items
  pga_ratio_g?: number;             // Floor acceleration in g
  tipped_over: boolean;
  shattered_or_fell: boolean;
  hit_occupant_zone: boolean;
  blocked_exit_corridor: boolean;
  peak_kinetic_energy_joules: number;
  resting_bbox_2d: { min_x: number; max_x: number; min_z: number; max_z: number };
}

export type MobilityClearanceMode = "walk" | "wheelchair";

export interface MonteCarloQuakeSummary {
  runs: number; // e.g., 50 simulated quakes
  seed: number; // e.g., 42
  pga_g_range: [number, number]; // e.g., [0.3, 0.5] scaled by floor amplification
  exit_clear_walk_count: number; // 0.4m clearance
  exit_clear_wheelchair_count: number; // 0.9m clearance
  exit_reachable_p: {
    walk: number; // Probability [0..1]
    wheelchair: number; // Probability [0..1]
  };
  top_blocking_objects: Array<{ id: string; block_rate: number }>;
}

export interface EgressAndShelterResult {
  survivable: boolean;
  exit_reachable_post_quake: boolean;
  wheelchair_reachable_post_quake?: boolean;
  // Shortest A* path (0.2m grid cells) from occupant_start to exit_door AFTER furniture collapses
  escape_path_points_m: Array<{ x_m: number; z_m: number }>;
  // Shortest A* path from occupant_start to safe shelter spot
  shelter_path_points_m?: Array<{ x_m: number; z_m: number }>;
  // Nearest safe Drop-Cover-Hold spot during shaking (under desk / outside fall shadows)
  safe_shelter_spot_m: { x_m: number; z_m: number; label: string } | null;
  shelter_reach_time_s: number;
  blocking_object_ids: string[];
  glass_hazard_zones_m: Array<{ x_m: number; z_m: number; radius_m: number }>;
  object_results: ObjectHazardResult[];
  // N=50 Monte Carlo seismic ensemble verification (from Slava + Ana synthesis)
  monte_carlo?: MonteCarloQuakeSummary;
}

export interface RemediationProposal {
  summary_spoken: string; // Short 2-sentence explanation for Gemini Live TTS
  changes: Array<{
    object_id: string;
    action: "move_floor_position" | "relocate_shelf_level" | "swap_objects" | "anchor_strap";
    reason: string;
    new_x_m?: number;
    new_z_m?: number;
    new_rotation_deg?: 0 | 90 | 180 | 270;
    new_parent_id?: string | null;
    new_shelf_level?: "bottom" | "middle" | "top";
  }>;
  updated_scene: RoomSceneGraph;
}

// ----------------------------------------------------------------------------
// PLAN C: ExitZero — 2D Floor-Plan + Live Camera Hazard to 3D Evacuation Twin
// ----------------------------------------------------------------------------

export type NodeType =
  | "room"
  | "corridor_junction"
  | "stairwell_exit"
  | "lift_elevator"
  | "accessible_refuge";

export interface NavNode {
  id: string;
  label: string;
  type: NodeType;
  x_m: number; // Normalized to building floor meter grid (e.g. 40m x 25m)
  z_m: number;
}

export interface NavEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  length_m: number;
  width_m: number;
  is_stairs: boolean;
}

export interface WallSegment {
  x1_m: number;
  z1_m: number;
  x2_m: number;
  z2_m: number;
  height_m: number;
  is_doorway?: boolean;
}

export interface BuildingFloorGraph {
  building_name: string;
  floor_number: number;
  width_m: number;
  depth_m: number;
  walls: WallSegment[];
  nodes: NavNode[];
  edges: NavEdge[];
}

export interface LiveHazardEvent {
  id: string;
  hazard_type: "structural_debris" | "fire_smoke" | "crowd_bottleneck";
  location_node_id: string;
  affected_edge_ids: string[];
  spread_rate_m_per_s: number; // 0 for static debris, e.g. 0.4 m/s for smoke
  severity: "blocked" | "slow_crawl";
  detected_from: "live_camera" | "voice_report";
  description: string;
  video_evidence?: {
    video_file: string;
    timestamp_s: number;
    quote: string;
  };
}

export interface EvacuationVerificationResult {
  user_start_node_id: string;
  emergency_type: "earthquake" | "fire";
  mobility_mode: "walking_running" | "wheelchair_accessible";
  lift_override_triggered: boolean; // True if user asked for lift or naive shortest path used a lift
  lift_override_reason: string;
  naive_shortest_route: {
    node_ids: string[];
    status: "FATAL_BLOCKED" | "UNSAFE_LIFT" | "SURVIVABLE";
    failure_reason?: string;
    total_distance_m?: number;
    estimated_travel_time_s?: number;
    overlap_margin_s?: number;
  };
  verified_safe_route: {
    node_ids: string[];
    target_exit_label: string;
    total_distance_m: number;
    estimated_travel_time_s: number;
    safety_margin_before_closure_s: number; // Time buffer before expanding smoke/debris reaches path
    turn_by_turn_voice: string;
  } | null;
}
