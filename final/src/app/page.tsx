"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
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
  Search,
  Sparkles,
  Volume2,
  Accessibility,
  SplitSquareVertical,
  X,
  Check,
  Navigation,
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
import type { TextureStyle } from "@/scene3d/proceduralTextures";

const QuakeRoomCanvas = dynamic(() => import("@/scene3d/QuakeRoomCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-[#050811] flex items-center justify-center text-slate-300 text-sm">
      Loading Multi-Room 3D Sanctuary & Collision Physics Engine...
    </div>
  ),
});

const ExitZeroCanvas = dynamic(() => import("@/scene3d/ExitZeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-[#050811] flex items-center justify-center text-slate-300 text-sm">
      Loading 3D Building Wing & Collision Pathfinder...
    </div>
  ),
});

interface SearchableSettingItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  keywords: string;
  badge: string;
  active?: boolean;
  action: () => void;
}

export default function SeismicCommandCenter() {
  // Main display switcher: Multi-Room Suite ("PLAN_B") vs Building Wing ("PLAN_C")
  const [activePlan, setActivePlan] = useState<"PLAN_B" | "PLAN_C">("PLAN_B");
  const [fullScreenMode, setFullScreenMode] = useState<boolean>(true);

  // Pop-up Menu Drawer (closed by default so 3D viewport fills the screen cleanly)
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // Cmd+P Settings Search Modal state
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSearchIdx, setSelectedSearchIdx] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Voice label state
  const [voiceLabel, setVoiceLabel] = useState<string>("Natural Neural");

  // Surface material state (from Memory Palace procedural textures)
  const [floorMaterial, setFloorMaterial] = useState<TextureStyle>("wood");

  // 3D Item Label Popups state (hidden by default; only enabled via Menu or Cmd+P)
  const [showItemLabels, setShowItemLabels] = useState<boolean>(false);

  // Player teleport & respawn state
  const [teleportRoomId, setTeleportRoomId] = useState<string | null>("room_1");
  const [playerResetCounter, setPlayerResetCounter] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        setVoiceLabel(getCurrentHumanVoiceLabel());
      };
      window.speechSynthesis.onvoiceschanged = updateVoices;
      updateVoices();
    }
  }, []);

  // Global Cmd+P / Ctrl+P keyboard shortcut for Settings Search Bar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setSearchOpen((prev) => {
          const next = !prev;
          if (next) {
            setSearchQuery("");
            setSelectedSearchIdx(0);
          }
          return next;
        });
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 30);
    }
  }, [searchOpen]);

  // ==========================================================================
  // PLAN B STATE (Multi-Room Quake Suite — Starts in 1st-Person Player View!)
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
  // PLAN C STATE (ExitZero Building Wing)
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
  // HANDLERS
  // ==========================================================================
  const handleTriggerQuake = () => {
    setIsShaking(true);
    setHasCollapsed(false);
    setTimeout(() => {
      setIsShaking(false);
      setHasCollapsed(true);
      if (!currentEvaluation.survivable) {
        speakCoachMessage(
          "Critical alert. Unanchored furniture has toppled across the room. Navigate around the fallen obstacles and follow the glowing emerald optimal path through the lounge and gallery to the emergency exit.",
          true
        );
      } else {
        speakCoachMessage(
          "Room verification passed! Because your heavy textbooks are now on the bottom shelf and the wardrobe was shifted away from the door, your escape path across all rooms is clear.",
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
      `Updated room physics for floor ${
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
      setHasCollapsed(false);
    } finally {
      setIsRemediating(false);
    }
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

  // ==========================================================================
  // CMD+P SEARCHABLE SETTINGS REGISTRY (ALL SETTINGS IN ONE SEARCH PALETTE)
  // ==========================================================================
  const allSearchableSettings = useMemo<SearchableSettingItem[]>(
    () => [
      // Simulation & Remediation
      {
        id: "sim_quake",
        category: "Simulation",
        title: "Simulate Earthquake (Trigger Quake & Object Physics)",
        subtitle: `Shake all rooms at ${roomScene.earthquake.magnitude_mw.toFixed(1)} Mw (${currentPgaG}g Floor PGA) & topple unanchored hazards`,
        keywords: "simulate quake earthquake shake trigger physics collapse",
        badge: isShaking ? "SHAKING" : "RUN",
        active: isShaking,
        action: () => {
          setActivePlan("PLAN_B");
          handleTriggerQuake();
          setSearchOpen(false);
        },
      },
      {
        id: "sim_remediate",
        category: "Simulation",
        title: "Apply Renter-Safe Remediation Fix",
        subtitle: "Lower 20kg books to bottom shelf, shift wardrobe clear of exit door, secure room",
        keywords: "apply renter fix remediate safe repair books wardrobe",
        badge: currentEvaluation.survivable ? "APPLIED" : "FIX",
        active: currentEvaluation.survivable,
        action: () => {
          setActivePlan("PLAN_B");
          handleSynthesizeRemediation();
          setSearchOpen(false);
        },
      },
      {
        id: "sim_reset",
        category: "Simulation",
        title: "Reset Unsafe Room & Obstacles",
        subtitle: "Restore initial unanchored furniture, pushable carts, and player spawn",
        keywords: "reset unsafe room restore obstacles default",
        badge: "RESET",
        action: () => {
          setRoomScene(STUDENT_BEDROOM_UNSAFE);
          setRemediatedScene(null);
          setSplitScreenCompare(false);
          setHasCollapsed(false);
          setPlayerResetCounter((c) => c + 1);
          setSearchOpen(false);
        },
      },

      // Display Mode & Camera View
      {
        id: "mode_room_suite",
        category: "Display Mode",
        title: "Switch to 3D Multi-Room Suite (4 Connected Rooms)",
        subtitle: "Walk through Bedroom, Central Lounge, Server Lab, and North Exit Gallery",
        keywords: "3d room display multi-room suite plan b bedroom lounge lab",
        badge: activePlan === "PLAN_B" ? "ACTIVE" : "SWITCH",
        active: activePlan === "PLAN_B",
        action: () => {
          setActivePlan("PLAN_B");
          setSearchOpen(false);
        },
      },
      {
        id: "mode_building_wing",
        category: "Display Mode",
        title: "Switch to 3D Building Floor Wing (Imperial CAGB L2)",
        subtitle: "Full floor wing with A* verified pathfinder, corridor hazards, and pushable carts",
        keywords: "3d building display floor wing plan c exit zero imperial corridor",
        badge: activePlan === "PLAN_C" ? "ACTIVE" : "SWITCH",
        active: activePlan === "PLAN_C",
        action: () => {
          setActivePlan("PLAN_C");
          setSearchOpen(false);
        },
      },
      {
        id: "view_toggle_pov",
        category: "Camera & View",
        title: "Toggle 1st-Person Player Walkthrough vs 3D Dollhouse Orbit",
        subtitle: `Currently: ${
          isFirstPersonActive
            ? "1st-Person Inside Walkthrough (WASD + Mouse Look)"
            : "3D Dollhouse Orbit View (WASD moves Avatar)"
        }`,
        keywords: "view camera first person 1st person inside orbit dollhouse walkthrough",
        badge: isFirstPersonActive ? "1ST PERSON" : "3D ORBIT",
        active: isFirstPersonActive,
        action: () => {
          toggleFirstPersonView();
          setSearchOpen(false);
        },
      },
      {
        id: "view_item_labels",
        category: "Camera & View",
        title: "Toggle 3D Item Label Popups",
        subtitle: `Currently: ${
          showItemLabels
            ? "ON (Showing floating telemetry labels above items)"
            : "OFF (Clean 3D scene without floating item popups)"
        }`,
        keywords: "labels popups item tags floating text telemetry sprites hide show",
        badge: showItemLabels ? "ON" : "OFF",
        active: showItemLabels,
        action: () => {
          setShowItemLabels((v) => !v);
          setSearchOpen(false);
        },
      },
      {
        id: "view_split_compare",
        category: "Camera & View",
        title: "Toggle Before / After Split-Screen Comparison",
        subtitle: "Compare Unsafe Room vs Renter-Safe Remediated Room side-by-side",
        keywords: "split screen compare before after side by side",
        badge: splitScreenCompare ? "ON" : "OFF",
        active: splitScreenCompare,
        action: () => {
          setActivePlan("PLAN_B");
          setSplitScreenCompare((v) => !v);
          setSearchOpen(false);
        },
      },
      {
        id: "view_fullscreen",
        category: "Camera & View",
        title: "Toggle Full-Screen Viewport Mode",
        subtitle: "Expand 3D canvas across 100% of screen vs framed mode",
        keywords: "full screen fullscreen maximize minimize viewport",
        badge: fullScreenMode ? "ON" : "OFF",
        active: fullScreenMode,
        action: () => {
          setFullScreenMode((v) => !v);
          setSearchOpen(false);
        },
      },

      // Room Teleport & Player Navigation
      {
        id: "tp_room_1",
        category: "Teleport Player",
        title: "Teleport to Room 1: Student Study & Bedroom",
        subtitle: "Spawn player inside primary bedroom near bed & study desk",
        keywords: "teleport room 1 bedroom study spawn player",
        badge: teleportRoomId === "room_1" ? "CURRENT" : "GO",
        active: teleportRoomId === "room_1",
        action: () => {
          setActivePlan("PLAN_B");
          setTeleportRoomId("room_1");
          setPlayerResetCounter((c) => c + 1);
          setSearchOpen(false);
        },
      },
      {
        id: "tp_room_2",
        category: "Teleport Player",
        title: "Teleport to Room 2: Central Lounge & Dining Hall",
        subtitle: "Spawn player in lounge with sofa, shelter table, curio cabinet & tea cart",
        keywords: "teleport room 2 lounge dining hall sofa table",
        badge: teleportRoomId === "room_2" ? "CURRENT" : "GO",
        active: teleportRoomId === "room_2",
        action: () => {
          setActivePlan("PLAN_B");
          setTeleportRoomId("room_2");
          setPlayerResetCounter((c) => c + 1);
          setSearchOpen(false);
        },
      },
      {
        id: "tp_room_3",
        category: "Teleport Player",
        title: "Teleport to Room 3: Seismic Server & Research Lab",
        subtitle: "Spawn player in research annex with mainframe rack, lab bench & oscilloscope cart",
        keywords: "teleport room 3 lab server rack research workbench",
        badge: teleportRoomId === "room_3" ? "CURRENT" : "GO",
        active: teleportRoomId === "room_3",
        action: () => {
          setActivePlan("PLAN_B");
          setTeleportRoomId("room_3");
          setPlayerResetCounter((c) => c + 1);
          setSearchOpen(false);
        },
      },
      {
        id: "tp_room_4",
        category: "Teleport Player",
        title: "Teleport to Room 4: North Gallery & Emergency Exit Wing",
        subtitle: "Spawn player in north gallery corridor with debris obstacles & exit stairwell",
        keywords: "teleport room 4 north gallery corridor emergency exit",
        badge: teleportRoomId === "room_4" ? "CURRENT" : "GO",
        active: teleportRoomId === "room_4",
        action: () => {
          setActivePlan("PLAN_B");
          setTeleportRoomId("room_4");
          setPlayerResetCounter((c) => c + 1);
          setSearchOpen(false);
        },
      },

      // 3D Surface & Material Settings
      {
        id: "mat_wood",
        category: "3D Surface Material",
        title: "Floor Material: Versailles Wood Parquet",
        subtitle: "Warm architectural oak parquet with bump-mapped wood grain",
        keywords: "floor material surface wood parquet oak texture",
        badge: floorMaterial === "wood" ? "ACTIVE" : "SELECT",
        active: floorMaterial === "wood",
        action: () => {
          setFloorMaterial("wood");
          setSearchOpen(false);
        },
      },
      {
        id: "mat_marble",
        category: "3D Surface Material",
        title: "Floor Material: Calacatta Marble & Gold",
        subtitle: "Polished Italian Calacatta marble with brushed gold inlays",
        keywords: "floor material surface marble calacatta gold stone",
        badge: floorMaterial === "marble" ? "ACTIVE" : "SELECT",
        active: floorMaterial === "marble",
        action: () => {
          setFloorMaterial("marble");
          setSearchOpen(false);
        },
      },
      {
        id: "mat_stone",
        category: "3D Surface Material",
        title: "Floor Material: Ashlar Stone Masonry",
        subtitle: "Textured sanctuary limestone blocks with deep mortar bump map",
        keywords: "floor material surface stone ashlar masonry",
        badge: floorMaterial === "stone" ? "ACTIVE" : "SELECT",
        active: floorMaterial === "stone",
        action: () => {
          setFloorMaterial("stone");
          setSearchOpen(false);
        },
      },
      {
        id: "mat_carpet",
        category: "3D Surface Material",
        title: "Floor Material: Crimson & Gold Damask Carpet",
        subtitle: "Royal woven sanctuary carpet with high-friction damping",
        keywords: "floor material surface carpet rug crimson damask",
        badge: floorMaterial === "carpet" ? "ACTIVE" : "SELECT",
        active: floorMaterial === "carpet",
        action: () => {
          setFloorMaterial("carpet");
          setSearchOpen(false);
        },
      },
      {
        id: "mat_cyber",
        category: "3D Surface Material",
        title: "Floor Material: Cyber Telemetry Grid",
        subtitle: "Dark metallic seismic lab grid with cyan coordinate lines",
        keywords: "floor material surface cyber grid lab matrix",
        badge: floorMaterial === "cyber" ? "ACTIVE" : "SELECT",
        active: floorMaterial === "cyber",
        action: () => {
          setFloorMaterial("cyber");
          setSearchOpen(false);
        },
      },

      // Seismic Physics Presets
      {
        id: "mw_6_0",
        category: "Seismic Magnitude",
        title: "Set Earthquake Magnitude: 6.0 Mw (Moderate)",
        subtitle: "Moderate ground shaking",
        keywords: "magnitude mw 6.0 earthquake intensity slider",
        badge:
          Math.abs(roomScene.earthquake.magnitude_mw - 6.0) < 0.05
            ? "ACTIVE"
            : "SET",
        active: Math.abs(roomScene.earthquake.magnitude_mw - 6.0) < 0.05,
        action: () => {
          setRoomScene((p) => ({
            ...p,
            earthquake: { ...p.earthquake, magnitude_mw: 6.0 },
          }));
          setSearchOpen(false);
        },
      },
      {
        id: "mw_7_1",
        category: "Seismic Magnitude",
        title: "Set Earthquake Magnitude: 7.1 Mw (Major)",
        subtitle: "Major seismic event — topples unanchored top-heavy furniture",
        keywords: "magnitude mw 7.1 earthquake major intensity",
        badge:
          Math.abs(roomScene.earthquake.magnitude_mw - 7.1) < 0.05
            ? "ACTIVE"
            : "SET",
        active: Math.abs(roomScene.earthquake.magnitude_mw - 7.1) < 0.05,
        action: () => {
          setRoomScene((p) => ({
            ...p,
            earthquake: { ...p.earthquake, magnitude_mw: 7.1 },
          }));
          setSearchOpen(false);
        },
      },
      {
        id: "mw_7_8",
        category: "Seismic Magnitude",
        title: "Set Earthquake Magnitude: 7.8 Mw (Severe)",
        subtitle: "Extreme ground acceleration & upper-floor sway amplification",
        keywords: "magnitude mw 7.8 severe earthquake maximum",
        badge:
          Math.abs(roomScene.earthquake.magnitude_mw - 7.8) < 0.05
            ? "ACTIVE"
            : "SET",
        active: Math.abs(roomScene.earthquake.magnitude_mw - 7.8) < 0.05,
        action: () => {
          setRoomScene((p) => ({
            ...p,
            earthquake: { ...p.earthquake, magnitude_mw: 7.8 },
          }));
          setSearchOpen(false);
        },
      },
      {
        id: "floor_1",
        category: "Building Floor",
        title: "Set Building Floor: Floor 1 (Ground Level)",
        subtitle: "Minimal structural sway amplification",
        keywords: "floor level 1 ground story height",
        badge: roomScene.room.floor_level === 1 ? "ACTIVE" : "SET",
        active: roomScene.room.floor_level === 1,
        action: () => {
          setRoomScene((p) => ({
            ...p,
            room: { ...p.room, floor_level: 1 },
          }));
          setSearchOpen(false);
        },
      },
      {
        id: "floor_10",
        category: "Building Floor",
        title: "Set Building Floor: Floor 10 (High-Rise Sway)",
        subtitle: "Significant horizontal floor acceleration amplification",
        keywords: "floor level 10 high rise story sway",
        badge: roomScene.room.floor_level === 10 ? "ACTIVE" : "SET",
        active: roomScene.room.floor_level === 10,
        action: () => {
          setRoomScene((p) => ({
            ...p,
            room: { ...p.room, floor_level: 10 },
          }));
          setSearchOpen(false);
        },
      },
      {
        id: "floor_18",
        category: "Building Floor",
        title: "Set Building Floor: Floor 18 (Penthouse Extreme Sway)",
        subtitle: "Maximum upper-story seismic whip amplification",
        keywords: "floor level 18 20 penthouse top floor",
        badge: roomScene.room.floor_level === 18 ? "ACTIVE" : "SET",
        active: roomScene.room.floor_level === 18,
        action: () => {
          setRoomScene((p) => ({
            ...p,
            room: { ...p.room, floor_level: 18 },
          }));
          setSearchOpen(false);
        },
      },

      // Building Hazards, Accessibility & Voice
      {
        id: "bldg_hazard_toggle",
        category: "Building & Evacuation",
        title: "Toggle East Corridor Structural Collapse Hazard",
        subtitle: "Block or clear East Junction to test dynamic A* rerouting to West Stairwell",
        keywords: "east corridor blocked hazard collapse clear building",
        badge: liveHazards.length > 0 ? "BLOCKED" : "CLEAR",
        active: liveHazards.length > 0,
        action: () => {
          setLiveHazards((prev) =>
            prev.length > 0 ? [] : DEFAULT_LIVE_HAZARDS
          );
          setSearchOpen(false);
        },
      },
      {
        id: "bldg_wheelchair",
        category: "Building & Evacuation",
        title: "Toggle Wheelchair Accessible Refuge Mode",
        subtitle: `Currently: ${
          mobilityMode === "wheelchair_accessible"
            ? "Wheelchair Refuge Routing"
            : "Standard Walking / Running Egress"
        }`,
        keywords: "wheelchair accessible mobility refuge walking mode",
        badge:
          mobilityMode === "wheelchair_accessible" ? "WHEELCHAIR" : "WALKING",
        active: mobilityMode === "wheelchair_accessible",
        action: () => {
          setMobilityMode((m) =>
            m === "walking_running"
              ? "wheelchair_accessible"
              : "walking_running"
          );
          setSearchOpen(false);
        },
      },
      {
        id: "voice_cycle",
        category: "Audio & Voice Coach",
        title: `Switch Natural Human Voice Coach (Current: ${voiceLabel})`,
        subtitle: "Cycle preferred neural speech synthesis voice and play sample",
        keywords: "voice audio coach speech human speaker",
        badge: "SWITCH VOICE",
        action: () => {
          const nextName = cyclePreferredHumanVoice();
          setVoiceLabel(nextName);
          setSearchOpen(false);
        },
      },
      {
        id: "open_full_menu",
        category: "Menu & Tools",
        title: "Open Full Settings & Telemetry Drawer",
        subtitle: "View all sliders, Gemini Vision uploads, and Housner safety factors",
        keywords: "open full menu drawer settings telemetry upload",
        badge: "OPEN",
        action: () => {
          setSearchOpen(false);
          setMenuOpen(true);
        },
      },
    ],
    [
      roomScene,
      currentPgaG,
      isShaking,
      activePlan,
      isFirstPersonActive,
      showItemLabels,
      splitScreenCompare,
      fullScreenMode,
      teleportRoomId,
      floorMaterial,
      liveHazards,
      mobilityMode,
      voiceLabel,
    ]
  );

  const filteredSearchItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSearchableSettings;
    return allSearchableSettings.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [allSearchableSettings, searchQuery]);

  // Keyboard navigation inside Cmd+P modal
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSearchIdx((i) =>
        filteredSearchItems.length > 0
          ? (i + 1) % filteredSearchItems.length
          : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSearchIdx((i) =>
        filteredSearchItems.length > 0
          ? (i - 1 + filteredSearchItems.length) % filteredSearchItems.length
          : 0
      );
    } else if (e.key === "Enter" && filteredSearchItems[selectedSearchIdx]) {
      e.preventDefault();
      filteredSearchItems[selectedSearchIdx].action();
    }
  };

  return (
    <div
      className={`relative bg-[#050811] text-slate-100 ${
        fullScreenMode
          ? "w-screen h-screen overflow-hidden"
          : "min-h-screen p-6"
      }`}
    >
      {/* ==================================================================== */}
      {/* STRIPPED-BACK FLOATING TOP HUD BAR (CLEAN FULL-SCREEN 3D VIEWPORT)    */}
      {/* ==================================================================== */}
      <header
        className={`${
          fullScreenMode ? "fixed top-3 left-3 right-3 z-30" : "mb-4"
        } flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 shadow-2xl`}
      >
        {/* Left: Brand & Live Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700/80">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md">
              <Activity className="h-4 w-4 text-slate-950" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              SeismicTwin 3D
            </span>
          </div>

          {/* Current Mode & Safety Verdict Pill */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-800 font-semibold text-amber-300">
              {activePlan === "PLAN_B"
                ? "🏠 4-Room Connected Suite"
                : "🏢 Building Floor Wing"}
            </span>
            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border ${
                activePlan === "PLAN_B"
                  ? currentEvaluation.survivable
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : "bg-red-500/15 text-red-300 border-red-500/40"
                  : evacuationResult.verified_safe_route
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  : "bg-red-500/15 text-red-300 border-red-500/40"
              }`}
            >
              {activePlan === "PLAN_B"
                ? currentEvaluation.survivable
                  ? `✓ Survivable (${roomScene.earthquake.magnitude_mw.toFixed(1)} Mw)`
                  : `⚠ Hazard Alert (${roomScene.earthquake.magnitude_mw.toFixed(1)} Mw)`
                : evacuationResult.verified_safe_route
                ? `✓ Route Verified → ${evacuationResult.verified_safe_route.target_exit_label}`
                : "⚠ Route Blocked"}
            </span>
          </div>
        </div>

        {/* Right: Quick Quake Trigger + Cmd+P Search Button + Single Menu Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerQuake}
            disabled={isShaking}
            className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg flex items-center gap-1.5 transition"
          >
            <Play className="h-3.5 w-3.5" />
            {isShaking ? "Shaking..." : "Simulate Quake"}
          </button>

          {/* CMD+P SEARCH BAR TRIGGER */}
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedSearchIdx(0);
              setSearchOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-2 transition shadow-inner"
            title="Search all settings (Cmd+P)"
          >
            <Search className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Search Settings</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-amber-300 rounded border border-slate-700">
              ⌘P
            </kbd>
          </button>

          {/* SINGLE POP-UP MENU BUTTON */}
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
                Close Menu
              </>
            ) : (
              <>
                <Menu className="h-4 w-4" />
                Menu
              </>
            )}
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* CMD+P INTERACTIVE SETTINGS COMMAND PALETTE MODAL                     */}
      {/* ==================================================================== */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-start justify-center pt-20 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
              <Search className="h-5 w-5 text-cyan-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedSearchIdx(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Type to search all settings (e.g. 'marble', 'room 2', 'magnitude', 'orbit', 'remediate', 'wheelchair')..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-slate-400 hover:text-white"
              >
                ESC
              </button>
            </div>

            {/* Quick Inline Sliders inside Cmd+P */}
            <div className="grid grid-cols-2 gap-3 px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/80 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">
                  Magnitude:{" "}
                  <strong className="text-amber-300">
                    {roomScene.earthquake.magnitude_mw.toFixed(1)} Mw
                  </strong>
                </span>
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
                  className="w-28 accent-amber-400"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">
                  Floor:{" "}
                  <strong className="text-cyan-300">
                    Floor {roomScene.room.floor_level} ({currentPgaG}g)
                  </strong>
                </span>
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
                  className="w-28 accent-cyan-400"
                />
              </div>
            </div>

            {/* Filtered Settings List */}
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800/60">
              {filteredSearchItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  No settings matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredSearchItems.map((item, idx) => {
                  const isSelected = idx === selectedSearchIdx;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedSearchIdx(idx)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition ${
                        isSelected
                          ? "bg-cyan-500/15 border-l-4 border-cyan-400"
                          : "hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {item.category}
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                          item.active
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {item.active && <Check className="h-3 w-3" />}
                        {item.badge}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Hints */}
            <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Use <strong>↑↓</strong> to navigate • <strong>Enter</strong> to
                apply setting • <strong>⌘P</strong> to toggle anytime
              </span>
              <span>{filteredSearchItems.length} settings available</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN FULL-SCREEN 3D VIEWPORT                                         */}
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
                floorMaterial={floorMaterial}
                teleportRoomId={teleportRoomId}
                playerResetCounter={playerResetCounter}
                showItemLabels={showItemLabels}
                titleBadge="BEFORE: UNSAFE SUITE (Top-Loaded Shelf + Unanchored Hazards)"
              />
              <QuakeRoomCanvas
                scene={remediatedScene || STUDENT_BEDROOM_REMEDIATED}
                evaluation={remediatedEvaluation}
                isShaking={isShaking}
                hasCollapsed={true}
                walkthroughActive={roomWalkthrough}
                fullScreen={fullScreenMode}
                floorMaterial={floorMaterial}
                teleportRoomId={teleportRoomId}
                playerResetCounter={playerResetCounter}
                showItemLabels={showItemLabels}
                titleBadge="AFTER: RENTER-SAFE FIX (Ballast Lowered + Optimal Path Clear)"
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
              floorMaterial={floorMaterial}
              teleportRoomId={teleportRoomId}
              playerResetCounter={playerResetCounter}
              showItemLabels={showItemLabels}
              titleBadge={`4-Room Connected Suite • Floor ${roomScene.room.floor_level} • ${roomScene.earthquake.magnitude_mw.toFixed(1)} Mw (${currentPgaG}g PGA)`}
            />
          )
        ) : (
          <ExitZeroCanvas
            floorGraph={floorGraph}
            hazards={liveHazards}
            verification={evacuationResult}
            walkthroughActive={buildingWalkthrough}
            fullScreen={fullScreenMode}
            playerResetCounter={playerResetCounter}
            showItemLabels={showItemLabels}
          />
        )}
      </div>

      {/* ==================================================================== */}
      {/* POP-UP FULL SETTINGS MENU DRAWER (ALL SETTINGS IN ONE UNIFIED MENU)  */}
      {/* ==================================================================== */}
      {menuOpen && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl overflow-y-auto p-6 pt-20 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">
                All Settings, Rooms & Physics Telemetry
              </h2>
              <p className="text-xs text-slate-400">
                Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">⌘P</kbd> anytime to search settings instantly.
              </p>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 0. Quick Display, Camera, Room Teleport & Floor Material Controls */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Display Mode, Camera View & Room Teleport
            </h3>

            {/* Display Mode Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActivePlan("PLAN_B")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activePlan === "PLAN_B"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                🏠 4-Room Suite
              </button>
              <button
                onClick={() => setActivePlan("PLAN_C")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activePlan === "PLAN_C"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                🏢 3D Building Wing
              </button>
            </div>

            {/* Camera View & Fullscreen */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleFirstPersonView}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  isFirstPersonActive
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : "bg-slate-800 text-slate-200 border-slate-700"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {isFirstPersonActive
                  ? "1st-Person Walkthrough"
                  : "3D Dollhouse Orbit"}
              </button>
              <button
                onClick={() => {
                  const nextName = cyclePreferredHumanVoice();
                  setVoiceLabel(nextName);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span className="truncate">Voice: {voiceLabel}</span>
              </button>
            </div>

            {/* 3D Item Label Popups Toggle (Off by default, opt-in via Menu) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-200">
                  3D Item Label Popups
                </div>
                <div className="text-[11px] text-slate-400">
                  Show floating name & safety tags above 3D furniture & obstacles
                </div>
              </div>
              <button
                onClick={() => setShowItemLabels((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  showItemLabels
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                {showItemLabels ? "Labels: ON" : "Labels: OFF"}
              </button>
            </div>

            {/* Teleport Player Across Connected Rooms */}
            {activePlan === "PLAN_B" && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5">
                  Teleport Player to Room (or walk freely through doorways with WASD):
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "room_1", label: "Rm 1: Student Bedroom" },
                    { id: "room_2", label: "Rm 2: Central Lounge" },
                    { id: "room_3", label: "Rm 3: Server & Lab" },
                    { id: "room_4", label: "Rm 4: North Exit Wing" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setTeleportRoomId(r.id);
                        setPlayerResetCounter((c) => c + 1);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
                        teleportRoomId === r.id
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <Navigation className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Memory Palace 3D Surface Material Selector */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5">
                3D Architectural Floor Surface Material:
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { id: "wood", label: "Wood" },
                    { id: "marble", label: "Marble" },
                    { id: "stone", label: "Stone" },
                    { id: "carpet", label: "Carpet" },
                    { id: "cyber", label: "Cyber" },
                  ] as const
                ).map((mat) => (
                  <button
                    key={mat.id}
                    onClick={() => setFloorMaterial(mat.id)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold border transition ${
                      floorMaterial === mat.id
                        ? "bg-amber-500 text-slate-950 border-amber-300"
                        : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    {mat.label}
                  </button>
                ))}
              </div>
            </div>
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
                  <span className="text-[11px] text-slate-400">
                    Vision → 3D Graph
                  </span>
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
                    {isExtractingRoom
                      ? "Extracting 3D..."
                      : "Upload Photo / Video"}
                  </button>
                  <button
                    onClick={() => {
                      setRoomScene(STUDENT_BEDROOM_UNSAFE);
                      setRemediatedScene(null);
                      setSplitScreenCompare(false);
                      setHasCollapsed(false);
                      setPlayerResetCounter((c) => c + 1);
                    }}
                    className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Unsafe Suite
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
                      Scanned & snapped to 3D floor grid via Deterministic
                      Sanitizer
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Gemini Live Voice Context & Physics Sliders */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mic className="h-4 w-4 text-cyan-400" />
                  2. Gemini Live Voice Constraints & Physics Sliders
                </h3>

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

              {/* 3. Self-Correcting Renter Remediation & Split Compare */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    3. Renter-Safe Remediation & Split Compare
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
                    {splitScreenCompare
                      ? "Split Compare: ON"
                      : "Split Compare: OFF"}
                  </button>
                </div>

                <button
                  onClick={handleSynthesizeRemediation}
                  disabled={isRemediating}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  {isRemediating
                    ? "Synthesizing Renter-Safe Fix..."
                    : "Apply Renter-Safe Remediation Fix"}
                </button>

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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Housner Overturning Telemetry */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Housner Overturning Safety Factors & Collision Objects
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
              {/* PLAN C BUILDING CONTROLS */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-cyan-400" />
                  1. Building Wing Controls, Hazards & Accessibility
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      setLiveHazards((prev) =>
                        prev.length > 0 ? [] : DEFAULT_LIVE_HAZARDS
                      )
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
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
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
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
                </div>

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
                    onChange={(e) => {
                      setUserStartNodeId(e.target.value);
                      setPlayerResetCounter((c) => c + 1);
                    }}
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

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="p-3 rounded-lg bg-red-950/25 border border-red-500/40 space-y-1">
                  <div className="text-xs font-bold text-red-300">
                    ❌ Naive Shortest Path (
                    {evacuationResult.naive_shortest_route.status})
                  </div>
                  <p className="text-xs text-slate-300">
                    {evacuationResult.naive_shortest_route.failure_reason}
                  </p>
                </div>

                {evacuationResult.verified_safe_route && (
                  <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/40 space-y-1">
                    <div className="text-xs font-bold text-emerald-300">
                      ✅ Verified Safe Route →{" "}
                      {evacuationResult.verified_safe_route.target_exit_label}
                    </div>
                    <p className="text-xs text-emerald-200">
                      &ldquo;
                      {evacuationResult.verified_safe_route.turn_by_turn_voice}
                      &rdquo;
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
