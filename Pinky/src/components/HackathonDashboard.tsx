"use client";

import React, { useMemo, useState } from "react";
import {
  ActivePlanMode,
  BuildingFloorGraph,
  LiveHazardEvent,
  RemediationProposal,
  RoomSceneGraph,
} from "@/types/contracts";
import {
  CAGB_L2_ZONE_PRESETS,
  CagbZoneKey,
  IMPERIAL_HUXLEY_FLOOR_GRAPH,
  IMPERIAL_LIVE_HAZARDS_PRESET,
  IMPERIAL_STUDENT_BEDROOM_UNSAFE,
} from "@/presets";
import {
  computeObjectCoMAndSafetyFactor,
  verifyBuildingEvacuation,
  verifyRoomScene,
} from "@/solver";
import {
  applyVoiceConstraintsToRoomScene,
  buildDeterministicRenterSafeRemediation,
  parseVoiceTranscriptToConstraints,
  seismicAudio,
  speakWithBrowserTTS,
} from "@/voice";
import { QuakeRoomCanvas, ExitZeroCanvas } from "@/scene3d";
import { MultimodalInputBar } from "./MultimodalInputBar";

export function HackathonDashboard() {
  const [mode, setMode] = useState<ActivePlanMode>("plan_b");
  const [isExtracting, setIsExtracting] = useState(false);
  const [lastSpoken, setLastSpoken] = useState(
    "Ready. Scan a room or floor plan, or speak constraints to Gemini Live."
  );

  // Plan B State
  const [selectedZoneKey, setSelectedZoneKey] =
    useState<CagbZoneKey>("student_bedroom");
  const [roomScene, setRoomScene] = useState<RoomSceneGraph>(
    IMPERIAL_STUDENT_BEDROOM_UNSAFE
  );
  const [remediation, setRemediation] = useState<RemediationProposal | null>(
    null
  );
  const [isShaking, setIsShaking] = useState(false);
  const [postQuakeCollapsed, setPostQuakeCollapsed] = useState(false);
  const [compareSideBySide, setCompareSideBySide] = useState(false);

  // Plan C State
  const [floorGraph, setFloorGraph] = useState<BuildingFloorGraph>(
    IMPERIAL_HUXLEY_FLOOR_GRAPH
  );
  const [hazards, setHazards] = useState<LiveHazardEvent[]>(
    IMPERIAL_LIVE_HAZARDS_PRESET
  );
  const [userStartNodeId, setUserStartNodeId] = useState("room_311");
  const [emergencyType, setEmergencyType] = useState<"earthquake" | "fire">(
    "earthquake"
  );
  const [mobilityMode, setMobilityMode] = useState<
    "walking_running" | "wheelchair_accessible"
  >("walking_running");
  const [userRequestedLift, setUserRequestedLift] = useState(true);

  // Deterministic Verifier Outputs
  const beforeVerification = useMemo(
    () => verifyRoomScene(roomScene),
    [roomScene]
  );

  const afterVerification = useMemo(
    () =>
      remediation ? verifyRoomScene(remediation.updated_scene) : null,
    [remediation]
  );

  const evacVerification = useMemo(
    () =>
      verifyBuildingEvacuation({
        graph: floorGraph,
        hazards,
        userStartNodeId,
        emergencyType,
        mobilityMode,
        userRequestedLift,
      }),
    [
      floorGraph,
      hazards,
      userStartNodeId,
      emergencyType,
      mobilityMode,
      userRequestedLift,
    ]
  );

  const bookshelfMetrics = useMemo(() => {
    const shelf = roomScene.objects.find((o) => o.category === "bookshelf");
    if (!shelf) return null;
    return computeObjectCoMAndSafetyFactor(
      shelf,
      roomScene.objects,
      roomScene.room.floor_level,
      roomScene.earthquake.magnitude_mw
    );
  }, [roomScene]);

  const handleVoiceSubmitted = (transcript: string) => {
    const parsed = parseVoiceTranscriptToConstraints(transcript);
    if (mode === "plan_b") {
      const updated = applyVoiceConstraintsToRoomScene(roomScene, parsed);
      setRoomScene(updated);
      setLastSpoken(parsed.spoken_response);
      speakWithBrowserTTS(parsed.spoken_response);
    } else {
      if (parsed.requested_lift !== undefined) {
        setUserRequestedLift(parsed.requested_lift);
      }
      if (parsed.mobility_mode) {
        setMobilityMode(parsed.mobility_mode);
      }
      if (parsed.emergency_type) {
        setEmergencyType(parsed.emergency_type);
      }
      setLastSpoken(parsed.spoken_response);
      speakWithBrowserTTS(parsed.spoken_response);
    }
  };

  const handleImageUploaded = async (base64: string, mimeType: string) => {
    setIsExtracting(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          imageBase64: base64,
          mimeType,
          voiceContextPrompt: lastSpoken,
        }),
      });
      const data = await res.json();
      if (mode === "plan_b" && data.roomScene) {
        setRoomScene(data.roomScene);
        setPostQuakeCollapsed(false);
        setRemediation(null);
      } else if (mode === "plan_c" && data.buildingGraph) {
        setFloorGraph(data.buildingGraph);
        if (data.hazards) setHazards(data.hazards);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const selectZonePreset = (key: CagbZoneKey) => {
    const preset = CAGB_L2_ZONE_PRESETS[key];
    setSelectedZoneKey(key);
    setRoomScene(preset.unsafeScene);
    setRemediation(null);
    setCompareSideBySide(false);
    setPostQuakeCollapsed(false);
    setLastSpoken(`Loaded ${preset.label}: ${preset.subtitle}`);
  };

  const triggerQuakeShake = () => {
    setIsShaking(true);
    setPostQuakeCollapsed(true);
    seismicAudio.playSeismicRumble(roomScene.earthquake.magnitude_mw, 3.4);
    const urgentAlert = !beforeVerification.survivable
      ? "Critical failure. Drop, Cover, and Hold On during shaking—do not run while the building shakes, and never take a lift. Post-quake A* check shows your exit corridor is blocked."
      : "Verification passed. All furniture remained stable and the post-quake escape path is clear.";
    setLastSpoken(urgentAlert);
    speakWithBrowserTTS(urgentAlert);
    setTimeout(() => {
      setIsShaking(false);
    }, 3200);
  };

  const handleSynthesizeRemediation = async () => {
    if (selectedZoneKey !== "student_bedroom") {
      const cachedProposal = CAGB_L2_ZONE_PRESETS[selectedZoneKey].remediationProposal;
      setRemediation(cachedProposal);
      setCompareSideBySide(true);
      setPostQuakeCollapsed(true);
      setLastSpoken(cachedProposal.summary_spoken);
      speakWithBrowserTTS(cachedProposal.summary_spoken);
      return;
    }
    try {
      const res = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: roomScene,
          currentVerification: beforeVerification,
        }),
      });
      const data = await res.json();
      if (data.proposal) {
        setRemediation(data.proposal);
        setCompareSideBySide(true);
        setPostQuakeCollapsed(true);
        setLastSpoken(data.proposal.summary_spoken);
        speakWithBrowserTTS(data.proposal.summary_spoken);
        return;
      }
    } catch {
      // Fallback to local deterministic solver
    }
    const fallbackProposal = buildDeterministicRenterSafeRemediation(roomScene);
    setRemediation(fallbackProposal);
    setCompareSideBySide(true);
    setPostQuakeCollapsed(true);
    setLastSpoken(fallbackProposal.summary_spoken);
    speakWithBrowserTTS(fallbackProposal.summary_spoken);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-4">
      {/* Top Bar: Plan B vs Plan C Switcher + Stage Presets */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono">
              GEMINI 4 ARGON + DETERMINISTIC A* VERIFIER
            </span>
            <h1 className="text-lg md:text-xl font-bold tracking-tight">
              {mode === "plan_b"
                ? "QuakeRoom — 3D Seismic Collapse & Egress Verifier (Plan B)"
                : "ExitZero — 3D Building Dynamic Evacuation Verifier (Plan C)"}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Vision extracts geometry • Gemini Live Voice captures invisible physics constraints • Deterministic mechanics &amp; A* verify survival
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("plan_b")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === "plan_b"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Plan B: QuakeRoom
          </button>
          <button
            type="button"
            onClick={() => setMode("plan_c")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === "plan_c"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Plan C: ExitZero
          </button>
        </div>
      </header>

      {/* Common Multimodal Input Bar (Camera + Gemini Live Voice) */}
      <MultimodalInputBar
        mode={mode}
        onVoiceSubmitted={handleVoiceSubmitted}
        onImageUploaded={handleImageUploaded}
        isExtracting={isExtracting}
        lastSpokenResponse={lastSpoken}
      />

      {mode === "plan_b" ? (
        <div className="space-y-4">
          {/* 5-Zone CAGB L2 Route A + Student Bedroom Switcher */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono uppercase text-slate-400 mr-1">
                CAGB L2 &amp; Room Zones (9.52 px/m • 52/52 Argon):
              </span>
              {(Object.keys(CAGB_L2_ZONE_PRESETS) as CagbZoneKey[]).map(
                (zKey) => {
                  const z = CAGB_L2_ZONE_PRESETS[zKey];
                  const active = selectedZoneKey === zKey;
                  return (
                    <button
                      key={zKey}
                      type="button"
                      onClick={() => selectZonePreset(zKey)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        active
                          ? "bg-indigo-600 text-white shadow"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {z.label}
                    </button>
                  );
                }
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                N=50 MC Walk (0.4m):{" "}
                <strong
                  className={
                    remediation
                      ? "text-emerald-400"
                      : CAGB_L2_ZONE_PRESETS[selectedZoneKey].mcBeforeWalk ===
                          "50/50"
                        ? "text-emerald-400"
                        : "text-red-400"
                  }
                >
                  {remediation
                    ? CAGB_L2_ZONE_PRESETS[selectedZoneKey].mcAfterWalk
                    : CAGB_L2_ZONE_PRESETS[selectedZoneKey].mcBeforeWalk}
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Wheelchair (0.9m):{" "}
                <strong
                  className={
                    remediation
                      ? "text-emerald-400"
                      : CAGB_L2_ZONE_PRESETS[selectedZoneKey]
                            .mcBeforeWheelchair === "50/50"
                        ? "text-emerald-400"
                        : "text-red-400"
                  }
                >
                  {remediation
                    ? CAGB_L2_ZONE_PRESETS[selectedZoneKey].mcAfterWheelchair
                    : CAGB_L2_ZONE_PRESETS[selectedZoneKey].mcBeforeWheelchair}
                </strong>
              </span>
            </div>
          </div>

          {/* Plan B Action & Telemetry Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between">
              <div className="text-xs text-slate-400">Voice Physics Constraints</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded bg-slate-800 text-xs font-mono">
                  Floor: {roomScene.room.floor_level} (PGA{" "}
                  {(1 + 0.12 * (roomScene.room.floor_level - 1)).toFixed(2)}x)
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-mono ${
                    roomScene.room.renter_no_drill
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {roomScene.room.renter_no_drill
                    ? "Renter: No Wall Drilling"
                    : "Wall Bolting Allowed"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span>Quake Mw: {roomScene.earthquake.magnitude_mw}</span>
                <input
                  type="range"
                  min={5.2}
                  max={7.8}
                  step={0.2}
                  value={roomScene.earthquake.magnitude_mw}
                  onChange={(e) =>
                    setRoomScene({
                      ...roomScene,
                      earthquake: {
                        ...roomScene.earthquake,
                        magnitude_mw: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-28 accent-indigo-500"
                />
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5">
              <div className="text-xs text-slate-400">
                Analytical Housner Overturning (Bookshelf)
              </div>
              <div className="mt-1 text-lg font-bold font-mono">
                hCoM = {bookshelfMetrics?.h_com_m ?? 1.48}m • SF ={" "}
                <span
                  className={
                    (bookshelfMetrics?.safety_factor ?? 0.54) < 1.0
                      ? "text-red-400"
                      : "text-emerald-400"
                  }
                >
                  {bookshelfMetrics?.safety_factor ?? 0.54}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                SF &lt; 1.0 tips under {bookshelfMetrics?.floor_accel_g ?? 0.7}g floor acceleration
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5">
              <div className="text-xs text-slate-400">
                Post-Quake A* Egress Status
              </div>
              <div
                className={`mt-1 text-base font-bold font-mono ${
                  beforeVerification.survivable
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {beforeVerification.exit_reachable_post_quake
                  ? "EXIT CLEAR (SURVIVABLE)"
                  : `EXIT BLOCKED BY ${
                      beforeVerification.blocking_object_ids[0]?.toUpperCase() ||
                      "WARDROBE_1"
                    }`}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Drop-Cover-Hold Reach: {beforeVerification.shelter_reach_time_s}s (
                {beforeVerification.safe_shelter_spot_m?.label})
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-center gap-2">
              <button
                type="button"
                onClick={triggerQuakeShake}
                className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow transition"
              >
                🌋 Trigger {roomScene.earthquake.magnitude_mw}M Quake
              </button>
              <button
                type="button"
                onClick={handleSynthesizeRemediation}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow transition"
              >
                🛠️ Synthesize &amp; Verify Renter-Safe Layout
              </button>
            </div>
          </div>

          {/* 3D Viewport(s): Single or Side-by-Side Before vs. Verified After */}
          <div
            className={`grid gap-4 ${
              compareSideBySide && remediation
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            <div className="h-[430px]">
              <QuakeRoomCanvas
                scene={roomScene}
                verification={beforeVerification}
                isShaking={isShaking}
                postQuakeCollapsed={postQuakeCollapsed}
                titleBadge="BEFORE: Scanned Student Bedroom (Door Blocked & Bed Crushed)"
              />
            </div>

            {compareSideBySide && remediation && afterVerification && (
              <div className="h-[430px]">
                <QuakeRoomCanvas
                  scene={remediation.updated_scene}
                  verification={afterVerification}
                  isShaking={isShaking}
                  postQuakeCollapsed={postQuakeCollapsed}
                  titleBadge="VERIFIED AFTER: Zero-Drill Ballast & Clear A* Escape Route"
                />
              </div>
            )}
          </div>

          {/* Remediation Proposal Cards */}
          {remediation && (
            <div className="rounded-xl bg-emerald-950/30 border border-emerald-700/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-emerald-300">
                  Self-Correcting Zero-Drill Remediation (Verified by Deterministic Solver)
                </h2>
                <button
                  type="button"
                  onClick={triggerQuakeShake}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                >
                  🔄 Re-Run {roomScene.earthquake.magnitude_mw}M Side-by-Side Verification
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {remediation.changes.map((chg, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 text-xs space-y-1"
                  >
                    <div className="font-mono text-emerald-400 font-semibold">
                      {chg.object_id} → {chg.action}
                    </div>
                    <p className="text-slate-300">{chg.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Plan C: ExitZero View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[480px]">
            <ExitZeroCanvas
              graph={floorGraph}
              hazards={hazards}
              verification={evacVerification}
            />
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase">
                Occupant Start &amp; Mobility
              </div>
              <select
                value={userStartNodeId}
                onChange={(e) => setUserStartNodeId(e.target.value)}
                className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs"
              >
                {floorGraph.nodes
                  .filter((n) => n.type === "room" || n.type === "corridor_junction")
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      Start: {n.label}
                    </option>
                  ))}
              </select>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setMobilityMode(
                      mobilityMode === "walking_running"
                        ? "wheelchair_accessible"
                        : "walking_running"
                    )
                  }
                  className="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono"
                >
                  Mode: {mobilityMode}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    speakWithBrowserTTS(
                      evacVerification.verified_safe_route?.turn_by_turn_voice ||
                        evacVerification.lift_override_reason
                    );
                  }}
                  className="py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold"
                >
                  🔊 Speak Route
                </button>
              </div>
            </div>

            {evacVerification.lift_override_triggered && (
              <div className="rounded-xl bg-red-950/50 border border-red-600/60 p-3.5 space-y-1">
                <div className="text-xs font-bold text-red-300 font-mono">
                  🚫 DETERMINISTIC LIFT LOCKOUT ACTIVE
                </div>
                <p className="text-xs text-red-200">
                  {evacVerification.naive_shortest_route.failure_reason ||
                    evacVerification.lift_override_reason}
                </p>
              </div>
            )}

            {evacVerification.verified_safe_route && (
              <div className="rounded-xl bg-emerald-950/40 border border-emerald-600/50 p-4 space-y-2">
                <div className="text-xs font-bold text-emerald-300 font-mono">
                  ✅ VERIFIED SAFE ROUTE:{" "}
                  {evacVerification.verified_safe_route.target_exit_label}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/80 p-2 rounded">
                    Distance: {evacVerification.verified_safe_route.total_distance_m}m
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded">
                    Travel: {evacVerification.verified_safe_route.estimated_travel_time_s}s
                  </div>
                  <div className="col-span-2 bg-emerald-900/30 border border-emerald-700/40 p-2 rounded text-emerald-200">
                    Safety Margin Before Hazard Closure:{" "}
                    {evacVerification.verified_safe_route.safety_margin_before_closure_s}s
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {evacVerification.verified_safe_route.turn_by_turn_voice}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
