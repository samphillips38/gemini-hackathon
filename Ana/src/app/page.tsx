"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import cagbRouteARooms from "@/presets/cagbRouteARooms.json";
import routeAMonteCarlo from "../../results/route_A_montecarlo.json";
import { seismicAudio } from "@/voice/seismicAudioSynth";
import {
  STUDENT_BEDROOM_UNSAFE,
  STUDENT_BEDROOM_REMEDIATED,
  DEFAULT_REMEDIATION_PROPOSAL,
  IMPERIAL_FLOOR_GRAPH,
  DEFAULT_LIVE_HAZARDS,
} from "@/presets/demoPresets";
import {
  evaluateRoomScene,
  calculateFloorPGA,
} from "@/solver/quakeRoomSolver";
import { verifyBuildingEvacuation } from "@/solver/exitZeroSolver";
import {
  parseVoiceConstraintTranscript,
  speakCoachMessage,
  cyclePreferredHumanVoice,
  getCurrentHumanVoiceLabel,
} from "@/voice/voiceCoach";
import {
  RoomSceneGraph,
  RemediationProposal,
  BuildingFloorGraph,
  LiveHazardEvent,
} from "@/types/contracts";
import type { RouteTwinObject } from "@/scene3d/cagbRouteTwinModels";

const QuakeRoomCanvas = dynamic(() => import("@/scene3d/QuakeRoomCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-[#050608] flex items-center justify-center text-white/40 font-mono text-xs tracking-widest uppercase">
      initializing 3d environment...
    </div>
  ),
});

const ExitZeroCanvas = dynamic(() => import("@/scene3d/ExitZeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-[#050608] flex items-center justify-center text-white/40 font-mono text-xs tracking-widest uppercase">
      initializing 3d building twin...
    </div>
  ),
});

type SettingsTab = "commands" | "presets" | "vision" | "telemetry";

const CAGB_ROOM_PRESET_LIST: Array<{
  key: "room200" | "hall" | "corridor" | "lobby";
  label: string;
  badge: string;
  desc: string;
}> = [
  {
    key: "room200",
    label: "CAGB Room 200 — Lecture Theatre",
    badge: "L2 • WALK 0/50",
    desc: "AV lectern, hackathon food tables, pull-up banners & tiered seating.",
  },
  {
    key: "hall",
    label: "CAGB Level 2 Exhibition Hall",
    badge: "L2 • WALK 50/50",
    desc: "Jet engine exhibit, fire extinguishers, recycling bins & banners.",
  },
  {
    key: "corridor",
    label: "CAGB Level 2 Spine Corridor",
    badge: "L2 • WALK 50/50",
    desc: "Fire doors, overhead signage & Dalby Court connector.",
  },
  {
    key: "lobby",
    label: "CAGB Main Entrance Lobby",
    badge: "L1 • WALK 0/50",
    desc: "Unanchored marble bust statue, digital totem & lobby planters.",
  },
];

