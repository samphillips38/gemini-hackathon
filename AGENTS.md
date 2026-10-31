# AGENTS.md — Shared Multi-Agent Coordination Hub (Google DeepMind Hackathon at Imperial)

> **Authoritative Blueprint:** [`ava/HACKATHON_PLANS_B_AND_C.md`](./ava/HACKATHON_PLANS_B_AND_C.md)  
> All coding agents (Antigravity, Codex, Cursor, Claude Code) MUST follow `ava/HACKATHON_PLANS_B_AND_C.md` and keep this root `AGENTS.md` updated as modules land on `main`.

---

## 1. Active Project Scope: Dual-Ready Shared Core for **Plan B (`QuakeRoom`)** & **Plan C (`ExitZero`)**

While the team finalizes the exact stage pitch between **Plan B (QuakeRoom)** and **Plan C (ExitZero)**, we are building the shared components that power **both** blueprints from [`ava/HACKATHON_PLANS_B_AND_C.md`](./ava/HACKATHON_PLANS_B_AND_C.md):

1. **Plan B — `QuakeRoom` (Seismic Room Collapse, Safe-Shelter & Escape Route Verifier):**
   - **Input:** Room video / photo scan + Gemini Live voice context (`floor_level`, `renter_no_drill`, top-shelf heavy loads).
   - **3D Scene:** Procedural 3D room twin (`RoomSceneGraph`) with `bed`, `bookshelf` (with `bottom`/`middle`/`top` shelf child items), `wardrobe`, `desk`, `chair`, `tv_monitor`, `heavy_item`, `fragile_glass`, `window`, `exit_door`.
   - **Deterministic Verifier:**
     1. Analytical Housner Center-of-Mass overturning safety factor: $SF = \frac{b / h_{\text{CoM}}}{a_{\text{floor}} / g}$ (accounting for stacked child items on top vs. bottom shelves).
     2. 3D rigid-body / tipping simulation + fall-shadow projection.
     3. Post-collapse 2D grid **A\* pathfinder** (`0.2m` grid) verifying `occupant_start -> exit_door` (`escape_path_points_m`) and `occupant_start -> safe_shelter_spot_m` (under sturdy desk).
   - **Self-Correcting Loop:** Gemini 4 Argon proposes a renter-safe `RemediationProposal` (moving `20kg` textbooks from `top` shelf to `bottom` shelf as ballast, sliding `wardrobe` away from `exit_door`, shifting `bed` out of window glass shatter zone) and re-verifies in the solver.

2. **Plan C — `ExitZero` (2D Floor-Plan + Live Camera Hazard to 3D Building Evacuation Verifier):**
   - **Input:** Photo of a 2D wall fire-exit floor plan (`BuildingFloorGraph`) + live camera / voice hazard report (`LiveHazardEvent`).
   - **3D Scene:** 3D extruded building floor (`WallSegment[]`), topological `NavNode[]` (`room`, `corridor_junction`, `stairwell_exit`, `lift_elevator`, `accessible_refuge`), `NavEdge[]`, expanding hazard zones, and 3D route ribbons.
   - **Deterministic Verifier:** Time-expanded Dijkstra / A\* evacuation solver ($t_{\text{human}}(e) < t_{\text{hazard\_closure}}(e)$) + deterministic **Lift Lockout Override** in seismic/fire emergencies + Wheelchair Accessible Refuge routing (`EvacuationVerificationResult`).

---

## 2. Repository Structure & Per-Teammate Folder Isolation

To prevent merge conflicts while all 5 teammates commit directly to `main`:
- **Each teammate works strictly inside their own top-level folder** (`ava/`, `sam/`, `Ana/`, `Pinky/`, etc.) during parallel development.
- **NEVER modify or delete files inside another teammate's folder.**
- **Only shared root file:** This `/AGENTS.md` file at the repo root, which any agent may update to log status and exported modules.

| Teammate Folder | Owner / Focus | Current Status & Key Modules |
| :--- | :--- | :--- |
| **`ava/`** | **Ava** — Authoritative Blueprint (`ava/HACKATHON_PLANS_B_AND_C.md`), Shared 3D Room & Building Creation (`RoomCanvas3D.tsx`, `BuildingCanvas3D.tsx`), Gemini 4 Argon API Suite (`/api/extract-room`, `/api/extract-floorplan`, `/api/remediate`, `/api/hazard`), Deterministic Physics + A\* Verifier (`roomVerifier.ts`, `buildingVerifier.ts`), Unified Plan B + Plan C App (`src/app/page.tsx`) | Complete & Live (`ava/`) |
| **`sam/`** | **Sam** — Plan B (`quakeRoomSolver.ts`) & Plan C (`exitZeroSolver.ts`) Solvers, Vision/Floorplan Extractors, Voice/Remediation Routes, 3D Scenes | Active (`sam/`) |
| **`Ana/`** | **Ana** — Plan B & C Solvers, 3D Shake Table & Building Extruder, API routes | Active (`Ana/`) |
| **`Pinky/`** | **Pinky** — Teammate workspace | Active (`Pinky/`) |

---

## 3. Tech Stack & Standard Commands (Inside Each App Folder e.g. `ava/`)

- **Framework:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **3D & Physics:** `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`
- **AI SDK:** `@google/genai` (Gemini 4 Argon / `gemini-2.5-pro` / `gemini-2.5-flash` structured JSON extraction & remediation + Web Speech / Gemini Live voice)
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
