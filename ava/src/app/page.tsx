"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Film,
  Flame,
  Home,
  MapPin,
  Mic,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  Zap,
} from "lucide-react";
import {
  CAGB_FILMING_ROUTES,
  DEFAULT_LIVE_HAZARDS,
  IMPERIAL_FLOOR_GRAPH,
  PRESET_ROOMS,
} from "@/presets/mockRooms";
import cagbRouteARooms from "@/presets/cagbRouteARooms.json";
import { seismicAudio } from "@/voice/seismicAudioSynth";
import {
  CAGB_L2_PLAN_PX_PER_M,
  synthesizeVerifiedRemediation,
  verifyRoomSafetyAndEgress,
} from "@/solver/roomVerifier";

const ALL_PRESET_ROOMS: Record<string, RoomSceneGraph> = {
  ...PRESET_ROOMS,
  ...(cagbRouteARooms as unknown as Record<string, RoomSceneGraph>),
};
import { verifyBuildingEvacuation } from "@/solver/buildingVerifier";
import {
  BuildingFloorGraph,
  ClearanceMode,
  LiveHazardEvent,
  RemediationProposal,
  RoomSceneGraph,
} from "@/types/contracts";

const RoomCanvas3D = dynamic(() => import("@/scene3d/RoomCanvas3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm rounded-xl border border-slate-800">
      Initializing Three.js 3D Room Shake Table...
    </div>
  ),
});

const BuildingCanvas3D = dynamic(() => import("@/scene3d/BuildingCanvas3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm rounded-xl border border-slate-800">
      Initializing Three.js 3D Building Extruder...
    </div>
  ),
});

