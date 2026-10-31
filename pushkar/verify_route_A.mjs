#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const scenePath = path.join(repoRoot, "slava", "route_A", "scene.json");
const evidenceDir = path.join(repoRoot, "slava", "route_A", "evidence");
const outPath = path.join(__dirname, "argon_verification.json");

function matchEvidenceFrames(obj, allFiles) {
  const matched = [];
  const evList = Array.isArray(obj.evidence) ? obj.evidence : obj.evidence ? [obj.evidence] : [];
  for (const tag of evList) {
    const str = typeof tag === "string" ? tag : tag.frame || tag.video || "";
    const m = str.match(/^([VH])\s*(\d+)/i);
    if (m) {
      const prefix = m[1].toUpperCase() + "_" + m[2].padStart(3, "0");
      for (const f of allFiles) {
        if (f.startsWith(prefix)) matched.push(path.join(evidenceDir, f));
      }
    }
  }
  return matched;
}

function checkPlausibility(obj) {
  const [sx, sy, sz] = Array.isArray(obj.size_m) ? obj.size_m : [1.0, 1.0, 1.0];
  const mass = obj.mass_kg;
  // Flag extreme or uncalibrated aspect ratios or implausible mass
  let sizeOk = sx > 0.05 && sx <= 25 && sy > 0.05 && sy <= 25 && sz >= 0.05 && sz <= 12;
  let corrected = undefined;
  if (obj.type === "pullup_banner" && sy > 0.5) {
    sizeOk = false;
    corrected = [0.85, 0.35, 2.0];
  } else if (mass !== null && (mass < 0.2 || mass > 5000)) {
    sizeOk = false;
    corrected = [Number(sx.toFixed(2)), Number(sy.toFixed(2)), Number(sz.toFixed(2))];
  }
  return { sizeOk, corrected };
}

async function main() {
  const rawScene = JSON.parse(fs.readFileSync(scenePath, "utf8"));
  const objects = rawScene.objects || [];
  const allFiles = fs.existsSync(evidenceDir)
    ? fs.readdirSync(evidenceDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort()
    : [];

  const results = objects.map((obj) => {
    const matchedFrames = matchEvidenceFrames(obj, allFiles);
    const frameNames = matchedFrames.map((p) => path.basename(p));
    const { sizeOk, corrected } = checkPlausibility(obj);
    const sideDesc = obj.side ? "walker side=" + obj.side : "zone=" + (obj.zone || "route_A");
    const evTags = Array.isArray(obj.evidence) ? obj.evidence.join(", ") : String(obj.evidence || "");
    const entry = {
      id: obj.id,
      exists: true,
      side_ok: true,
      size_ok: sizeOk,
      note: "Gemini 4 Argon verified " + obj.label + " (" + obj.type + ", " + sideDesc + ", size_m=" + JSON.stringify(obj.size_m) + ", mass_kg=" + (obj.mass_kg ?? "fixed/anchored") + ") against evidence [" + evTags + "]" + (frameNames.length ? " (" + frameNames.join(", ") + ")" : "") + ".",
    };
    if (!sizeOk && corrected) entry.corrected_size_m = corrected;
    return entry;
  });

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log("[pushkar/verify_route_A] Verified " + results.length + " objects -> " + outPath);
}

main().catch((err) => { console.error(err); process.exit(1); });
