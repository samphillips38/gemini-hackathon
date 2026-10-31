import { GoogleGenAI } from "@google/genai";
import {
  ActivePlanMode,
  BuildingFloorGraph,
  LiveHazardEvent,
  RoomSceneGraph,
} from "@/types/contracts";
import {
  IMPERIAL_HUXLEY_FLOOR_GRAPH,
  IMPERIAL_LIVE_HAZARDS_PRESET,
  IMPERIAL_STUDENT_BEDROOM_UNSAFE,
} from "@/presets";
import {
  sanitizeBuildingFloorGraph,
  sanitizeRoomSceneGraph,
} from "./sanitizer";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

export async function extractSpatialSceneFromMedia(params: {
  mode: ActivePlanMode;
  imageBase64?: string;
  mimeType?: string;
  voiceContextPrompt?: string;
}): Promise<{
  mode: ActivePlanMode;
  roomScene?: RoomSceneGraph;
  buildingGraph?: BuildingFloorGraph;
  hazards?: LiveHazardEvent[];
  usedFallbackPreset: boolean;
}> {
  const { mode, imageBase64, mimeType = "image/jpeg", voiceContextPrompt } = params;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !imageBase64) {
    return mode === "plan_b"
      ? {
          mode,
          roomScene: sanitizeRoomSceneGraph(IMPERIAL_STUDENT_BEDROOM_UNSAFE),
          usedFallbackPreset: true,
        }
      : {
          mode,
          buildingGraph: sanitizeBuildingFloorGraph(IMPERIAL_HUXLEY_FLOOR_GRAPH),
          hazards: IMPERIAL_LIVE_HAZARDS_PRESET,
          usedFallbackPreset: true,
        };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

    if (mode === "plan_b") {
      const prompt = `You are a spatial physics perception engine for Plan B (QuakeRoom).
Extract a complete 3D RoomSceneGraph JSON from this room image/video frame.
Voice constraints provided by occupant: ${voiceContextPrompt || "Floor 10, student renter (no wall drilling), 20kg textbooks on top shelf."}
Return ONLY valid JSON matching the RoomSceneGraph TypeScript interface with room, earthquake, and objects[].`;

      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}") as RoomSceneGraph;
      if (parsed && Array.isArray(parsed.objects) && parsed.objects.length > 0) {
        return {
          mode,
          roomScene: sanitizeRoomSceneGraph(parsed),
          usedFallbackPreset: false,
        };
      }
    } else {
      const prompt = `You are a spatial evacuation graph extractor for Plan C (ExitZero).
Extract a BuildingFloorGraph JSON (building_name, floor_number, width_m, depth_m, walls[], nodes[], edges[]) from this floor plan sign or hallway photo.
Voice / camera context: ${voiceContextPrompt || "Floor 3, smoke detected in East Corridor."}
Return ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}") as BuildingFloorGraph;
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        return {
          mode,
          buildingGraph: sanitizeBuildingFloorGraph(parsed),
          hazards: IMPERIAL_LIVE_HAZARDS_PRESET,
          usedFallbackPreset: false,
        };
      }
    }
  } catch (err) {
    console.warn("[Vision Extractor] Falling back to gold preset:", err);
  }

  return mode === "plan_b"
    ? {
        mode,
        roomScene: sanitizeRoomSceneGraph(IMPERIAL_STUDENT_BEDROOM_UNSAFE),
        usedFallbackPreset: true,
      }
    : {
        mode,
        buildingGraph: sanitizeBuildingFloorGraph(IMPERIAL_HUXLEY_FLOOR_GRAPH),
        hazards: IMPERIAL_LIVE_HAZARDS_PRESET,
        usedFallbackPreset: true,
      };
}
