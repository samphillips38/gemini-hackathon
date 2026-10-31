# 3-Minute Live Stage Demo Script & Backup Recording Checklist (`DEMO.md`)

**Deadlines (GMT):**
- **15:45 GMT:** Backup screen recording locked & verified
- **16:00 GMT:** Final submission deadline
- **16:30 GMT:** Live stage presentation (3 minutes strict)

**Primary Demo URL / File:** `slava/viewer/index.html`

---

## Live 3-Minute Stage Script

### `0:00 – 0:15` | Macro Overview & Context
- **Action:** Start in **Macro Overview** with **Room 200** pinned (press `Cmd+Space` -> select **Overview**, or press `1`).
- **Talk Track:** Introduce the City & Guilds Building (CAGB Level 2) digital twin reconstructed from walkthrough video and floorplan `assets/floorplans/cagb-L2.jpg` (`9.52 px/m`), showing our exact starting point inside **Room 200** and the primary evacuation route to **Exhibition Road**.

### `0:15 – 0:50` | Pure Immersive First-Person Exit Walk
- **Action:** Transition into the **First-Person Walk** starting on the **Room 200 front floor** -> walk through the **blue double doors** -> **vestibule** -> **Breakout hall** -> **C&G stairs/ramp** -> **Exhibition Road lobby**.
- **Visual Check:** Keep **zero UI clutter on screen** so judges experience the pure architectural space, real surface textures (`slava/viewer/textures/*.jpg`), and 52 mapped route objects (`slava/route_A/scene.json`).

### `0:50 – 1:40` | Seismic Shake (`N=50` Monte Carlo at `0.35 g`)
- **Action:** Press **`Cmd+Space`** (or `Ctrl+Space`) to summon the **Spotlight Command Palette** -> click **"Shake 50x at 0.35 g"**.
- **Visual & Readout:** Watch unanchored hazards— freestanding banners, mobile cart, display totems, and corridor obstacles—animate falling into the egress path.
- **Talk Track:** Read out the exact computed **`X/50` blocked frequency** and the **narrowest corridor clearance** from the seeded `N=50` Monte Carlo simulation, demonstrating how non-structural clutter turns a compliant corridor into a pinch-point failure for walking (`0.40 m`) and wheelchair (`0.90 m`) egress.

### `1:40 – 2:20` | Argon Fix Layout & Re-Verification (`50/50` Clear)
- **Action:** Open **`Cmd+Space`** -> click **"Apply Fix Layout · Re-Verify 50x"**.
- **Visual & Readout:** Watch hazards automatically relocate and anchor according to the remediation layout (`ava/results/argon_fix_main_exit.json`), then re-run the seeded `50x` Monte Carlo check.
- **Talk Track:** Highlight the verified result: **`50/50` clear** across both **walking (`0.40 m`)** and **wheelchair (`0.90 m`)** clearance thresholds.

### `2:20 – 2:50` | Ground-Truth Evidence & Gemini Extraction Score
- **Action:** Open **`Cmd+Space`** and search any cataloged route object (e.g., **"Jet Engine"**, **"Marble Statue"**, or **"Build the Future banner"**).
- **Visual & Readout:** Display the object's real video frame evidence from `slava/route_A/evidence/*.jpg` alongside **Pushkar's Gemini extraction evaluation score** (`pushkar/extraction_evaluation.json` against the 52-object ground truth).

### `2:50 – 3:00` | Safety-Correct Closing Framing
- **Talk Track:** Close with the essential life-safety distinction:
  1. **During shaking:** **Drop, Cover, and Hold On**—do not attempt to run while the building is shaking.
  2. **After shaking stops:** Evacuate along the **pre-verified, hazard-cleared exit route** to Exhibition Road.
  3. **Never use lifts** during or after an earthquake.

---

## Backup Recording & Pre-Stage Checklist (Deadline 15:45 GMT)

- [ ] `slava/viewer/index.html` loads cleanly with all textures (`slava/viewer/textures/*.jpg`) and evidence frames (`slava/route_A/evidence/*.jpg`).
- [ ] Cross-agent JSON contracts present or gracefully handled (`slava/contracts/building.cagb_l2_live.json`, `ava/results/argon_fix_main_exit.json`, `pushkar/extraction_evaluation.json`, `sam/results/route_A_montecarlo.json`).
- [ ] Viewport starts with zero UI clutter at `1920x1080` (or native Retina full-screen) at 60 FPS.
- [ ] `1` / `Cmd+Space -> Overview` snaps cleanly to Macro Overview with Room 200 pinned.
- [ ] First-person camera path smoothly traverses Room 200 -> blue double doors -> vestibule -> Breakout hall -> C&G stairs/ramp -> Exhibition Road lobby.
- [ ] `Cmd+Space` -> **"Shake 50x at 0.35 g"** triggers physics fall animations and displays `X/50` blocked stats + narrowest clearance.
- [ ] `Cmd+Space` -> **"Apply Fix Layout · Re-Verify 50x"** relocates/anchors hazards and confirms **`50/50` clear** (`0.40 m` walking / `0.90 m` wheelchair).
- [ ] Searching **"Jet Engine"**, **"Marble Statue"**, and **"Build the Future banner"** in `Cmd+Space` opens the photo evidence card and extraction score.
- [ ] Backup video recorded, inspected end-to-end (< 3:00 duration), and saved before **15:45 GMT**.
