# ClearExit: Plan B (QuakeRoom) vs. Plan C (ExitZero) — Shared Architecture & Hackathon Winner Analysis

## 1. Executive Decision: Which Idea Wins the Hackathon?

**Winner to Lead the Demo: PLAN B (`QuakeRoom` — Seismic Room Collapse, Safe-Shelter & Self-Correcting Renter Remediation)**, enhanced with a **15-second Plan C (`ExitZero` — Imperial CAGB Level 2 Floor-Plan Opener)** in a unified Macro-to-Micro Command Center.

### Why Plan B (`QuakeRoom`) Scores Highest with DeepMind Judges (39/40 vs. 35/40)

| Judging Criterion | Plan B: **QuakeRoom** (Micro 3D Room Physics + Ballast Fix) | Plan C: **ExitZero** (Macro 2D->3D Floor Plan + Corridor Blockade) | Winner & Why |
| :--- | :--- | :--- | :--- |
| **1. Specificity** *(One sharp problem for one real person)* | **10/10** — A university student renter in an upper-floor flat (where 30–50% of earthquake injuries happen from falling furniture and blocked bedroom doors, and where **wall drilling is forbidden by the lease**). | **8.5/10** — Building visitor reading a static fire-exit wall map during an emergency. | **Plan B** — Every student and renter in the audience immediately relates to a cramped bedroom where you aren't allowed to drill into walls. |
| **2. Alchemy** *(Multimodal interdependence)* | **10/10** — **Vision** sees furniture positions; **Voice** supplies *invisible physics* a camera cannot see (`10th floor` whiplash amplification, `renter: no wall drilling`, `20kg textbooks on top shelf`); **3D Physics + Deterministic A\*** discovers a counter-intuitive physical fix. | **9/10** — Floor plan photo gives global topology; live camera spots local corridor blockage; voice intercepts lift panic. | **Plan B** — Moving **20kg of books from the top shelf to the bottom shelf** to lower $h_{\text{CoM}}$ from $1.48\text{m} \to 0.58\text{m}$ (turning a deadly hazard into natural ballast without drilling a single screw!) is an unforgettable "aha!" moment. |
| **3. Rigor** *(Falsifiable deterministic verification)* | **10/10** — Combines analytical **Housner overturning mechanics** ($SF = \frac{b/h_{\text{CoM}}}{a_{\text{floor}}/g}$), **50-run Monte Carlo seismic simulation** (PGA $0.3\text{g}\text{--}0.5\text{g}$), and **2D Occupancy Grid A\*** (`0.4m` walking & `0.9m` wheelchair clearance) + verified **Drop-Cover-Hold** shelter under desk. | **9/10** — Time-expanded Dijkstra ($t_{\text{human}}(e) < t_{\text{smoke}}(e)$) + deterministic Lift Lockout Override + Wheelchair Refuge routing. | **Plan B** (and **10/10 Unified** when both solvers run in the same engine). |
| **4. Courage** *(Live magic in first 10 seconds)* | **9.5/10** — Scan room / speak floor & shelf load -> hit **Trigger 6.8M Quake** -> watch furniture violently pitch over in 3D, crush the bed, and block the exit -> click **Auto-Remediate** -> side-by-side verified pass. | **9/10** — Scan the Imperial CAGB Level 2 hallway plan outside Room 200 -> block corridor -> trigger Lift Lockout Alert. | **Tie / Unified Wins** — Start with a 10s nod to CAGB Level 2 Room 200, then zoom straight into the 3D QuakeRoom shake table. |

---

## 2. Shared Engineering Built for BOTH Plan B & Plan C (`Ana/src/`)

Everything that is common between Plan B and Plan C is implemented as a unified, modular architecture inside `Ana/`:

1. **Unified TypeScript Contracts (`src/types/contracts.ts`)**
   - Shared spatial primitives, 2D/3D bounding boxes, A* waypoints, mobility clearance modes (`walk: 0.4m`, `wheelchair: 0.9m`), and Monte Carlo statistical confidence (`N = 50` synthetic earthquakes).
   - Full contract support for **Plan B (`RoomSceneGraph`, `EgressAndShelterResult`, `RemediationProposal`, `MonteCarloSummary`)** and **Plan C (`BuildingFloorGraph`, `LiveHazardEvent`, `EvacuationVerificationResult`)**.
2. **Shared Deterministic Physics & Pathfinding Engine (`src/solver/`)**
   - **2D Grid & Graph A* / Time-Expanded Dijkstra Solver**: Supports both room-level post-collapse occupancy grids (with `0.4m` walking and `0.9m` wheelchair obstacle inflation) and building-level time-expanded hazard propagation ($t_{\text{human}} < t_{\text{closure}}$).
   - **Analytical Housner Overturning + 50-Run Monte Carlo Shake Engine**: Computes composite Center of Mass ($h_{\text{CoM}}$) across parent furniture and shelf children, upper-floor modal amplification, kinetic impact energy ($J$), and 50-run Monte Carlo survival probability (`P(exit reachable)`).
   - **Self-Correcting Candidate Layout Verifier**: Tests any Gemini 4 Argon remediation candidate against hard constraints (inside room bounds, zero AABB overlap, doorway clearance, $SF \ge 1.15$, valid A* egress) *before* accepting it.
3. **Shared Multimodal Perception & Sanitizer Pipeline (`src/vision/` & `src/app/api/`)**
   - Frame/photo extraction and structured JSON schemas for **Gemini 4 Argon** (`gemini-4-argon` with automatic fallback).
   - **Deterministic Scene Sanitizer**: Snaps floor objects to `y = 0`, resolves bounding-box overlaps, attaches shelf items (`bottom` / `middle` / `top`), and validates topological floor graphs.
4. **Shared Gemini Live Voice & Expressive Audio Coach (`src/voice/`)**
   - Parses live natural-language voice commands for both Plan B (*"I'm on the 10th floor, renting so I can't drill, 20kg books on top shelf"*) and Plan C (*"East corridor blocked outside Room 200, get me to the lift!"* / *"Wheelchair accessible mode"*).
   - Synthesizes urgent P/S-wave seismic rumble audio, glass shatter alerts, Lift Lockout sirens, and spoken remediation briefings.
5. **Unified 3D Digital Twin & Split-Screen Command Center (`src/scene3d/` & `src/app/page.tsx`)**
   - Interactive Three.js / React Three Fiber 3D renderer for **Plan B (`QuakeRoomCanvas` with Before vs. Verified After split-screen comparison)** and **Plan C (`ExitZeroCanvas` with Imperial CAGB Level 2 floor-plan extrusion & walkthrough camera)**.
