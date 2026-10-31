import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { IMPERIAL_FLOOR_GRAPH } from "@/presets/mockRooms";
import { BuildingFloorGraph } from "@/types/contracts";

const FLOORPLAN_PROMPT = `You are a 3D Architectural Floor-Plan Graph Extractor powered by Gemini.
Given an image of a building fire-exit floor plan, output a valid BuildingFloorGraph JSON object with:
- "building_name", "floor_number", "width_m", "depth_m"
- "walls": array of WallSegment ({ x1_m, z1_m, x2_m, z2_m, height_m, is_doorway })
- "nodes": array of NavNode ({ id, label, type: "room" | "corridor_junction" | "stairwell_exit" | "lift_elevator" | "accessible_refuge", x_m, z_m })
- "edges": array of NavEdge ({ id, from_node_id, to_node_id, length_m, width_m, is_stairs })

Always include at least one "lift_elevator", two "stairwell_exit" nodes, and one "accessible_refuge" node.
Return ONLY valid JSON matching BuildingFloorGraph.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64 = "" } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !imageBase64) {
      return NextResponse.json({
        warning:
          "Loaded calibrated Imperial College 3D Floor Graph (set GEMINI_API_KEY in .env.local for live floor-plan image extraction).",
        graph: IMPERIAL_FLOOR_GRAPH,
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = process.env.GEMINI_MODEL_ID || "gemini-2.5-pro";
    const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: clean,
          },
        },
        `Extract the 3D BuildingFloorGraph JSON matching this schema:\n${JSON.stringify(
          IMPERIAL_FLOOR_GRAPH,
          null,
          2
        )}`,
      ],
      config: {
        systemInstruction: FLOORPLAN_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "") as BuildingFloorGraph;
    if (!parsed.nodes || parsed.nodes.length === 0) {
      return NextResponse.json({ graph: IMPERIAL_FLOOR_GRAPH });
    }
    return NextResponse.json({ graph: parsed, modelUsed: modelId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Floorplan extraction fallback";
    return NextResponse.json({
      warning: message,
      graph: IMPERIAL_FLOOR_GRAPH,
    });
  }
}
