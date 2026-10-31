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
 * Converts technical abbreviations/units into warm, natural human speech
 */
function humanizeSpeechText(raw: string): string {
  return raw
    .replace(/•/g, ", ")
    .replace(/\bSF\b/g, "safety factor")
    .replace(/(\d+(?:\.\d+)?)\s*Mw\b/gi, "magnitude $1")
    .replace(/(\d+(?:\.\d+)?)\s*kg\b/gi, "$1 kilograms")
    .replace(/(\d+(?:\.\d+)?)\s*m\/s\b/gi, "$1 meters per second")
    .replace(/(\d+(?:\.\d+)?)\s*m\b/g, "$1 meters")
    .replace(/(\d+(?:\.\d+)?)\s*g\b/g, "$1 G")
    .replace(/\bCAGB\b/g, "City and Guilds Building")
    .replace(/\bA\*/g, "A-star")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ranks browser voices from most natural/neural human-sounding to fallback
 */
function scoreVoiceNaturalness(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();
  if (!lang.startsWith("en")) return -100;

  let score = 0;

  // Tier 1: Microsoft Edge / Windows 11 Neural Natural Online voices (extremely human-like)
  if (name.includes("natural")) score += 120;
  if (name.includes("online")) score += 60;
  if (name.includes("neural")) score += 90;

  // Specific top-rated natural voices
  if (name.includes("sonia")) score += 55;
  if (name.includes("aria")) score += 52;
  if (name.includes("jenny")) score += 50;
  if (name.includes("libby")) score += 48;
  if (name.includes("ryan")) score += 46;
  if (name.includes("guy")) score += 44;

  // Tier 2: Google Chrome High-Quality Cloud voices
  if (name.includes("google uk english female")) score += 85;
  else if (name.includes("google us english")) score += 80;
  else if (name.includes("google uk english male")) score += 75;
  else if (name.includes("google")) score += 65;

  // Tier 3: Apple macOS/iOS Enhanced / Premium voices
  if (name.includes("premium") || name.includes("enhanced")) score += 75;
  if (name.includes("samantha") || name.includes("ava") || name.includes("allison")) score += 45;
  if (name.includes("daniel") || name.includes("karen") || name.includes("moira")) score += 40;

  // Tier 4: Prefer smoother UK/US voices over old robotic Microsoft David
  if (name.includes("hazel") || name.includes("susan") || name.includes("george")) score += 25;
  if (name.includes("zira")) score += 20;
  if (name.includes("david")) score -= 30;

  if (lang === "en-gb" || lang === "en-us") score += 10;

  return score;
}

let cachedVoiceIndex = 0;

export function getRankedHumanVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = englishVoices.length > 0 ? englishVoices : voices;
  return [...pool].sort((a, b) => scoreVoiceNaturalness(b) - scoreVoiceNaturalness(a));
}

export function cyclePreferredHumanVoice(): string {
  const ranked = getRankedHumanVoices();
  if (ranked.length === 0) return "Default System Voice";
  cachedVoiceIndex = (cachedVoiceIndex + 1) % Math.min(ranked.length, 6);
  const chosen = ranked[cachedVoiceIndex];
  speakCoachMessage(
    `Hi, I'm your Spatial Safety Coach. I'll guide you through the room and building in real time.`,
    false
  );
  return chosen.name.replace(/Microsoft |Online \(Natural\) - |Desktop - /g, "");
}

export function getCurrentHumanVoiceLabel(): string {
  const ranked = getRankedHumanVoices();
  if (ranked.length === 0) return "Natural Voice";
  const chosen = ranked[cachedVoiceIndex % ranked.length] || ranked[0];
  return chosen.name.replace(/Microsoft |Online \(Natural\) - |Desktop - /g, "");
}

/**
 * Expressive Human-Like Voice Coach output via Web Speech Neural/Cloud Voices
 */
export function speakCoachMessage(text: string, urgent = false): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();

    const cleanText = humanizeSpeechText(text);
    const sentences = cleanText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const ranked = getRankedHumanVoices();
    const chosenVoice =
      ranked.length > 0 ? ranked[cachedVoiceIndex % ranked.length] : null;

    sentences.forEach((sentence, idx) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang;
      }

      const isNeuralOrGoogle =
        chosenVoice &&
        (chosenVoice.name.toLowerCase().includes("natural") ||
          chosenVoice.name.toLowerCase().includes("google") ||
          chosenVoice.name.toLowerCase().includes("online"));

      utterance.rate = urgent ? (isNeuralOrGoogle ? 1.04 : 1.0) : isNeuralOrGoogle ? 0.98 : 0.95;
      utterance.pitch = urgent ? 1.03 : idx % 2 === 0 ? 1.02 : 0.99;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    });
  } catch (e) {
    console.warn("Speech synthesis unavailable:", e);
  }
}
