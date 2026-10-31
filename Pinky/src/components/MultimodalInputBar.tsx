"use client";

import React, { useState } from "react";
import { ActivePlanMode } from "@/types/contracts";

interface MultimodalInputBarProps {
  mode: ActivePlanMode;
  onVoiceSubmitted: (transcript: string) => void;
  onImageUploaded: (base64: string, mimeType: string) => void;
  isExtracting: boolean;
  lastSpokenResponse: string;
}

export function MultimodalInputBar({
  mode,
  onVoiceSubmitted,
  onImageUploaded,
  isExtracting,
  lastSpokenResponse,
}: MultimodalInputBarProps) {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  const handleMicClick = () => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRec) {
      const fallback =
        mode === "plan_b"
          ? "I live on the 10th floor, I'm a student renter so I can't drill into the walls, and the top shelf has 20 kilos of textbooks."
          : "Where is the lift? Smoke is spreading in the East Corridor!";
      setTranscript(fallback);
      onVoiceSubmitted(fallback);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRec as any)();
      recognition.lang = "en-GB";
      recognition.interimResults = false;
      setIsListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript || "";
        setTranscript(text);
        onVoiceSubmitted(text);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImageUploaded(reader.result, file.type || "image/jpeg");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition">
            <span>{isExtracting ? "Extracting 3D Scene..." : "📷 Scan Room / Floor Plan"}</span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <button
            type="button"
            onClick={handleMicClick}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition border ${
              isListening
                ? "bg-red-600 border-red-400 text-white animate-pulse"
                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100"
            }`}
          >
            {isListening ? "🎙️ Listening Live..." : "🎙️ Gemini Live Voice"}
          </button>
        </div>

        {/* 1-Click Stage-Safe Voice Prompts */}
        <div className="flex flex-wrap items-center gap-1.5">
          {mode === "plan_b" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  const t =
                    "I live on the 10th floor, I'm a student renter so I can't drill anything into the walls, and the top shelf has 20 kilos of textbooks.";
                  setTranscript(t);
                  onVoiceSubmitted(t);
                }}
                className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-[11px] text-amber-200"
              >
                ⚡ Demo Voice: &ldquo;10th Floor + Renter No-Drill + 20kg Top Shelf&rdquo;
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = "Floor 1 ground level, 5kg books on bottom shelf.";
                  setTranscript(t);
                  onVoiceSubmitted(t);
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300"
              >
                Floor 1 Baseline
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const t = "Where is the lift? There is smoke in the East Corridor!";
                  setTranscript(t);
                  onVoiceSubmitted(t);
                }}
                className="px-2.5 py-1 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-[11px] text-red-200"
              >
                ⚡ Demo Voice: &ldquo;Where is the lift? Smoke in East Corridor!&rdquo;
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = "I am in a wheelchair and need an accessible refuge route.";
                  setTranscript(t);
                  onVoiceSubmitted(t);
                }}
                className="px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-[11px] text-sky-200"
              >
                ♿ Wheelchair Accessible Mode
              </button>
            </>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (transcript.trim()) onVoiceSubmitted(transcript.trim());
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={
            mode === "plan_b"
              ? 'Speak or type invisible constraints (e.g., "10th floor, student renter no drill, 20kg books on top shelf")...'
              : 'Speak or type live evacuation report (e.g., "Where is the lift? Smoke blocking East Corridor")...'
          }
          className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
        >
          Apply Voice
        </button>
      </form>

      {lastSpokenResponse && (
        <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-800/50 rounded-lg px-3 py-1.5">
          <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
            Gemini Live TTS
          </span>
          <span>{lastSpokenResponse}</span>
        </div>
      )}
    </div>
  );
}
