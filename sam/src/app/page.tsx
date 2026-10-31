"use client";

import React, { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Compass,
  FileUp,
  Layers,
  Mic,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Volume2,
  Accessibility,
  SplitSquareVertical,
} from "lucide-react";

import cagbRouteARooms from "@/presets/cagbRouteARooms.json";
import routeAMonteCarlo from "../../results/route_A_montecarlo.json";
import { playSeismicRumble } from "@/voice/seismicAudioSynth";
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
} from "@/voice/voiceCoach";
import {
  RoomSceneGraph,
  RemediationProposal,
  BuildingFloorGraph,
  LiveHazardEvent,
} from "@/types/contracts";

const QuakeRoomCanvas = dynamic(() => import("@/scene3d/QuakeRoomCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[440px] bg-slate-900/60 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">
      Loading 3D Shake Table & Housner Physics Engine...
    </div>
  ),
});

const ExitZeroCanvas = dynamic(() => import("@/scene3d/ExitZeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[440px] bg-slate-900/60 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">
      Loading 3D Extruded Building Twin & Time-Expanded Pathfinder...
    </div>
  ),
});

export default function SeismicCommandCenter() {
  // Mode toggle: Plan B (QuakeRoom) vs Plan C (ExitZero)
  const [activePlan, setActivePlan] = useState<"PLAN_B" | "PLAN_C">("PLAN_B");

  // ==========================================================================
  // PLAN B STATE (QuakeRoom)
  // ==========================================================================
  const [roomScene, setRoomScene] = useState<RoomSceneGraph>(
    STUDENT_BEDROOM_UNSAFE
  );
  const [remediatedScene, setRemediatedScene] = useState<RoomSceneGraph | null>(
    null
  );
  const [remediationProposal, setRemediationProposal] =
    useState<RemediationProposal | null>(null);
  const [splitScreenCompare, setSplitScreenCompare] = useState(false);

  const [isShaking, setIsShaking] = useState(false);
  const [hasCollapsed, setHasCollapsed] = useState(false);
  const [roomWalkthrough, setRoomWalkthrough] = useState(false);
  const [isExtractingRoom, setIsExtractingRoom] = useState(false);
  const [isRemediating, setIsRemediating] = useState(false);
  const [voiceInputText, setVoiceInputText] = useState(
    "I live on the 10th floor, I'm a student renter so I can't drill into the walls, and the top shelf has 20 kilos of textbooks."
  );
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(
    null
  );

  const roomFileInputRef = useRef<HTMLInputElement>(null);

  // Deterministic evaluations
  const currentEvaluation = useMemo(
    () => evaluateRoomScene(roomScene),
    [roomScene]
  );
  const remediatedEvaluation = useMemo(
    () =>
      remediatedScene
        ? evaluateRoomScene(remediatedScene)
        : evaluateRoomScene(STUDENT_BEDROOM_REMEDIATED),
    [remediatedScene]
  );

  const currentPgaG = useMemo(
    () =>
      calculateFloorPGA(
        roomScene.earthquake.magnitude_mw,
        roomScene.room.floor_level
      ),
    [roomScene.earthquake.magnitude_mw, roomScene.room.floor_level]
  );

  // ==========================================================================
  // PLAN C STATE (ExitZero)
  // ==========================================================================
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
  const [buildingWalkthrough, setBuildingWalkthrough] = useState(false);
  const [routeTwinMode, setRouteTwinMode] = useState(true);
  const [planCVoiceText, setPlanCVoiceText] = useState(
    "I'm outside Lecture Theatre 1 (Room 302)! The main east corridor just collapsed—what's the fastest route to the lift?!"
  );
  const [isScanningHazard, setIsScanningHazard] = useState(false);
  const floorPlanInputRef = useRef<HTMLInputElement>(null);
  const hazardCamInputRef = useRef<HTMLInputElement>(null);

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

  // ==========================================================================
  // HANDLERS — PLAN B (QuakeRoom)
  // ==========================================================================
  const handleTriggerQuake = () => {
    setIsShaking(true); try { playSeismicRumble({ durationSeconds: 4.5, magnitudeMw: roomScene.earthquake.magnitude_mw, pgaG: currentPgaG }); } catch {}
    setHasCollapsed(false);
    setTimeout(() => {
      setIsShaking(false);
      setHasCollapsed(true);
      if (!currentEvaluation.survivable) {
        speakCoachMessage(
          "Critical failure! You cannot reach the exit door—and never take a lift in a seismic event. Your wardrobe's 2-meter fall shadow seals the exit door, and the top-heavy bookshelf crushes the sleep zone.",
          true
        );
      } else {
        speakCoachMessage(
          "Verification passed! Zero casualties, bottom-weighted shelves stayed upright, and the green A-star evacuation path to the exit door is 100 percent clear.",
          false
        );
      }
    }, 3200);
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
    speakCoachMessage(
      `Updated physics constraints: Floor ${
        parsed.floorLevel || roomScene.room.floor_level
      } sway amplification enabled, Renter No-Drill constraint active.`,
      false
    );
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
          setSplitScreenCompare(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsExtractingRoom(false);
      }
    };
    reader.readAsDataURL(file);
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
      // Sync magnitude and floor level with current slider
      proposal.updated_scene.earthquake.magnitude_mw =
        roomScene.earthquake.magnitude_mw;
      proposal.updated_scene.room.floor_level = roomScene.room.floor_level;

      setRemediationProposal(proposal);
      setRemediatedScene(proposal.updated_scene);
      setSplitScreenCompare(true);
      setHasCollapsed(true);
      speakCoachMessage(proposal.summary_spoken, false);
    } catch (e) {
      console.error(e);
      setRemediationProposal(DEFAULT_REMEDIATION_PROPOSAL);
      setRemediatedScene(STUDENT_BEDROOM_REMEDIATED);
      setSplitScreenCompare(true);
    } finally {
      setIsRemediating(false);
    }
  };

  // ==========================================================================
  // HANDLERS — PLAN C (ExitZero)
  // ==========================================================================
  const handlePlanCVoiceSubmit = () => {
    const parsed = parseVoiceConstraintTranscript(planCVoiceText);
    if (parsed.askedForLift !== undefined) setAskedForLift(parsed.askedForLift);
    if (parsed.wheelchairMode) {
      setMobilityMode("wheelchair_accessible");
    }
    if (parsed.eastCorridorBlocked && liveHazards.length === 0) {
      setLiveHazards(DEFAULT_LIVE_HAZARDS);
    }
    setTimeout(() => {
      if (evacuationResult.verified_safe_route) {
        speakCoachMessage(
          evacuationResult.verified_safe_route.turn_by_turn_voice,
          true
        );
      }
    }, 150);
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

  const handleHazardCameraUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningHazard(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/hazard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: reader.result as string,
            mimeType: file.type || "image/jpeg",
            voiceReport: planCVoiceText,
            targetNodeId: "junc_east",
          }),
        });
        const data = await res.json();
        if (data.hazard) {
          setLiveHazards([data.hazard]);
        }
        if (data.lift_requested) {
          setAskedForLift(true);
        }
      } finally {
        setIsScanningHazard(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOP COMMAND HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                SeismicTwin 3D
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Gemini 4 Argon + Deterministic Physics & A* Verifier
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Upload Room Video / Blueprint → 3D Quake Simulation → Structural Remediation → First-Person Escape Walkthrough
            </p>
          </div>
        </div>

        {/* PLAN B vs PLAN C MODE SWITCHER */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActivePlan("PLAN_B")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activePlan === "PLAN_B"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="h-4 w-4" />
            Plan B: QuakeRoom (3D Room Collapse & Fix)
          </button>
          <button
            onClick={() => {
              setActivePlan("PLAN_C");
              setRouteTwinMode(false);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activePlan === "PLAN_C"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Plan C: ExitZero (3D Floor-Plan Evacuation Twin)
          </button>
          <button
            onClick={() => {
              setActivePlan("PLAN_C");
              setRouteTwinMode(true);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activePlan === "PLAN_C" && routeTwinMode
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="h-4 w-4" />
            CAGB Route Twin (slava/route_A)
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* PLAN B: QUAKEROOM VIEW */}
      {/* ==================================================================== */}
      {activePlan === "PLAN_B" && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
          {/* LEFT CONTROL COLUMN (4 COLS) */}
          <div className="lg:col-span-4 space-y-4 flex flex-col">
            {/* 1. Upload Video / Photo / Blueprint + Presets */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Camera className="h-4 w-4 text-emerald-400" />
                  1. Scan Room Video / Photo / Blueprint
                </h2>
                <span className="text-[11px] text-slate-400">Vision → 3D Graph</span>
              </div>

              <input
                ref={roomFileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleRoomFileUpload}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => roomFileInputRef.current?.click()}
                  disabled={isExtractingRoom}
                  className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition"
                >
                  <FileUp className="h-4 w-4 text-emerald-400" />
                  {isExtractingRoom ? "Extracting 3D..." : "Upload Photo / Video"}
                </button>
                <button
                  onClick={() => {
                    setRoomScene(STUDENT_BEDROOM_UNSAFE);
                    setRemediatedScene(null);
                    setSplitScreenCompare(false);
                    setHasCollapsed(false);
                  }}
                  className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Load Imperial Student Room
                </button>
              </div>

              {uploadedPreviewUrl && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <img
                    src={uploadedPreviewUrl}
                    alt="Uploaded scan"
                    className="h-12 w-16 object-cover rounded"
                  />
                  <div className="text-xs text-emerald-300 font-medium">
                    Scanned & snapped to 3D floor grid via Deterministic Sanitizer
                  </div>
                </div>
              )}
            </div>

            {/* 2. Gemini Live Voice Context (Floor Level, Renter Mode, Shelf Loads) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mic className="h-4 w-4 text-cyan-400" />
                  2. Gemini Live Voice Constraints
                </h2>
                <span className="text-[11px] text-cyan-300 font-medium">
                  Invisible Physics Context
                </span>
              </div>

              <textarea
                value={voiceInputText}
                onChange={(e) => setVoiceInputText(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="Speak or type floor level, renter drilling rules, and shelf masses..."
              />

              <button
                onClick={handleApplyVoiceConstraints}
                className="w-full py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold text-cyan-300 flex items-center justify-center gap-2 transition"
              >
                <Volume2 className="h-4 w-4" />
                Apply Voice Constraints to Physics Engine
              </button>

              {/* Live Parameter Sliders */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Quake Magnitude:</span>
                    <span className="font-bold text-rose-400">
                      {roomScene.earthquake.magnitude_mw.toFixed(1)} Mw
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4.5}
                    max={8.0}
                    step={0.1}
                    value={roomScene.earthquake.magnitude_mw}
                    onChange={(e) =>
                      setRoomScene((prev) => ({
                        ...prev,
                        earthquake: {
                          ...prev.earthquake,
                          magnitude_mw: parseFloat(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-rose-500"
                  />
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Building Floor:</span>
                    <span className="font-bold text-amber-300">
                      Floor {roomScene.room.floor_level} ({currentPgaG}g PGA)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    step={1}
                    value={roomScene.room.floor_level}
                    onChange={(e) =>
                      setRoomScene((prev) => ({
                        ...prev,
                        room: {
                          ...prev.room,
                          floor_level: parseInt(e.target.value, 10),
                        },
                      }))
                    }
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-300">
                  Renter Constraint (No Wall Drilling):
                </span>
                <button
                  onClick={() =>
                    setRoomScene((prev) => ({
                      ...prev,
                      room: {
                        ...prev.room,
                        renter_no_drill: !prev.room.renter_no_drill,
                      },
                    }))
                  }
                  className={`px-2.5 py-0.5 rounded font-bold ${
                    roomScene.room.renter_no_drill
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {roomScene.room.renter_no_drill ? "ACTIVE (Zero-Drill)" : "OFF"}
                </button>
              </div>
            </div>

            {/* 3. Trigger Quake & Synthesize Remediation */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                3. Simulate Quake & Auto-Remediate Room
              </h2>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={handleTriggerQuake}
                  disabled={isShaking}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {isShaking
                    ? `Shaking 3D Floor (${roomScene.earthquake.magnitude_mw}M)...`
                    : `Trigger ${roomScene.earthquake.magnitude_mw}M Earthquake`}
                </button>

                <button
                  onClick={handleSynthesizeRemediation}
                  disabled={isRemediating}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  {isRemediating
                    ? "Synthesizing & Verifying Layout..."
                    : "Synthesize & Verify Renter-Safe Layout"}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRoomWalkthrough((w) => !w)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      roomWalkthrough
                        ? "bg-emerald-500 text-slate-950 border-emerald-400"
                        : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    <Compass className="h-4 w-4" />
                    {roomWalkthrough ? "Exit 1st-Person" : "Play 1st-Person Escape"}
                  </button>

                  <button
                    onClick={() => {
                      if (!remediatedScene) {
                        setRemediatedScene(STUDENT_BEDROOM_REMEDIATED);
                        setRemediationProposal(DEFAULT_REMEDIATION_PROPOSAL);
                      }
                      setSplitScreenCompare((s) => !s);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      splitScreenCompare
                        ? "bg-cyan-500 text-slate-950 border-cyan-400"
                        : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    <SplitSquareVertical className="h-4 w-4" />
                    {splitScreenCompare ? "Single 3D View" : "Split Before/After"}
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Proposed Structural / Furniture Changes List */}
            {remediationProposal && (
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Gemini 4 Argon Verified Structural Fixes
                  </h3>
                  <button
                    onClick={() => {
                      if (remediatedScene) {
                        setRoomScene(remediatedScene);
                        setSplitScreenCompare(false);
                      }
                    }}
                    className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-[11px] font-bold hover:bg-emerald-400"
                  >
                    Apply Fix to Main Room
                  </button>
                </div>
                <p className="text-xs text-slate-300 italic">
                  &ldquo;{remediationProposal.summary_spoken}&rdquo;
                </p>
                <div className="space-y-1.5 pt-1">
                  {remediationProposal.changes.map((c, i) => (
                    <div
                      key={i}
                      className="text-xs bg-slate-950/80 border border-slate-800 rounded-lg p-2"
                    >
                      <span className="font-bold text-emerald-400">
                        [{c.object_id} → {c.action}]:
                      </span>{" "}
                      <span className="text-slate-300">{c.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 3D VIEWPORT & TELEMETRY COLUMN (8 COLS) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* 3D Canvas Area (Single or Split-Screen Before vs Verified After) */}
            <div
              className={`grid gap-4 flex-1 min-h-[440px] ${
                splitScreenCompare ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
              }`}
            >
              <QuakeRoomCanvas
                scene={roomScene}
                evaluation={currentEvaluation}
                isShaking={isShaking}
                hasCollapsed={hasCollapsed}
                walkthroughActive={roomWalkthrough}
                titleBadge="BEFORE: Original Scanned Layout"
              />

              {splitScreenCompare && (
                <QuakeRoomCanvas
                  scene={remediatedScene || STUDENT_BEDROOM_REMEDIATED}
                  evaluation={remediatedEvaluation}
                  isShaking={isShaking}
                  hasCollapsed={hasCollapsed}
                  walkthroughActive={roomWalkthrough}
                  titleBadge="VERIFIED AFTER: Renter-Safe Ballasted Layout"
                />
              )}
            </div>

            {/* Deterministic Physics, N=50 Monte Carlo & A* Pathfinder Telemetry Cards */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              {/* 2-Phase Official Seismic Safety Protocol Banner (Slava + Ana Spec) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-cyan-300 uppercase tracking-wider text-[10px] block">
                      Phase 1 — DURING Shaking (Do Not Run to Door)
                    </span>
                    <span className="text-slate-200 font-medium">
                      {currentEvaluation.safe_shelter_spot_m?.label ||
                        "Drop, Cover & Hold On Under Study Desk"}
                    </span>
                  </div>
                  <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold whitespace-nowrap">
                    {currentEvaluation.shelter_reach_time_s}s reach
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-300 uppercase tracking-wider text-[10px] block">
                      Phase 2 — AFTER Shaking Stops (Post-Collapse A* Egress)
                    </span>
                    <span className="text-slate-300">
                      Walk (0.4m):{" "}
                      <strong
                        className={
                          currentEvaluation.exit_reachable_post_quake
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }
                      >
                        {currentEvaluation.exit_reachable_post_quake
                          ? "CLEAR"
                          : "BLOCKED"}
                      </strong>{" "}
                      | Wheelchair (0.9m):{" "}
                      <strong
                        className={
                          currentEvaluation.wheelchair_reachable_post_quake
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }
                      >
                        {currentEvaluation.wheelchair_reachable_post_quake
                          ? "CLEAR"
                          : "BLOCKED"}
                      </strong>
                    </span>
                  </div>
                  {currentEvaluation.monte_carlo && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">
                        N={currentEvaluation.monte_carlo.runs} Monte Carlo (Seed{" "}
                        {currentEvaluation.monte_carlo.seed})
                      </span>
                      <span className="font-bold text-amber-300">
                        Walk:{" "}
                        {Math.round(
                          currentEvaluation.monte_carlo.exit_reachable_p.walk *
                            100
                        )}
                        % ({currentEvaluation.monte_carlo.exit_clear_walk_count}/
                        {currentEvaluation.monte_carlo.runs})
                        {splitScreenCompare &&
                          remediatedEvaluation.monte_carlo && (
                            <span className="text-emerald-400 ml-1">
                              →{" "}
                              {Math.round(
                                remediatedEvaluation.monte_carlo
                                  .exit_reachable_p.walk * 100
                              )}
                              %
                            </span>
                          )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Deterministic Housner Overturning ($SF = (b/h_&#123;\text&#123;CoM&#125;&#125;)/(a_&#123;\text&#123;floor&#125;&#125;/g)$) & Post-Collapse A* Egress Telemetry
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  {currentEvaluation.monte_carlo && (
                    <span className="text-slate-400">
                      PGA Ensemble:{" "}
                      <strong className="text-cyan-300">
                        {currentEvaluation.monte_carlo.pga_g_range[0]}g–
                        {currentEvaluation.monte_carlo.pga_g_range[1]}g
                      </strong>
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded font-bold ${
                      currentEvaluation.exit_reachable_post_quake
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {currentEvaluation.exit_reachable_post_quake
                      ? "A* EXIT DOOR CLEAR"
                      : `EXIT BLOCKED BY: ${currentEvaluation.blocking_object_ids.join(", ")}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {currentEvaluation.object_results.map((res) => {
                  const obj = roomScene.objects.find(
                    (o) => o.id === res.object_id
                  );
                  const danger =
                    res.tipped_over ||
                    res.shattered_or_fell ||
                    res.analytical_safety_factor < 1.0;
                  return (
                    <div
                      key={res.object_id}
                      className={`p-2.5 rounded-lg border text-xs ${
                        danger
                          ? "bg-red-950/25 border-red-500/40 text-red-200"
                          : "bg-slate-950 border-slate-800 text-slate-300"
                      }`}
                    >
                      <div className="font-bold truncate">
                        {obj?.label || res.object_id}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span>
                          SF:{" "}
                          <strong
                            className={
                              res.analytical_safety_factor < 1.0
                                ? "text-red-400"
                                : "text-emerald-400"
                            }
                          >
                            {res.analytical_safety_factor}
                          </strong>
                        </span>
                        <span>h_CoM: {res.com_height_m}m</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                        <span>Impact: {res.peak_kinetic_energy_joules} J</span>
                        {res.hit_occupant_zone && (
                          <span className="text-red-400 font-bold">
                            HITS BED!
                          </span>
                        )}
                        {res.blocked_exit_corridor && (
                          <span className="text-red-400 font-bold">
                            BLOCKS DOOR!
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ==================================================================== */}
      {/* PLAN C: EXITZERO VIEW (2D Floor-Plan + Live Camera -> 3D Evacuation) */}
      {/* ==================================================================== */}
      {activePlan === "PLAN_C" && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
          {/* LEFT CONTROL COLUMN (4 COLS) */}
          <div className="lg:col-span-4 space-y-4 flex flex-col">
            {/* 1. Scan Building Floor-Plan Sign & Live Corridor Camera */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-400" />
                1. Scan Wall Floor-Plan Sign & Live Corridor Hazard
              </h2>

              <input
                ref={floorPlanInputRef}
                type="file"
                accept="image/*"
                onChange={handleFloorPlanUpload}
                className="hidden"
              />
              <input
                ref={hazardCamInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleHazardCameraUpload}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => floorPlanInputRef.current?.click()}
                  className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
                >
                  <FileUp className="h-4 w-4 text-cyan-400" />
                  Upload 2D Floor Plan
                </button>
                <button
                  onClick={() => hazardCamInputRef.current?.click()}
                  className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5"
                >
                  <Camera className="h-4 w-4 text-rose-400" />
                  Scan Corridor Blockade
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Your Current Location:
                  </label>
                  <select
                    value={userStartNodeId}
                    onChange={(e) => setUserStartNodeId(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-slate-200"
                  >
                    {floorGraph.nodes
                      .filter((n) => n.type === "room" || n.type === "corridor_junction")
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Emergency Mode:
                  </label>
                  <select
                    value={emergencyType}
                    onChange={(e) =>
                      setEmergencyType(e.target.value as "earthquake" | "fire")
                    }
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="earthquake">6.8M Earthquake + Aftershock</option>
                    <option value="fire">Corridor Fire & Smoke Spread</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Gemini Live Spotter & "Lift Trap" Interceptor */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mic className="h-4 w-4 text-emerald-400" />
                  2. Gemini Live Voice Spotter & Lift Override
                </h2>
                {isScanningHazard && (
                  <span className="text-xs text-cyan-400 animate-pulse">
                    Analyzing...
                  </span>
                )}
              </div>

              <textarea
                value={planCVoiceText}
                onChange={(e) => setPlanCVoiceText(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePlanCVoiceSubmit}
                  className="py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Volume2 className="h-4 w-4" />
                  Verify & Speak Guidance
                </button>

                <button
                  onClick={() => {
                    const nextMode =
                      mobilityMode === "walking_running"
                        ? "wheelchair_accessible"
                        : "walking_running";
                    setMobilityMode(nextMode);
                    speakCoachMessage(
                      nextMode === "wheelchair_accessible"
                        ? "Wheelchair accessible mode activated. Lifts are locked out and stairs are impassable; routing to Fire-Rated Evacuation Refuge Point R2."
                        : "Walking evacuation mode active; routing to Stairwell B via West Fire Core.",
                      false
                    );
                  }}
                  className={`py-2.5 px-3 rounded-lg font-bold text-xs border flex items-center justify-center gap-1.5 transition ${
                    mobilityMode === "wheelchair_accessible"
                      ? "bg-purple-500 text-white border-purple-400"
                      : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  <Accessibility className="h-4 w-4" />
                  {mobilityMode === "wheelchair_accessible"
                    ? "Wheelchair Refuge Mode"
                    : "Switch to Wheelchair Mode"}
                </button>
              </div>

              <button
                onClick={() => setBuildingWalkthrough((b) => !b)}
                className={`w-full py-2.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                  buildingWalkthrough
                    ? "bg-cyan-500 text-slate-950 border-cyan-400"
                    : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                }`}
              >
                <Compass className="h-4 w-4" />
                {buildingWalkthrough
                  ? "Stop Guided 3D Corridor Walkthrough"
                  : "Play First-Person Guided Evacuation Route"}
              </button>
            </div>

            {/* 3. Deterministic Time-Expanded Route Verifier Comparison */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                3. Time-Expanded Dijkstra / A* Verifier
              </h2>

              {/* Lift Lockout Alert */}
              {evacuationResult.lift_override_triggered && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/50 text-xs text-red-200">
                  <div className="font-bold text-red-400 mb-0.5">
                    LIFT LOCKOUT OVERRIDE TRIGGERED
                  </div>
                  {evacuationResult.lift_override_reason}
                </div>
              )}

              {/* Naive Shortest Route (Rejected) */}
              <div className="p-3 rounded-lg bg-slate-950 border border-red-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400">
                    Naive Shortest Route (East Hall / Lift)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-[10px] font-bold text-red-300">
                    REJECTED ({evacuationResult.naive_shortest_route.status})
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {evacuationResult.naive_shortest_route.failure_reason}
                </p>
              </div>

              {/* Verified Safe Route */}
              {evacuationResult.verified_safe_route && (
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      Verified Safe Route:{" "}
                      {evacuationResult.verified_safe_route.target_exit_label}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                      +{evacuationResult.verified_safe_route.safety_margin_before_closure_s}s BUFFER
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-300">
                    <span>
                      Distance:{" "}
                      <strong>
                        {evacuationResult.verified_safe_route.total_distance_m}m
                      </strong>
                    </span>
                    <span>
                      Travel Time:{" "}
                      <strong>
                        {evacuationResult.verified_safe_route.estimated_travel_time_s}s
                      </strong>
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200 italic pt-1">
                    &ldquo;{evacuationResult.verified_safe_route.turn_by_turn_voice}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 3D BUILDING TWIN COLUMN (8 COLS) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex-1 min-h-[460px]">
              <ExitZeroCanvas
                floorGraph={floorGraph}
                hazards={liveHazards}
                verification={evacuationResult}
                walkthroughActive={buildingWalkthrough}
              />
            </div>

            {/* Official CAGB Level 2 Floorplan Calibration + Video Evidence & Macro-to-Micro Bridge */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 flex items-center gap-2.5">
                <img
                  src="/floorplans/cagb-L2-preview.jpg"
                  alt="Imperial CAGB Level 2 Official Map"
                  className="h-20 w-24 object-cover rounded-lg border border-slate-700 bg-slate-950"
                />
                <img
                  src="/floorplans/routes/routes_overview.png"
                  alt="CAGB Level 2 Routes A-D Overview"
                  className="h-20 w-24 object-cover rounded-lg border border-cyan-500/40 bg-slate-950"
                />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-white">
                    CAGB Level 2 Venue & Routes A–D
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Scale Lock (<code className="text-cyan-300">9.52 px/m</code>): Exhibition Rd ={" "}
                    <strong className="text-emerald-300">2.10m</strong>; Dalby Ct ={" "}
                    <strong className="text-amber-300">1.12m</strong>
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 text-xs space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400">
                    Video Hazard Evidence
                  </span>
                  {liveHazards[0]?.video_evidence && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                      {liveHazards[0].video_evidence.video_file} @ t=
                      {liveHazards[0].video_evidence.timestamp_s}s
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300">
                  {liveHazards[0]?.video_evidence?.quote ||
                    liveHazards[0]?.description}
                </p>
              </div>

              <div className="md:col-span-3 flex flex-col gap-2">
                <button
                  onClick={() => setActivePlan("PLAN_B")}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition"
                >
                  <Layers className="h-4 w-4" />
                  Zoom Inside Room 3D Shake Table →
                </button>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
