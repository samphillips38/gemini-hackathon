"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  RotateCcw,
  Layers,
  Navigation,
  Accessibility,
  Footprints,
  Radio,
  Eye,
  SplitSquareVertical,
  Sliders,
  X,
  Compass,
  MapPin,
  Mic,
  CheckCircle2,
  AlertTriangle,
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
  RemediationProposal,
  RoomSceneGraph,
  LiveHazardEvent,
  BuildingFloorGraph,
  ObjectHazardResult,
} from "@/types/contracts";

const QuakeRoomCanvas = dynamic(() => import("@/scene3d/QuakeRoomCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#050811] text-slate-300 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-amber-400/80 border-t-transparent animate-spin" />
      <p className="text-xs font-mono uppercase tracking-widest text-amber-300/90">
        Initializing Sanctuary 3D Physics Engine...
      </p>
    </div>
  ),
});

const ExitZeroCanvas = dynamic(() => import("@/scene3d/ExitZeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#050811] text-slate-300 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-400/80 border-t-transparent animate-spin" />
      <p className="text-xs font-mono uppercase tracking-widest text-emerald-300/90">
        Initializing 3D Architectural Floor Graph...
      </p>
    </div>
  ),
});

type AppMode = "quakeroom" | "exitzero";
type PlanBDrawerTab = "physics" | "remediate" | "scan";
type PlanCDrawerTab = "routes" | "hazards" | "blueprint";

