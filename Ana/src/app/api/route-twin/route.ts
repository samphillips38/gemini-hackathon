import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { FALLBACK_ROUTE_A_SCENE } from "@/scene3d/cagbRouteTwinModels";

export const dynamic = "force-dynamic";

function getRepoRoot(): string {
  const cwd = process.cwd();
  if (path.basename(cwd) === "sam") {
    return path.resolve(cwd, "..");
  }
  return cwd;
}

export async function GET(req: NextRequest) {
  const repoRoot = getRepoRoot();
  const { searchParams } = new URL(req.url);

  // 1. Serve slava/viewer/models.js directly as an ES module if requested
  const moduleParam = searchParams.get("module");
  if (moduleParam === "models.js") {
    const modelsPath = path.join(repoRoot, "slava", "viewer", "models.js");
    if (fs.existsSync(modelsPath)) {
      const jsContent = fs.readFileSync(modelsPath, "utf8");
      return new NextResponse(jsContent, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
    return new NextResponse("// slava/viewer/models.js not on disk yet\nexport const __fallback = true;\n", {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // 2. Serve evidence frame image from slava/route_A/evidence/<frame> if requested
  const frameParam = searchParams.get("frame");
  if (frameParam) {
    const safeName = path.basename(frameParam);
    const framePath = path.join(repoRoot, "slava", "route_A", "evidence", safeName);
    if (fs.existsSync(framePath)) {
      const buf = fs.readFileSync(framePath);
      const ext = path.extname(safeName).toLowerCase();
      const mime =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json({ error: "Evidence frame not found on disk yet" }, { status: 404 });
  }

  // 3. Load slava/route_A/scene.json + pushkar/argon_verification.json + check slava/viewer/models.js
  const scenePath = path.join(repoRoot, "slava", "route_A", "scene.json");
  const modelsPath = path.join(repoRoot, "slava", "viewer", "models.js");
  const argonPath = path.join(repoRoot, "pushkar", "argon_verification.json");
  const evidenceDir = path.join(repoRoot, "slava", "route_A", "evidence");

  let sceneData = FALLBACK_ROUTE_A_SCENE;
  let sceneSource: "slava_route_A_live" | "fallback_route_A" = "fallback_route_A";

  if (fs.existsSync(scenePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(scenePath, "utf8"));
      sceneData = Array.isArray(raw) ? { objects: raw } : raw;
      sceneSource = "slava_route_A_live";
    } catch (err) {
      // Keep fallback if file is mid-write
    }
  }

  let argonVerification: unknown[] = [];
  if (fs.existsSync(argonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(argonPath, "utf8"));
      if (Array.isArray(parsed)) argonVerification = parsed;
    } catch {
      // ignore
    }
  }

  const evidenceFiles = fs.existsSync(evidenceDir)
    ? fs.readdirSync(evidenceDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    : [];

  return NextResponse.json(
    {
      source: sceneSource,
      hasSlavaModelsJs: fs.existsSync(modelsPath),
      scenePath: "slava/route_A/scene.json",
      modelsPath: "slava/viewer/models.js",
      canonicalScalePxPerM: 9.52,
      scene: sceneData,
      argonVerification,
      evidenceFiles,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
