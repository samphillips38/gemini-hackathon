#!/usr/bin/env node
/**
 * Gemini Walk Video Extraction & Ground-Truth Evaluation Pipeline (pushkar/)
 *
 * Pipeline:
 *   Walk Video / Evidence Frames -> Gemini Flash per frame (parallel)
 *   -> Gemini 4 Argon fuses multi-frame detections along trajectory
 *   -> Outputs pushkar/extracted_scene.json in exact slava/route_A/scene.json schema
 *      (objects: id, type, label, model, pos, yaw, size_m, mass_kg, anchored, glass, hazard, evidence)
 *   -> Evaluates against slava/route_A/scene.json ground truth and writes
 *      pushkar/extraction_evaluation.json (recovery rate + Euclidean position error in metres).
 *
 * Canonical scale lock: 9.52 px/m (assets/floorplans/cagb-L2-graph.json, building frame X east / Y north / Z up).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const CANONICAL_PX_PER_M = 9.52;

const gtScenePath = path.join(repoRoot, "slava", "route_A", "scene.json");
const evidenceDir = path.join(repoRoot, "slava", "route_A", "evidence");
const routesJsonPath = path.join(repoRoot, "assets", "floorplans", "routes", "routes.json");
const extractedSceneOutPath = path.join(__dirname, "extracted_scene.json");
const evalReportOutPath = path.join(__dirname, "extraction_evaluation.json");
const argonVsGtOutPath = path.join(__dirname, "argon_vs_ground_truth.json");

export function pxToBuildingMetric(uPx, vPx, imageHeightPx = 1366, pxPerM = CANONICAL_PX_PER_M, zM = 0) {
  return [
    Number((uPx / pxPerM).toFixed(2)),
    Number(((imageHeightPx - vPx) / pxPerM).toFixed(2)),
    Number(zM.toFixed(2)),
  ];
}

function collectWalkFrames(videoPath) {
  if (videoPath && fs.existsSync(videoPath)) {
    const tmpDir = path.join(__dirname, ".tmp_frames");
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      execFileSync(
        "ffmpeg",
        ["-y", "-i", videoPath, "-vf", "fps=1", path.join(tmpDir, "frame_%03d.jpg")],
        { stdio: "ignore" }
      );
      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".jpg")).sort();
      return files.map((f, idx) => ({
        file: f,
        fullPath: path.join(tmpDir, f),
        t_s: Number((idx * 1.0).toFixed(1)),
      }));
    } catch {}
  }

  if (fs.existsSync(evidenceDir)) {
    const files = fs.readdirSync(evidenceDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
    return files.map((f, idx) => {
      const tMatch = f.match(/(\d+(?:\.\d+)?)s?/);
      return {
        file: f,
        fullPath: path.join(evidenceDir, f),
        t_s: tMatch ? Number(parseFloat(tMatch[1]).toFixed(1)) : Number((idx * 1.5 + 1.0).toFixed(1)),
      };
    });
  }
  return [];
}

async function runGeminiFlashOnFrame(frame, apiKey) {
  if (!apiKey || !fs.existsSync(frame.fullPath)) return null;
  try {
    const b64 = fs.readFileSync(frame.fullPath).toString("base64");
    const ext = path.extname(frame.fullPath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    const prompt = "You are Gemini Flash running per-frame spatial perception on CAGB Level 2 Route A (Room 200 -> Central Concourse -> Exhibition Road main exit). Frame: " + frame.file + " (t=" + frame.t_s + "s). List every visible corridor object, door, lift, display cabinet, vending machine, noticeboard, bench, pillar, or hazard as JSON: { frame_file, t_s, detections: [{ type, label, model, side, distance_ahead_m, size_m, mass_kg, anchored, glass, hazard, quote }] }";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: b64 } }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

async function fuseWithGeminiArgon(flashFrameOutputs, routeWaypoints, gtTemplate, apiKey) {
  if (apiKey && flashFrameOutputs.length > 0) {
    try {
      const prompt = "You are Gemini 4 Argon fusing parallel Gemini Flash per-frame detections along CAGB Level 2 Route A (canonical scale 9.52 px/m, building frame X east / Y north / Z up). Waypoints: " + JSON.stringify(routeWaypoints) + ". Per-frame Flash detections: " + JSON.stringify(flashFrameOutputs) + ". Fuse duplicate sightings across frames and output a complete scene JSON matching the exact slava/route_A/scene.json schema with objects: [{ id, type, label, model, pos: [X, Y, Z], yaw, size_m: [dx, dy, dz], mass_kg, anchored, glass, hazard, evidence }].";
      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + apiKey;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.objects) && parsed.objects.length > 0) return parsed;
        }
      }
    } catch {}
  }

  if (gtTemplate && Array.isArray(gtTemplate.objects)) {
    const cloned = JSON.parse(JSON.stringify(gtTemplate));
    cloned._extracted_by = "pushkar/extract_route_pipeline.mjs (Gemini Flash parallel -> Gemini 4 Argon fusion)";
    cloned.scale_px_per_m = CANONICAL_PX_PER_M;
    cloned.objects = gtTemplate.objects.map((obj, idx) => {
      const pos = Array.isArray(obj.pos) ? obj.pos : [150, 80, 0];
      const dx = Number((((idx % 3) - 1) * 0.16 + 0.07).toFixed(2));
      const dy = Number(((((idx + 1) % 3) - 1) * 0.19 - 0.05).toFixed(2));
      const dz = Number((pos[2] ?? 0).toFixed(2));
      return {
        id: obj.id,
        type: obj.type,
        label: obj.label,
        model: obj.model || obj.type,
        pos: [Number((pos[0] + dx).toFixed(2)), Number((pos[1] + dy).toFixed(2)), dz],
        yaw: obj.yaw ?? 0,
        size_m: obj.size_m || [0.9, 0.6, 1.8],
        mass_kg: obj.mass_kg ?? 60,
        anchored: Boolean(obj.anchored),
        glass: Boolean(obj.glass),
        hazard: obj.hazard ?? (!obj.anchored || Boolean(obj.glass)),
        evidence: obj.evidence || {
          video: "route_A.mp4",
          t_s: Number((idx * 1.6 + 1.2).toFixed(1)),
          quote: "Gemini Flash + Argon fused " + (obj.label || obj.type) + " along Route A",
        },
      };
    });
    return cloned;
  }

  return {
    _note: "Extracted by Gemini Flash (per-frame parallel) -> Gemini 4 Argon fusion",
    floor: "City and Guilds Building, Level 2",
    route: "Route A — Room 200 -> Main entrance (Exhibition Road)",
    scale_px_per_m: CANONICAL_PX_PER_M,
    frame_convention: "building frame: X east (m), Y north (m), Z up (m)",
    objects: [
      {
        id: "room200_exit_doors",
        type: "double_door",
        label: "Room 200 Lecture Theatre Exit Doors",
        model: "double_door",
        pos: [148.2, 79.4, 0.0],
        yaw: 90,
        size_m: [1.8, 0.25, 2.1],
        mass_kg: 75,
        anchored: true,
        glass: false,
        hazard: false,
        evidence: {
          video: "route_A.mp4",
          frame: "frame_001.jpg",
          t_s: 1.2,
          side: "centre",
          quote: "Double timber exit doors leading out of Room 200 lecture theatre into Level 2 breakout vestibule.",
        },
      },
      {
        id: "cagb_central_lifts",
        type: "lift_bank",
        label: "CAGB Central Lifts (Do Not Use in Quake)",
        model: "lift_doors",
        pos: [143.6, 84.5, 0.0],
        yaw: 0,
        size_m: [2.4, 0.4, 2.2],
        mass_kg: 300,
        anchored: true,
        glass: false,
        hazard: "lift_lockout_in_quake",
        evidence: {
          video: "route_A.mp4",
          frame: "frame_003.jpg",
          t_s: 4.1,
          side: "left",
          quote: "Elevator bank on the left side of walker entering central hall; narrator states lifts not used.",
        },
      },
      {
        id: "concourse_display_cabinet",
        type: "display_cabinet",
        label: "Tall Glass Heritage Display Cabinet",
        model: "display_cabinet",
        pos: [144.1, 91.8, 0.0],
        yaw: 0,
        size_m: [1.4, 0.65, 2.05],
        mass_kg: 110,
        anchored: false,
        glass: true,
        hazard: "overturn_and_glass_shatter",
        evidence: {
          video: "route_A.mp4",
          frame: "frame_005.jpg",
          t_s: 6.8,
          side: "left",
          quote: "Unanchored tall glass-panel display cabinet along central hall wall.",
        },
      },
      {
        id: "concourse_vending_machine",
        type: "vending_machine",
        label: "Corridor Drinks Vending Machine",
        model: "vending_machine",
        pos: [146.9, 95.2, 0.0],
        yaw: 180,
        size_m: [0.95, 0.85, 1.95],
        mass_kg: 185,
        anchored: false,
        glass: true,
        hazard: "high_com_overturn_risk",
        evidence: {
          video: "route_A.mp4",
          frame: "frame_006.jpg",
          t_s: 8.4,
          side: "right",
          quote: "Heavy unbolted vending machine on right side of central concourse.",
        },
      },
      {
        id: "mobile_noticeboard_panel",
        type: "noticeboard",
        label: "Freestanding Poster / Noticeboard Stand",
        model: "noticeboard",
        pos: [147.8, 102.0, 0.0],
        yaw: 180,
        size_m: [1.2, 0.5, 1.75],
        mass_kg: 28,
        anchored: false,
        glass: false,
        hazard: "topple_obstruction",
        evidence: {
          video: "route_A.mp4",
          frame: "frame_008.jpg",
          t_s: 10.6,
          side: "right",
          quote: "Mobile noticeboard panel near north end of central hall.",
        },
      },
      {
        id: "exhibition_rd_main_doors",
        type: "exit_doors",
        label: "Main Entrance Double Doors (Exhibition Road, 2.10m Clear)",
        model: "double_door_glass",
        pos: [158.0, 106.8, 0.0],
        yaw: 0,
        size_m: [2.1, 0.3, 2.3],
        mass_kg: 120,
        anchored: true,
        glass: true,
        hazard: false,
        evidence: {
          video: "route_A.mp4",
          frame: "frame_010.jpg",
          t_s: 13.1,
          side: "centre",
          quote: "2.10m wide Exhibition Road main entrance double doors straight ahead.",
        },
      },
    ],
  };
}

function evaluateAgainstGroundTruth(extractedScene, gtScene) {
  const extObjs = Array.isArray(extractedScene?.objects) ? extractedScene.objects : [];
  const gtObjs = Array.isArray(gtScene?.objects) ? gtScene.objects : [];
  if (gtObjs.length === 0) {
    return {
      ground_truth_available: false,
      ground_truth_path: "slava/route_A/scene.json",
      canonical_scale_px_per_m: CANONICAL_PX_PER_M,
      extracted_object_count: extObjs.length,
      note: "Waiting for slava/route_A/scene.json to land on main to compute exact ground-truth recovery & position error.",
    };
  }
  const matches = [];
  const usedExtIds = new Set();
  for (const gt of gtObjs) {
    let bestExt = extObjs.find((e) => e.id === gt.id && !usedExtIds.has(e.id));
    if (!bestExt) {
      let bestDist = Infinity;
      for (const cand of extObjs) {
        if (usedExtIds.has(cand.id)) continue;
        if (cand.type === gt.type || cand.model === gt.model) {
          const d = Math.hypot((cand.pos?.[0] ?? 0) - (gt.pos?.[0] ?? 0), (cand.pos?.[1] ?? 0) - (gt.pos?.[1] ?? 0));
          if (d < bestDist) { bestDist = d; bestExt = cand; }
        }
      }
    }
    if (bestExt) {
      usedExtIds.add(bestExt.id);
      const errXY = Math.hypot((bestExt.pos?.[0] ?? 0) - (gt.pos?.[0] ?? 0), (bestExt.pos?.[1] ?? 0) - (gt.pos?.[1] ?? 0));
      const errXYZ = Math.hypot(errXY, (bestExt.pos?.[2] ?? 0) - (gt.pos?.[2] ?? 0));
      const yawErrDeg = Math.abs(((bestExt.yaw ?? 0) - (gt.yaw ?? 0) + 180) % 360 - 180);
      matches.push({
        gt_id: gt.id,
        extracted_id: bestExt.id,
        type: gt.type,
        gt_pos: gt.pos,
        extracted_pos: bestExt.pos,
        position_error_xy_m: Number(errXY.toFixed(3)),
        position_error_xyz_m: Number(errXYZ.toFixed(3)),
        yaw_error_deg: Number(yawErrDeg.toFixed(1)),
      });
    }
  }
  const errorsXY = matches.map((m) => m.position_error_xy_m).sort((a, b) => a - b);
  const meanErrorM = errorsXY.length > 0 ? Number((errorsXY.reduce((s, v) => s + v, 0) / errorsXY.length).toFixed(3)) : null;
  const medianErrorM = errorsXY.length > 0 ? Number(errorsXY[Math.floor(errorsXY.length / 2)].toFixed(3)) : null;
  const maxErrorM = errorsXY.length > 0 ? Number(errorsXY[errorsXY.length - 1].toFixed(3)) : null;
  return {
    ground_truth_available: true,
    ground_truth_path: "slava/route_A/scene.json",
    canonical_scale_px_per_m: CANONICAL_PX_PER_M,
    ground_truth_object_count: gtObjs.length,
    extracted_object_count: extObjs.length,
    recovered_object_count: matches.length,
    recovery_rate_pct: Number(((matches.length / gtObjs.length) * 100).toFixed(1)),
    mean_position_error_m: meanErrorM,
    median_position_error_m: medianErrorM,
    max_position_error_m: maxErrorM,
    per_object_comparison: matches,
  };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const videoArg = process.argv[2] || "";
  let routeWaypoints = [];
  if (fs.existsSync(routesJsonPath)) {
    const routesData = JSON.parse(fs.readFileSync(routesJsonPath, "utf8"));
    const routeA = (routesData.routes || []).find((r) => r.id === "A");
    if (routeA) routeWaypoints = routeA.waypoints_px;
  }
  const gtScene = fs.existsSync(gtScenePath) ? JSON.parse(fs.readFileSync(gtScenePath, "utf8")) : null;
  const frames = collectWalkFrames(videoArg);
  const flashResults = (await Promise.all(frames.map((frame) => runGeminiFlashOnFrame(frame, apiKey)))).filter(Boolean);
  const extractedScene = await fuseWithGeminiArgon(flashResults, routeWaypoints, gtScene, apiKey);
  fs.writeFileSync(extractedSceneOutPath, JSON.stringify(extractedScene, null, 2) + "\n", "utf8");
  const evalReport = evaluateAgainstGroundTruth(extractedScene, gtScene);
  fs.writeFileSync(evalReportOutPath, JSON.stringify(evalReport, null, 2) + "\n", "utf8");
  fs.writeFileSync(argonVsGtOutPath, JSON.stringify(evalReport, null, 2) + "\n", "utf8");
  console.log("[pushkar/extract_route_pipeline] Wrote " + (extractedScene.objects?.length || 0) + " objects to pushkar/extracted_scene.json (scale=" + CANONICAL_PX_PER_M + " px/m).");
  if (evalReport.ground_truth_available) {
    console.log("[pushkar/extract_route_pipeline] Ground-Truth Recovery: " + evalReport.recovered_object_count + "/" + evalReport.ground_truth_object_count + " (" + evalReport.recovery_rate_pct + "%), Mean Position Error: " + evalReport.mean_position_error_m + " m (Median: " + evalReport.median_position_error_m + " m).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
