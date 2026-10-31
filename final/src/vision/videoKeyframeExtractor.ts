"use client";

import { LiveHazardEvent, RoomSceneGraph } from "@/types/contracts";
import { STUDENT_BEDROOM_UNSAFE } from "@/presets/demoPresets";

export type VideoStreamSourceId =
  | "route_A.mp4"
  | "route_B.mp4"
  | "route_C.mp4"
  | "room.mp4"
  | "live_webcam";

export interface ExtractedVideoKeyframe {
  video_file: string;
  timestamp_s: number;
  frame_index: number;
  data_url: string;
  mime_type: string;
  caption_hint: string;
}

export interface VideoAnalysisBundle {
  video_file: string;
  mode: "PLAN_B_ROOM" | "PLAN_C_CORRIDOR";
  keyframes_sampled: number;
  hazards: LiveHazardEvent[];
  room_scene?: RoomSceneGraph;
  source: string;
}

/**
 * Stage-Safe Pre-Indexed CAGB Level 2 Walkthrough Evidence Catalog
 * (Matches Slava's HANDOFF.md & Ava's Route A-C + Room 203 specs so it works 100% offline or with live video)
 */
export const CAGB_VIDEO_EVIDENCE_CATALOG: Record<
  Exclude<VideoStreamSourceId, "live_webcam">,
  {
    label: string;
    routeBadge: string;
    duration_s: number;
    mode: "PLAN_B_ROOM" | "PLAN_C_CORRIDOR";
    hazards: LiveHazardEvent[];
    roomScene?: RoomSceneGraph;
  }
> = {
  "route_A.mp4": {
    label: "Route A — Room 200 → Central Concourse → Exhibition Rd (2.10m Double Doors)",
    routeBadge: "Route A (Primary Step-Free West Exit)",
    duration_s: 14.0,
    mode: "PLAN_C_CORRIDOR",
    hazards: [
      {
        id: "hazard_routeA_display",
        hazard_type: "structural_debris",
        location_node_id: "junc_central",
        affected_edge_ids: ["edge_central_lift"],
        spread_rate_m_per_s: 0.0,
        severity: "slow_crawl",
        detected_from: "live_camera",
        description:
          "Unanchored trophy/display cabinet & lift-lobby signage shaking near CAGB Central Lifts; Exhibition Rd West Spine (2.10m clear double doors) remains unobstructed.",
        video_evidence: {
          video_file: "route_A.mp4",
          timestamp_s: 3.6,
          quote:
            "Glass display case and central lift lobby header rattling at Concourse junction (t = 3.6s); West double-door exit path clear.",
        },
      },
    ],
  },
  "route_B.mp4": {
    label: "Route B — Room 200 → East Corridor → Dalby Court Exit (1.12m Door + 10 Steps)",
    routeBadge: "Route B (East Choke Point / Blocked)",
    duration_s: 16.5,
    mode: "PLAN_C_CORRIDOR",
    hazards: [
      {
        id: "hazard_routeB_vending",
        hazard_type: "structural_debris",
        location_node_id: "junc_east",
        affected_edge_ids: ["edge_central_east", "edge_east_stairA"],
        spread_rate_m_per_s: 0.45,
        severity: "blocked",
        detected_from: "live_camera",
        description:
          "Tall unanchored vending machine & suspended ceiling grid collapse sealing East Corridor choke point toward Dalby Court (1.12m door + 1.06m steep ramp / 10 steps).",
        video_evidence: {
          video_file: "route_B.mp4",
          timestamp_s: 4.2,
          quote:
            "Tall unanchored vending machine and glass display cabinet spotted beside East Corridor choke point (t = 4.2s).",
        },
      },
      {
        id: "hazard_routeB_dalby_stairs",
        hazard_type: "crowd_bottleneck",
        location_node_id: "stair_east",
        affected_edge_ids: ["edge_east_stairA"],
        spread_rate_m_per_s: 0.25,
        severity: "blocked",
        detected_from: "live_camera",
        description:
          "Narrow 1.12m Dalby Court doorway + 10 steps / steep 1.06m ramp fails 0.9m wheelchair seismic clearance under post-quake crowd surge.",
        video_evidence: {
          video_file: "route_B.mp4",
          timestamp_s: 11.8,
          quote:
            "Dalby Court 1.12m exit door and 10-step stair bottleneck impassable for wheelchair egress (t = 11.8s).",
        },
      },
    ],
  },
  "route_C.mp4": {
    label: "Route C — Room 200 → Concourse → CAGB Room 203 Computer Lab Deep-Dive",
    routeBadge: "Route C (Macro → Micro Room 203 Bridge)",
    duration_s: 12.0,
    mode: "PLAN_C_CORRIDOR",
    hazards: [
      {
        id: "hazard_routeC_partition",
        hazard_type: "structural_debris",
        location_node_id: "junc_east",
        affected_edge_ids: ["edge_central_east", "edge_east_stairA"],
        spread_rate_m_per_s: 0.4,
        severity: "blocked",
        detected_from: "live_camera",
        description:
          "East corridor glazing & overhead cable tray hazard at t = 2.8s; Route C pivots west past Room 203 Computer Lab toward Exhibition Rd 2.10m exit.",
        video_evidence: {
          video_file: "route_C.mp4",
          timestamp_s: 2.8,
          quote:
            "Corridor partition glazing & unbolted equipment rack outside Room 203 Computer Lab (t = 2.8s).",
        },
      },
    ],
  },
  "room.mp4": {
    label: "room.mp4 — Furnished Room / CAGB Room 203 Twin (12 Keyframes → Gemini 4 Argon)",
    routeBadge: "Plan B Micro Twin (room.mp4)",
    duration_s: 15.0,
    mode: "PLAN_B_ROOM",
    hazards: [
      {
        id: "hazard_room_wardrobe_door",
        hazard_type: "structural_debris",
        location_node_id: "room_301",
        affected_edge_ids: ["edge_301_west"],
        spread_rate_m_per_s: 0.0,
        severity: "blocked",
        detected_from: "live_camera",
        description:
          "Unbolted 2.05m bookshelf with 20kg top-shelf load (t = 3.1s) and 2.1m oak wardrobe adjacent to exit door (t = 7.4s) create fatal overturning fall shadow.",
        video_evidence: {
          video_file: "room.mp4",
          timestamp_s: 7.4,
          quote:
            "Unanchored 2.1m wardrobe positioned 0.25m from exit_door_1 and 20kg textbooks on top shelf of bookshelf_1 (t = 7.4s).",
        },
      },
    ],
    roomScene: STUDENT_BEDROOM_UNSAFE,
  },
};

