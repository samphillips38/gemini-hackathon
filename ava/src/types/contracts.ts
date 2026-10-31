// ============================================================================
// PLAN B (QuakeRoom) & PLAN C (ExitZero) — Unified TypeScript Contracts
// Authoritative Spec: ava/HACKATHON_PLANS_B_AND_C.md
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
  | "exit_door"
  | "lift_door"
  | "hazard_zone";

export type ClearanceMode = "walk" | "wheelchair";

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
  id?: string;
  name?: string;
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
  label: string;
  category: ObjectCategory;
  combined_mass_kg: number;
  center_of_mass_height_m: number;
  effective_base_depth_m: number;
  analytical_safety_factor: number; // SF = (b / h_CoM) / (a_floor / g); < 1.0 means tips
  tipped_over: boolean;
  tip_direction_rad: number;
  shattered_or_fell: boolean;
  hit_occupant_zone: boolean;
  blocked_exit_corridor: boolean;
  peak_kinetic_energy_joules: number;
  resting_bbox_2d?: { min_x: number; max_x: number; min_z: number; max_z: number };
  fallen_footprint_2d: {
    min_x: number;
    max_x: number;
    min_z: number;
    max_z: number;
  };
}

export interface MonteCarloSummary {
  runs: number;
  pga_range_g: [number, number];
  walk_clear_count: number;
  wheelchair_clear_count: number;
  walk_clear_prob: number;
  wheelchair_clear_prob: number;
}

export interface EgressAndShelterResult {
  survivable: boolean;
  clearance_mode: ClearanceMode;
  clearance_width_m: number;
  floor_pga_g: number;
  exit_reachable_pre_quake: boolean;
  exit_reachable_post_quake: boolean;
  monte_carlo: MonteCarloSummary;
  lift_lockout_active: boolean;
  lift_lockout_reason: string;
  escape_path_points_m?: Array<{ x_m: number; z_m: number }>;
  escape_path_pre_quake_m: Array<{ x_m: number; z_m: number }>;
  escape_path_post_quake_m: Array<{ x_m: number; z_m: number }>;
  escape_distance_m: number;
  escape_time_s: number;
  safe_shelter_spot_m: { x_m: number; z_m: number; label: string } | null;
  shelter_path_m: Array<{ x_m: number; z_m: number }>;
  shelter_reach_time_s: number;
  blocking_object_ids: string[];
  bed_crush_object_ids: string[];
  glass_hazard_zones_m: Array<{ x_m: number; z_m: number; radius_m: number; source_id: string }>;
  object_results: Record<string, ObjectHazardResult>;
}

export interface RemediationChange {
  object_id: string;
  label: string;
  action: "move_floor_position" | "relocate_shelf_level" | "swap_objects" | "anchor_strap";
  reason: string;
  before_desc: string;
  after_desc: string;
  new_x_m?: number;
  new_z_m?: number;
  new_rotation_deg?: 0 | 90 | 180 | 270;
  new_parent_id?: string | null;
  new_shelf_level?: "bottom" | "middle" | "top";
}

export interface RemediationProposal {
  summary_spoken: string;
  changes: RemediationChange[];
  updated_scene: RoomSceneGraph;
  verified_result: EgressAndShelterResult;
}

// ----------------------------------------------------------------------------
// PLAN C: ExitZero — 2D Floor-Plan + Live Camera Hazard to 3D Building Verifier
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
  x_m: number; // Normalized to building floor meter grid (e.g. 36m x 22m)
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

export interface CAGBRouteSpec {
  id: "A" | "B" | "C" | "D";
  title: string;
  video: string;
  image: string;
  waypoints_px: Array<[number, number]>;
  landmarks: Array<{
    number: number;
    waypoint_index: number;
    say: string;
  }>;
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
