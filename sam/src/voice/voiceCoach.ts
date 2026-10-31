"use client";

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

  // Match floor level e.g. "10th floor", "floor 8", "ninth floor"
  const floorMatch = lower.match(/(\d+)(?:st|nd|rd|th)?\s*floor|floor\s*(\d+)/);
  if (floorMatch) {
    result.floorLevel = parseInt(floorMatch[1] || floorMatch[2], 10);
  } else if (lower.includes("tenth")) {
    result.floorLevel = 10;
  } else if (lower.includes("eighth")) {
    result.floorLevel = 8;
  } else if (lower.includes("ninth")) {
    result.floorLevel = 9;
  }

  // Match renter / no drill constraints
  if (
    lower.includes("rent") ||
    lower.includes("no drill") ||
    lower.includes("can't drill") ||
    lower.includes("cannot drill") ||
    lower.includes("unbolted")
  ) {
    result.renterNoDrill = true;
  }

  // Match heavy top shelf items
  const kgMatch = lower.match(/(\d+)\s*(?:kg|kilo|kilos|kilograms)/);
  if (kgMatch) {
    result.heavyTopShelfKg = parseInt(kgMatch[1], 10);
  } else if (lower.includes("heavy") && lower.includes("top")) {
    result.heavyTopShelfKg = 20;
  }

  // Plan C: Lift request
  if (lower.includes("lift") || lower.includes("elevator")) {
    result.askedForLift = true;
  }

  // Plan C: Wheelchair / Accessibility mode
  if (
    lower.includes("wheelchair") ||
    lower.includes("mobility") ||
    lower.includes("can't use stairs") ||
    lower.includes("cannot use stairs")
  ) {
    result.wheelchairMode = true;
  }

  // Plan C: Corridor blockage
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
    utterance.rate = urgent ? 1.08 : 1.02;
    utterance.pitch = urgent ? 1.05 : 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Speech synthesis unavailable:", e);
  }
}