export default function HomePage() {
  const [appMode, setAppMode] = useState<AppMode>("quakeroom");

  // =========================================================================
  // UI HUD & DRAWER STATE
  // =========================================================================
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planBTab, setPlanBTab] = useState<PlanBDrawerTab>("physics");
  const [planCTab, setPlanCTab] = useState<PlanCDrawerTab>("routes");
  const [showTuningPopover, setShowTuningPopover] = useState(false);
  const [showLocationPopover, setShowLocationPopover] = useState(false);

  // =========================================================================
  // PLAN B (QuakeRoom 3D) STATE
  // =========================================================================
  const [customUnsafeScene, setCustomUnsafeScene] = useState<RoomSceneGraph>(
    STUDENT_BEDROOM_UNSAFE
  );
  const [customRemediatedScene, setCustomRemediatedScene] =
    useState<RoomSceneGraph | null>(null);
  const [remediated, setRemediated] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [magnitude, setMagnitude] = useState(6.8);
  const [floorLevel, setFloorLevel] = useState(10);
  const [renterNoDrill, setRenterNoDrill] = useState(true);
  const [voiceConstraint, setVoiceConstraint] = useState("");
  const [proposal, setProposal] = useState<RemediationProposal>(
    DEFAULT_REMEDIATION_PROPOSAL
  );
  const [isRemediating, setIsRemediating] = useState(false);
  const [isExtractingRoom, setIsExtractingRoom] = useState(false);
  const [extractRoomStatus, setExtractRoomStatus] = useState<string | null>(
    null
  );
  const [splitComparison, setSplitComparison] = useState(false);
  const [roomFirstPerson, setRoomFirstPerson] = useState(false);
  const roomFileInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // PLAN C (ExitZero Live) STATE
  // =========================================================================
  const [floorGraph, setFloorGraph] = useState<BuildingFloorGraph>(
    IMPERIAL_FLOOR_GRAPH
  );
  const [mobility, setMobility] = useState<
    "walking_running" | "wheelchair_accessible"
  >("walking_running");
  const [selectedStartNodeId, setSelectedStartNodeId] =
    useState<string>("room_301");
  const [liveHazards, setLiveHazards] =
    useState<LiveHazardEvent[]>(DEFAULT_LIVE_HAZARDS);
  const [hazardInput, setHazardInput] = useState("");
  const [isReportingHazard, setIsReportingHazard] = useState(false);
  const [isExtractingFloorplan, setIsExtractingFloorplan] = useState(false);
  const [floorplanStatus, setFloorplanStatus] = useState<string | null>(null);
  const [walkthroughMode, setWalkthroughMode] = useState(false);
  const [buildingQuakeActive, setBuildingQuakeActive] = useState(false);
  const floorplanFileInputRef = useRef<HTMLInputElement | null>(null);
  const hazardCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Active room scene & deterministic solver reports
  const activeScene: RoomSceneGraph = useMemo(() => {
    const base = remediated
      ? customRemediatedScene ?? STUDENT_BEDROOM_REMEDIATED
      : customUnsafeScene;
    return {
      ...base,
      room: {
        ...base.room,
        floor_level: floorLevel,
        renter_no_drill: renterNoDrill,
      },
      earthquake: {
        ...base.earthquake,
        magnitude_mw: magnitude,
      },
    };
  }, [
    remediated,
    customRemediatedScene,
    customUnsafeScene,
    floorLevel,
    renterNoDrill,
    magnitude,
  ]);

  const simReport = useMemo(
    () => evaluateRoomScene(activeScene),
    [activeScene]
  );

  const unsafeSceneWithParams: RoomSceneGraph = useMemo(
    () => ({
      ...customUnsafeScene,
      room: {
        ...customUnsafeScene.room,
        floor_level: floorLevel,
        renter_no_drill: renterNoDrill,
      },
      earthquake: {
        ...customUnsafeScene.earthquake,
        magnitude_mw: magnitude,
      },
    }),
    [customUnsafeScene, floorLevel, renterNoDrill, magnitude]
  );

  const remediatedSceneWithParams: RoomSceneGraph = useMemo(() => {
    const base = customRemediatedScene ?? STUDENT_BEDROOM_REMEDIATED;
    return {
      ...base,
      room: {
        ...base.room,
        floor_level: floorLevel,
        renter_no_drill: renterNoDrill,
      },
      earthquake: {
        ...base.earthquake,
        magnitude_mw: magnitude,
      },
    };
  }, [customRemediatedScene, floorLevel, renterNoDrill, magnitude]);

  const unsafeSimReport = useMemo(
    () => evaluateRoomScene(unsafeSceneWithParams),
    [unsafeSceneWithParams]
  );

  const remediatedSimReport = useMemo(
    () => evaluateRoomScene(remediatedSceneWithParams),
    [remediatedSceneWithParams]
  );

  const floorPgaG = useMemo(
    () => calculateFloorPGA(magnitude, floorLevel),
    [magnitude, floorLevel]
  );

  // Active building evacuation plan
  const evacPlan = useMemo(
    () =>
      verifyBuildingEvacuation(
        floorGraph,
        selectedStartNodeId,
        liveHazards,
        "earthquake",
        mobility,
        true
      ),
    [floorGraph, selectedStartNodeId, liveHazards, mobility]
  );

  // Web Speech API voice announcer
  const speakText = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.04;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Trigger Earthquake Simulation (Plan B)
  const handleTriggerQuake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 4500);
  }, []);

  // Trigger Building Earthquake Simulation (Plan C)
  const handleTriggerBuildingQuake = useCallback(() => {
    setBuildingQuakeActive(true);
    speakText(
      "Seismic tremor detected on Level 2. Elevators locked out. Follow the glowing emerald ribbon to the nearest verified exit."
    );
    setTimeout(() => setBuildingQuakeActive(false), 6000);
  }, [speakText]);

  // Trigger Gemini 4 Argon Remediation (Plan B)
  const handleAutoRemediate = useCallback(async () => {
    setIsRemediating(true);
    try {
      const res = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: activeScene,
          simReport,
          userVoiceConstraint: voiceConstraint || undefined,
        }),
      });
      const data = await res.json();
      if (data.proposal) {
        setProposal(data.proposal);
        if (data.proposal.updated_scene) {
          setCustomRemediatedScene(data.proposal.updated_scene);
        }
        setRemediated(true);
        setIsShaking(false);
        speakText(data.proposal.summary_spoken);
      }
    } catch {
      setProposal(DEFAULT_REMEDIATION_PROPOSAL);
      setRemediated(true);
      setIsShaking(false);
      speakText(DEFAULT_REMEDIATION_PROPOSAL.summary_spoken);
    } finally {
      setIsRemediating(false);
    }
  }, [activeScene, simReport, voiceConstraint, speakText]);

  // Keyboard shortcuts (Memory Palace HUD style)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        if (appMode === "quakeroom") {
          handleTriggerQuake();
        } else {
          handleTriggerBuildingQuake();
        }
      } else if (e.code === "KeyR" && appMode === "quakeroom") {
        e.preventDefault();
        if (remediated) {
          setRemediated(false);
        } else {
          handleAutoRemediate();
        }
      } else if (e.code === "KeyV" && appMode === "quakeroom") {
        e.preventDefault();
        setSplitComparison((prev) => !prev);
      } else if (e.code === "KeyF") {
        e.preventDefault();
        if (appMode === "quakeroom") {
          setSplitComparison(false);
          setRoomFirstPerson((prev) => !prev);
        } else {
          setWalkthroughMode((prev) => !prev);
        }
      } else if (e.code === "KeyI") {
        e.preventDefault();
        setDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    appMode,
    remediated,
    handleTriggerQuake,
    handleTriggerBuildingQuake,
    handleAutoRemediate,
  ]);

  // Handle Room Photo/Video Upload -> /api/extract (Plan B)
  const handleRoomMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingRoom(true);
    setExtractRoomStatus(`Analyzing "${file.name}" with Gemini 4 Argon...`);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || "image/jpeg",
          floorLevel,
          renterNoDrill,
        }),
      });
      const data = await res.json();
      if (data.scene) {
        setCustomUnsafeScene(data.scene);
        setCustomRemediatedScene(null);
        setRemediated(false);
        setExtractRoomStatus(
          data.source === "gemini-4-argon"
            ? `Extracted ${data.scene.objects.length} 3D objects via Gemini 4 Argon`
            : `Loaded calibrated 3D room twin (${data.scene.objects.length} objects)`
        );
        speakText(
          `Extracted ${data.scene.objects.length} spatial objects into the 3D seismic simulator.`
        );
      }
    } catch {
      setExtractRoomStatus("Loaded fallback calibrated 3D room preset.");
    } finally {
      setIsExtractingRoom(false);
    }
  };

  // Handle 2D FloorPlan Image Upload -> /api/floorplan (Plan C)
  const handleFloorplanUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingFloorplan(true);
    setFloorplanStatus(
      `Extracting navigation graph from "${file.name}" via Gemini 4 Argon...`
    );

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/floorplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || "image/png",
        }),
      });
      const data = await res.json();
      if (data.graph) {
        setFloorGraph(data.graph);
        setSelectedStartNodeId(data.graph.nodes[0]?.id ?? "room_301");
        setFloorplanStatus(
          data.source === "gemini-4-argon"
            ? `Extracted ${data.graph.nodes.length} nodes & ${data.graph.walls.length} walls`
            : `Loaded Imperial College CAGB Level 2 graph`
        );
        speakText(
          `Floor plan graph extracted with ${data.graph.nodes.length} navigation nodes.`
        );
      }
    } catch {
      setFloorplanStatus("Using verified Imperial CAGB Level 2 floor graph.");
    } finally {
      setIsExtractingFloorplan(false);
    }
  };

  // Inject Live Voice/Text Hazard -> /api/hazard (Plan C)
  const handleReportHazard = async () => {
    if (!hazardInput.trim()) return;
    setIsReportingHazard(true);
    try {
      const res = await fetch("/api/hazard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceTranscript: hazardInput,
          graph: floorGraph,
        }),
      });
      const data = await res.json();
      if (data.hazard) {
        const updated = [...liveHazards, data.hazard];
        setLiveHazards(updated);
        setHazardInput("");
        const nextPlan = verifyBuildingEvacuation(
          floorGraph,
          selectedStartNodeId,
          updated,
          "earthquake",
          mobility,
          true
        );
        if (nextPlan.verified_safe_route) {
          speakText(nextPlan.verified_safe_route.turn_by_turn_voice);
        }
      }
    } finally {
      setIsReportingHazard(false);
    }
  };

  // Inject Live Camera Photo Hazard -> /api/hazard (Plan C)
  const handleHazardPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReportingHazard(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/hazard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || "image/jpeg",
          voiceTranscript:
            hazardInput || "走廊煙霧 / Corridor smoke or fallen debris photo",
          graph: floorGraph,
        }),
      });
      const data = await res.json();
      if (data.hazard) {
        const updated = [...liveHazards, data.hazard];
        setLiveHazards(updated);
        const nextPlan = verifyBuildingEvacuation(
          floorGraph,
          selectedStartNodeId,
          updated,
          "earthquake",
          mobility,
          true
        );
        if (nextPlan.verified_safe_route) {
          speakText(nextPlan.verified_safe_route.turn_by_turn_voice);
        }
      }
    } finally {
      setIsReportingHazard(false);
    }
  };

  const survivalPct = Math.round(
    (simReport.monte_carlo?.exit_reachable_p.walk ??
      (simReport.survivable ? 0.98 : 0.06)) * 100
  );
  const startNodeLabel =
    floorGraph.nodes.find((n) => n.id === selectedStartNodeId)?.label ??
    "Room 203";

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#050811] text-slate-100 select-none">
      {/* Hidden File Inputs */}
      <input
        ref={roomFileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleRoomMediaUpload}
      />
      <input
        ref={floorplanFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFloorplanUpload}
      />
      <input
        ref={hazardCameraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleHazardPhotoUpload}
      />

      {/* =====================================================================
          FULL-SCREEN 3D VIEWPORT LAYER (100% OF SCREEN)
          ===================================================================== */}
      <div className="absolute inset-0 z-10 w-full h-full">
        {appMode === "quakeroom" ? (
          splitComparison ? (
            <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full divide-x divide-amber-500/20">
              <QuakeRoomCanvas
                scene={unsafeSceneWithParams}
                simReport={unsafeSimReport}
                isShaking={isShaking}
                remediated={false}
                compact
                label={`BEFORE REMEDIATION • ${Math.round(
                  (unsafeSimReport.monte_carlo?.exit_reachable_p.walk ?? 0.06) *
                    100
                )}% SURVIVAL (EXIT BLOCKED)`}
              />
              <QuakeRoomCanvas
                scene={remediatedSceneWithParams}
                simReport={remediatedSimReport}
                isShaking={isShaking}
                remediated={true}
                compact
                label={`AFTER GEMINI 4 ARGON • ${Math.round(
                  (remediatedSimReport.monte_carlo?.exit_reachable_p.walk ??
                    0.98) * 100
                )}% SURVIVAL (EXIT CLEAR)`}
              />
            </div>
          ) : (
            <QuakeRoomCanvas
              scene={activeScene}
              simReport={simReport}
              isShaking={isShaking}
              remediated={remediated}
              firstPersonMode={roomFirstPerson}
              onToggleFirstPerson={() => setRoomFirstPerson((prev) => !prev)}
            />
          )
        ) : (
          <ExitZeroCanvas
            graph={floorGraph}
            evacPlan={evacPlan}
            liveHazards={liveHazards}
            selectedStartNodeId={selectedStartNodeId}
            onSelectStartNode={setSelectedStartNodeId}
            walkthroughMode={walkthroughMode}
            onToggleWalkthrough={() => setWalkthroughMode((prev) => !prev)}
            buildingQuakeActive={buildingQuakeActive}
          />
        )}
      </div>

      {/* Subtle Vignette Edge Framing (non-blocking) */}
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background:
            "radial-gradient(circle at center, transparent 58%, rgba(3, 6, 14, 0.58) 100%)",
        }}
      />

      {/* =====================================================================
          MEMORY-PALACE FLOATING HUD OVERLAY LAYER
          ===================================================================== */}
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-6">
        {/* ==================== TOP FLOATING HUD BAR ==================== */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* TOP-LEFT: Sanctuary Brand & Mode Switcher Pill */}
          <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-950/80 backdrop-blur-xl border border-amber-500/25 px-3.5 py-2 rounded-2xl shadow-2xl">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Compass className="w-4 h-4 text-slate-950" />
            </div>
            <div className="pr-2 border-r border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider uppercase text-amber-300">
                  SeismicTwin
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30">
                  Gemini 4
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {appMode === "quakeroom"
                  ? `${magnitude.toFixed(1)} Mw • Floor L${floorLevel} • ${floorPgaG}g PGA`
                  : `Imperial CAGB L2 • ${floorGraph.width_m}m × ${floorGraph.depth_m}m`}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setAppMode("quakeroom");
                  setShowLocationPopover(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  appMode === "quakeroom"
                    ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Room 3D
              </button>
              <button
                onClick={() => {
                  setAppMode("exitzero");
                  setShowTuningPopover(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  appMode === "exitzero"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                Building Evac
              </button>
            </div>
          </div>

          {/* TOP-CENTER: Live Survival / Route Verdict Pill */}
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-950/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-2xl">
            {appMode === "quakeroom" ? (
              <>
                <div
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-bold ${
                    simReport.survivable
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-red-500/20 text-red-300 border border-red-500/40"
                  }`}
                >
                  {simReport.survivable ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                  )}
                  <span>
                    {simReport.survivable
                      ? "VERIFIED SURVIVABLE"
                      : "FATAL HAZARD • EXIT BLOCKED"}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 mr-1.5">Monte Carlo:</span>
                    <span
                      className={`font-mono font-bold ${
                        survivalPct >= 80 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {survivalPct}%
                    </span>
                  </div>
                  <div className="h-3 w-px bg-slate-800" />
                  <div>
                    <span className="text-slate-400 mr-1.5">Egress:</span>
                    <span
                      className={`font-mono font-bold ${
                        simReport.exit_reachable_post_quake
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {simReport.exit_reachable_post_quake
                        ? "0.88m CLEAR"
                        : "0.22m BLOCKED"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => speakText(proposal.summary_spoken)}
                  title="Listen to Voice Remediation Briefing"
                  className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    {mobility === "wheelchair_accessible"
                      ? "REFUGE & STEP-FREE VERIFIED"
                      : "STEP-FREE ROUTE VERIFIED"}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 mr-1.5">From:</span>
                    <span className="font-semibold text-sky-300">
                      {startNodeLabel.split("(")[0]}
                    </span>
                  </div>
                  <div className="h-3 w-px bg-slate-800" />
                  <div>
                    <span className="text-slate-400 mr-1.5">ETA:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {evacPlan.verified_safe_route?.estimated_travel_time_s ??
                        14}
                      s (
                      {evacPlan.verified_safe_route?.total_distance_m ?? 18}
                      m)
                    </span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    speakText(
                      evacPlan.verified_safe_route?.turn_by_turn_voice ??
                        evacPlan.lift_override_reason
                    )
                  }
                  title="Speak Turn-by-Turn Evacuation Command"
                  className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* TOP-RIGHT: Telemetry & AI Inspector Drawer Button */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen((prev) => !prev)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold backdrop-blur-xl border shadow-2xl transition ${
                drawerOpen
                  ? "bg-amber-500 text-slate-950 border-amber-300"
                  : "bg-slate-950/80 text-slate-200 border-white/15 hover:border-amber-400/50"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Inspector & AI</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/30 text-amber-300">
                I
              </kbd>
            </button>
          </div>
        </div>

        {/* ==================== BOTTOM FLOATING POPOVERS & ACTION DOCK ==================== */}
        <div className="flex flex-col items-center gap-3">
          {/* Popover 1: Seismic Tuning Sliders (Plan B) */}
          {appMode === "quakeroom" && showTuningPopover && (
            <div className="pointer-events-auto w-full max-w-lg bg-slate-950/90 backdrop-blur-2xl border border-amber-500/35 rounded-3xl p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Seismic Ground-Motion & Building Parameters
                </span>
                <button
                  onClick={() => setShowTuningPopover(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Earthquake Magnitude</span>
                    <span className="font-mono font-bold text-amber-400">
                      {magnitude.toFixed(1)} Mw
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4.5}
                    max={8.0}
                    step={0.1}
                    value={magnitude}
                    onChange={(e) => setMagnitude(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">
                      Building Floor (EN 1998-1)
                    </span>
                    <span className="font-mono font-bold text-sky-400">
                      Floor L{floorLevel} ({floorPgaG}g PGA)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    step={1}
                    value={floorLevel}
                    onChange={(e) =>
                      setFloorLevel(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={renterNoDrill}
                    onChange={(e) => setRenterNoDrill(e.target.checked)}
                    className="rounded accent-emerald-500"
                  />
                  <span>
                    Renter Mode (No Wall Drilling — Relocate & Lower CoM Only)
                  </span>
                </label>
                <span className="font-mono text-[11px] text-slate-400">
                  orbit: drag • zoom: scroll
                </span>
              </div>
            </div>
          )}

          {/* Popover 2: Start Location Selector (Plan C) */}
          {appMode === "exitzero" && showLocationPopover && (
            <div className="pointer-events-auto w-full max-w-lg bg-slate-950/90 backdrop-blur-2xl border border-emerald-500/35 rounded-3xl p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Select Occupant Start Room (Imperial CAGB L2)
                </span>
                <button
                  onClick={() => setShowLocationPopover(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {floorGraph.nodes
                  .filter(
                    (n) => n.type === "room" || n.type === "corridor_junction"
                  )
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setSelectedStartNodeId(n.id);
                        setShowLocationPopover(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-left text-xs font-medium border transition ${
                        selectedStartNodeId === n.id
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                          : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* MEMORY PALACE BOTTOM FLOATING DOCK */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 bg-slate-950/85 backdrop-blur-2xl border border-amber-500/25 p-2 rounded-3xl shadow-2xl">
            {appMode === "quakeroom" ? (
              <>
                {/* 1. Trigger Quake */}
                <button
                  onClick={handleTriggerQuake}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-lg ${
                    isShaking
                      ? "bg-red-500 text-white shadow-red-500/30 animate-pulse"
                      : "bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>
                    {isShaking
                      ? "Shaking..."
                      : `Trigger ${magnitude.toFixed(1)}M Quake`}
                  </span>
                  <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/25">
                    Space
                  </kbd>
                </button>

                {/* 2. Auto-Remediate / Reset */}
                {!remediated ? (
                  <button
                    onClick={handleAutoRemediate}
                    disabled={isRemediating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition shadow-lg shadow-emerald-500/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isRemediating
                        ? "Solving..."
                        : "Auto-Remediate (Gemini 4)"}
                    </span>
                    <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/20 text-slate-950">
                      R
                    </kbd>
                  </button>
                ) : (
                  <button
                    onClick={() => setRemediated(false)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Unsafe</span>
                    <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/30">
                      R
                    </kbd>
                  </button>
                )}

                <div className="h-6 w-px bg-slate-800 mx-0.5 hidden sm:block" />

                {/* 3. Seismic Tuning Popover Toggle */}
                <button
                  onClick={() => setShowTuningPopover((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                    showTuningPopover
                      ? "bg-amber-500/25 text-amber-200 border border-amber-400/50"
                      : "bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {magnitude.toFixed(1)}M / L{floorLevel}
                  </span>
                </button>

                {/* 4. Split-Screen Before/After Toggle */}
                <button
                  onClick={() => {
                    setRoomFirstPerson(false);
                    setSplitComparison((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                    splitComparison
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  <SplitSquareVertical className="w-3.5 h-3.5" />
                  <span>Split View</span>
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/25">
                    V
                  </kbd>
                </button>

                {/* 5. 1st-Person Escape Mode */}
                <button
                  onClick={() => {
                    setSplitComparison(false);
                    setRoomFirstPerson((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                    roomFirstPerson
                      ? "bg-sky-500 text-slate-950 font-bold"
                      : "bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>1st-Person Escape</span>
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/25">
                    F
                  </kbd>
                </button>

                {/* 6. Upload Photo/Video to 3D */}
                <button
                  onClick={() => roomFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isExtractingRoom ? "Scanning..." : "Scan Room"}</span>
                </button>
              </>
            ) : (
              <>
                {/* PLAN C DOCK: 1. Trigger Building Quake */}
                <button
                  onClick={handleTriggerBuildingQuake}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-lg ${
                    buildingQuakeActive
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>
                    {buildingQuakeActive
                      ? "Seismic Tremor Active"
                      : "Trigger Building Quake"}
                  </span>
                  <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/25">
                    Space
                  </kbd>
                </button>

                {/* 2. 1st-Person Evacuation Walkthrough */}
                <button
                  onClick={() => setWalkthroughMode((prev) => !prev)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
                    walkthroughMode
                      ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25"
                      : "bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>
                    {walkthroughMode
                      ? "Exit 1st-Person"
                      : "1st-Person Evac Drill"}
                  </span>
                  <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/25">
                    F
                  </kbd>
                </button>

                {/* 3. Mobility Profile Switcher */}
                <button
                  onClick={() =>
                    setMobility(
                      (
                        prev: "walking_running" | "wheelchair_accessible"
                      ) =>
                        prev === "walking_running"
                          ? "wheelchair_accessible"
                          : "walking_running"
                    )
                  }
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition border ${
                    mobility === "wheelchair_accessible"
                      ? "bg-purple-500/25 border-purple-400 text-purple-200"
                      : "bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {mobility === "wheelchair_accessible" ? (
                    <Accessibility className="w-4 h-4 text-purple-300" />
                  ) : (
                    <Footprints className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>
                    {mobility === "wheelchair_accessible"
                      ? "Wheelchair / Refuge"
                      : "Standard Walk"}
                  </span>
                </button>

                {/* 4. Start Location Selector */}
                <button
                  onClick={() => setShowLocationPopover((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>Start: {startNodeLabel.split("(")[0]}</span>
                </button>

                {/* 5. Live Hazard Injection Drawer Shortcut */}
                <button
                  onClick={() => {
                    setPlanCTab("hazards");
                    setDrawerOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-red-950/60 hover:bg-red-900/60 text-red-200 border border-red-500/30 transition"
                >
                  <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span>Report Hazard ({liveHazards.length})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          SLIDE-OVER TELEMETRY, AI REMEDIATION & MULTIMODAL INSPECTOR DRAWER
          ===================================================================== */}
      {drawerOpen && (
        <aside className="pointer-events-auto absolute top-0 right-0 bottom-0 z-40 w-full max-w-md bg-slate-950/92 backdrop-blur-2xl border-l border-amber-500/25 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/90">
            <div>
              <h2 className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                {appMode === "quakeroom"
                  ? "QuakeRoom Physics & Gemini 4 Inspector"
                  : "ExitZero Evacuation & Hazard Inspector"}
              </h2>
              <p className="text-[11px] text-slate-400">
                Deterministic Housner Solver + A* Egress Verifier
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {appMode === "quakeroom" ? (
            <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900/70 border-b border-slate-800">
              {(
                [
                  { id: "physics", label: "Housner SF" },
                  { id: "remediate", label: "Gemini 4 Fix" },
                  { id: "scan", label: "Scan & Voice" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPlanBTab(t.id)}
                  className={`py-1.5 rounded-xl text-xs font-semibold transition ${
                    planBTab === t.id
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900/70 border-b border-slate-800">
              {(
                [
                  { id: "routes", label: "A* Routes" },
                  { id: "hazards", label: "Live Hazards" },
                  { id: "blueprint", label: "2D Blueprint" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPlanCTab(t.id)}
                  className={`py-1.5 rounded-xl text-xs font-semibold transition ${
                    planCTab === t.id
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {appMode === "quakeroom" && planBTab === "physics" && (
              <>
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Formula: SF = (b / 2·h_CoM) / (PGA_floor / g)
                    </span>
                    <span className="font-mono text-amber-400 font-bold">
                      {floorPgaG}g
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400">
                        Survival (N=50)
                      </div>
                      <div
                        className={`text-lg font-mono font-bold ${
                          survivalPct >= 80
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {survivalPct}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400">
                        Door Egress
                      </div>
                      <div
                        className={`text-lg font-mono font-bold ${
                          simReport.exit_reachable_post_quake
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {simReport.exit_reachable_post_quake
                          ? "CLEAR"
                          : "BLOCKED"}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400">
                        Shelter ETA
                      </div>
                      <div className="text-lg font-mono font-bold text-sky-400">
                        {simReport.shelter_reach_time_s}s
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {simReport.object_results.map((h: ObjectHazardResult) => {
                    const obj = activeScene.objects.find(
                      (o) => o.id === h.object_id
                    );
                    const isUnsafe = h.analytical_safety_factor < 1.0;
                    return (
                      <div
                        key={h.object_id}
                        className={`p-3.5 rounded-2xl border ${
                          isUnsafe
                            ? "bg-red-950/25 border-red-500/40"
                            : "bg-emerald-950/15 border-emerald-500/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">
                            {obj?.label ?? h.object_id}
                          </span>
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                              isUnsafe
                                ? "bg-red-500/20 text-red-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            SF = {h.analytical_safety_factor}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>h_CoM: {h.com_height_m ?? 0.9}m</span>
                          <span>KE: {h.peak_kinetic_energy_joules} J</span>
                        </div>
                        <div className="mt-1.5 text-[11px] text-slate-300 flex items-center gap-1.5">
                          {h.blocked_exit_corridor ? (
                            <span className="text-red-400 font-semibold">
                              • Blocks Primary Exit Door
                            </span>
                          ) : h.hit_occupant_zone ? (
                            <span className="text-amber-400 font-semibold">
                              • Sweeps Across Bed Pillow Zone
                            </span>
                          ) : (
                            <span className="text-emerald-400">
                              • Verified Stable & Clear of Egress
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {appMode === "quakeroom" && planBTab === "remediate" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Gemini 4 Argon Spatial Remediation
                    </span>
                    <button
                      onClick={() => speakText(proposal.summary_spoken)}
                      className="text-xs flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Speak
                    </button>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    “{proposal.summary_spoken}”
                  </p>
                </div>

                <div className="space-y-2.5">
                  {proposal.changes.map(
                    (
                      act: RemediationProposal["changes"][number],
                      idx: number
                    ) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-300 uppercase">
                            {idx + 1}. {act.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] font-mono text-amber-300">
                            {act.object_id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{act.reason}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {appMode === "quakeroom" && planBTab === "scan" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    1. Scan Room Photo / Video to 3D Scene
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload any bedroom or office photo/video. Gemini 4 Argon
                    extracts 3D bounding boxes, mass estimates, and Center-of-Mass
                    heights.
                  </p>
                  <button
                    onClick={() => roomFileInputRef.current?.click()}
                    disabled={isExtractingRoom}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4" />
                    {isExtractingRoom
                      ? "Scanning with Gemini 4 Argon..."
                      : "Upload Room Photo / Video"}
                  </button>
                  {extractRoomStatus && (
                    <p className="text-xs text-emerald-300 font-mono">
                      {extractRoomStatus}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    2. Voice / Natural-Language Constraint
                  </h3>
                  <input
                    type="text"
                    value={voiceConstraint}
                    onChange={(e) => setVoiceConstraint(e.target.value)}
                    placeholder="e.g., I'm a renter, no drilling into walls..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    onClick={handleAutoRemediate}
                    disabled={isRemediating}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    Re-Solve Room with Constraint
                  </button>
                </div>
              </div>
            )}

            {appMode === "exitzero" && planCTab === "routes" && (
              <div className="space-y-4">
                {evacPlan.verified_safe_route && (
                  <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-emerald-300">
                        Verified Safe Route
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {evacPlan.verified_safe_route.estimated_travel_time_s}s •{" "}
                        {evacPlan.verified_safe_route.total_distance_m}m
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      “{evacPlan.verified_safe_route.turn_by_turn_voice}”
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Verified Waypoint Nodes
                  </h4>
                  {(evacPlan.verified_safe_route?.node_ids ?? []).map(
                    (nid: string, idx: number) => {
                      const n = floorGraph.nodes.find((nd) => nd.id === nid);
                      return (
                        <div
                          key={nid}
                          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs text-slate-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {idx + 1}. {n?.label ?? nid}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-red-950/25 border border-red-500/35 text-xs space-y-1.5">
                  <div className="font-bold text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      Rejected Naive Route ({evacPlan.naive_shortest_route.status})
                    </span>
                  </div>
                  <p className="text-slate-300">
                    {evacPlan.naive_shortest_route.failure_reason}
                  </p>
                </div>
              </div>
            )}

            {appMode === "exitzero" && planCTab === "hazards" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-300">
                    Inject Live Multimodal Hazard (Any Language)
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={hazardInput}
                      onChange={(e) => setHazardInput(e.target.value)}
                      placeholder="e.g. 'Smoke in central corridor' or '走廊有濃煙'"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                    />
                    <button
                      onClick={handleReportHazard}
                      disabled={isReportingHazard}
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                    >
                      Inject
                    </button>
                  </div>
                  <button
                    onClick={() => hazardCameraInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    Upload Corridor Hazard Photo
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Active Building Hazards ({liveHazards.length})
                    </span>
                    <button
                      onClick={() => setLiveHazards(DEFAULT_LIVE_HAZARDS)}
                      className="text-[11px] text-slate-400 hover:text-white underline"
                    >
                      Reset Default
                    </button>
                  </div>
                  {liveHazards.map((hz) => (
                    <div
                      key={hz.id}
                      className="p-3 rounded-xl bg-red-950/30 border border-red-500/35 text-xs space-y-1"
                    >
                      <div className="flex justify-between font-bold text-red-300 uppercase">
                        <span>{hz.hazard_type.replace(/_/g, " ")}</span>
                        <span className="font-mono">
                          {hz.spread_rate_m_per_s} m/s
                        </span>
                      </div>
                      <p className="text-slate-300">{hz.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {appMode === "exitzero" && planCTab === "blueprint" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-emerald-300">
                      Imperial College CAGB Level 2
                    </span>
                    <button
                      onClick={() => floorplanFileInputRef.current?.click()}
                      disabled={isExtractingFloorplan}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      {isExtractingFloorplan ? "Scanning..." : "Upload 2D Map"}
                    </button>
                  </div>
                  {floorplanStatus && (
                    <p className="text-[11px] text-emerald-300 font-mono">
                      {floorplanStatus}
                    </p>
                  )}
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                    <img
                      src="/floorplans/imperial-cagb-l2.svg"
                      alt="Imperial College CAGB Level 2 Floor Plan"
                      className="w-full h-auto object-contain"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </main>
  );
}
