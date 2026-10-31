import { NextRequest, NextResponse } from "next/server";
import { ActivePlanMode } from "@/types/contracts";
import { extractSpatialSceneFromMedia } from "@/vision";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode: ActivePlanMode = body.mode === "plan_c" ? "plan_c" : "plan_b";
    const result = await extractSpatialSceneFromMedia({
      mode,
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      voiceContextPrompt: body.voiceContextPrompt,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to extract spatial scene", details: String(err) },
      { status: 500 }
    );
  }
}
