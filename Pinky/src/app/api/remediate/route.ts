import { NextRequest, NextResponse } from "next/server";
import {
  parseVoiceTranscriptToConstraints,
  synthesizeVerifiedRemediation,
} from "@/voice";
import { IMPERIAL_STUDENT_BEDROOM_UNSAFE } from "@/presets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.transcript) {
      const voiceUpdate = parseVoiceTranscriptToConstraints(
        String(body.transcript)
      );
      return NextResponse.json({ voiceUpdate });
    }

    const scene = body.scene || IMPERIAL_STUDENT_BEDROOM_UNSAFE;
    const result = await synthesizeVerifiedRemediation({
      scene,
      currentVerification: body.currentVerification,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to run remediation", details: String(err) },
      { status: 500 }
    );
  }
}
