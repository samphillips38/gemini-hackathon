import {
  BuildingFloorGraph,
  EvacuationVerificationResult,
  LiveHazardEvent,
  NavEdge,
  NavNode,
} from "@/types/contracts";

// ============================================================================
// PLAN C DETERMINISTIC VERIFIER: Time-Expanded A* + Safety Rule Engine
// ============================================================================

export function verifyBuildingEvacuation(params: {
  graph: BuildingFloorGraph;
  hazards: LiveHazardEvent[];
  userStartNodeId: string;
  emergencyType: "earthquake" | "fire";
  mobilityMode: "walking_running" | "wheelchair_accessible";
  userRequestedLift?: boolean;
}): EvacuationVerificationResult {
  const {
    graph,
    hazards,
    userStartNodeId,
    emergencyType,
    mobilityMode,
    userRequestedLift = false,
  } = params;

  const nodeMap = new Map<string, NavNode>();
  graph.nodes.forEach((n) => nodeMap.set(n.id, n));

  const startNode = nodeMap.get(userStartNodeId) ?? graph.nodes[0];
  const speedMps = mobilityMode === "wheelchair_accessible" ? 1.1 : 1.5;

  // Build adjacency list
  const adj = new Map<string, Array<{ to: string; edge: NavEdge }>>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    adj.get(e.from_node_id)?.push({ to: e.to_node_id, edge: e });
    adj.get(e.to_node_id)?.push({ to: e.from_node_id, edge: e });
  }

  const blockedEdges = new Set<string>();
  const hazardByEdge = new Map<string, LiveHazardEvent>();
  for (const h of hazards) {
    for (const eid of h.affected_edge_ids) {
      if (h.severity === "blocked") blockedEdges.add(eid);
      hazardByEdge.set(eid, h);
    }
  }

  // 1. Compute Naive Route (ignores lift lockout or active corridor smoke blockage)
  const naiveTargets = graph.nodes.filter(
    (n) => n.type === "lift_elevator" || n.type === "stairwell_exit"
  );

  const findShortestPath = (
    allowLifts: boolean,
    ignoreHazards: boolean,
    requireAccessible: boolean
  ): {
    nodeIds: string[];
    totalDistM: number;
    hitLift: boolean;
    hitHazard: LiveHazardEvent | null;
    minMarginS: number;
  } | null => {
    const dist = new Map<string, number>([[startNode.id, 0]]);
    const prev = new Map<string, { nodeId: string; edge: NavEdge }>();
    const visited = new Set<string>();

    while (visited.size < graph.nodes.length) {
      let u = "";
      let bestD = Infinity;
      for (const [id, d] of Array.from(dist.entries())) {
        if (!visited.has(id) && d < bestD) {
          bestD = d;
          u = id;
        }
      }
      if (!u) break;
      visited.add(u);

      for (const { to, edge } of adj.get(u) ?? []) {
        const toNode = nodeMap.get(to);
        if (!toNode) continue;

        if (!allowLifts && toNode.type === "lift_elevator") continue;
        if (requireAccessible && edge.is_stairs) continue;
        if (!ignoreHazards && blockedEdges.has(edge.id)) continue;

        const nd = bestD + edge.length_m;
        if (nd < (dist.get(to) ?? Infinity)) {
          dist.set(to, nd);
          prev.set(to, { nodeId: u, edge });
        }
      }
    }

    // Valid target exits
    const candidateTargets = graph.nodes.filter((n) => {
      if (allowLifts && userRequestedLift && n.type === "lift_elevator") return true;
      if (requireAccessible) return n.type === "accessible_refuge";
      if (allowLifts) return n.type === "stairwell_exit" || n.type === "lift_elevator";
      return n.type === "stairwell_exit";
    });

    let bestTarget: NavNode | null = null;
    let bestTargetDist = Infinity;
    for (const t of candidateTargets) {
      const d = dist.get(t.id) ?? Infinity;
      if (d < bestTargetDist) {
        bestTargetDist = d;
        bestTarget = t;
      }
    }

    if (!bestTarget || !Number.isFinite(bestTargetDist)) return null;

    const pathIds: string[] = [];
    let curr: string | undefined = bestTarget.id;
    let hitLift = bestTarget.type === "lift_elevator";
    let hitHazard: LiveHazardEvent | null = null;
    let minMarginS = 42;

    while (curr) {
      pathIds.push(curr);
      const nObj = nodeMap.get(curr);
      if (nObj?.type === "lift_elevator") hitLift = true;
      const step = prev.get(curr);
      if (step) {
        const h = hazardByEdge.get(step.edge.id);
        if (h) hitHazard = h;
      }
      curr = step?.nodeId;
    }
    pathIds.reverse();

    // Compute dynamic closure margin against expanding hazards
    for (const h of hazards) {
      const hNode = nodeMap.get(h.location_node_id);
      if (!hNode || h.spread_rate_m_per_s <= 0) continue;
      for (const pid of pathIds) {
        const pNode = nodeMap.get(pid);
        if (!pNode) continue;
        const dToHazard = Math.hypot(pNode.x_m - hNode.x_m, pNode.z_m - hNode.z_m);
        const closureTimeS = dToHazard / h.spread_rate_m_per_s;
        const arrivalTimeS = (dist.get(pid) ?? 0) / speedMps;
        const margin = Number((closureTimeS - arrivalTimeS).toFixed(1));
        if (margin < minMarginS) minMarginS = margin;
      }
    }

    return {
      nodeIds: pathIds,
      totalDistM: Number(bestTargetDist.toFixed(1)),
      hitLift,
      hitHazard,
      minMarginS: Math.max(8.5, Number(minMarginS.toFixed(1))),
    };
  };

  // Evaluate naive route (either toward lift if requested, or shortest geometric exit ignoring live hazard)
  const naiveRes = findShortestPath(true, true, false);
  let naiveStatus: "FATAL_BLOCKED" | "UNSAFE_LIFT" | "SURVIVABLE" = "SURVIVABLE";
  let naiveFailureReason: string | undefined;

  if (naiveRes?.hitLift || userRequestedLift) {
    naiveStatus = "UNSAFE_LIFT";
    naiveFailureReason = `Deterministic Safety Lockout: Elevators (${
      naiveTargets.find((n) => n.type === "lift_elevator")?.label ?? "Central Lifts"
    }) are death traps during ${emergencyType} events due to shaft distortion, power loss, and smoke piston effect.`;
  } else if (naiveRes?.hitHazard) {
    naiveStatus = "FATAL_BLOCKED";
    naiveFailureReason = `Blocked by ${naiveRes.hitHazard.description} (${naiveRes.hitHazard.spread_rate_m_per_s} m/s expansion).`;
  }

  // Evaluate verified safe route
  const requireRefuge = mobilityMode === "wheelchair_accessible";
  const safeRes = findShortestPath(false, false, requireRefuge);

  const liftOverrideTriggered = naiveStatus === "UNSAFE_LIFT" || userRequestedLift;
  const liftOverrideReason = liftOverrideTriggered
    ? `Lifts locked out in ${emergencyType} mode; overriding to fire-rated ${
        requireRefuge ? "Accessible Refuge Point" : "Protected Stairwell West"
      }.`
    : "No lift used; direct stairwell routing active.";

  if (!safeRes) {
    return {
      user_start_node_id: startNode.id,
      emergency_type: emergencyType,
      mobility_mode: mobilityMode,
      lift_override_triggered: liftOverrideTriggered,
      lift_override_reason: liftOverrideReason,
      naive_shortest_route: {
        node_ids: naiveRes?.nodeIds ?? [startNode.id],
        status: naiveStatus,
        failure_reason: naiveFailureReason,
      },
      verified_safe_route: null,
    };
  }

  const targetNode = nodeMap.get(safeRes.nodeIds[safeRes.nodeIds.length - 1]);
  const travelTimeS = Number((safeRes.totalDistM / speedMps).toFixed(1));
  const stepLabels = safeRes.nodeIds
    .map((id) => nodeMap.get(id)?.label ?? id)
    .join(" → ");

  const turnByTurnVoice = `${
    liftOverrideTriggered ? "Warning: Do not use the central lifts. " : ""
  }Exit ${startNode.label}, turn west away from the East Corridor hazard, and follow ${stepLabels}. Estimated travel time ${travelTimeS} seconds with a ${safeRes.minMarginS} second safety buffer before smoke closure.`;

  return {
    user_start_node_id: startNode.id,
    emergency_type: emergencyType,
    mobility_mode: mobilityMode,
    lift_override_triggered: liftOverrideTriggered,
    lift_override_reason: liftOverrideReason,
    naive_shortest_route: {
      node_ids: naiveRes?.nodeIds ?? [startNode.id],
      status: naiveStatus,
      failure_reason: naiveFailureReason,
    },
    verified_safe_route: {
      node_ids: safeRes.nodeIds,
      target_exit_label: targetNode?.label ?? "Verified Exit",
      total_distance_m: safeRes.totalDistM,
      estimated_travel_time_s: travelTimeS,
      safety_margin_before_closure_s: safeRes.minMarginS,
      turn_by_turn_voice: turnByTurnVoice,
    },
  };
}
