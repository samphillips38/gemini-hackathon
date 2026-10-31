import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { sanitizeRoomScene } from "@/vision/sceneSanitizer";
import { STUDENT_BEDROOM_UNSAFE } from "@/presets/demoPresets";
import { RoomSceneGraph } from "@/types/contracts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageBase64,
      mimeType = "image/jpeg",
      voiceTranscript = "",
      floorLevel = 10,
      renterNoDrill = true,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // Deterministic fallback using preset modified by voice parameters
      const presetCopy: RoomSceneGraph = JSON.parse(
        JSON.stringify(STUDENT_BEDROOM_UNSAFE)
      );
      presetCopy.room.floor_level = Number(floorLevel) || 10;
      presetCopy.room.renter_no_drill = Boolean(renterNoDrill);
      return NextResponse.json({
        scene: sanitizeRoomScene(presetCopy),
        source: "preset_fallback_no_api_key",
      });
    }

    const client = new GoogleGenAI({ apiKey });

    const prompt = `You are a 3D Spatial & Seismic Engineering Scene Extractor (Gemini 4 Argon).
Analyze the provided room image/video frame and user voice context: "${voiceTranscript}".
Extract a complete RoomSceneGraph JSON object matching this exact TypeScript structure:
{
  "room": { "width_m": 4.4, "depth_m": 4.0, "height_m": 2.7, "floor_level": ${floorLevel}, "renter_no_drill": ${renterNoDrill} },
  "earthquake": { "magnitude_mw": 6.8, "duration_s": 6.0, "dominant_axis": "XZ" },
  "objects": [
    {
      "id": "bed_1",
      "category": "bed" | "bookshelf" | "wardrobe" | "desk" | "chair" | "tv_monitor" | "heavy_item" | "fragile_glass" | "window" | "exit_door",
      "label": "descriptive label",
      "parent_id": null,
      "shelf_level": "top" | "middle" | "bottom",
      "x_m": number,
      "z_m": number,
      "width_m": number,
      "height_m": number,
      "depth_m": number,
      "rotation_deg": 0 | 90 | 180 | 270,
      "mass_kg": number,
      "anchored_to_wall": boolean,
      "is_fragile": boolean,
      "is_occupant_start": boolean
    }
  ]
}
Include at least a bed, bookshelf (with heavy_item child on top shelf if mentioned or visible), wardrobe near the exit_door, desk, chair, window, and exit_door. Return ONLY valid JSON.`;

    const inputParts: Array<
      | { type: "text"; text: string }
      | { type: "image"; data: string; mime_type: string }
    > = [{ type: "text", text: prompt }];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      inputParts.push({
        type: "image",
        data: cleanBase64,
        mime_type: mimeType,
      });
    }

    const interaction = await client.interactions.create({
      model: "gemini-4-argon",
      input: inputParts,
    });

    const rawText = interaction.output_text || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Gemini output");
    }

    const parsed = JSON.parse(jsonMatch[0]) as RoomSceneGraph;
    const sanitized = sanitizeRoomScene(parsed);

    return NextResponse.json({
      scene: sanitized,
      source: "gemini-4-argon",
    });
  } catch (error) {
    console.warn("Vision extract fallback triggered:", error);
    return NextResponse.json({
      scene: sanitizeRoomScene(STUDENT_BEDROOM_UNSAFE),
      source: "fallback_preset",
    });
  }
}
