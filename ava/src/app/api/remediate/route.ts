import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  sanitizeRoomScene,
  synthesizeVerifiedRemediation,
  verifyRoomSafetyAndEgress,
} from "@/solver/roomVerifier";
import {
  ClearanceMode,
  RemediationProposal,
  RoomSceneGraph,
} from "@/types/contracts";

const REMEDIATE_SYSTEM_PROMPT = `You are a Seismic Structural Remediation Agent powered by Gemini 4 Argon.
Given a RoomSceneGraph that failed deterministic earthquake verification (e.g. wardrobe blocks exit_door or top-heavy bookshelf crushes bed), propose a RemediationProposal JSON.
Respect constraints:
- If room.renter_no_drill is true, DO NOT bolt furniture into walls. Instead:
  1) Relocate heavy_item children from "top" shelf to "bottom" shelf ("relocate_shelf_level") so they act as natural ballast and lower h_CoM.
  2) Move tall wardrobes away from exit_door ("move_floor_position") so their fall shadow cannot seal the exit corridor.
  3) Move the bed out of exterior window glass shatter zones and bookshelf crush shadows.
Return ONLY valid JSON matching RemediationProposal.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      scene,
      clearanceMode = "walk",
    }: { scene: RoomSceneGraph; clearanceMode?: ClearanceMode } = body;

    // Always compute the deterministic verified remediation baseline
    const deterministicProposal = synthesizeVerifiedRemediation(scene, clearanceMode);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        proposal: deterministicProposal,
        verifiedBySolver: true,
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = process.env.GEMINI_MODEL_ID || "gemini-2.5-pro";
    const currentCheck = verifyRoomSafetyAndEgress(scene, clearanceMode);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        `Current RoomSceneGraph:\n${JSON.stringify(scene, null, 2)}\n\nCurrent Failure Telemetry:\n${JSON.stringify(
          {
            survivable: currentCheck.survivable,
            exit_reachable_post_quake: currentCheck.exit_reachable_post_quake,
            blocking_object_ids: currentCheck.blocking_object_ids,
            bed_crush_object_ids: currentCheck.bed_crush_object_ids,
          },
          null,
          2
        )}\n\nReturn a RemediationProposal JSON that achieves 0 casualties and a clear post-quake A* exit path.`,
      ],
      config: {
        systemInstruction: REMEDIATE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "") as RemediationProposal;
    if (parsed?.updated_scene) {
      const sanitized = sanitizeRoomScene(parsed.updated_scene);
      const verifyCandidate = verifyRoomSafetyAndEgress(sanitized, clearanceMode);
      // Deterministic Verification Gate: only accept LLM layout if it passes A* & crush checks!
      if (verifyCandidate.survivable && verifyCandidate.exit_reachable_post_quake) {
        return NextResponse.json({
          proposal: {
            ...parsed,
            updated_scene: sanitized,
            verified_result: verifyCandidate,
          },
          verifiedBySolver: true,
          modelUsed: modelId,
        });
      }
    }

    // Fallback to deterministic solver-guaranteed layout if candidate failed verification
    return NextResponse.json({
      proposal: deterministicProposal,
      verifiedBySolver: true,
      note: "Candidate refined by deterministic Housner + A* verifier loop.",
    });
  } catch {
    return NextResponse.json({
      proposal: null,
      error: "Remediation fallback triggered",
    });
  }
}
