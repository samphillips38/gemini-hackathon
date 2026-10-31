# Ana — ClearExit (`QuakeRoom` + `ExitZero` Unified Seismic Digital Twin)

**Google DeepMind x Imperial College London Hackathon (31 Oct 2026)**

See [`DECISION_AND_ARCHITECTURE.md`](./DECISION_AND_ARCHITECTURE.md) for the full evaluation of **Plan B (`QuakeRoom`)** vs. **Plan C (`ExitZero`)** and the shared architecture powering both.

## Why Plan B (`QuakeRoom`) + Plan C (`CAGB Level 2 Opener`) Wins

- **Lead Pitch — Plan B (`QuakeRoom` — 39/40 Judge Score):**
  - **Specificity:** Upper-floor university student renter where falling furniture and blocked bedroom doors cause 30–50% of urban earthquake injuries, and lease agreements prohibit drilling into walls.
  - **Alchemy (Multimodal Interdependence):**
    - **Vision (`Gemini 4 Argon`)** extracts metric 3D room geometry (`RoomSceneGraph`).
    - **Voice (`Gemini Live` / WebSpeech)** provides invisible physical constraints (`10th floor` whiplash amplification, `renter: no wall drilling`, `20kg textbooks on top shelf`).
    - **Deterministic Physics & A\* Verifier** discovers the counter-intuitive zero-drill fix: relocating `20kg` textbooks from the **top shelf to the bottom shelf** drops $h_{\text{CoM}}$ from $1.48\text{m} \to 0.58\text{m}$ and raises the Housner overturning Safety Factor $SF$ from $0.54$ to $1.42$ (acting as natural ballast!), while sliding the wardrobe away from the exit door and moving the bed out of the window shatter zone.
  - **Rigor:** Analytical Housner tipping threshold ($SF = \frac{b/h_{\text{CoM}}}{a_{\text{floor}}/g}$) + **N = 50 Monte Carlo seismic simulation** (`0.4m` walking & `0.9m` wheelchair clearance) + post-collapse 2D occupancy grid A* pathfinder + verified Drop-Cover-Hold shelter under desk.
- **Stage Opener — Plan C (`ExitZero` — Imperial CAGB Level 2 Building Twin):**
  - Uses the real **City & Guilds Building (CAGB) Level 2** floor plan (calibrated at `11.43 px/m` from the `2.10m` Exhibition Road double doors, with Routes A–D overlays), time-expanded Dijkstra evacuation verification ($t_{\text{human}} < t_{\text{smoke\_closure}}$), deterministic **Lift Lockout Override**, and Wheelchair Accessible Refuge routing.

## Quickstart

```bash
cd Ana
cp .env.example .env.local   # Add GEMINI_API_KEY
npm install
npm run typecheck            # Verify zero TypeScript errors
npm run dev                  # Open http://localhost:3000
```
