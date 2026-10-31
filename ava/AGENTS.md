# AGENTS.md — Ava's Workspace (`ava/`)

> **Authoritative Spec:** [`ava/HACKATHON_PLANS_B_AND_C.md`](./HACKATHON_PLANS_B_AND_C.md)

## 1. Scope of `ava/`
This workspace implements the unified **Plan B (`QuakeRoom`)** and **Plan C (`ExitZero`)** 3D creation, Gemini 4 Argon spatial extraction, deterministic physics + A\* pathfinding verification, and interactive UI according to `ava/HACKATHON_PLANS_B_AND_C.md`:
- **`src/types/contracts.ts`**: Exact TypeScript contracts for both Plan B (`RoomObjectNode`, `RoomSceneGraph`, `ObjectHazardResult`, `EgressAndShelterResult`, `RemediationProposal`) and Plan C (`NavNode`, `NavEdge`, `WallSegment`, `BuildingFloorGraph`, `LiveHazardEvent`, `EvacuationVerificationResult`).
- **`src/scene3d/RoomCanvas3D.tsx`**: Interactive Three.js 3D Room Twin with procedural furniture prefabs (`bed`, `bookshelf` with `bottom`/`middle`/`top` shelf child items, `wardrobe`, `desk`, `chair`, `tv_monitor`, `window`, `exit_door`), P/S-wave earthquake table oscillation, tipping mechanics, red fall-shadow cones, cyan Drop-Cover-Hold shelter path, and glowing green/red post-collapse A\* escape path.
- **`src/scene3d/BuildingCanvas3D.tsx`**: Interactive Three.js 3D Extruded Building Floor Twin for Plan C (`ExitZero`) with extruded `WallSegment[]`, color-coded `NavNode[]` (green stairwell exits, red locked-out lifts, cyan accessible refuge points), volumetric live hazards (`LiveHazardEvent`), and animated 3D route ribbons comparing Naive vs. Verified evacuation paths.
- **`src/solver/roomVerifier.ts`**: Plan B deterministic Housner overturning calculator ($SF = \frac{b/h_{\text{CoM}}}{a_{\text{floor}}/g}$), 2D occupancy grid A\* pathfinder (`0.2m` grid cells), and renter-safe remediation verifier.
- **`src/solver/buildingVerifier.ts`**: Plan C deterministic time-expanded Dijkstra/A\* evacuation verifier ($t_{\text{human}}(e) < t_{\text{hazard\_closure}}(e)$) with hard Lift Lockout override and Wheelchair Accessible Refuge routing.
- **`src/app/api/extract-room/route.ts`**: Multimodal Room Video/Photo + Voice -> `RoomSceneGraph` JSON extractor via `@google/genai` (`GEMINI_MODEL` defaulting to Gemini 4 Argon / `gemini-2.5-flash` with deterministic sanitizer).

## 2. Commands
```bash
cd ava
npm install
npm run typecheck
npm run dev
```