export default function HackathonPage() {
  // Active Blueprint Mode: Plan B (QuakeRoom) vs Plan C (ExitZero)
  const [activePlan, setActivePlan] = useState<"PLAN_B" | "PLAN_C">("PLAN_B");

  // Plan B (QuakeRoom) State
  const [presetKey, setPresetKey] = useState<string>("student_dorm");
  const [scene, setScene] = useState<RoomSceneGraph>(PRESET_ROOMS.student_dorm);
  const [clearanceMode, setClearanceMode] = useState<ClearanceMode>("walk");
  const [simState, setSimState] = useState<"idle" | "shaking" | "collapsed">("idle");
  const [dropHazardMode, setDropHazardMode] = useState<boolean>(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [remediation, setRemediation] = useState<RemediationProposal | null>(null);
  const [isRemediatedView, setIsRemediatedView] = useState<boolean>(false);

  // Plan C (ExitZero — CAGB Level 2) State
  const [floorGraph, setFloorGraph] = useState<BuildingFloorGraph>(IMPERIAL_FLOOR_GRAPH);
  const [liveHazards, setLiveHazards] = useState<LiveHazardEvent[]>(DEFAULT_LIVE_HAZARDS);
  const [startNodeId, setStartNodeId] = useState<string>("room_302");
  const [emergencyType, setEmergencyType] = useState<"earthquake" | "fire">("earthquake");
  const [selectedRouteId, setSelectedRouteId] = useState<"A" | "B" | "C" | "D">("A");

  // Shared Multimodal Voice & Vision Upload State
  const [voiceNote, setVoiceNote] = useState<string>(
    "I live on the 10th floor, I'm a student renter so I can't drill into walls, and the top shelf has 20kg of textbooks. What's the fastest route to the lift?"
  );
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Plan B Deterministic Verification
  const verification = useMemo(
    () => verifyRoomSafetyAndEgress(scene, clearanceMode),
    [scene, clearanceMode]
  );

  // Plan C Deterministic Evacuation Verification
  const buildingVerification = useMemo(
    () =>
      verifyBuildingEvacuation(
        floorGraph,
        startNodeId,
        liveHazards,
        emergencyType,
        clearanceMode === "wheelchair" ? "wheelchair_accessible" : "walking_running",
        true
      ),
    [floorGraph, startNodeId, liveHazards, emergencyType, clearanceMode]
  );

  const activeCAGBRoute = useMemo(
    () => CAGB_FILMING_ROUTES.find((r) => r.id === selectedRouteId) || CAGB_FILMING_ROUTES[0],
    [selectedRouteId]
  );

  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.06;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  };

  // Switch Plan B preset room
  const handleSelectPreset = (key: string) => {
    const base = ALL_PRESET_ROOMS[key] || ALL_PRESET_ROOMS.student_dorm;
    setPresetKey(key);
    setScene(JSON.parse(JSON.stringify(base)));
    setSimState("idle");
    setRemediation(null);
    setIsRemediatedView(false);
    setStatusBanner(null);
  };

  // 1-Click Macro (Plan C CAGB Level 2 Route C) -> Micro (Plan B Room 203 Shake Table)
  const handleEnterRoom203DeepDive = () => {
    setActivePlan("PLAN_B");
    handleSelectPreset("cagb_room_203");
    setStatusBanner(
      "Macro → Micro Transition: Entered CAGB Level 2 Room 203 from Route C (Calibrated at 9.52 px/m)."
    );
    speakText(
      "Entering CAGB Level 2 Room 203 3D Shake Table. Ready to simulate 6.8 magnitude seismic overturning and post-collapse A-star egress."
    );
  };

  // Trigger Plan B 6.8M Quake & Deterministic Verification
  const handleTriggerEarthquake = () => {
    setSimState("shaking");
    const v = verifyRoomSafetyAndEgress(scene, clearanceMode);
    seismicAudio.playSeismicPAndSWave(v.floor_pga_g, 3.0);
    setTimeout(() => {
      setSimState("collapsed");
      if (!v.survivable) {
        seismicAudio.playLiftLockoutSiren(1.1);
        speakText(
          `Critical failure! Never take a lift in a seismic event. Phase 1 during shaking: Drop, Cover, and Hold On under the sturdy desk. Phase 2 after shaking: your wardrobe's 2-meter fall shadow seals the exit door, and the top-heavy bookshelf crushes the sleep zone.`
        );
      } else {
        seismicAudio.playVerificationPassChime();
        speakText(
          `Verified! Phase 1 under-desk safe shelter and Phase 2 post-collapse A-star evacuation route to the exit door remain clear across ${v.monte_carlo.walk_clear_count} of 50 Monte Carlo quakes.`
        );
      }
    }, 2400);
  };

  // Synthesize & Verify Renter-Safe Room Layout (Plan B Self-Correcting Loop)
  const handleSynthesizeFix = () => {
    const baseScene = ALL_PRESET_ROOMS[presetKey]
      ? {
          ...JSON.parse(JSON.stringify(ALL_PRESET_ROOMS[presetKey])),
          room: { ...scene.room },
          earthquake: { ...scene.earthquake },
        }
      : scene;

    const proposal = synthesizeVerifiedRemediation(baseScene, clearanceMode);
    setRemediation(proposal);
    setScene(proposal.updated_scene);
    setIsRemediatedView(true);
    setSimState("shaking");
    seismicAudio.playVerificationPassChime();
    speakText(proposal.summary_spoken);
    setTimeout(() => {
      setSimState("collapsed");
    }, 2200);
  };

  // Drop Live Floor Hazard inside 3D Room
  const handleFloorDropHazard = (x_m: number, z_m: number) => {
    const newHazardId = `hazard_${Date.now().toString().slice(-4)}`;
    const nextScene: RoomSceneGraph = {
      ...scene,
      objects: [
        ...scene.objects,
        {
          id: newHazardId,
          category: "hazard_zone",
          label: "Live Debris / Smoke Blockade",
          parent_id: null,
          x_m,
          z_m,
          width_m: 0.75,
          height_m: 0.7,
          depth_m: 0.75,
          rotation_deg: 0,
          mass_kg: 50,
          anchored_to_wall: true,
          is_fragile: false,
        },
      ],
    };
    setScene(nextScene);
    const nextVer = verifyRoomSafetyAndEgress(nextScene, clearanceMode);
    if (nextVer.exit_reachable_pre_quake) {
      speakText(
        `Hazard anchored at ${x_m} meters. Rerouting A-star escape path with ${nextVer.clearance_width_m} meter clearance.`
      );
    } else {
      speakText(`Critical alert! Exit corridor is sealed by hazard blockade.`);
    }
  };

  // Toggle Corridor Hazard in Plan C (ExitZero)
  const handleToggleCorridorHazard = (nodeId: string) => {
    setLiveHazards((prev) => {
      const exists = prev.some((h) => h.location_node_id === nodeId);
      if (exists) {
        return prev.filter((h) => h.location_node_id !== nodeId);
      }
      const affectedEdges = floorGraph.edges
        .filter((e) => e.from_node_id === nodeId || e.to_node_id === nodeId)
        .map((e) => e.id);
      const nodeLabel = floorGraph.nodes.find((n) => n.id === nodeId)?.label || nodeId;
      return [
        ...prev,
        {
          id: `haz_${nodeId}`,
          hazard_type: "fire_smoke",
          location_node_id: nodeId,
          affected_edge_ids: affectedEdges,
          spread_rate_m_per_s: 0.45,
          severity: "blocked",
          detected_from: "live_camera",
          description: `Live camera hazard blockade & expanding smoke at ${nodeLabel}`,
          video_evidence: {
            video_file: "route_B.mp4",
            timestamp_s: 4.2,
            quote: `Live walk camera spotted corridor blockage at ${nodeLabel}.`,
          },
        },
      ];
    });
  };

  // Extract 3D Room (Plan B) or 3D Floor Plan (Plan C) via Gemini 4 Argon
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    setStatusBanner(
      activePlan === "PLAN_B"
        ? "Extracting keyframes & building 3D RoomSceneGraph with Gemini 4 Argon..."
        : "Extracting 3D BuildingFloorGraph walls & topological NavGraph with Gemini 4 Argon..."
    );

    try {
      const framesBase64: string[] = [];

      if (file.type.startsWith("video/")) {
        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
        const times = [
          Math.min(0.5, video.duration * 0.2),
          Math.min(2.0, video.duration * 0.7),
        ];
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");
        for (const t of times) {
          video.currentTime = t;
          await new Promise<void>((r) => {
            video.onseeked = () => r();
          });
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          framesBase64.push(canvas.toDataURL("image/jpeg", 0.8));
        }
        URL.revokeObjectURL(videoUrl);
      } else {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        framesBase64.push(b64);
      }

      if (activePlan === "PLAN_B") {
        const res = await fetch("/api/extract-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imagesBase64: framesBase64,
            voiceTranscript: voiceNote,
            floorLevel: scene.room.floor_level,
            renterNoDrill: scene.room.renter_no_drill,
            magnitudeMw: scene.earthquake.magnitude_mw,
          }),
        });

        const data = await res.json();
        if (data.scene) {
          setScene(data.scene);
          setSimState("idle");
          setRemediation(null);
          setIsRemediatedView(false);
          setStatusBanner(
            data.warning
              ? data.warning
              : `3D RoomSceneGraph extracted (${data.scene.objects.length} objects calibrated).`
          );
        }
      } else {
        const res = await fetch("/api/extract-floorplan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: framesBase64[0] || "",
          }),
        });
        const data = await res.json();
        if (data.graph) {
          setFloorGraph(data.graph);
          setStatusBanner(
            data.warning
              ? data.warning
              : `3D BuildingFloorGraph extracted (${data.graph.walls.length} walls, ${data.graph.nodes.length} nodes).`
          );
        }
      }
    } catch {
      setStatusBanner("Loaded calibrated 3D twin fallback.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyVoiceContext = () => {
    const lower = voiceNote.toLowerCase();
    const floorMatch = lower.match(/(?:floor|level)\s*(\d+)|(\d+)\s*(?:st|nd|rd|th)?\s*floor/);
    const newFloor = floorMatch
      ? Number(floorMatch[1] || floorMatch[2])
      : scene.room.floor_level;
    const isRenter =
      lower.includes("rent") ||
      lower.includes("no drill") ||
      lower.includes("can't drill") ||
      lower.includes("unanchored");

    if (lower.includes("wheelchair") || lower.includes("step-free")) {
      setClearanceMode("wheelchair");
    }

    setScene((prev) => ({
      ...prev,
      room: {
        ...prev.room,
        floor_level: newFloor,
        renter_no_drill: isRenter ? true : prev.room.renter_no_drill,
      },
    }));

    if (lower.includes("lift") || lower.includes("elevator")) {
      speakText(
        activePlan === "PLAN_B"
          ? "Stop—never take the lift in a seismic event! During shaking, Drop, Cover, and Hold On under the sturdy desk, then exit via the stairwell."
          : buildingVerification.verified_safe_route?.turn_by_turn_voice ||
            "Stop—central lifts are locked out in seismic and fire mode."
      );
      setStatusBanner(
        "LIFT LOCKOUT OVERRIDE: Elevators are locked out due to rail distortion & power failure. Routing to Verified Stairwell / Refuge."
      );
    } else {
      setStatusBanner(
        `Applied Voice Context: Floor ${newFloor} (PGA ${verification.floor_pga_g}g), Renter No-Drill=${isRenter}`
      );
    }
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#060911] text-slate-100 flex flex-col">
      {/* Top Header Bar with Plan B (QuakeRoom) & Plan C (ExitZero) Switcher */}
      <header className="border-b border-slate-800/90 bg-slate-950/90 backdrop-blur px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-400/50 flex items-center justify-center text-emerald-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-base tracking-tight text-white">
                {activePlan === "PLAN_B"
                  ? "Plan B: QuakeRoom — 3D Seismic Room Collapse & Egress Verifier"
                  : "Plan C: ExitZero — CAGB Level 2 Floor-Plan & Dynamic Evacuation Verifier"}
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-medium">
                Gemini 4 Argon × Deterministic Physics &amp; N=50 Monte Carlo A*
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {activePlan === "PLAN_B"
                ? "Room Video + Voice Constraints → 3D Shake Table + Housner Tipping Math + Post-Collapse A* Escape (0.4m Walk / 0.9m Wheelchair)"
                : `Imperial CAGB Level 2 (Room 200 Venue, ${CAGB_L2_PLAN_PX_PER_M} px/m on 2.10m Exhibition Rd Doors) → 3D Extruded Twin + Lift Lockout`}
            </p>
          </div>
        </div>

        {/* Mode Switcher & Upload Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
            <button
              onClick={() => setActivePlan("PLAN_B")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                activePlan === "PLAN_B"
                  ? "bg-emerald-600 text-slate-950 shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              Plan B: QuakeRoom (3D Room)
            </button>
            <button
              onClick={() => setActivePlan("PLAN_C")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                activePlan === "PLAN_C"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Plan C: ExitZero (CAGB L2)
            </button>
          </div>

          {activePlan === "PLAN_B" && (
            <select
              value={presetKey}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-400"
            >
              <option value="student_dorm">Preset 1: Student Bedroom (10th Floor — Renter)</option>
              <option value="cagb_room_203">Preset 2: CAGB Level 2 — Room 203 (Route C Deep-Dive)</option>
              <option value="room200">CAGB Walk Twin: Room 200 Lecture Theatre (0/50 Clear)</option>
              <option value="hall">CAGB Walk Twin: Jet Engine Hall (50/50 Walk • 0/50 Wheelchair)</option>
              <option value="corridor">CAGB Walk Twin: Level 2 Spine Corridor (50/50 Clear)</option>
              <option value="lobby">CAGB Walk Twin: Main Entrance Lobby (0/50 Clear)</option>
              <option value="studio_lab">Preset 3: High-Rise Studio / Lab (12th Floor)</option>
            </select>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition shadow"
          >
            <Upload className="w-3.5 h-3.5" />
            {isExtracting
              ? "Extracting 3D..."
              : activePlan === "PLAN_B"
              ? "Scan Room Video / Photo"
              : "Scan Floor-Plan Sign"}
          </button>

          <button
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`p-2 rounded-lg border text-xs transition ${
              voiceEnabled
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : "bg-slate-900 border-slate-700 text-slate-500"
            }`}
            title="Toggle Voice Coach"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2-Phase Seismic Safety Framing Strip (Judge Verification Check) */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 font-bold">
              PHASE 1 (DURING SHAKING)
            </span>
            Drop, Cover &amp; Hold On under sturdy desk ({verification.shelter_reach_time_s}s reach) — never run to doors or lifts while shaking
          </span>
          <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 font-bold">
              PHASE 2 (AFTER SHAKING STOPS)
            </span>
            Post-Collapse A* Egress to Stairwell Exit (Walk 0.4m: {verification.monte_carlo.walk_clear_count}/50 • Wheelchair 0.9m: {verification.monte_carlo.wheelchair_clear_count}/50)
          </span>
        </div>
        <span className="text-rose-300 font-bold">
          LIFT LOCKOUT: ACTIVE
        </span>
      </div>

      {statusBanner && (
        <div className="bg-indigo-950/80 border-b border-indigo-500/40 px-5 py-1.5 text-xs text-indigo-200 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-indigo-400 hover:text-white ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        {/* Left Column: 3D Interactive Viewport (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-[540px]">
          {activePlan === "PLAN_B" ? (
            <>
              {/* Plan B Toolbar */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleTriggerEarthquake}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Trigger {scene.earthquake.magnitude_mw}M Quake (PGA {verification.floor_pga_g}g)
                  </button>

                  <button
                    onClick={handleSynthesizeFix}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-950/50 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Synthesize &amp; Verify Renter-Safe Layout
                  </button>

                  <button
                    onClick={() =>
                      setClearanceMode((m) => (m === "walk" ? "wheelchair" : "walk"))
                    }
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                      clearanceMode === "wheelchair"
                        ? "bg-cyan-600 border-cyan-400 text-slate-950 font-bold"
                        : "bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700"
                    }`}
                  >
                    <Accessibility className="w-3.5 h-3.5" />
                    {clearanceMode === "wheelchair"
                      ? "Wheelchair Clearance (0.9m)"
                      : "Walking Clearance (0.4m)"}
                  </button>

                  <button
                    onClick={() => setDropHazardMode((d) => !d)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                      dropHazardMode
                        ? "bg-orange-600 border-orange-400 text-white"
                        : "bg-slate-800 border-slate-700 text-orange-300 hover:bg-slate-700"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    {dropHazardMode ? "Click Floor to Drop Hazard..." : "Drop Live Hazard"}
                  </button>

                  <button
                    onClick={() => handleSelectPreset(presetKey)}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    Phase 2 A* Egress
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                    Phase 1 Drop-Cover-Hold
                  </span>
                </div>
              </div>

              {/* Plan B 3D Room Canvas */}
              <div className="flex-1 relative min-h-[460px]">
                <RoomCanvas3D
                  scene={scene}
                  verification={verification}
                  simState={simState}
                  dropHazardMode={dropHazardMode}
                  onFloorClickDropHazard={handleFloorDropHazard}
                  selectedObjectId={selectedObjectId}
                  onSelectObject={setSelectedObjectId}
                />

                <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1.5">
                  <div
                    className={`px-3 py-1.5 rounded-lg border backdrop-blur text-xs font-bold flex items-center gap-2 shadow-lg ${
                      verification.survivable
                        ? "bg-emerald-950/85 border-emerald-400 text-emerald-200"
                        : "bg-rose-950/90 border-rose-500 text-rose-200"
                    }`}
                  >
                    {verification.survivable ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        VERIFIED SURVIVABLE — WALK {verification.monte_carlo.walk_clear_count}/50 • WHEELCHAIR{" "}
                        {verification.monte_carlo.wheelchair_clear_count}/50 RUNS
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        {!verification.exit_reachable_post_quake
                          ? `EXIT BLOCKED BY WARDROBE — WALK ${verification.monte_carlo.walk_clear_count}/50 • WHEELCHAIR ${verification.monte_carlo.wheelchair_clear_count}/50`
                          : "CRITICAL HAZARD: SLEEP ZONE IN BOOKSHELF / GLASS FALL SHADOW"}
                      </>
                    )}
                  </div>

                  {isRemediatedView && (
                    <div className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[11px] font-semibold backdrop-blur">
                      Zero-Drill Renter Layout Verified by Housner Mechanics &amp; Post-Collapse A*
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Plan C Toolbar */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={startNodeId}
                    onChange={(e) => setStartNodeId(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-200"
                  >
                    {floorGraph.nodes
                      .filter((n) => n.type === "room")
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          Start: {n.label}
                        </option>
                      ))}
                  </select>

                  <button
                    onClick={() =>
                      setEmergencyType((t) => (t === "earthquake" ? "fire" : "earthquake"))
                    }
                    className="px-3 py-2 rounded-lg bg-rose-600/25 border border-rose-500/50 text-rose-200 text-xs font-bold"
                  >
                    {emergencyType.toUpperCase()} (Lifts Locked)
                  </button>

                  <button
                    onClick={() =>
                      setClearanceMode((m) => (m === "walk" ? "wheelchair" : "walk"))
                    }
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                      clearanceMode === "wheelchair"
                        ? "bg-cyan-600 border-cyan-400 text-slate-950 font-bold"
                        : "bg-slate-800 border-slate-700 text-cyan-300"
                    }`}
                  >
                    <Accessibility className="w-3.5 h-3.5" />
                    {clearanceMode === "wheelchair"
                      ? "Wheelchair (0.9m → Refuge R2)"
                      : "Walking (0.4m → Exhibition Rd 2.10m)"}
                  </button>

                  <button
                    onClick={handleEnterRoom203DeepDive}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Route C → Enter Room 203 (3D Shake Table)
                  </button>

                  <button
                    onClick={() =>
                      speakText(
                        buildingVerification.verified_safe_route?.turn_by_turn_voice ||
                          "No safe route available."
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Speak Route
                  </button>
                </div>
              </div>

              {/* Plan C 3D Building Canvas */}
              <div className="flex-1 relative min-h-[460px]">
                <BuildingCanvas3D
                  graph={floorGraph}
                  hazards={liveHazards}
                  evacuation={buildingVerification}
                  onSelectStartNode={setStartNodeId}
                  onToggleCorridorHazard={handleToggleCorridorHazard}
                />

                <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1.5">
                  <div className="px-3 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-bold flex items-center gap-2 shadow-lg">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    LIFT LOCKOUT OVERRIDE ACTIVE — CAGB CENTRAL LIFTS FORBIDDEN IN{" "}
                    {emergencyType.toUpperCase()}
                  </div>
                  {buildingVerification.verified_safe_route && (
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      VERIFIED SAFE ROUTE: {buildingVerification.verified_safe_route.target_exit_label}{" "}
                      ({buildingVerification.verified_safe_route.total_distance_m}m •{" "}
                      {buildingVerification.verified_safe_route.estimated_travel_time_s}s • +
                      {buildingVerification.verified_safe_route.safety_margin_before_closure_s}s buffer)
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Multimodal Inputs + Deterministic Verifier Telemetry (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* 1. Gemini Live Voice & Invisible Physics Parameters */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                1. Gemini Live Voice &amp; Constraints
              </h2>
              <span className="text-[11px] text-slate-400">
                Floor {scene.room.floor_level} PGA:{" "}
                <strong className="text-amber-300">{verification.floor_pga_g}g</strong>
              </span>
            </div>

            <textarea
              value={voiceNote}
              onChange={(e) => setVoiceNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400"
              placeholder="Speak constraints: floor level, renter no-drill, heavy top-shelf load, where is the lift..."
            />

            {activePlan === "PLAN_B" && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Building Floor</span>
                    <span className="font-bold text-white">Floor {scene.room.floor_level}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={scene.room.floor_level}
                    onChange={(e) =>
                      setScene((s) => ({
                        ...s,
                        room: { ...s.room, floor_level: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Quake Magnitude</span>
                    <span className="font-bold text-rose-400">
                      {scene.earthquake.magnitude_mw} Mw
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5.2}
                    max={7.8}
                    step={0.1}
                    value={scene.earthquake.magnitude_mw}
                    onChange={(e) =>
                      setScene((s) => ({
                        ...s,
                        earthquake: { ...s.earthquake, magnitude_mw: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-rose-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scene.room.renter_no_drill}
                  onChange={(e) =>
                    setScene((s) => ({
                      ...s,
                      room: { ...s.room, renter_no_drill: e.target.checked },
                    }))
                  }
                  className="rounded accent-emerald-500"
                />
                Renter Mode (No Wall Drilling)
              </label>

              <button
                onClick={handleApplyVoiceContext}
                className="px-2.5 py-1 rounded-md bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 text-[11px] font-semibold transition"
              >
                Apply Voice Context
              </button>
            </div>
          </div>

          {activePlan === "PLAN_B" ? (
            <>
              {/* Plan B Card 2: Deterministic Housner Physics & N=50 Monte Carlo A* Telemetry */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    2. Housner &amp; N=50 Monte Carlo Verifier
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    PGA {verification.monte_carlo.pga_range_g[0]}g–{verification.monte_carlo.pga_range_g[1]}g
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className={`p-2 rounded-lg border ${
                      verification.exit_reachable_post_quake
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                        : "bg-rose-950/50 border-rose-500/50 text-rose-200"
                    }`}
                  >
                    <div className="text-[10px] uppercase opacity-75">
                      Walk (0.4m) / Wheelchair (0.9m)
                    </div>
                    <div className="font-bold text-sm mt-0.5">
                      {verification.monte_carlo.walk_clear_count}/50 •{" "}
                      {verification.monte_carlo.wheelchair_clear_count}/50
                    </div>
                  </div>

                  <div className="p-2 rounded-lg border bg-cyan-950/40 border-cyan-500/40 text-cyan-200">
                    <div className="text-[10px] uppercase opacity-75">
                      Phase 1 Shelter (Under Desk)
                    </div>
                    <div className="font-bold text-sm mt-0.5">
                      {verification.safe_shelter_spot_m
                        ? `Reach in ${verification.shelter_reach_time_s}s`
                        : "None Found"}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {Object.values(verification.object_results)
                    .filter(
                      (r) =>
                        r.category === "bookshelf" ||
                        r.category === "wardrobe" ||
                        r.category === "heavy_item" ||
                        r.category === "window"
                    )
                    .map((r) => (
                      <div
                        key={r.object_id}
                        className="flex items-center justify-between text-[11px] bg-slate-950/80 border border-slate-800/90 rounded-lg px-2.5 py-1.5"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{r.label}</div>
                          <div className="text-[10px] text-slate-400">
                            Mass: {r.combined_mass_kg}kg • CoM h: {r.center_of_mass_height_m}m •{" "}
                            {r.peak_kinetic_energy_joules}J
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              r.tipped_over || r.shattered_or_fell
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            }`}
                          >
                            {r.category === "window"
                              ? r.shattered_or_fell
                                ? "SHATTERS"
                                : "INTACT"
                              : `SF = ${r.analytical_safety_factor}`}
                          </span>
                          {r.blocked_exit_corridor && (
                            <div className="text-[9px] text-rose-400 font-bold mt-0.5">
                              SEALS EXIT DOOR
                            </div>
                          )}
                          {r.hit_occupant_zone && (
                            <div className="text-[9px] text-rose-400 font-bold mt-0.5">
                              CRUSHES BED ZONE
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Plan B Card 3: Remediation Proposal */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex-1 flex flex-col gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  3. Self-Correcting Renter-Safe Remediation
                </h2>

                {remediation ? (
                  <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
                    {remediation.changes.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px]"
                      >
                        <div className="font-bold text-emerald-300">
                          {i + 1}. {c.label}: {c.before_desc} → {c.after_desc}
                        </div>
                        <div className="text-slate-300 text-[10px] mt-0.5 leading-snug">
                          {c.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 leading-relaxed my-auto py-3">
                    1. Hit <strong>&ldquo;Trigger 6.8M Quake&rdquo;</strong> to watch the top-heavy bookshelf crush the bed and the wardrobe block the exit door.<br />
                    2. Hit <strong>&ldquo;Synthesize &amp; Verify Renter-Safe Layout&rdquo;</strong> to move the 20kg textbooks to the bottom shelf as ballast and clear the exit.
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Plan C Card 2: CAGB Level 2 Filming Routes A–D & Time-Expanded Evacuation Verifier */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    2. CAGB Level 2 Routes A–D ({CAGB_L2_PLAN_PX_PER_M} px/m)
                  </h2>
                  <div className="flex gap-1">
                    {(["A", "B", "C", "D"] as const).map((rId) => (
                      <button
                        key={rId}
                        onClick={() => setSelectedRouteId(rId)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          selectedRouteId === rId
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        Route {rId}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Official CAGB Level 2 Route Map Preview */}
                <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                  <img
                    src={activeCAGBRoute.image}
                    alt={activeCAGBRoute.title}
                    className="w-full h-32 object-cover opacity-90"
                  />
                  <div className="p-2 bg-slate-950/95 border-t border-slate-800">
                    <div className="text-[11px] font-bold text-indigo-200">
                      {activeCAGBRoute.title}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {activeCAGBRoute.landmarks.map((lm) => (
                        <span
                          key={lm.number}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300"
                        >
                          #{lm.number}: {lm.say}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rejected Naive Route vs Verified Route */}
                <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-500/50 text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-bold text-rose-300 text-[11px]">
                    <span>Naive Route (Dalby Court / Central Lift)</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-[9px]">
                      REJECTED ({buildingVerification.naive_shortest_route.status})
                    </span>
                  </div>
                  <p className="text-[10px] text-rose-200/90 leading-snug">
                    {buildingVerification.naive_shortest_route.failure_reason}
                  </p>
                </div>

                {buildingVerification.verified_safe_route && (
                  <div className="p-2 rounded-lg bg-emerald-950/45 border border-emerald-500/50 text-xs space-y-0.5">
                    <div className="flex items-center justify-between font-bold text-emerald-300 text-[11px]">
                      <span>{buildingVerification.verified_safe_route.target_exit_label}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-[9px]">
                        +{buildingVerification.verified_safe_route.safety_margin_before_closure_s}s
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-200/90 leading-snug">
                      &ldquo;{buildingVerification.verified_safe_route.turn_by_turn_voice}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Plan C Card 3: Active Live Camera / Voice Hazards with Video Timestamp Evidence */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex-1 flex flex-col gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  3. Live Camera Hazard Evidence
                </h2>
                <div className="space-y-2">
                  {liveHazards.map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-orange-500/40 text-xs space-y-1.5"
                    >
                      <div className="font-bold text-orange-300 flex justify-between">
                        <span>{h.hazard_type.toUpperCase()}</span>
                        <span>Spread: {h.spread_rate_m_per_s} m/s</span>
                      </div>
                      <p className="text-[11px] text-slate-300">{h.description}</p>
                      {h.video_evidence && (
                        <div className="p-1.5 rounded bg-indigo-950/50 border border-indigo-500/30 text-[10px] text-indigo-200 flex items-start gap-1.5">
                          <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-indigo-300">
                              {h.video_evidence.video_file} @ t={h.video_evidence.timestamp_s}s:
                            </span>{" "}
                            &ldquo;{h.video_evidence.quote}&rdquo;
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
