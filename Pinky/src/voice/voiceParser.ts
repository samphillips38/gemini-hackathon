import {
  RoomSceneGraph,
  SharedVoiceConstraintUpdate,
} from "@/types/contracts";

// ============================================================================
// COMMON VOICE PARSER & TTS (Works for Plan B QuakeRoom & Plan C ExitZero)
// ============================================================================

export function parseVoiceTranscriptToConstraints(
  transcript: string
): SharedVoiceConstraintUpdate {
  const lower = transcript.toLowerCase();
  const update: SharedVoiceConstraintUpdate = {
    transcript,
    spoken_response: "Voice constraints locked into deterministic physics verifier.",
  };

  // 1. Floor level extraction ("10th floor", "floor 9", "level 12")
  const floorMatch =
    lower.match(/(\d+)\s*(?:st|nd|rd|th)?\s*floor/) ||
    lower.match(/floor\s*(\d+)/) ||
    lower.match(/level\s*(\d+)/);
  if (floorMatch) {
    const fl = parseInt(floorMatch[1], 10);
    if (!Number.isNaN(fl) && fl >= 1 && fl <= 80) {
      update.floor_level = fl;
    }
  }

  // 2. Renter / No-Drill constraint
  if (
    lower.includes("renter") ||
    lower.includes("renting") ||
    lower.includes("can't drill") ||
    lower.includes("cannot drill") ||
    lower.includes("no drill") ||
    lower.includes("student")
  ) {
    update.renter_no_drill = true;
  } else if (lower.includes("own the place") || lower.includes("can drill")) {
    update.renter_no_drill = false;
  }

  // 3. Heavy shelf load ("20 kilos of textbooks on the top shelf")
  const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos|kilograms)/);
  if (kgMatch || lower.includes("top shelf") || lower.includes("textbooks")) {
    const massKg = kgMatch ? parseFloat(kgMatch[1]) : 20;
    const shelfLevel: "bottom" | "middle" | "top" = lower.includes("bottom")
      ? "bottom"
      : lower.includes("middle")
      ? "middle"
      : "top";
    update.heavy_shelf_note = {
      target_category: "bookshelf",
      shelf_level: shelfLevel,
      mass_kg: massKg,
      label: `${massKg}kg Textbooks`,
    };
  }

  // 4. Plan C: Lift request detection
  if (lower.includes("lift") || lower.includes("elevator")) {
    update.requested_lift = true;
  }

  // 5. Plan C: Mobility mode detection
  if (
    lower.includes("wheelchair") ||
    lower.includes("accessible") ||
    lower.includes("crutches") ||
    lower.includes("can't use stairs")
  ) {
    update.mobility_mode = "wheelchair_accessible";
  }

  // 6. Plan C: Emergency type
  if (lower.includes("fire") || lower.includes("smoke")) {
    update.emergency_type = "fire";
  } else if (lower.includes("quake") || lower.includes("earthquake")) {
    update.emergency_type = "earthquake";
  }

  // 7. Build concise spoken confirmation
  const parts: string[] = [];
  if (update.floor_level !== undefined) {
    const amp = (1 + 0.12 * (update.floor_level - 1)).toFixed(2);
    parts.push(`Floor ${update.floor_level} set with ${amp}x sway amplification`);
  }
  if (update.renter_no_drill) {
    parts.push("Renter mode active: wall drilling disabled");
  }
  if (update.heavy_shelf_note) {
    parts.push(
      `${update.heavy_shelf_note.mass_kg}kg load registered on ${update.heavy_shelf_note.shelf_level} shelf`
    );
  }
  if (update.requested_lift) {
    parts.push(
      "Critical override: Lifts are locked out in seismic and fire emergencies; routing to fire-rated stairwell"
    );
  }
  if (update.mobility_mode === "wheelchair_accessible") {
    parts.push("Wheelchair accessible refuge routing enabled");
  }

  if (parts.length > 0) {
    update.spoken_response = parts.join(". ") + ".";
  }

  return update;
}

export function applyVoiceConstraintsToRoomScene(
  scene: RoomSceneGraph,
  voice: SharedVoiceConstraintUpdate
): RoomSceneGraph {
  const next: RoomSceneGraph = {
    room: {
      ...scene.room,
      floor_level: voice.floor_level ?? scene.room.floor_level,
      renter_no_drill:
        voice.renter_no_drill !== undefined
          ? voice.renter_no_drill
          : scene.room.renter_no_drill,
    },
    earthquake: { ...scene.earthquake },
    objects: scene.objects.map((o) => ({ ...o })),
  };

  if (voice.heavy_shelf_note) {
    const heavyItem = next.objects.find((o) => o.category === "heavy_item");
    if (heavyItem) {
      heavyItem.mass_kg = voice.heavy_shelf_note.mass_kg;
      heavyItem.shelf_level = voice.heavy_shelf_note.shelf_level;
      if (voice.heavy_shelf_note.label) {
        heavyItem.label = voice.heavy_shelf_note.label;
      }
    }
  }

  return next;
}

export function speakWithBrowserTTS(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.04;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore browser autoplay restrictions
  }
}
