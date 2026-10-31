# SeismicTwin 3D (`final/`) — Unified Multi-Room 3D Seismic Sanctuary, Collision Physics Engine & Building Evacuation Verifier

> **Google DeepMind × Imperial College London Hackathon — Final Unified Submission (`final/`)**  
> **Commits:** `1c1e4d0` / `ed530f7` (`final/` Unified Memory Palace 3D Graphics, 4-Room Connected Suite, Real-Time Collision & Pushable Obstacle Physics, `⌘P` Command Palette, and Plan B `QuakeRoom` + Plan C `ExitZero` Solvers)

---

## 1. Overview of the `final/` Directory

The [`final/`](./) directory contains **`SeismicTwin 3D`** (`SeismicCommandCenter` in [`src/app/page.tsx`](./src/app/page.tsx))—our unified full-screen 3D interactive simulation and deterministic safety verification platform combining **Plan B (`QuakeRoom` — 4-Room Connected Suite)** and **Plan C (`ExitZero` — 3D Building Floor Wing)**:

1. **🏠 Plan B (`QuakeRoomCanvas.tsx`) — 4-Room Connected Suite (`20.4 m × 13.2 m` World Footprint):**
   - Spawns the user directly inside a **1st-Person Player Walkthrough (`WASD` + Mouse Look + `Space` to Jump)** (or **3D Dollhouse Orbit View** where `WASD` moves the 3D Avatar) across **4 interconnected rooms** linked by `1.7 m – 1.8 m` open architectural doorways:
     - **Room 1 (`room_1`): Student Study & Bedroom (`6.8 m × 6.2 m`)** — Primary bedroom with bed, study desk, top-heavy bookshelf (`20 kg` textbooks on top shelf), and unanchored wardrobe by the exit door.
     - **Room 2 (`room_2`): Central Lounge & Dining Hall (`6.8 m × 6.2 m`)** — Lounge with sofa, Drop-Cover-Hold shelter dining table, curio cabinet, and pushable tea cart.
     - **Room 3 (`room_3`): Seismic Server & Research Lab (`6.8 m × 6.2 m`)** — Research annex with mainframe server rack, lab workbench, and pushable oscilloscope cart.
     - **Room 4 (`room_4`): North Gallery & Emergency Exit Wing (`20.4 m × 7.0 m`)** — North corridor gallery with debris obstacles leading to the emergency exit stairwell.
2. **🏢 Plan C (`ExitZeroCanvas.tsx`) — 3D Building Floor Wing (Imperial CAGB Level 2):**
   - Full 3D extruded building floor wing with walkable rooms, doorway gaps, interior corridor obstacles (`Corridor Avionics Cart`, `Supply Crate`, `Fallen Ceiling Duct`, `Atrium Oak Bench`), dynamic **time-expanded A\* route ribbons**, **East Corridor Structural Collapse** hazard toggle, **Lift Lockout Override**, and **Wheelchair Accessible Refuge** routing.
3. **⚡ Real-Time Rigid-Body Seismic & Player Collision Physics (`src/scene3d/collisionPhysics.ts`):**
   - **Seismic Excitation & Tipping (`stepObjectPhysics`):** Simulates 2D harmonic ground waves scaled by floor-amplified Peak Ground Acceleration (`pgaG`), frictional floor sliding, tipping angular velocity integration, dynamic footprint AABB expansion as tall furniture pitches over, 2-iteration **Object-to-Object AABB impulse resolution**, and **Object-to-Wall segment collision**.
   - **Interactive Player Capsule Physics (`resolvePlayerCollisions`):** Smooth sliding collision against architectural walls (`SUITE_WALLS` with doorway gaps) and furniture AABBs. Walking into movable objects ($\text{mass} \le 45\text{ kg}$, e.g., carts, chairs, supply crates) **physically pushes them across the floor**, and pressing **`Space`** lets the player **jump over low obstacles** (`lowObstacle: true`, player height $> 1.85\text{ m}$).
4. **🎨 Memory Palace Procedural 3D Textures (`src/scene3d/proceduralTextures.ts`):**
   - Zero external image dependencies required for 3D materials—generates high-resolution procedural diffuse textures, bump maps, furniture wood/fabric/metal shaders, and glassmorphic 3D telemetry sprites (`TelemetrySprite`) on the fly across **5 switchable architectural floor styles**:
     - `wood` (**Versailles Wood Parquet**), `marble` (**Calacatta Marble & Gold**), `stone` (**Ashlar Stone Masonry**), `carpet` (**Crimson & Gold Damask Carpet**), and `cyber` (**Cyber Telemetry Grid**).