/**
 * Extracts evenly spaced JPEG keyframes from a user-selected <video> File in the browser
 */
export async function sampleVideoFileKeyframes(
  file: File,
  maxFrames = 4
): Promise<ExtractedVideoKeyframe[]> {
  if (typeof window === "undefined") return [];

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const frames: ExtractedVideoKeyframe[] = [];

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    video.onerror = () => {
      cleanup();
      resolve([]);
    };

    video.onloadedmetadata = async () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8.0;
      const canvas = document.createElement("canvas");
      const width = 640;
      const height = Math.max(360, Math.round((video.videoHeight / (video.videoWidth || 640)) * width));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        cleanup();
        resolve([]);
        return;
      }

      for (let i = 0; i < maxFrames; i++) {
        const timestamp_s = Number((((i + 0.5) / maxFrames) * duration).toFixed(1));
        await new Promise<void>((seekResolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            ctx.drawImage(video, 0, 0, width, height);
            const data_url = canvas.toDataURL("image/jpeg", 0.78);
            frames.push({
              video_file: file.name || "room.mp4",
              timestamp_s,
              frame_index: i,
              data_url,
              mime_type: "image/jpeg",
              caption_hint: `Keyframe #${i + 1} at t=${timestamp_s}s`,
            });
            seekResolve();
          };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = Math.min(duration - 0.05, Math.max(0.1, timestamp_s));
        });
      }

      cleanup();
      resolve(frames);
    };
  });
}

/**
 * Captures a single live frame from an active HTMLVideoElement (webcam stream)
 */
export function captureWebcamKeyframe(
  videoEl: HTMLVideoElement,
  elapsedSeconds = 2.4
): ExtractedVideoKeyframe | null {
  if (typeof window === "undefined" || !videoEl.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = Math.round((videoEl.videoHeight / videoEl.videoWidth) * 640) || 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return {
    video_file: "live_webcam.mp4",
    timestamp_s: Number(elapsedSeconds.toFixed(1)),
    frame_index: 0,
    data_url: canvas.toDataURL("image/jpeg", 0.8),
    mime_type: "image/jpeg",
    caption_hint: `Live webcam capture at t=${elapsedSeconds.toFixed(1)}s`,
  };
}
