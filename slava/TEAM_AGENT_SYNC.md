# Team Multi-Agent Synchronization Guide (`TEAM_AGENT_SYNC.md`)

**Authoritative reference for all team agents (Slava / OpenClaw / Claude, Ava, Sam, Pushkar, Ana) collaborating on `main`.**

---

## 1. Canonical Shared Facts & Artifacts

### Demo Screen & Primary Viewer
- **Entrypoint:** `slava/viewer/index.html`
- **Experience:** First-Person Exit Walk from **Room 200 -> Exhibition Road** with a zero-clutter viewport, interactive **`Cmd+Space` / `Ctrl+Space` Spotlight Command Palette**, and seeded **`N=50` Monte Carlo** seismic egress simulation.

### Ground-Truth Route A Scene & Evidence (52 Objects)
- **Scene Graph / Ground Truth:** `slava/route_A/scene.json` (52 cataloged route objects & hazards)
- **Video Frame Photo Evidence:** `slava/route_A/evidence/*.jpg`
- **Real Surface & Object Textures:** `slava/viewer/textures/*.jpg`

### Canonical Floorplan, Scale & Coordinate Systems
- **Floorplan Asset:** `assets/floorplans/cagb-L2.jpg`
- **Resolution:** `1934 x 1366` px
- **Scale (`plan_px_per_m`):** `9.52` px/m
- **Building Metric Frame `(X, Y, Z)`:**
  - `X = u / 9.52` (East, meters)
  - `Y = (1366 - v) / 9.52` (North, meters)
  - `Z = up` (Elevation, meters)
- **Three.js Viewer Coordinates:**
  - `[X - 150, Z, -(Y - 80)]`

### Live Computed Results Contract
- **Contract Path:** `slava/contracts/building.cagb_l2_live.json`
- Feeds real-time clearance, blockage frequencies, and verification states into the stage viewer.

---

## 2. Cross-Agent Handoff Targets

Each team agent owns a clear output contract that integrates automatically or directly with the canonical viewer and verification pipeline:

| Team Member / Agent | Target Artifact Path | Integration Contract & Behavior |
| :--- | :--- | :--- |
| **Ava's Agent** | `ava/results/argon_fix_main_exit.json` | Write the Argon rearrangement layout here. `slava/viewer` **auto-loads** this file when present and enables the **"Argon fix"** label and layout state. |
| **Sam's Agent** | `sam/results/route_A_montecarlo.json` | Cross-check the Route A `N=50` Monte Carlo simulation in the TypeScript solver and write verification metrics here. |
| **Pushkar's Agent** | `pushkar/extraction_evaluation.json` | Evaluate Gemini object extraction against `slava/route_A/scene.json` (52 ground-truth objects). `slava/viewer` **auto-loads** this file and displays the live recovery score in the Command Palette / inspector. |
| **Ana's Agent** | `slava/scene3d/RealisticCAGBModels.tsx` | Reusable React Three Fiber (R3F) 3D models ready for import into R3F scenes. |

---

## 3. Git & Folder Isolation Protocol

To prevent merge conflicts during final sprint integration on `main`:

1. **Always Rebase Before Pushing:**
   ```bash
   git pull --rebase
   ```
   Run `git pull --rebase` immediately before every `git push`.
2. **Strict Folder Ownership:**
   - Edit **only** inside your own designated directory (`slava/`, `ava/`, `sam/`, `pushkar/`, `ana/`).
   - Do not modify another agent's folder directly unless explicitly coordinated.
3. **Cross-Agent Requests via Inbox:**
   - Communicate schema requests, handoff updates, or integration asks by dropping a markdown/JSON note in:
     `coordination/inbox/<agent>/`
