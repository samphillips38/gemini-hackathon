import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { sanitizeRoomScene } from "@/solver/roomVerifier";
import { PRESET_ROOMS } from "@/presets/mockRooms";
import { RoomSceneGraph } from "@/types/contracts";

const SYSTEM_PROMPT = `You are a 3D Structural & Spatial Vision Engineer powered by Gemini.
Given one or more images/keyframes of an indoor room and optional user voice context, extract a metric 3D RoomSceneGraph in strict JSON format.

 Coordinate System Rules:
- Room SW corner is (0, 0), X goes West-to-East [0, width_m], Z goes North-to-South [0, depth_m].
- Floor-standing objects have "parent_id": null.
- Items resting on a bookshelf or desk MUST set "parent_id" to that bookshelf/desk's id and set "shelf_level" to "top" | "middle" | "bottom".
- Always include at least one "exit_door" on the room perimeter, one occupant start ("bed" or "chair" with "is_occupant_start": true), and realistic masses in kg.
- Valid categories ONLY: "bed", "bookshelf", "wardrobe", "desk", "chair", "tv_monitor", "heavy_item", "fragile_glass", "window", "exit_door", "lift_door", "hazard_zone".

Return ONLY valid JSON matching the RoomSceneGraph interface.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imagesBase64 = [],
      voiceTranscript = "",
      floorLevel = 9,
      renterNoDrill = true,
      magnitudeMw = 6.8,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          warning:
            "GEMINI_API_KEY not found in .env.local — loaded calibrated 3D room twin with your voice parameters applied.",
          scene: sanitizeRoomScene({
            ...PRESET_ROOMS.student_dorm,
            name: "Scanned Room (Calibrated Twin)",
            room: {
              ...PRESET_ROOMS.student_dorm.room,
              floor_level: Number(floorLevel) || 9,
              renter_no_drill: Boolean(renterNoDrill),
            },
            earthquake: {
              ...PRESET_ROOMS.student_dorm.earthquake,
              magnitude_mw: Number(magnitudeMw) || 6.8,
            },
          }),
        },
        { status: 200 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = process.env.GEMINI_MODEL_ID || "gemini-2.5-pro";

    const imageParts = (imagesBase64 as string[]).slice(0, 3).map((b64: string) => {
      const clean = b64.includes(",") ? b64.split(",")[1] : b64;
      return {
        inlineData: {
          mimeType: "image/jpeg",
          data: clean,
        },
      };
    });

    const userPrompt = `Extract the 3D RoomSceneGraph JSON from these room camera frames.
User Voice Context: "${voiceTranscript || "9th floor apartment, renter (no wall drilling), heavy items on top shelf."}"
Floor Level: ${floorLevel}
Renter No-Drill Constraint: ${renterNoDrill}
Target Earthquake Magnitude: ${magnitudeMw}

Required JSON shape example:
${JSON.stringify(PRESET_ROOMS.student_dorm, null, 2)}`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [...imageParts, userPrompt],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text || "";
    const parsed = JSON.parse(rawText) as RoomSceneGraph;
    const sanitized = sanitizeRoomScene(parsed);

    return NextResponse.json({ scene: sanitized, modelUsed: modelId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown extraction error";
    return NextResponse.json(
      {
        error: message,
        scene: sanitizeRoomScene(PRESET_ROOMS.student_dorm),
      },
      { status: 200 }
    );
  }
}
