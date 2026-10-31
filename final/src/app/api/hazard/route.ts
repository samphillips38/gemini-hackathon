import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_LIVE_HAZARDS } from "@/presets/demoPresets";
import { LiveHazardEvent } from "@/types/contracts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageBase64,
      mimeType = "image/jpeg",
      voiceReport = "",
      targetNodeId = "junc_east",
    } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    const baseHazard: LiveHazardEvent = {
      ...DEFAULT_LIVE_HAZARDS[0],
      id: `hazard_${Date.now()}`,
      location_node_id: targetNodeId,
      detected_from: imageBase64 ? "live_camera" : "voice_report",
    };

    if (!apiKey) {
      return NextResponse.json({
        hazard: baseHazard,
        lift_requested: /lift|elevator/i.test(voiceReport),
        source: "deterministic_hazard_detector",
      });
    }

    const client = new GoogleGenAI({ apiKey });
    const inputParts: Array<
      | { type: "text"; text: string }
      | { type: "image"; data: string; mime_type: string }
    > = [
      {
        type: "text",
        text: `You are a Live Egocentric Hazard Spotter for building evacuation (Gemini 4 Argon).
Voice report: "${voiceReport}".
Classify the corridor hazard into JSON:
{
  "hazard_type": "structural_debris" | "fire_smoke" | "crowd_bottleneck",
  "spread_rate_m_per_s": number,
  "description": "concise 1-sentence hazard description",
  "lift_requested": boolean
}`,
      },
    ];

    if (imageBase64) {
      inputParts.push({
        type: "image",
        data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
        mime_type: mimeType,
      });
    }

    const interaction = await client.interactions.create({
      model: "gemini-4-argon",
      input: inputParts,
    });

    const match = (interaction.output_text || "").match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      baseHazard.hazard_type = parsed.hazard_type || "structural_debris";
      baseHazard.spread_rate_m_per_s = Number(parsed.spread_rate_m_per_s ?? 0.45);
      baseHazard.description = parsed.description || baseHazard.description;
      return NextResponse.json({
        hazard: baseHazard,
        lift_requested: Boolean(
          parsed.lift_requested || /lift|elevator/i.test(voiceReport)
        ),
        source: "gemini-4-argon",
      });
    }

    return NextResponse.json({
      hazard: baseHazard,
      lift_requested: /lift|elevator/i.test(voiceReport),
      source: "gemini-4-argon-default",
    });
  } catch (error) {
    console.warn("Hazard API fallback:", error);
    return NextResponse.json({
      hazard: DEFAULT_LIVE_HAZARDS[0],
      lift_requested: true,
      source: "fallback_hazard",
    });
  }
}
