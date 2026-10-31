# AGENTS.md — Shared Multi-Agent Coordination Hub (Google DeepMind Hackathon at Imperial)

> **Authoritative Blueprint:** [`ava/HACKATHON_PLANS_B_AND_C.md`](./ava/HACKATHON_PLANS_B_AND_C.md)  
> **Live Discord Channel:** `#agent-comms` (`1566074283900272824` in Guild `1566057184297619506`)  
> All coding agents (`[Ava-Agent]`, `[Sam-Agent]`, `sam-openclaw-agent`, `@geminiproject`, `[Ana bot]`) MUST follow `ava/HACKATHON_PLANS_B_AND_C.md` and keep this root `AGENTS.md` updated as modules land on `main`.

---

## 1. Active Project Scope: Dual-Ready Shared Core for **Plan B (`QuakeRoom`)** & **Plan C (`ExitZero`)**

We are building and integrating the shared components that power **both** blueprints from [`ava/HACKATHON_PLANS_B_AND_C.md`](./ava/HACKATHON_PLANS_B_AND_C.md), anchored on the actual hackathon venue (**CAGB Level 2 — Room 200 Lecture Theatre -> Routes A–D -> Room 203 Deep-Dive**):

1. **Plan B — `QuakeRoom` (Seismic Room Collapse, Safe-Shelter & Escape Route Verifier):**
   - **Input:** Room video / photo scan + Gemini Live voice context (`floor_level`, `renter_no_drill`, top-shelf heavy loads).
   - **3D Scene:** Procedural 3D room twin (`RoomSceneGraph`) with `bed`, `bookshelf` (with `bottom`/`middle`/`top` shelf child items), `wardrobe`, `desk`, `chair`, `tv_monitor`, `heavy_item`, `fragile_glass`, `window`, `exit_door`, plus **CAGB Level 2 Room 203** (`cagb_room_203`).
   - **Deterministic Verifier:**
     1. Analytical Housner Center-of-Mass overturning safety factor: $SF = \frac{b / h_{\text{CoM}}}{a_{\text{floor}} / g}$ (accounting for stacked child items on top vs. bottom shelves).
     2. **N=50 Monte Carlo Shake Ensembles:** Perturbs friction and pulse phase across 50 runs to compute `walk_clear_prob` (`0.4m` capsule) and `wheelchair_clear_prob` (`0.9m` capsule).
     3. **2-Phase Seismic Safety Framing:** Phase 1 (During Shaking: Drop, Cover & Hold On under sturdy desk) + Phase 2 (Post-Collapse Egress: 2D grid **A\* pathfinder** on `0.2m` grid verifying `occupant_start -> exit_door`).
   - **Self-Correcting Loop:** Gemini 4 Argon proposes a renter-safe `RemediationProposal` (moving `20kg` textbooks from `top` shelf to `bottom` shelf as ballast, sliding `wardrobe` away from `exit_door`, shifting `bed` out of window glass shatter zone) and re-verifies in the solver.

2. **Plan C — `ExitZero` (2D Floor-Plan + Live Camera Hazard to 3D Building Evacuation Verifier):**
   - **Input:** Calibrated **CAGB Level 2** floorplan (`cagb-L2.jpg`, `11.43 px/m` calibrated on `2.10m` Exhibition Rd double doors, Routes A–D in `routes.json`) + live camera / voice hazard report (`LiveHazardEvent` with `video_evidence`).
   - **3D Scene:** 3D extruded building floor (`WallSegment[]`), topological `NavNode[]` (`room_200`, `room_203`, `breakout_space`, `exit_exhibition_rd`, `exit_dalby_court`, `lift_central`, `refuge_r2`), `NavEdge[]`, expanding hazard zones, and 3D route ribbons.
   - **Deterministic Verifier:** Time-expanded Dijkstra / A\* evacuation solver ($t_{\text{human}}(e) < t_{\text{hazard\_closure}}(e)$) + deterministic **Lift Lockout Override** in seismic/fire emergencies + Wheelchair Accessible Refuge routing (`EvacuationVerificationResult`) + **1-click Route C -> Room 203 Macro-to-Micro transition**.

---

## 2. Live 5-Agent Coordination Map (`#agent-comms` & GitHub)

To prevent merge conflicts while all teammates commit directly to `main`:
- **Each agent works strictly inside their own top-level folder** (`ava/`, `sam/`, `Ana/`, `Pinky/`, `pushkar/`).
- **NEVER modify or delete files inside another teammate's folder.**
- **Only shared root file:** This `/AGENTS.md` file at the repo root.

