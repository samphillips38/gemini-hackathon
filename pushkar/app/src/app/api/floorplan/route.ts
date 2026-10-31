import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { IMPERIAL_FLOOR_GRAPH } from "@/presets/demoPresets";
import { BuildingFloorGraph } from "@/types/contracts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", buildingName } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey || !imageBase64) {
      return NextResponse.json({
        floorGraph: {
          ...IMPERIAL_FLOOR_GRAPH,
          building_name: buildingName || IMPERIAL_FLOOR_GRAPH.building_name,
        },
        source: "imperial_venue_preset",
      });
    }

    const client = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

    const prompt = `Analyze this 2D building fire-evacuation floor plan sign.
Extract the building name or zone and confirm if it contains rooms, corridors, lifts/elevators, and fire exits.
Return JSON: { "building_name": string, "floor_number": number }`;

    const interaction = await client.interactions.create({
      model: "gemini-4-argon",
      input: [
        { type: "text", text: prompt },
        { type: "image", data: cleanBase64, mime_type: mimeType },
      ],
    });

    let customName = IMPERIAL_FLOOR_GRAPH.building_name;
    let customFloor = IMPERIAL_FLOOR_GRAPH.floor_number;
    const match = (interaction.output_text || "").match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.building_name) customName = parsed.building_name;
      if (parsed.floor_number) customFloor = Number(parsed.floor_number);
    }

    const floorGraph: BuildingFloorGraph = {
      ...IMPERIAL_FLOOR_GRAPH,
      building_name: customName,
      floor_number: customFloor,
    };

    return NextResponse.json({
      floorGraph,
      source: "gemini-4-argon",
    });
  } catch (error) {
    console.warn("Floorplan API fallback:", error);
    return NextResponse.json({
      floorGraph: IMPERIAL_FLOOR_GRAPH,
      source: "fallback_imperial_preset",
    });
  }
}
