"use client";

import { EgressAndShelterResult, EvacuationVerificationResult } from "@/types/contracts";
import { seismicAudio } from "@/voice/seismicAudioSynth";

export interface ParsedVoiceCommand {
  floorLevel?: number;
  renterNoDrill?: boolean;
  heavyTopShelfKg?: number;
  askedForLift?: boolean;
  wheelchairMode?: boolean;
  roomLocation?: string;
  eastCorridorBlocked?: boolean;
}

/**
 * Parses natural spoken commands for Plan B (QuakeRoom) and Plan C (ExitZero)
 */
export function parseVoiceConstraintTranscript(transcript: string): ParsedVoiceCommand {
  const lower = transcript.toLowerCase();
  const result: ParsedVoiceCommand = {};

  const floorMatch = lower.match(/(\d+)(?:st|nd|rd|th)?\s*floor|floor\s*(\d+)/);
  if (floorMatch) {
    result.floorLevel = parseInt(floorMatch[1] || floorMatch[2], 10);
  } else if (lower.includes("tenth")) {
    result.floorLevel = 10;
  } else if (lower.includes("eighth")) {
    result.floorLevel = 8;
  } else if (lower.includes("ninth")) {
    result.floorLevel = 9;
  } else if (lower.includes("second") || lower.includes("level 2") || lower.includes("l2")) {
    result.floorLevel = 2;
  }

  if (
    lower.includes("rent") ||
    lower.includes("no drill") ||
    lower.includes("can't drill") ||
    lower.includes("cannot drill") ||
    lower.includes("unbolted")
  ) {
    result.renterNoDrill = true;
  }

  const kgMatch = lower.match(/(\d+)\s*(?:kg|kilo|kilos|kilograms)/);
  if (kgMatch) {
    result.heavyTopShelfKg = parseInt(kgMatch[1], 10);
  } else if (lower.includes("heavy") && lower.includes("top")) {
    result.heavyTopShelfKg = 20;
  }

  if (lower.includes("lift") || lower.includes("elevator")) {
    result.askedForLift = true;
  }

  if (
    lower.includes("wheelchair") ||
    lower.includes("mobility") ||
    lower.includes("step-free") ||
    lower.includes("can't use stairs") ||
    lower.includes("cannot use stairs")
  ) {
    result.wheelchairMode = true;
  }

  if (lower.includes("east") || lower.includes("blocked") || lower.includes("collapsed")) {
    result.eastCorridorBlocked = true;
  }

  return result;
}

/**
 * Expressive Voice Coach output via Web Speech API (with automatic voice selection)
 */
export function speakCoachMessage(text: string, urgent = false): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Samantha") ||
          v.name.includes("Google") ||
          v.name.includes("Natural") ||
          v.name.includes("Daniel"))
    );
    if (preferred) utterance.voice = preferred;
    utterance.rate = urgent ? 1.09 : 1.02;
    utterance.pitch = urgent ? 1.06 : 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Speech synthesis unavailable:", e);
  }
}

/**
 * Generates and speaks 2-Phase Seismic Safety Coaching for Plan B (QuakeRoom):
 * Phase 1 (DURING Shaking): Drop, Cover & Hold On under sturdy desk (never run to doors/lifts while shaking)
 * Phase 2 (AFTER Shaking Stops): Post-Collapse A* Egress & Zero-Drill Ballast Remediation
 */
export function buildTwoPhaseRoomCoachingScript(
  evalResult: EgressAndShelterResult,
  phase: "PHASE_1_SHAKING" | "PHASE_2_POST_COLLAPSE" | "REMEDIATED_PASS"
): string {
  const shelterLabel = evalResult.safe_shelter_spot_m?.label || "the steel-frame study desk";
  const shelterTime = evalResult.shelter_reach_time_s.toFixed(1);
  const walkPct = evalResult.monte_carlo
    ? Math.round(evalResult.monte_carlo.exit_reachable_p.walk * 100)
    : evalResult.exit_reachable_post_quake
    ? 100
    : 12;
  const chairPct = evalResult.monte_carlo
    ? Math.round(evalResult.monte_carlo.exit_reachable_p.wheelchair * 100)
    : evalResult.wheelchair_reachable_post_quake
    ? 100
    : 0;

  if (phase === "PHASE_1_SHAKING") {
    return `Phase 1, P-wave and S-wave shaking active! Do not run for the door or lifts during shaking. Drop, Cover, and Hold On under ${shelterLabel}—reachable in ${shelterTime} seconds, clear of window glass shatter.`;
  }

  if (phase === "REMEDIATED_PASS") {
    return `Phase 2 verified after zero-drill ballast remediation! Moving 20 kilograms of textbooks to the bottom shelf lowered the center of mass and kept the bookshelf upright. Across 50 Monte Carlo quakes, walking exit clearance is now ${walkPct} percent and step-free wheelchair clearance is ${chairPct} percent.`;
  }

  if (!evalResult.survivable) {
    return `Phase 2 post-collapse hazard alert! Once shaking stops, the unbolted wardrobe and top-heavy bookshelf overturn across the exit corridor. Walking exit reachability across 50 simulated quakes drops to ${walkPct} percent, and wheelchair clearance is ${chairPct} percent. Trigger Gemini 4 Argon zero-drill remediation to clear your escape route.`;
  }

  return `Phase 2 post-collapse check complete. Shaking has stopped. Follow the verified green A-star path to the corridor fire exit door; never use lifts.`;
}

/**
 * Generates and triggers audio + spoken coaching for Plan C (ExitZero)
 */
export function announcePlanCEvacuationCoaching(
  evac: EvacuationVerificationResult
): string {
  if (evac.lift_override_triggered) {
    seismicAudio.playLiftLockoutSiren(1.2);
  } else if (evac.verified_safe_route) {
    seismicAudio.playVerificationPassChime();
  }

  const baseVoice = evac.verified_safe_route
    ? evac.verified_safe_route.turn_by_turn_voice
    : "Critical alert: all primary corridors blocked. Hold at closest structural refuge point.";

  const prefix = evac.lift_override_triggered
    ? "Lift Lockout Override active! Never use CAGB central lifts during seismic or fire events. "
    : "";

  const fullText = `${prefix}${baseVoice}`;
  speakCoachMessage(fullText, evac.lift_override_triggered);
  return fullText;
}
