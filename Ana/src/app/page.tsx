"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  FileUp,
  Layers,
  Maximize2,
  Menu,
  Mic,
  Minimize2,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Volume2,
  Accessibility,
  SplitSquareVertical,
  X,
} from "lucide-react";

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

const QuakeRoomCanvas = dynamic(() => import("@/scene3d/QuakeRoomCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-slate-950 flex items-center justify-center text-slate-300 text-sm">
      Loading Realistic 3D Room & Housner Physics Engine...
    </div>
  ),
});

const ExitZeroCanvas = dynamic(() => import("@/scene3d/ExitZeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-slate-950 flex items-center justify-center text-slate-300 text-sm">
      Loading Realistic 3D Building & Time-Expanded Pathfinder...
    </div>
  ),
});

export default function SeismicCommandCenter() {
  // Main display switcher: Room ("PLAN_B") vs Building ("PLAN_C")
  const [activePlan, setActivePlan] = useState<"PLAN_B" | "PLAN_C">("PLAN_B");

  // Full-screen toggle (ON by default as requested)
  const [fullScreenMode, setFullScreenMode] = useState<boolean>(true);

  // Collapsible full menu drawer (CLOSED by default so full screen is unobstructed)
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // Voice label state
  const [voiceLabel, setVoiceLabel] = useState<string>("Natural Neural");

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        setVoiceLabel(getCurrentHumanVoiceLabel());
      };
      window.speechSynthesis.onvoiceschanged = updateVoices;
      updateVoices();
    }
  }, []);

  // ==========================================================================
  // PLAN B STATE (QuakeRoom — Starts in First-Person View inside the Room!)
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
  // Start in First-Person View inside the room by default!
  const [roomWalkthrough, setRoomWalkthrough] = useState(true);
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
  // PLAN C STATE (ExitZero — Starts in First-Person View inside the Building!)
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
  // Start in First-Person View inside the building by default!
  const [buildingWalkthrough, setBuildingWalkthrough] = useState(true);
  const [planCVoiceText, setPlanCVoiceText] = useState(
    "I'm outside Lecture Theatre 1 (Room 302)! The main east corridor just collapsed — what's the fastest route to the lift?!"
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
    setIsShaking(true);
    setHasCollapsed(false);
    setTimeout(() => {
      setIsShaking(false);
      setHasCollapsed(true);
      if (!currentEvaluation.survivable) {
        speakCoachMessage(
          "Critical alert. You cannot reach the exit door right now, and never take an elevator during an earthquake. Your wardrobe has tipped across the doorway, and the top-heavy bookshelf fell into the bed zone.",
          true
        );
      } else {
        speakCoachMessage(
          "Room verification passed! Because your heavy textbooks are now on the bottom shelf and the wardrobe was shifted away from the door, everything stayed safe and your escape path is completely clear.",
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
      `Got it. I've updated the room physics for floor ${
        parsed.floorLevel || roomScene.room.floor_level
      } sway amplification, and enabled renter-friendly no-drill mode.`,
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
      proposal.updated_scene.earthquake.magnitude_mw =
        roomScene.earthquake.magnitude_mw;
      proposal.updated_scene.room.floor_level = roomScene.room.floor_level;

      setRemediationProposal(proposal);
      setRemediatedScene(proposal.updated_scene);
      setRoomScene(proposal.updated_scene);
      setHasCollapsed(false);
      speakCoachMessage(proposal.summary_spoken, false);
    } catch (e) {
      console.error(e);
      setRemediationProposal(DEFAULT_REMEDIATION_PROPOSAL);
      setRemediatedScene(STUDENT_BEDROOM_REMEDIATED);
      setRoomScene(STUDENT_BEDROOM_REMEDIATED);
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

  const isFirstPersonActive =
    activePlan === "PLAN_B" ? roomWalkthrough : buildingWalkthrough;

  const toggleFirstPersonView = () => {
    if (activePlan === "PLAN_B") {
      setRoomWalkthrough((v) => !v);
    } else {
      setBuildingWalkthrough((v) => !v);
    }
  };

  return (
    <div
      className={`relative bg-slate-950 text-slate-100 ${
        fullScreenMode
          ? "w-screen h-screen overflow-hidden"
          : "min-h-screen p-6"
      }`}
    >
      {/* ==================================================================== */}
      {/* FLOATING MINIMAL TOP HUD BAR (ALWAYS ACCESSIBLE, UNOBSTRUCTED 3D)    */}
      {/* ==================================================================== */}
      <header
        className={`${
          fullScreenMode
            ? "fixed top-3 left-3 right-3 z-30"
            : "mb-4"
        } flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-slate-700/80 shadow-2xl`}
      >
        {/* Left: Brand & Room vs Building Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700/80">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md">
              <Activity className="h-4 w-4 text-slate-950" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white hidden sm:inline">
              SeismicTwin 3D
            </span>
          </div>

          {/* ROOM vs BUILDING DISPLAY SWITCH BUTTONS */}
          <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActivePlan("PLAN_B")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activePlan === "PLAN_B"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              🏠 3D Room Display
            </button>
            <button
              onClick={() => setActivePlan("PLAN_C")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activePlan === "PLAN_C"
                  ? "bg-cyan-500 text-slate-950 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              🏢 3D Building Display
            </button>
          </div>

          {/* 1ST PERSON (INSIDE) vs 3D ORBIT SWITCHER */}
          <button
            onClick={toggleFirstPersonView}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              isFirstPersonActive
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                : "bg-slate-800/90 text-slate-200 border-slate-700 hover:border-slate-500"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {isFirstPersonActive
              ? "👁️ View: 1st Person (Inside)"
              : "🌐 View: 3D Dollhouse Orbit"}
          </button>

          {/* FULL SCREEN ON / OFF BUTTON */}
          <button
            onClick={() => setFullScreenMode((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              fullScreenMode
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                : "bg-slate-800/90 text-slate-300 border-slate-700"
            }`}
          >
            {fullScreenMode ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                Full Screen: ON
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                Full Screen: OFF
              </>
            )}
          </button>
        </div>

        {/* Right: Quick Simulation Actions + Human Voice Switcher + Menu Toggle Button */}
        <div className="flex flex-wrap items-center gap-2">
          {activePlan === "PLAN_B" ? (
            <>
              <button
                onClick={handleTriggerQuake}
                disabled={isShaking}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg flex items-center gap-1.5 transition"
              >
                <Play className="h-3.5 w-3.5" />
                {isShaking ? "Shaking..." : "Simulate Quake"}
              </button>
              <button
                onClick={handleSynthesizeRemediation}
                disabled={isRemediating}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg flex items-center gap-1.5 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isRemediating ? "Fixing..." : "Apply Renter Fix"}
              </button>
              <button
                onClick={() => {
                  setRoomScene(STUDENT_BEDROOM_UNSAFE);
                  setRemediatedScene(null);
                  setSplitScreenCompare(false);
                  setHasCollapsed(false);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition"
                title="Reset Unsafe Room"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() =>
                  setLiveHazards((prev) =>
                    prev.length > 0 ? [] : DEFAULT_LIVE_HAZARDS
                  )
                }
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                  liveHazards.length > 0
                    ? "bg-red-600 text-white border-red-400"
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {liveHazards.length > 0
                  ? "East Corridor Blocked"
                  : "Corridors Clear"}
              </button>
              <button
                onClick={() =>
                  setMobilityMode((m) =>
                    m === "walking_running"
                      ? "wheelchair_accessible"
                      : "walking_running"
                  )
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                  mobilityMode === "wheelchair_accessible"
                    ? "bg-purple-600 text-white border-purple-400"
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}
              >
                <Accessibility className="h-3.5 w-3.5" />
                {mobilityMode === "wheelchair_accessible"
                  ? "♿ Wheelchair Refuge"
                  : "🚶 Walking Mode"}
              </button>
            </>
          )}

          {/* HUMAN VOICE SWITCHER BUTTON */}
          <button
            onClick={() => {
              const nextName = cyclePreferredHumanVoice();
              setVoiceLabel(nextName);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition"
            title="Click to switch to another human-like voice"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Voice:</span>{" "}
            <span className="max-w-[110px] truncate">{voiceLabel}</span>
          </button>

          {/* OPEN / CLOSE FULL MENU BUTTON */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shadow-lg ${
              menuOpen
                ? "bg-amber-500 text-slate-950 border-amber-400"
                : "bg-slate-100 text-slate-950 border-white hover:bg-emerald-400"
            }`}
          >
            {menuOpen ? (
              <>
                <X className="h-4 w-4" />
                Hide Menu
              </>
            ) : (
              <>
                <Menu className="h-4 w-4" />
                Open Full Menu
              </>
            )}
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MAIN 3D VIEWPORT (FULL-SCREEN OR FRAMED)                             */}
      {/* ==================================================================== */}
      <div className={fullScreenMode ? "w-screen h-screen" : "w-full"}>
        {activePlan === "PLAN_B" ? (
          splitScreenCompare ? (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${
                fullScreenMode ? "w-screen h-screen" : "w-full"
              }`}
            >
              <QuakeRoomCanvas
                scene={STUDENT_BEDROOM_UNSAFE}
                evaluation={evaluateRoomScene(STUDENT_BEDROOM_UNSAFE)}
                isShaking={isShaking}
                hasCollapsed={true}
                walkthroughActive={roomWalkthrough}
                fullScreen={fullScreenMode}
                titleBadge="BEFORE: UNSAFE ROOM (Top-Loaded Shelf + Door Blocked)"
              />
              <QuakeRoomCanvas
                scene={remediatedScene || STUDENT_BEDROOM_REMEDIATED}
                evaluation={remediatedEvaluation}
                isShaking={isShaking}
                hasCollapsed={true}
                walkthroughActive={roomWalkthrough}
                fullScreen={fullScreenMode}
                titleBadge="AFTER: RENTER-SAFE FIX (Ballast Lowered + Exit Clear)"
              />
            </div>
          ) : (
            <QuakeRoomCanvas
              scene={roomScene}
              evaluation={currentEvaluation}
              isShaking={isShaking}
              hasCollapsed={hasCollapsed}
              walkthroughActive={roomWalkthrough}
              fullScreen={fullScreenMode}
              titleBadge={`Floor ${roomScene.room.floor_level} Room Twin • ${roomScene.earthquake.magnitude_mw.toFixed(1)} Mw (${currentPgaG}g Floor PGA)`}
            />
          )
        ) : (
          <ExitZeroCanvas
            floorGraph={floorGraph}
            hazards={liveHazards}
            verification={evacuationResult}
            walkthroughActive={buildingWalkthrough}
            fullScreen={fullScreenMode}
          />
        )}
      </div>

      {/* ==================================================================== */}
      {/* SLIDE-OVER FULL MENU DRAWER (ONLY VISIBLE WHEN USER CLICKS MENU)     */}
      {/* ==================================================================== */}
      {menuOpen && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl overflow-y-auto p-6 pt-20 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">
                {activePlan === "PLAN_B"
                  ? "Plan B: QuakeRoom Controls & Physics Telemetry"
                  : "Plan C: ExitZero Building Controls & Route Verifier"}
              </h2>
              <p className="text-xs text-slate-400">
                Click &ldquo;Hide Menu&rdquo; anytime to return to unobstructed full-screen 3D view.
              </p>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {activePlan === "PLAN_B" ? (
            <>
              {/* 1. Upload Video / Photo / Blueprint + Presets */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Camera className="h-4 w-4 text-emerald-400" />
                    1. Scan Room Video / Photo / Blueprint
                  </h3>
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
                    Reset Unsafe Student Room
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

              {/* 2. Gemini Live Voice Context */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Mic className="h-4 w-4 text-cyan-400" />
                    2. Gemini Live Voice Constraints & Physics Sliders
                  </h3>
                </div>

                <textarea
                  value={voiceInputText}
                  onChange={(e) => setVoiceInputText(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />

                <button
                  onClick={handleApplyVoiceConstraints}
                  className="w-full py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold text-cyan-300 flex items-center justify-center gap-2 transition"
                >
                  <Volume2 className="h-4 w-4" />
                  Apply Voice Constraints to Physics Engine
                </button>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Quake Magnitude:</span>
                      <span className="font-bold text-amber-400">
                        {roomScene.earthquake.magnitude_mw.toFixed(1)} Mw
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5.0}
                      max={7.8}
                      step={0.1}
                      value={roomScene.earthquake.magnitude_mw}
                      onChange={(e) => {
                        const mw = parseFloat(e.target.value);
                        setRoomScene((prev) => ({
                          ...prev,
                          earthquake: { ...prev.earthquake, magnitude_mw: mw },
                        }));
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Building Floor:</span>
                      <span className="font-bold text-cyan-300">
                        Floor {roomScene.room.floor_level} ({currentPgaG}g)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={roomScene.room.floor_level}
                      onChange={(e) => {
                        const fl = parseInt(e.target.value, 10);
                        setRoomScene((prev) => ({
                          ...prev,
                          room: { ...prev.room, floor_level: fl },
                        }));
                      }}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Compare Split Screen & Remediation Actions */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    3. Self-Correcting Renter Remediation & Compare
                  </h3>
                  <button
                    onClick={() => setSplitScreenCompare((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
                      splitScreenCompare
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    <SplitSquareVertical className="h-3.5 w-3.5" />
                    {splitScreenCompare ? "Split Compare: ON" : "Split Compare: OFF"}
                  </button>
                </div>

                {remediationProposal && (
                  <div className="space-y-2 pt-1">
                    {remediationProposal.changes.map((chg, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-300">
                            {chg.object_id}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                            {chg.action.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-slate-300">{chg.reason}</p>
                        {(chg.new_shelf_level || chg.new_x_m !== undefined) && (
                          <p className="text-[11px] text-cyan-300 font-mono">
                            Target:{" "}
                            {chg.new_shelf_level
                              ? `shelf -> ${chg.new_shelf_level}`
                              : `pos -> (${chg.new_x_m}m, ${chg.new_z_m}m)`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Housner Overturning & Monte Carlo Telemetry */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Housner Overturning Safety Factors & Monte Carlo Egress
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
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
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* PLAN C MENU CONTROLS */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-cyan-400" />
                  1. Imperial CAGB Level 2 Floor Plan & Live Hazard Feed
                </h3>

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
                    disabled={isScanningHazard}
                    className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition"
                  >
                    <FileUp className="h-4 w-4 text-cyan-400" />
                    Upload 2D Floor Plan
                  </button>
                  <button
                    onClick={() => hazardCamInputRef.current?.click()}
                    disabled={isScanningHazard}
                    className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-red-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Camera className="h-4 w-4 text-red-400" />
                    Scan Corridor Hazard
                  </button>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Your Starting Room / Location:
                  </label>
                  <select
                    value={userStartNodeId}
                    onChange={(e) => setUserStartNodeId(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200"
                  >
                    {floorGraph.nodes
                      .filter(
                        (n) =>
                          n.type === "room" || n.type === "corridor_junction"
                      )
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mic className="h-4 w-4 text-emerald-400" />
                  2. Live Voice Evacuee Report & Lift Override
                </h3>
                <textarea
                  value={planCVoiceText}
                  onChange={(e) => setPlanCVoiceText(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200"
                />
                <button
                  onClick={handlePlanCVoiceSubmit}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg"
                >
                  <Volume2 className="h-4 w-4" />
                  Verify Evacuation Route & Speak Guidance
                </button>
              </div>

              {/* Naive vs Verified Route Comparison */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="p-3 rounded-lg bg-red-950/25 border border-red-500/40 space-y-1">
                  <div className="text-xs font-bold text-red-300">
                    ❌ Naive Shortest Path ({evacuationResult.naive_shortest_route.status})
                  </div>
                  <p className="text-xs text-slate-300">
                    {evacuationResult.naive_shortest_route.failure_reason}
                  </p>
                </div>

                {evacuationResult.verified_safe_route && (
                  <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/40 space-y-1">
                    <div className="text-xs font-bold text-emerald-300">
                      ✅ Verified Safe Route → {evacuationResult.verified_safe_route.target_exit_label}
                    </div>
                    <p className="text-xs text-emerald-200">
                      &ldquo;{evacuationResult.verified_safe_route.turn_by_turn_voice}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