5. **🔍 Stripped-Back Full-Screen HUD + Universal `⌘P` (`Cmd+P` / `Ctrl+P`) Settings Command Palette:**
   - Launches in clean **Full-Screen 3D Viewport Mode (`fullScreenMode = true`)** with a floating top HUD bar (`SeismicTwin 3D`, active mode pill, live survivability badge, `Simulate Quake` button, `Search Settings ⌘P`, and collapsible `Menu` drawer).
   - Pressing **`⌘P` / `Ctrl+P`** opens an instant Spotlight-style search modal with inline **Magnitude (`5.0 – 7.8 Mw`)** and **Building Floor (`Floor 1 – 20`)** sliders plus **23 keyboard-navigable (`↑↓` + `Enter`) actions**.

---

## 2. Exact File-by-File Architecture of `final/`

```text
final/
├── package.json                         # Scripts (`dev`, `build`, `start`, `typecheck`) & dependencies
├── tsconfig.json                        # Strict TypeScript config (`@/*` -> `./src/*`)
├── next.config.mjs                      # Next.js 14 App Router config
├── tailwind.config.js                   # Tailwind CSS dark HUD styling
├── postcss.config.js                    # PostCSS configuration
├── DECISION_AND_ARCHITECTURE.md         # Plan B (QuakeRoom) + Plan C (ExitZero) architectural analysis
├── AGENTS.md                            # Multi-agent coordination & module ownership log
│
├── src/
│   ├── app/
│   │   ├── page.tsx                     # SeismicCommandCenter (1,823 lines): Full-screen 3D UI, ⌘P command
│   │   │                                # palette (23 actions), collapsible Menu drawer, Split-Screen Compare
│   │   ├── layout.tsx                   # Root Next.js layout & metadata
│   │   ├── globals.css                  # Global Tailwind & custom scrollbar/HUD styles
│   │   └── api/
│   │       ├── extract/route.ts         # POST /api/extract   — Gemini Vision room photo/video -> RoomSceneGraph
│   │       ├── remediate/route.ts       # POST /api/remediate — Gemini 4 Argon zero-drill remediation loop
│   │       ├── floorplan/route.ts       # POST /api/floorplan — 2D floorplan image -> BuildingFloorGraph
│   │       ├── hazard/route.ts          # POST /api/hazard    — Live camera/voice -> LiveHazardEvent
│   │       └── route-twin/route.ts      # GET  /api/route-twin — Serves CAGB L2 Route A twin & Argon benchmarks
│   │
│   ├── scene3d/
│   │   ├── QuakeRoomCanvas.tsx          # (2,223 lines) 4-Room Connected Suite R3F renderer (`SUITE_W=20.4m`,
│   │   │                                # `SUITE_D=13.2m`), 1st-person WASD + Jump & 3D Orbit Avatar,
│   │   │                                # seismic shake table, fall-shadow cones, A* emerald path tubes
│   │   ├── ExitZeroCanvas.tsx           # (955 lines) 3D Building Floor Wing renderer, extruded walls/doors,
│   │   │                                # pushable `WING_OBSTACLES`, expanding hazard plumes, route ribbons
│   │   ├── collisionPhysics.ts          # (394 lines) `stepObjectPhysics` & `resolvePlayerCollisions`:
│   │   │                                # object tipping, AABB-vs-AABB impulse, wall segments, pushable carts
│   │   ├── proceduralTextures.ts        # (25.8 KB) Procedural HTML5 Canvas textures & bump maps (`wood`,
│   │   │                                # `marble`, `stone`, `carpet`, `cyber`) + `getGlassPillTexture`
│   │   └── cagbRouteTwinModels.ts       # (16.8 KB) 4-stage coordinate transforms (`9.52 px/m`) & 52 real
│   │                                    # CAGB Level 2 Route A 3D procedural object builders
│   │
│   ├── solver/
│   │   ├── quakeRoomSolver.ts           # (22.3 KB) `evaluateRoomScene`, `calculateFloorPGA`, Analytical
│   │   │                                # Housner overturning SF, N=50 Monte Carlo, 0.2m grid A* pathfinder
│   │   └── exitZeroSolver.ts            # (9.8 KB) `verifyBuildingEvacuation`, time-expanded Dijkstra/A*,
│   │                                    # Lift Lockout Override, Wheelchair Accessible Refuge routing
│   │
│   ├── vision/
│   │   ├── sceneSanitizer.ts            # Deterministic scene sanitizer (y=0 floor snap, 2D overlap resolution,
│   │   │                                # parent-child shelf height snapping)
│   │   └── videoKeyframeExtractor.ts    # Client/server video & webcam keyframe extractor
│   │
│   ├── voice/
│   │   ├── voiceCoach.ts                # `parseVoiceConstraintTranscript`, `speakCoachMessage`,
│   │   │                                # `cyclePreferredHumanVoice` (natural neural speech synthesis)
│   │   └── seismicAudioSynth.ts         # WebAudio API P-wave / S-wave seismic rumble & Lift Lockout siren
│   │
│   ├── presets/
│   │   ├── demoPresets.ts               # `STUDENT_BEDROOM_UNSAFE`, `STUDENT_BEDROOM_REMEDIATED`,
│   │   │                                # `DEFAULT_REMEDIATION_PROPOSAL`, `IMPERIAL_FLOOR_GRAPH`, `DEFAULT_LIVE_HAZARDS`
│   │   └── cagbRouteARooms.json         # 4 real Imperial CAGB Level 2 zones (`room200`, `hall`, `corridor`, `lobby`)
│   │
│   └── types/
│       └── contracts.ts                 # Shared TypeScript interfaces (`RoomSceneGraph`, `EgressAndShelterResult`,
│                                        # `RemediationProposal`, `BuildingFloorGraph`, `EvacuationVerificationResult`)
│
├── results/
│   └── route_A_montecarlo.json          # Pre-computed N=50 Monte Carlo walk (0.4m) & wheelchair (0.9m) results
│
├── public/
│   ├── evidence/
│   │   ├── argon_verification.json      # Gemini 4 Argon spatial verification across 30 CAGB walk keyframes
│   │   ├── argon_vs_ground_truth.json   # 52/52 object recall (100%) & 0.157m median XY error benchmark
│   │   └── extracted_scene.json         # Full 52-object extracted CAGB Level 2 Route A scene graph
│   ├── floorplans/
│   │   ├── cagb-L2.jpg                  # Calibrated Imperial CAGB Level 2 floorplan (1934x1366, 9.52 px/m)
│   │   ├── cagb-L2-1280.jpg             # Web-optimized floorplan texture
│   │   ├── cagb-L2-preview.jpg          # Thumbnail preview
│   │   └── routes/routes.json           # Calibrated pixel waypoints for Routes A, B, C, and D
│   └── index.html, styles.css, js/      # Standalone static 3D World visualizer assets served by `server.js`
│
└── server.js                            # Standalone zero-dependency Node HTTP server (`npm run start`)
```

---

## 3. Core Systems & Technical Capabilities

### 3.1 4-Room Connected Suite & Teleportation (`src/scene3d/QuakeRoomCanvas.tsx`)
The Multi-Room Suite spans **`20.4 m × 13.2 m`** (`X: -10.2 m to +10.2 m`, `Z: -6.6 m to +6.6 m`, wall height `3.35 m`, wall thickness `0.18 m`) with 5 labeled doorway lintels (`TO NORTH GALLERY`, `GALLERY ARCH`, `LAB PASSAGE`, `TO LOUNGE (RM 2)`, `TO LAB (RM 3)`):

| Room ID | Room Name | World Bounds $(X, Z)$ | Spawn Coordinates | Key Furniture & Interactive Physics Bodies |
| :--- | :--- | :--- | :--- | :--- |
| **`room_1`** | **Student Study & Bedroom** | $X \in [-10.2, -3.4]$, $Z \in [0.4, 6.6]$ | `(-8.2, 5.1)` | Bed, study desk (Drop-Cover-Hold shelter),chair, oak bookshelf with **`20 kg` top-shelf textbooks**, unanchored tall wardrobe near doorway, window |
| **`room_2`** | **Central Lounge & Dining Hall** | $X \in [-3.4, 3.4]$, $Z \in [0.4, 6.6]$ | `(-0.3, 4.4)` | Sectional sofa, heavy dining shelter table, glass curio cabinet, **pushable tea cart** |
| **`room_3`** | **Seismic Server & Research Lab** | $X \in [3.4, 10.2]$, $Z \in [0.4, 6.6]$ | `(6.4, 4.4)` | Unanchored mainframe server rack, reinforced lab workbench, **pushable oscilloscope cart** |
| **`room_4`** | **North Gallery & Emergency Exit Wing** | $X \in [-10.2, 10.2]$, $Z \in [-6.6, 0.4]$ | `(-2.4, -3.1)` | Long gallery corridor, low jumpable debris obstacles, pushable supply crates, **Emergency Exit Door** |

### 3.2 Real-Time Seismic Rigid-Body & Player Capsule Collision Physics (`src/scene3d/collisionPhysics.ts`)
- **Seismic Ground Excitation (`stepObjectPhysics`):**
  During an earthquake (`isShaking = true`), objects experience multi-frequency horizontal ground acceleration waves scaled by `pgaG * 9.81`:
  - **Sliding:** Unanchored movable bodies slide when `pgaG` exceeds `friction * 0.45`.
  - **Tipping (`willTip`):** Objects whose analytical Housner Safety Factor $SF < 1.0$ accelerate rotationally (`angVelX`, `angVelZ`) toward their floor impact angle (`targetRotX`, `targetRotZ`), dynamically expanding their 2D collision bounding box (`currHalfW`, `currHalfD`).
  - **2-Pass Object-to-Object & Object-to-Wall Resolution:** Prevents interpenetration between toppling furniture, sliding carts, and architectural walls using mass-proportioned impulse transfer.
- **Interactive Player Walkthrough (`resolvePlayerCollisions`):**
  - **Wall & Furniture Sliding:** The player's `0.38 m` radius capsule slides smoothly along wall segments (`closestPointOnSegment`) and heavy furniture AABBs.
  - **Pushable Obstacles:** Walking into any unanchored object with `movable === true` and `mass <= 45 kg` transfers a `1.35 m/s` push impulse (`pushRatio = 0.55`), allowing the user to physically clear carts and crates out of doorways.
  - **Jumping Over Low Debris:** Pressing `Space` triggers a vertical jump; when `playerPos.y > 1.85 m`, low obstacles (`lowObstacle: true`) are cleared.

### 3.3 Deterministic Physics & Evacuation Verifiers (`src/solver/`)
1. **Plan B — Analytical Housner Overturning + `N=50` Monte Carlo + `0.20 m` Grid A\* (`quakeRoomSolver.ts`):**
   - **Floor PGA Amplification (`calculateFloorPGA`):**
     $$\text{PGA}_{\text{base}}(M_w) = 10^{0.38(M_w - 6.0)} \times 0.18\,g, \qquad a_{\text{floor}} = \text{PGA}_{\text{base}}(M_w) \times \bigl(1 + 0.12\,(L - 1)\bigr)$$
   - **Composite Center of Mass ($h_{\text{CoM}}$) & Overturning Safety Factor ($SF$):**
     $$h_{\text{CoM}} = \frac{m_p (0.5\,H_p) + \sum_{c \in \mathcal{C}(p)} m_c \, h_{\text{shelf}}(c)}{m_p + \sum_{c \in \mathcal{C}(p)} m_c}, \qquad SF = \frac{b / h_{\text{CoM}}}{a_{\text{floor}} / g}$$
   - **Renter-Safe Ballast Remediation:** Relocating `20 kg` of textbooks from the `top` shelf ($0.86\,H_p$) to the `bottom` shelf ($0.18\,H_p$) lowers $h_{\text{CoM}}$ from **`1.48 m` to `0.58 m`**, raising $SF$ from **`0.54` (tips) to `1.42` (stable)** without drilling into walls.
   - **Seeded `N=50` Monte Carlo & Dual-Capsule A\*:** Evaluates 50 perturbed seismic runs (`seed = 42`) on a `0.20 m` occupancy grid for both **Walking (`0.40 m` capsule)** and **Wheelchair (`0.90 m` capsule)** clearance.
2. **Plan C — Time-Expanded Building Evacuation & Lift Lockout (`exitZeroSolver.ts`):**
   - Verifies $t_{\text{human}}(e) < t_{\text{hazard\_closure}}(e)$ across the building graph (`IMPERIAL_FLOOR_GRAPH`).
   - Enforces **hard Lift Lockout (`UNSAFE_LIFT`)** when an occupant requests the elevator during a seismic or fire emergency, and routes wheelchair users (`mobilityMode === "wheelchair_accessible"`) away from stairs to certified **Accessible Refuges**.

### 3.4 Universal `⌘P` (`Cmd+P` / `Ctrl+P`) Searchable Settings Palette (`src/app/page.tsx`)
Pressing **`⌘P`** (Mac) or **`Ctrl+P`** (Windows/Linux) from anywhere in the 3D viewport opens the interactive command palette with live **Magnitude (`5.0–7.8 Mw`)** and **Floor (`1–20`)** sliders plus **23 instant commands**:

| Category | Searchable Commands in `⌘P` |
| :--- | :--- |
| **Simulation** | `Simulate Earthquake (Trigger Quake & Object Physics)`, `Apply Renter-Safe Remediation Fix`, `Reset Unsafe Room & Obstacles` |
| **Display Mode** | `Switch to 3D Multi-Room Suite (4 Connected Rooms)`, `Switch to 3D Building Floor Wing (Imperial CAGB L2)` |
| **Camera & View** | `Toggle 1st-Person Player Walkthrough vs 3D Dollhouse Orbit`, `Toggle 3D Item Label Popups`, `Toggle Before / After Split-Screen Comparison`, `Toggle Full-Screen Viewport Mode` |
| **Teleport Player** | `Teleport to Room 1: Student Study & Bedroom`, `Teleport to Room 2: Central Lounge & Dining Hall`, `Teleport to Room 3: Seismic Server & Research Lab`, `Teleport to Room 4: North Gallery & Emergency Exit Wing` |
| **3D Surface Material** | `Versailles Wood Parquet` (`wood`), `Calacatta Marble & Gold` (`marble`), `Ashlar Stone Masonry` (`stone`), `Crimson & Gold Damask Carpet` (`carpet`), `Cyber Telemetry Grid` (`cyber`) |
| **Seismic Magnitude** | `Set Earthquake Magnitude: 6.0 Mw`, `7.1 Mw`, `7.8 Mw` |
| **Building Floor** | `Set Building Floor: Floor 1 (Ground)`, `Floor 10 (High-Rise Sway)`, `Floor 18 (Penthouse Extreme Sway)` |
| **Building & Audio** | `Toggle East Corridor Structural Collapse Hazard`, `Toggle Wheelchair Accessible Refuge Mode`, `Switch Natural Human Voice Coach`, `Open Full Settings & Telemetry Drawer` |

---

## 4. Imperial CAGB Level 2 Ground-Truth Evidence (`public/evidence/` & `results/`)

Included inside `final/` are the complete venue calibration and Gemini 4 Argon verification datasets from Imperial College's **City & Guilds Building (CAGB) Level 2**:
- **[`public/floorplans/cagb-L2.jpg`](./public/floorplans/cagb-L2.jpg) & [`routes.json`](./public/floorplans/routes/routes.json):** Calibrated at **`9.52 px/m`** (`1934 × 1366 px`).
- **[`public/evidence/argon_vs_ground_truth.json`](./public/evidence/argon_vs_ground_truth.json):** **`52 / 52` real objects recovered (`100%` recall)** along Route A (`Room 200 → Concourse Hall → Fire Corridor → Exhibition Rd Lobby`) with **`0.157 m` median XY localization error** (`0.196 m` mean).
- **[`results/route_A_montecarlo.json`](./results/route_A_montecarlo.json):** Pre-computed `N=50` Monte Carlo clearance across all 4 CAGB Level 2 zones (`room200`: `0/50`, `hall`: `50/50` walk / `0/50` wheelchair pinch-point trap, `corridor`: `50/50`, `lobby`: `0/50` → all **`50/50`** after zero-drill Argon remediation).

---

## 5. Quickstart & Running `final/`

### 1. Install Dependencies
```bash
cd final
npm install
```

### 2. Environment Setup (Optional)
Create `final/.env.local` if you want live Gemini API calls (all 3D physics, presets, voice synthesis, and deterministic solvers work 100% offline out of the box):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Typecheck
```bash
npm run typecheck
```

### 4. Start the Next.js 14 `SeismicTwin 3D` Command Center (Recommended)
```bash
npx next dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
- Use **`W A S D`** or **Arrow Keys** to walk through the 4 connected rooms (or move the 3D Avatar in Orbit mode), **Mouse Drag** to look around, and **`Space`** to jump over low obstacles.
- Walk into carts or light obstacles to physically push them out of doorways.
- Press **`⌘P` / `Ctrl+P`** anytime to search settings, switch floor materials (`Wood`, `Marble`, `Stone`, `Carpet`, `Cyber`), teleport between Rooms 1–4, trigger an earthquake, apply the Renter-Safe Remediation Fix, or switch to the **3D Building Floor Wing**.