export default function QuakeSafeFullScreenApp() {
  const [activePlan, setActivePlan] = useState<"PLAN_B" | "PLAN_C">("PLAN_B");

  // Rocky Robotics (https://youtu.be/9VnViBXvA9Q) UI state:
  // Closed by default so the user starts directly inside the walkable 3D room with ZERO buttons on screen.
  // Summoned and dismissed at any time via Ctrl+Space / Cmd+Space (or Esc).
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("commands");
  const [commandQuery, setCommandQuery] = useState<string>("");
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  // ==================== PLAN B: QUAKEROOM STATE ====================
  const [roomScene, setRoomScene] = useState<RoomSceneGraph>(
    STUDENT_BEDROOM_UNSAFE
  );
  const [activeRoomPresetKey, setActiveRoomPresetKey] =
    useState<string>("unsafe_bedroom");
  const [remediatedScene, setRemediatedScene] = useState<RoomSceneGraph | null>(
    null
  );
  const [remediationProposal, setRemediationProposal] =
    useState<RemediationProposal | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [hasCollapsed, setHasCollapsed] = useState(false);

  // Start in First-Person Inside Free-Walk view by default
  const [roomWalkthrough, setRoomWalkthrough] = useState(true);
  const [roomAutoWalk, setRoomAutoWalk] = useState(false);
  const [isExtractingRoom, setIsExtractingRoom] = useState(false);
  const [isRemediating, setIsRemediating] = useState(false);
  const [voiceActive, setVoiceActive] = useState(true);
  const [seismicAudioEnabled, setSeismicAudioEnabled] = useState(true);
  const [voiceLabel, setVoiceLabel] = useState("Natural Neural Voice");
  const [voiceInputText, setVoiceInputText] = useState(
    "I live on the 10th floor, I'm a student renter so I can't drill into the walls, and the top shelf has 20 kilos of textbooks."
  );
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(
    null
  );

  // ==================== PLAN C: EXITZERO STATE ====================
  const [floorGraph, setFloorGraph] =
    useState<BuildingFloorGraph>(IMPERIAL_FLOOR_GRAPH);
  const [liveHazards, setLiveHazards] =
    useState<LiveHazardEvent[]>(DEFAULT_LIVE_HAZARDS);
  const [userStartNodeId, setUserStartNodeId] = useState("room_302");
  const [emergencyType, setEmergencyType] = useState<"earthquake" | "fire">(
    "earthquake"
  );
  const [mobilityMode, setMobilityMode] = useState<
    "walking_running" | "wheelchair_accessible"
  >("walking_running");
  const [askedForLift, setAskedForLift] = useState(true);

  // Start in First-Person Inside Free-Walk view by default
  const [buildingWalkthrough, setBuildingWalkthrough] = useState(true);
  const [buildingFreeWalk, setBuildingFreeWalk] = useState(true);
  const [buildingQuakeActive, setBuildingQuakeActive] = useState(true);
  const [showRouteTwin, setShowRouteTwin] = useState(true);
  const [buildingSpawnTarget, setBuildingSpawnTarget] = useState<{
    x_m: number;
    z_m: number;
    yaw: number;
  } | null>(null);
  const [buildingHudStatus, setBuildingHudStatus] = useState<string>(
    "FREE-WALK IN ROOM 203 — Follow Green Floor Chevrons to Exit"
  );
  const [selectedTwinObj, setSelectedTwinObj] =
    useState<RouteTwinObject | null>(null);
  const [planCVoiceText, setPlanCVoiceText] = useState(
    "I'm outside Lecture Theatre 1 (Room 302)! The main east corridor just collapsed—what's the fastest route to the lift?!"
  );
  const [isScanningHazard, setIsScanningHazard] = useState(false);

  // Refresh human voice label
  useEffect(() => {
    const syncVoice = () => setVoiceLabel(getCurrentHumanVoiceLabel());
    syncVoice();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = syncVoice;
    }
  }, []);

  // Global keyboard shortcut: Ctrl+Space or Cmd+Space summons/closes the Settings & Command Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmdSpace =
        (e.ctrlKey || e.metaKey) && (e.code === "Space" || e.key === " ");
      if (isCtrlOrCmdSpace) {
        e.preventDefault();
        e.stopPropagation();
        setSettingsOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape" && settingsOpen) {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!isInput && e.code === "Backquote") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [settingsOpen]);

  // Focus command input when Ctrl+Space modal opens
  useEffect(() => {
    if (settingsOpen) {
      setTimeout(() => {
        commandInputRef.current?.focus();
      }, 30);
    } else {
      setCommandQuery("");
    }
  }, [settingsOpen]);

  // ==================== DETERMINISTIC SOLVERS ====================
  const currentEvaluation = useMemo(
    () => evaluateRoomScene(roomScene),
    [roomScene]
  );

  const currentPgaG = useMemo(
    () =>
      calculateFloorPGA(
        roomScene.earthquake.magnitude_mw,
        roomScene.room.floor_level
      ),
    [roomScene.earthquake.magnitude_mw, roomScene.room.floor_level]
  );

  const evacuationResult = useMemo(
    () =>
      verifyBuildingEvacuation(
        floorGraph,
        userStartNodeId,
        liveHazards,
        emergencyType,
        mobilityMode,
        askedForLift
      ),
    [
      floorGraph,
      userStartNodeId,
      liveHazards,
      emergencyType,
      mobilityMode,
      askedForLift,
    ]
  );

  // ==================== HANDLERS ====================
  const handleTriggerQuake = () => {
    setIsShaking(true);
    setHasCollapsed(false);
    if (seismicAudioEnabled) {
      try {
        seismicAudio.playSeismicPAndSWave(currentPgaG, 3.8);
      } catch {
        // ignore audio errors
      }
    }
    setTimeout(() => {
      setIsShaking(false);
      setHasCollapsed(true);
      if (voiceActive) {
        if (!currentEvaluation.survivable) {
          speakCoachMessage(
            "Critical failure! You cannot reach the exit door, and never take a lift in a seismic event. Your wardrobe's 2-meter fall shadow seals the exit door, and the top-heavy bookshelf crushes the sleep zone.",
            true
          );
        } else {
          speakCoachMessage(
            "Verification passed! Zero casualties, bottom-weighted shelves stayed upright, and the green A-star evacuation path to the exit door is 100 percent clear.",
            false
          );
        }
      }
    }, 3000);
  };

  const handleSynthesizeRemediation = async () => {
    setIsRemediating(true);
    try {
      const res = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: roomScene,
          evaluation: currentEvaluation,
        }),
      });
      const data = await res.json();
      const proposal: RemediationProposal =
        data.proposal || DEFAULT_REMEDIATION_PROPOSAL;
      proposal.updated_scene.earthquake.magnitude_mw =
        roomScene.earthquake.magnitude_mw;
      proposal.updated_scene.room.floor_level = roomScene.room.floor_level;

      setRemediationProposal(proposal);
      setRemediatedScene(proposal.updated_scene);
      setRoomScene(proposal.updated_scene);
      setHasCollapsed(false);
      if (voiceActive) {
        speakCoachMessage(proposal.summary_spoken, false);
      }
    } catch {
      setRemediationProposal(DEFAULT_REMEDIATION_PROPOSAL);
      setRemediatedScene(STUDENT_BEDROOM_REMEDIATED);
      setRoomScene(STUDENT_BEDROOM_REMEDIATED);
      setHasCollapsed(false);
    } finally {
      setIsRemediating(false);
    }
  };

  const handleSelectRoomPreset = (
    presetKey: "unsafe_bedroom" | "room200" | "hall" | "corridor" | "lobby"
  ) => {
    setActiveRoomPresetKey(presetKey);
    setRemediationProposal(null);
    setRemediatedScene(null);
    setIsShaking(false);
    setHasCollapsed(false);
    if (presetKey === "unsafe_bedroom") {
      setRoomScene(STUDENT_BEDROOM_UNSAFE);
      return;
    }
    const raw = (cagbRouteARooms as unknown as Record<string, RoomSceneGraph>)[
      presetKey
    ];
    if (raw) {
      setRoomScene(raw);
    }
  };

  const handleApplyVoiceConstraints = () => {
    const parsed = parseVoiceConstraintTranscript(voiceInputText);
    setRoomScene((prev) => {
      const next: RoomSceneGraph = JSON.parse(JSON.stringify(prev));
      if (parsed.floorLevel) next.room.floor_level = parsed.floorLevel;
      if (parsed.renterNoDrill !== undefined)
        next.room.renter_no_drill = parsed.renterNoDrill;
      if (parsed.heavyTopShelfKg) {
        const heavy = next.objects.find((o) => o.category === "heavy_item");
        if (heavy) {
          heavy.mass_kg = parsed.heavyTopShelfKg;
          heavy.shelf_level = "top";
        }
      }
      return next;
    });
    if (voiceActive) {
      speakCoachMessage(
        `Updated physics constraints: Floor ${
          parsed.floorLevel || roomScene.room.floor_level
        } sway amplification enabled, Renter No-Drill constraint active.`,
        false
      );
    }
  };

  const handleRoomFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingRoom(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadedPreviewUrl(base64);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || "image/jpeg",
            voiceTranscript: voiceInputText,
            floorLevel: roomScene.room.floor_level,
            renterNoDrill: roomScene.room.renter_no_drill,
          }),
        });
        const data = await res.json();
        if (data.scene) {
          setRoomScene(data.scene);
          setHasCollapsed(false);
        }
      } finally {
        setIsExtractingRoom(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFloorPlanUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningHazard(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/floorplan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: reader.result as string,
            mimeType: file.type || "image/jpeg",
          }),
        });
        const data = await res.json();
        if (data.floorGraph) setFloorGraph(data.floorGraph);
      } finally {
        setIsScanningHazard(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePlanCVoiceSubmit = () => {
    const parsed = parseVoiceConstraintTranscript(planCVoiceText);
    if (parsed.askedForLift !== undefined) setAskedForLift(parsed.askedForLift);
    if (parsed.wheelchairMode) {
      setMobilityMode("wheelchair_accessible");
    }
    if (parsed.eastCorridorBlocked && liveHazards.length === 0) {
      setLiveHazards(DEFAULT_LIVE_HAZARDS);
    }
    if (voiceActive && evacuationResult.verified_safe_route) {
      speakCoachMessage(
        evacuationResult.verified_safe_route.turn_by_turn_voice,
        true
      );
    }
  };

  // ==================== COMMAND PALETTE ITEMS (CTRL+SPACE) ====================
  const quickCommands = useMemo(
    () => [
      {
        id: "cmd-quake",
        label:
          activePlan === "PLAN_B"
            ? `Trigger ${roomScene.earthquake.magnitude_mw.toFixed(1)} Mw Earthquake Shake & Collapse`
            : buildingQuakeActive
            ? "Stop Building Seismic Shake"
            : "Trigger Building 6.8 Mw Seismic Shake",
        shortcut: "ENTER",
        category: "simulation",
        status:
          activePlan === "PLAN_B"
            ? isShaking
              ? "SHAKING"
              : `${currentPgaG}g PGA`
            : buildingQuakeActive
            ? "ACTIVE"
            : "READY",
        action: () => {
          if (activePlan === "PLAN_B") {
            handleTriggerQuake();
            setSettingsOpen(false);
          } else {
            setBuildingQuakeActive((prev) => !prev);
            setSettingsOpen(false);
          }
        },
      },
      {
        id: "cmd-remediate",
        label: "Synthesize Gemini 4 Argon Renter-Safe Room Remediation",
        shortcut: "AI FIX",
        category: "ai",
        status: remediationProposal ? "APPLIED" : "READY",
        action: () => {
          setActivePlan("PLAN_B");
          handleSynthesizeRemediation();
          setSettingsOpen(false);
        },
      },
      {
        id: "cmd-switch-view",
        label:
          activePlan === "PLAN_B"
            ? "Switch Viewport to 3D Building Twin (CAGB Level 2)"
            : "Switch Viewport to 3D Room Shake Twin",
        shortcut: "VIEW",
        category: "viewport",
        status:
          activePlan === "PLAN_B" ? "ROOM -> BUILDING" : "BUILDING -> ROOM",
        action: () => {
          setActivePlan((prev) => (prev === "PLAN_B" ? "PLAN_C" : "PLAN_B"));
          setSettingsOpen(false);
        },
      },
      {
        id: "cmd-camera-mode",
        label:
          activePlan === "PLAN_B"
            ? roomWalkthrough
              ? "Switch Camera to 3D Orbit Cutaway View"
              : "Switch Camera to 1st-Person Free-Walk (WASD + Mouse)"
            : buildingWalkthrough
            ? "Switch Building Camera to Top-Down 3D Orbit View"
            : "Switch Building Camera to 1st-Person Free-Walk",
        shortcut: "CAM",
        category: "camera",
        status:
          (activePlan === "PLAN_B" ? roomWalkthrough : buildingWalkthrough)
            ? "1ST-PERSON"
            : "3D ORBIT",
        action: () => {
          if (activePlan === "PLAN_B") {
            setRoomWalkthrough((prev) => !prev);
          } else {
            setBuildingWalkthrough((prev) => !prev);
          }
          setSettingsOpen(false);
        },
      },
      {
        id: "cmd-autowalk",
        label:
          activePlan === "PLAN_B"
            ? roomAutoWalk
              ? "Switch to Manual WASD Free-Walk"
              : "Run Auto-Guided Shelter & Escape Drill"
            : !buildingFreeWalk
            ? "Switch Building to Manual WASD Free-Walk"
            : "Run Auto-Guided Building Evacuation Drill",
        shortcut: "DRILL",
        category: "camera",
        status:
          activePlan === "PLAN_B"
            ? roomAutoWalk
              ? "AUTO DRILL"
              : "WASD WALK"
            : !buildingFreeWalk
            ? "AUTO DRILL"
            : "WASD WALK",
        action: () => {
          if (activePlan === "PLAN_B") {
            setRoomWalkthrough(true);
            setRoomAutoWalk((prev) => !prev);
          } else {
            setBuildingWalkthrough(true);
            setBuildingFreeWalk((prev) => !prev);
          }
          setSettingsOpen(false);
        },
      },
      {
        id: "cmd-route-twin",
        label: "Toggle CAGB Route A 3D Evidence Twin Overlay (slava/route_A)",
        shortcut: "TWIN",
        category: "building",
        status: showRouteTwin ? "ON" : "OFF",
        action: () => {
          setActivePlan("PLAN_C");
          setShowRouteTwin((prev) => !prev);
          setSettingsOpen(false);
        },
      },
      {
        id: "cmd-voice-cycle",
        label: `Cycle Natural Human Voice Coach (${voiceLabel})`,
        shortcut: "VOICE",
        category: "audio",
        status: voiceActive ? "ENABLED" : "MUTED",
        action: () => {
          const nextName = cyclePreferredHumanVoice();
          setVoiceLabel(nextName);
        },
      },
      {
        id: "cmd-reset",
        label: "Reset Room & Hazards to Baseline Unsafe State",
        shortcut: "RESET",
        category: "simulation",
        status: "DEFAULT",
        action: () => {
          handleSelectRoomPreset("unsafe_bedroom");
          setLiveHazards(DEFAULT_LIVE_HAZARDS);
          setSettingsOpen(false);
        },
      },
    ],
    [
      activePlan,
      roomScene.earthquake.magnitude_mw,
      buildingQuakeActive,
      isShaking,
      currentPgaG,
      remediationProposal,
      roomWalkthrough,
      buildingWalkthrough,
      roomAutoWalk,
      buildingFreeWalk,
      showRouteTwin,
      voiceLabel,
      voiceActive,
    ]
  );

  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return quickCommands;
    return quickCommands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.shortcut.toLowerCase().includes(q)
    );
  }, [quickCommands, commandQuery]);

  // Primary telemetry readout for the Rocky-Robotics-style top-left HUD
  const primaryMetricValue =
    activePlan === "PLAN_B"
      ? `${currentPgaG}`
      : evacuationResult.verified_safe_route
      ? `${evacuationResult.verified_safe_route.estimated_travel_time_s}`
      : "LOCK";
  const primaryMetricUnit =
    activePlan === "PLAN_B" ? "G PGA" : "SEC EGRESS";

  const activeRoomBadge = useMemo(() => {
    if (activeRoomPresetKey === "unsafe_bedroom") {
      return "high-rise-bedroom";
    }
    const found = CAGB_ROOM_PRESET_LIST.find(
      (r) => r.key === activeRoomPresetKey
    );
    return found ? found.key : "room-twin";
  }, [activeRoomPresetKey]);

  const minSafetyFactor = useMemo(() => {
    if (!currentEvaluation.object_results.length) return "1.00";
    const minSf = Math.min(
      ...currentEvaluation.object_results.map(
        (r) => r.analytical_safety_factor
      )
    );
    return minSf.toFixed(2);
  }, [currentEvaluation]);

  const mcWalkPct = useMemo(() => {
    if (!currentEvaluation.monte_carlo) return 100;
    return Math.round(
      currentEvaluation.monte_carlo.exit_reachable_p.walk * 100
    );
  }, [currentEvaluation]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050608] text-slate-100 select-none">
      {/* ==================== FULL-SCREEN 3D VIEWPORT (100VW x 100VH, ZERO BUTTONS) ==================== */}
      <main className="w-screen h-screen">
        {activePlan === "PLAN_B" ? (
          <QuakeRoomCanvas
            scene={roomScene}
            evaluation={currentEvaluation}
            isShaking={isShaking}
            hasCollapsed={hasCollapsed}
            walkthroughActive={roomWalkthrough}
            autoWalk={roomAutoWalk}
            fullScreen={true}
          />
        ) : (
          <ExitZeroCanvas
            floorGraph={floorGraph}
            hazards={liveHazards}
            verification={evacuationResult}
            walkthroughActive={buildingWalkthrough}
            freeWalkMode={buildingFreeWalk}
            quakeActive={buildingQuakeActive}
            showRouteTwin={showRouteTwin}
            spawnTarget={buildingSpawnTarget}
            fullScreen={true}
            onHudUpdate={setBuildingHudStatus}
            onSelectRouteTwinObject={(obj) => {
              setSelectedTwinObj(obj);
              setSettingsTab("telemetry");
              setSettingsOpen(true);
            }}
          />
        )}
      </main>

      {/* ==================== ROCKY ROBOTICS (9VnViBXvA9Q) MINIMAL NON-INTERACTIVE HUD ==================== */}
      {/* Zero buttons on screen when settings are closed: only clean monospace telemetry in corners */}
      <div className="pointer-events-none fixed top-5 left-6 z-20 flex flex-col font-mono">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-light tracking-tight text-white/90 drop-shadow">
            {primaryMetricValue}
          </span>
          <span className="text-[11px] font-normal tracking-widest uppercase text-white/55">
            {primaryMetricUnit}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] tracking-widest uppercase text-white/45 flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              activePlan === "PLAN_B"
                ? currentEvaluation.survivable &&
                  currentEvaluation.exit_reachable_post_quake
                  ? "bg-emerald-400"
                  : "bg-rose-500"
                : evacuationResult.verified_safe_route
                ? "bg-emerald-400"
                : "bg-rose-500"
            }`}
          />
          {activePlan === "PLAN_B" ? (
            <span>
              {roomScene.earthquake.magnitude_mw.toFixed(1)} MW • FL{" "}
              {roomScene.room.floor_level} •{" "}
              {currentEvaluation.survivable &&
              currentEvaluation.exit_reachable_post_quake
                ? "SURVIVABLE"
                : "HIGH COLLAPSE RISK"}
            </span>
          ) : (
            <span>
              CAGB L{floorGraph.floor_number} •{" "}
              {evacuationResult.verified_safe_route?.target_exit_label ??
                "SHELTER IN PLACE"}
            </span>
          )}
        </div>
      </div>

      {/* Bottom-Left Single-Line Dim Monospace Telemetry (Matches "truck-0 driving 18 km/h" in video) */}
      <div className="pointer-events-none fixed bottom-4 left-6 z-20 font-mono text-[11px] tracking-wide text-white/45 flex flex-wrap items-center gap-x-4 gap-y-1">
        {activePlan === "PLAN_B" ? (
          <>
            <span className="text-white/75">{activeRoomBadge}</span>
            <span>
              {roomWalkthrough
                ? roomAutoWalk
                  ? "auto-drill"
                  : "1st-person walk (wasd + mouse)"
                : "orbit-3d"}
            </span>
            <span>sf_min {minSafetyFactor}</span>
            <span>
              exit{" "}
              {currentEvaluation.exit_reachable_post_quake
                ? "clear"
                : "blocked"}
            </span>
            <span>mc_walk {mcWalkPct}%</span>
          </>
        ) : (
          <>
            <span className="text-white/75">cagb-level-2</span>
            <span>
              {buildingWalkthrough
                ? buildingFreeWalk
                  ? "1st-person walk (wasd + mouse)"
                  : "auto-evac-drill"
                : "orbit-3d"}
            </span>
            <span className="truncate max-w-md">
              {buildingHudStatus.toLowerCase()}
            </span>
          </>
        )}
      </div>

      {/* Bottom-Right Subtle Shortcut Indicator */}
      <div className="pointer-events-none fixed bottom-4 right-6 z-20 font-mono text-[11px] tracking-widest text-white/35">
        [ctrl + space] settings
      </div>

      {/* ==================== CTRL+SPACE SUMMONED COMMAND & SETTINGS MODAL ==================== */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-[780px] max-w-[95vw] max-h-[86vh] bg-[#0b0d12]/95 border border-white/15 rounded-lg shadow-2xl flex flex-col font-mono text-xs text-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Command / Search Header Bar (Matches Rocky Robotics Ctrl+Space Overlay) */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <span className="text-emerald-400 font-bold select-none">&gt;</span>
              <input
                ref={commandInputRef}
                type="text"
                value={commandQuery}
                onChange={(e) => {
                  setCommandQuery(e.target.value);
                  if (settingsTab !== "commands" && e.target.value.trim()) {
                    setSettingsTab("commands");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredCommands.length > 0) {
                    e.preventDefault();
                    filteredCommands[0].action();
                  }
                }}
                placeholder='type a command or filter settings... (e.g. "quake", "building", "remediate", "voice")'
                className="w-full bg-transparent text-slate-100 placeholder-white/30 focus:outline-none text-xs"
              />
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/45 whitespace-nowrap">
                ctrl+space / esc
              </span>
            </div>

            {/* Clean Monospace Category Tabs */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/30 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: "commands", label: "commands & controls" },
                    { id: "presets", label: "rooms & building spawns" },
                    { id: "vision", label: "vision scan & human voice" },
                    { id: "telemetry", label: "physics, monte carlo & evidence" },
                  ] as Array<{ id: SettingsTab; label: string }>
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSettingsTab(t.id)}
                    className={`px-2.5 py-1 rounded transition ${
                      settingsTab === t.id
                        ? "bg-white/15 text-white font-semibold"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Direct Mode Switch Pill */}
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded border border-white/10">
                <button
                  onClick={() => setActivePlan("PLAN_B")}
                  className={`px-2 py-0.5 rounded text-[10px] transition ${
                    activePlan === "PLAN_B"
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  room 3d
                </button>
                <button
                  onClick={() => setActivePlan("PLAN_C")}
                  className={`px-2 py-0.5 rounded text-[10px] transition ${
                    activePlan === "PLAN_C"
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  building 3d
                </button>
              </div>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ==================== TAB 1: COMMANDS & SIMULATION PARAMETERS ==================== */}
              {settingsTab === "commands" && (
                <>
                  {/* Command List Rows */}
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-white/40 px-2 pb-1">
                      executable actions (press enter for top match)
                    </div>
                    {filteredCommands.map((cmd, idx) => (
                      <button
                        key={cmd.id}
                        onClick={cmd.action}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-left transition border ${
                          idx === 0 && commandQuery.trim()
                            ? "bg-emerald-500/15 border-emerald-500/40 text-white"
                            : "bg-white/[0.02] hover:bg-white/[0.07] border-white/5 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-white/35 text-[10px] w-16 uppercase">
                            [{cmd.category}]
                          </span>
                          <span>{cmd.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-emerald-300/90">
                            {cmd.status}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/50">
                            {cmd.shortcut}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Interactive Parameter Sliders & Toggles */}
                  <div className="pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded bg-white/[0.02] border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">
                          earthquake magnitude
                        </span>
                        <span className="text-amber-300 font-semibold">
                          {roomScene.earthquake.magnitude_mw.toFixed(1)} Mw
                        </span>
                      </div>
                      <input
                        type="range"
                        min={4.5}
                        max={8.0}
                        step={0.1}
                        value={roomScene.earthquake.magnitude_mw}
                        onChange={(e) => {
                          const mw = Number(e.target.value);
                          setRoomScene({
                            ...roomScene,
                            earthquake: {
                              ...roomScene.earthquake,
                              magnitude_mw: mw,
                            },
                          });
                        }}
                        className="w-full accent-emerald-400"
                      />

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-white/60">
                          building floor level
                        </span>
                        <span className="text-sky-300 font-semibold">
                          floor {roomScene.room.floor_level} ({currentPgaG}g
                          PGA)
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={25}
                        step={1}
                        value={roomScene.room.floor_level}
                        onChange={(e) =>
                          setRoomScene({
                            ...roomScene,
                            room: {
                              ...roomScene.room,
                              floor_level: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>

                    <div className="p-3 rounded bg-white/[0.02] border border-white/10 space-y-2">
                      <div className="text-[10px] uppercase tracking-widest text-white/40">
                        constraints & emergency profile
                      </div>
                      <label className="flex items-center justify-between py-1 cursor-pointer">
                        <span className="text-white/75">
                          renter no-drill constraint
                        </span>
                        <input
                          type="checkbox"
                          checked={roomScene.room.renter_no_drill}
                          onChange={(e) =>
                            setRoomScene({
                              ...roomScene,
                              room: {
                                ...roomScene.room,
                                renter_no_drill: e.target.checked,
                              },
                            })
                          }
                          className="accent-emerald-400"
                        />
                      </label>
                      <label className="flex items-center justify-between py-1 cursor-pointer">
                        <span className="text-white/75">
                          p-wave / s-wave seismic rumble audio
                        </span>
                        <input
                          type="checkbox"
                          checked={seismicAudioEnabled}
                          onChange={(e) =>
                            setSeismicAudioEnabled(e.target.checked)
                          }
                          className="accent-emerald-400"
                        />
                      </label>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-white/60">mobility profile</span>
                        <div className="flex gap-1">
                          {(
                            [
                              { id: "walking_running", label: "able-bodied" },
                              {
                                id: "wheelchair_accessible",
                                label: "wheelchair",
                              },
                            ] as const
                          ).map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setMobilityMode(m.id)}
                              className={`px-2 py-0.5 rounded text-[10px] border ${
                                mobilityMode === m.id
                                  ? "bg-white/15 border-white/30 text-white"
                                  : "border-white/10 text-white/45"
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ==================== TAB 2: ROOM PRESETS & BUILDING SPAWNS ==================== */}
              {settingsTab === "presets" && (
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                      3d room shake-table presets (switches to room 3d & closes
                      modal)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setActivePlan("PLAN_B");
                          handleSelectRoomPreset("unsafe_bedroom");
                          setSettingsOpen(false);
                        }}
                        className={`p-3 rounded text-left border transition ${
                          activePlan === "PLAN_B" &&
                          activeRoomPresetKey === "unsafe_bedroom"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-white"
                            : "bg-white/[0.02] hover:bg-white/[0.06] border-white/10 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">
                            High-Rise Renter Bedroom
                          </span>
                          <span className="text-[10px] text-amber-300">
                            FLOOR 10 • UNSAFE
                          </span>
                        </div>
                        <div className="text-[11px] text-white/50 mt-1">
                          Top-heavy bookcase (20kg textbooks on top shelf),
                          unanchored armoire near exit door, bed by window.
                        </div>
                      </button>

                      {CAGB_ROOM_PRESET_LIST.map((room) => (
                        <button
                          key={room.key}
                          onClick={() => {
                            setActivePlan("PLAN_B");
                            handleSelectRoomPreset(room.key);
                            setSettingsOpen(false);
                          }}
                          className={`p-3 rounded text-left border transition ${
                            activePlan === "PLAN_B" &&
                            activeRoomPresetKey === room.key
                              ? "bg-emerald-500/15 border-emerald-500/40 text-white"
                              : "bg-white/[0.02] hover:bg-white/[0.06] border-white/10 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">
                              {room.label}
                            </span>
                            <span className="text-[10px] text-emerald-300">
                              {room.badge}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/50 mt-1">
                            {room.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                      3d building first-person room spawns (cagb level 2)
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        {
                          label: "Room 203 (Robotics Lab)",
                          nodeId: "room_301",
                          x_m: 6.5,
                          z_m: 5,
                          yaw: 0,
                        },
                        {
                          label: "Room 200 (Lecture Theatre)",
                          nodeId: "room_302",
                          x_m: 17,
                          z_m: 5,
                          yaw: 0,
                        },
                        {
                          label: "Central Spine Corridor",
                          nodeId: "junc_west",
                          x_m: 17,
                          z_m: 11,
                          yaw: -Math.PI / 2,
                        },
                        {
                          label: "Breakout & Refuge Bay R2",
                          nodeId: "refuge_west",
                          x_m: 8,
                          z_m: 17,
                          yaw: Math.PI,
                        },
                        {
                          label: "Central Lifts Lobby",
                          nodeId: "lift_main",
                          x_m: 20.5,
                          z_m: 16,
                          yaw: Math.PI,
                        },
                      ].map((sp) => (
                        <button
                          key={sp.label}
                          onClick={() => {
                            setActivePlan("PLAN_C");
                            setUserStartNodeId(sp.nodeId);
                            setBuildingWalkthrough(true);
                            setBuildingFreeWalk(true);
                            setBuildingSpawnTarget({
                              x_m: sp.x_m,
                              z_m: sp.z_m,
                              yaw: sp.yaw,
                            });
                            setSettingsOpen(false);
                          }}
                          className="p-2.5 rounded bg-white/[0.02] hover:bg-white/[0.07] border border-white/10 text-left transition"
                        >
                          <div className="text-white font-medium">
                            {sp.label}
                          </div>
                          <div className="text-[10px] text-emerald-400 mt-0.5">
                            teleport 1st-person camera -&gt;
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== TAB 3: VISION UPLOAD & NATURAL HUMAN VOICE ==================== */}
              {settingsTab === "vision" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Room Photo / Walkthrough Video Upload */}
                    <div className="p-3 rounded bg-white/[0.02] border border-white/10 space-y-2">
                      <div className="text-[10px] uppercase tracking-widest text-emerald-300">
                        gemini 4 argon room scan (photo or mp4/mov)
                      </div>
                      <p className="text-[11px] text-white/50">
                        Upload a room photo or walkthrough video to extract a 3D
                        scene graph with child shelf loads.
                      </p>
                      <label className="inline-block px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/15 text-white cursor-pointer transition">
                        {isExtractingRoom
                          ? "extracting 3d scene..."
                          : "upload room photo / video"}
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleRoomFileUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadedPreviewUrl && (
                        <img
                          src={uploadedPreviewUrl}
                          alt="Scanned Room"
                          className="h-16 w-28 object-cover rounded border border-white/15 mt-2"
                        />
                      )}
                    </div>

                    {/* 2D Floorplan Upload & Live Hazard Report */}
                    <div className="p-3 rounded bg-white/[0.02] border border-white/10 space-y-2">
                      <div className="text-[10px] uppercase tracking-widest text-sky-300">
                        2d floor-plan & live hazard injection
                      </div>
                      <label className="inline-block px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/15 text-white cursor-pointer transition">
                        {isScanningHazard
                          ? "extruding 3d floorplan..."
                          : "upload 2d floorplan photo"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFloorPlanUpload}
                          className="hidden"
                        />
                      </label>
                      <div className="flex gap-1.5 pt-1">
                        <input
                          type="text"
                          value={planCVoiceText}
                          onChange={(e) => setPlanCVoiceText(e.target.value)}
                          placeholder='e.g. "East corridor blocked, where is the lift?"'
                          className="flex-1 px-2.5 py-1.5 rounded bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none"
                        />
                        <button
                          onClick={handlePlanCVoiceSubmit}
                          className="px-3 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 transition"
                        >
                          verify
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Natural Human Voice Coach Switcher & Voice Constraint Input */}
                  <div className="p-3 rounded bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-white/50">
                        natural human voice coach ({voiceLabel})
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-white/60">voice enabled</span>
                        <input
                          type="checkbox"
                          checked={voiceActive}
                          onChange={(e) => setVoiceActive(e.target.checked)}
                          className="accent-emerald-400"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          const next = cyclePreferredHumanVoice();
                          setVoiceLabel(next);
                        }}
                        className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/15 text-white transition"
                      >
                        switch human voice ({voiceLabel})
                      </button>

                      <button
                        onClick={() =>
                          speakCoachMessage(
                            activePlan === "PLAN_B"
                              ? currentEvaluation.survivable
                                ? "Room layout verified safe. Exit path is clear."
                                : "Warning: top-heavy bookcase and unanchored wardrobe block the exit door."
                              : evacuationResult.verified_safe_route
                                  ?.turn_by_turn_voice ||
                                  "Proceed to the nearest fire stairwell.",
                            false
                          )
                        }
                        className="px-3 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 transition"
                      >
                        test voice readout
                      </button>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        value={voiceInputText}
                        onChange={(e) => setVoiceInputText(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none"
                      />
                      <button
                        onClick={handleApplyVoiceConstraints}
                        className="px-3 py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 transition"
                      >
                        apply constraints
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== TAB 4: TELEMETRY, MONTE CARLO & EVIDENCE ==================== */}
              {settingsTab === "telemetry" && (
                <div className="space-y-4">
                  {/* Two-Phase Seismic Safety Framing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30">
                      <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                        phase 1: during shaking (0–15s)
                      </div>
                      <div className="text-white font-semibold mt-0.5">
                        DROP • COVER • HOLD ON
                      </div>
                      <div className="text-[11px] text-white/65 mt-1">
                        Target Shelter:{" "}
                        {currentEvaluation.safe_shelter_spot_m?.label ??
                          "Under Sturdy Study Desk"}{" "}
                        ({currentEvaluation.shelter_reach_time_s}s)
                      </div>
                    </div>
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30">
                      <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">
                        phase 2: post-shaking evacuation
                      </div>
                      <div className="text-white font-semibold mt-0.5">
                        A* VERIFIED EGRESS ROUTE
                      </div>
                      <div className="text-[11px] text-white/65 mt-1">
                        Walk (0.4m):{" "}
                        {currentEvaluation.exit_reachable_post_quake
                          ? "CLEAR"
                          : "BLOCKED"}{" "}
                        • Wheelchair (0.9m):{" "}
                        {currentEvaluation.wheelchair_reachable_post_quake
                          ? "CLEAR"
                          : "BLOCKED"}
                      </div>
                    </div>
                  </div>

                  {/* Monte Carlo Route A Evaluation Summary (from results/route_A_montecarlo.json) */}
                  <div className="p-3 rounded bg-white/[0.02] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-emerald-300">
                        cagb route a monte carlo evaluation (n = 50 trials,
                        pga 0.30g–0.50g)
                      </span>
                      <span className="text-[10px] text-white/45">
                        results/route_A_montecarlo.json
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {routeAMonteCarlo.map((mc) => (
                        <div
                          key={mc.room}
                          className="p-2 rounded bg-black/40 border border-white/5"
                        >
                          <div className="text-[10px] uppercase text-white/50">
                            {mc.room}
                          </div>
                          <div className="text-xs font-bold text-emerald-300 mt-0.5">
                            walk: {mc.exit_clear_walk}
                          </div>
                          <div className="text-[10px] text-white/50">
                            wheelchair: {mc.exit_clear_wheelchair}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selected Route Twin Object Inspector (if clicked in 3D Building) */}
                  {selectedTwinObj && (
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-300 font-bold">
                          inspected 3d object:{" "}
                          {selectedTwinObj.label || selectedTwinObj.id}
                        </span>
                        <span className="text-white/50">
                          {selectedTwinObj.anchored ? "anchored" : "unanchored"}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/70">
                        pos={JSON.stringify(selectedTwinObj.pos)} • mass=
                        {selectedTwinObj.mass_kg ?? "?"}kg
                      </div>
                    </div>
                  )}

                  {/* Housner Overturning Safety Factor Table */}
                  <div className="p-3 rounded bg-white/[0.02] border border-white/10 space-y-2">
                    <div className="text-[10px] uppercase tracking-widest text-white/45">
                      housner center-of-mass overturning table (current room)
                    </div>
                    <div className="space-y-1">
                      {currentEvaluation.object_results.map((res) => {
                        const obj = roomScene.objects.find(
                          (o) => o.id === res.object_id
                        );
                        return (
                          <div
                            key={res.object_id}
                            className="flex items-center justify-between py-1 px-2 rounded bg-black/30 text-[11px]"
                          >
                            <span className="text-white">
                              {obj?.label || res.object_id}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-white/50">
                                CoM {res.com_height_m}m
                              </span>
                              <span className="font-semibold text-amber-300">
                                SF {res.analytical_safety_factor}
                              </span>
                              <span
                                className={
                                  res.tipped_over || res.shattered_or_fell
                                    ? "text-rose-400"
                                    : "text-emerald-400"
                                }
                              >
                                {res.tipped_over
                                  ? "TIPS"
                                  : res.shattered_or_fell
                                  ? "SHATTERS"
                                  : "STABLE"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