| Teammate Folder | Active Agent(s) in `#agent-comms` | Current Status & Key Modules on `main` |
| :--- | :--- | :--- |
| **`ava/`** | **`[Ava-Agent]`** (Antigravity) | **100% Unified Cross-Merge Complete:** Authoritative Blueprint (`ava/HACKATHON_PLANS_B_AND_C.md`), CAGB Level 2 Routes A–D (`public/floorplans/`), Canonical `9.52 px/m` 4-Stage Coordinate Transforms, 3D CAGB Route Twin (`cagbRouteTwinModels.ts` + `/api/route-twin`), Slava's 30 Walk Evidence Photos & Pushkar's Argon Verification (`public/evidence/argon_verification.json` — 52/52 recall, `0.157m` error), WebAudio P/S-Wave Seismic Synth (`src/voice/seismicAudioSynth.ts`), Ana's Natural Human Voice Coach (`src/voice/voiceCoach.ts`), Procedural Oak Hardwood Floor & Detailed 3D Furniture + 1st-Person WASD Walkthrough (`src/scene3d/RoomCanvas3D.tsx`), 4 Real CAGB L2 Walk Zones (`room200`, `hall`, `corridor`, `lobby`) + Room 203 Macro-to-Micro Deep Dive (`cagb_room_203`), 2-Phase Seismic Safety Banner, N=50 Monte Carlo (`0.4m` Walk / `0.9m` Wheelchair) |
| **`sam/`** | **`[Sam-Agent]`** & **`sam-openclaw-agent`** (`<@1566070613490270288>`) | **Active & Synced:** Plan B (`quakeRoomSolver.ts`) & Plan C (`exitZeroSolver.ts`), CAGB Route Twin 3D R3F view (`buildModel`/`makeMaterials`), 4 Real CAGB L2 Rooms (`cagbRouteARooms.json`), `route_A_montecarlo.json`, 4-stage coordinate transforms, N=50 Monte Carlo |
| **`Ana/`** | **`[Ana bot]`** | **Active & Synced:** Rocky Robotics (`9VnViBXvA9Q`) Full-Screen 1st-Person Walkable UI with zero buttons when closed + `Ctrl+Space` / `Cmd+Space` Command & Settings Modal (`f1e25c5`), synced with Sam's CAGB Route A 3D Twin, 4 CAGB L2 Rooms (`0/50 -> 50/50` remediation), Evidence & Monte Carlo (`Ana/src/app/page.tsx`, `Ana/src/scene3d/QuakeRoomCanvas.tsx`, `Ana/src/scene3d/ExitZeroCanvas.tsx`, `Ana/src/voice/voiceCoach.ts`) |
| **`pushkar/`** | **`@geminiproject`** (`<@1566055877352497282>`) | **Active & Synced:** Gemini 4 Argon Object Verifier (`pushkar/verify_route_A.mjs` -> `pushkar/argon_verification.json` & `argon_vs_ground_truth.json`), Live Video/Webcam Keyframe Extractor (`videoKeyframeExtractor.ts`), WebAudio P-wave/S-wave Seismic Synth (`seismicAudioSynth.ts`) |
| **`Pinky/`** | **`[Pinky-Agent]`** (`pinkybot`) | **Active & Synced:** Unified Plan B (`QuakeRoom` 3D Shake Table + Housner overturning SF + `0.2m` A* egress verifier) & Plan C (`ExitZero` 3D Building Twin + time-expanded A* evacuation) + standalone `preview.html` |
| **`assets/floorplans/`** | Shared Venue Assets | Calibrated CAGB Level 2 (`cagb-L2.jpg`, `cagb-L2-1280.jpg`, `routes.json`, `route_A..D.png`) |

---

## 3. Tech Stack & Standard Commands (Inside Each App Folder e.g. `ava/`)

- **Framework:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **3D & Physics:** `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`
- **AI SDK:** `@google/genai` (Gemini 4 Argon / `gemini-2.5-pro` / `gemini-2.5-flash` structured JSON extraction & remediation + Web Speech / WebAudio voice)
- **Commands:**
  ```bash
  npm install
  npm run dev         # Starts local server on http://localhost:3000
  npm run typecheck   # Runs tsc --noEmit (MUST pass before pushing)
  ```

---

## 4. Continuous Git Sync Protocol (Mandatory for All Agents)

1. **Pull before every push:**
   ```bash
   git pull --rebase origin main
   ```
2. **Stage ONLY your own folder (and root `AGENTS.md` if updating status):**
   ```bash
   git add <your-folder>/ AGENTS.md
   git commit -m "<your-name>: <concise summary>"
   git push origin main
   ```
3. **Commit & push frequently (every 2–3 files)** so all teammates and their coding agents have real-time visibility.
4. **Offline-Safe Guarantee:** Every feature MUST work out-of-the-box with the deterministic presets in `src/presets/` even if Wi-Fi or live API keys drop during the 4:30 PM live stage demo.

---

## Agent-to-agent requests (automatic)
Use `coordination/PROTOCOL.md`: one new file per message in `coordination/inbox/<to>/`, watchers pull every 20-60 s, work only inside your own folder, reply in the sender's inbox. Canonical map scale is **9.52 px/m** (`assets/floorplans/cagb-L2-graph.json`); real CAGB L2 objects are in `slava/route_A/scene.json`.
