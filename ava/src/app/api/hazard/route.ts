import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_LIVE_HAZARDS } from "@/presets/mockRooms";
import { LiveHazardEvent } from "@/types/contracts";

const HAZARD_PROMPT = `You are a Live Emergency Corridor Hazard Spotter powered by Gemini 4 Argon.
Given a camera frame and/or voice report from inside a building during an emergency, output a JSON object with:
- "hazard": LiveHazardEvent ({ id, hazard_type: "structural_debris" | "fire_smoke" | "crowd_bottleneck", location_node_id, affected_edge_ids, spread_rate_m_per_s, severity: "blocked" | "slow_crawl", detected_from: "live_camera" | "voice_report", description })
- "lift_requested": boolean (true if the user asked for the lift or elevator)
Return ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64 = "", voiceTranscript = "" } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    const lowerVoice = (voiceTranscript as string).toLowerCase();
    const liftRequested =
      lowerVoice.includes("lift") || lowerVoice.includes("elevator");

    if (!apiKey || (!imageBase64 && !voiceTranscript)) {
      return NextResponse.json({
        hazard: DEFAULT_LIVE_HAZARDS[0],
        lift_requested: liftRequested,
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = process.env.GEMINI_MODEL_ID || "gemini-2.5-flash";

    const parts: Array<
      | string
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
    > = [];

    if (imageBase64) {
      const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: clean,
        },
      });
    }

    parts.push(
      `Voice Transcript: "${voiceTranscript}"\nAvailable Building Nodes: room_301, room_302, room_304, junc_west, junc_central, junc_east, lift_central, stair_east, stair_west, refuge_r2.\nExtract LiveHazardEvent JSON.`
    );

    const response = await ai.models.generateContent({
      model: modelId,
      contents: parts,
      config: {
        systemInstruction: HAZARD_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "") as {
      hazard?: LiveHazardEvent;
      lift_requested?: boolean;
    };

    return NextResponse.json({
      hazard: parsed.hazard || DEFAULT_LIVE_HAZARDS[0],
      lift_requested: parsed.lift_requested ?? liftRequested,
      modelUsed: modelId,
    });
  } catch {
    return NextResponse.json({
      hazard: DEFAULT_LIVE_HAZARDS[0],
      lift_requested: true,
    });
  }
}
