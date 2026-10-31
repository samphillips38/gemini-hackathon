# CAGB Level 2 — 3D Reconstruction & Capture Alignment Plan

**Artifact:** `assets/floorplans/RECONSTRUCTION_PLAN.md`  
**Scope Lock:** City and Guilds Building (CAGB), Level 2 only (`assets/floorplans/cagb-L2.jpg`, `1934 × 1366 px`)  
**Contracts Verified:** `slava/contracts/building.example.json` (v1.0) & `slava/contracts/room.example.json` (v1.0)  
**Capture Outputs:** `captures/room.mp4`, `captures/walk1.mp4`, `captures/walk2.mp4`

---

## 1. Contract & Asset Path Verification

Before running the pipeline, align these verified paths and schema keys across modules:

| Item | Contract / Doc Reference | Actual Repo Path / Field | Alignment Action |
|---|---|---|---|
| Level 2 full-res plan | `building.example.json` → `conventions.plan_image`: `"captures/floorplans/cagb-L2.jpg"` | `assets/floorplans/cagb-L2.jpg` (`1934 × 1366 px`) | Copy or symlink `assets/floorplans/*.jpg` to `captures/floorplans/` and `web/public/floorplans/` (per `assets/floorplans/README.md`). |
| Level 2 preview crop | `assets/floorplans/README.md` | `assets/floorplans/cagb-L2-preview.jpg` (`700 × 570 px`) | Use full-res `cagb-L2.jpg` (`1934 × 1366`) for all `plan_px` coordinates so pixel indices are invariant. |
| Building walk videos | `building.example.json` → `objects[].evidence.video` | `"captures/walk1.mp4"`, `"captures/walk2.mp4"` | Gitignored local files; serve via `engine/server/` static mount at `/captures/*`. |
| Room deep-dive video | `room.example.json` → `source.video` | `"captures/room.mp4"` | 10–20 s slow pan of Breakout space or Room 203. |
| Replay keyframes | `room.example.json` → `results.replay.frames_file` | `"results/replay.json"` | Exported at `results.replay.fps = 30` for one representative run (`results.replay.run_index`). |

### Verified Contract Field Checklist
- **`building.example.json`**:
  - `conventions`: `units` (`"metres"`), `plan_image`, `plan_px_per_m`, `scale_reference`, `object_anchor`
  - `floor`: `"City and Guilds Building, Level 2"`
  - `nodes[]`: `{ id, type, label, plan_px, usable_in_quake? }` (`type ∈ {"room", "space", "lift", "stairs", "exit"}`)
  - `edges[]`: `{ id, from, to, length_m, min_width_m }`
  - `objects[]`: `{ id, type, edge, along_m, side, size_m, mass_kg, anchored, glass, evidence: { video, t_s, quote } }` (`side ∈ {"left", "right", "centre"}`)
  - `results`: `{ routes: [{ from, to, path, p_clear: { walk, wheelchair }, blocked_by }], shelter_spots: [] }`
- **`room.example.json`**:
  - `conventions`: `units`, `axes`, `furniture_pos`, `furniture_size`, `walls`
  - `source`: `{ video, frames_used, model }`
  - `room`: `{ dims_m: { x, y, z }, dims_uncertainty_pct }`
  - `doors[]`: `{ id, wall, offset_m, width_m }` (`wall ∈ {"x0", "xmax", "y0", "ymax"}`)
  - `windows[]`: `{ id, wall, offset_m, width_m, sill_m, glass }`
  - `furniture[]`: `{ id, type, pos_m: [x, y], yaw_deg, size_m: [dx, dy, dz], mass_kg, anchored, glass, sturdy_shelter, movable }`
  - `spawn_points_m[]`: `[[x, y], ...]`
  - `sim`: `{ runs, pga_g_range: [min_g, max_g], duration_s, seed, agent_clearance_m: { walk, wheelchair } }`
  - `results`: `{ exit_reachable_p: { walk, wheelchair }, blocked_by, shelter_spot_m, replay: { run_index, fps, frames_file }, iterations: [{ layout_changes: [{ id, pos_m, yaw_deg }], exit_reachable_p: { walk, wheelchair }, argon_rationale }] }`

---

## 2. Exact 4-Stage 3D Coordinate Pipeline

To prevent axis flips and quaternion bugs between floorplan overlays, MuJoCo physics, and the Three.js viewer, the pipeline uses four strictly defined coordinate frames.

```
Stage 1: Floorplan Image Pixels (u, v)         [2D raster, top-left origin, u right, v down]
   │  (calibrated via plan_px_per_m = 11.43 px/m)
   ▼
Stage 2: Building Metric Frame (X_b, Y_b, Z_b) [3D right-handed, z-up, metres, building-wide]
   │  (rigid room anchor T_building->room at room floor corner)
   ▼
Stage 3: Local Room MuJoCo Frame (x_r, y_r, z_r) + quat (w, x, y, z) [3D right-handed, z-up]
   │  (converted in ONE place inside web/ scene loader)
   ▼
Stage 4: Three.js Web Viewer Frame (x_t, y_t, z_t) + quat (x, y, z, w) [3D right-handed, y-up]
```

### Stage 1 → Stage 2: Floorplan Image Pixels `(u, v)` to Building Metric Frame `(X_b, Y_b, Z_b)`

- **Image domain (`assets/floorplans/cagb-L2.jpg`)**:
  - Width $W = 1934\text{ px}$, Height $H = 1366\text{ px}$.
  - Pixel coordinates $\text{plan\_px} = [u, v]$ have origin $(0, 0)$ at the **top-left corner**:
    - $+u$ runs **East** (left $\to$ right, toward Exhibition Road at $u \approx 1540$).
    - $+v$ runs **South** (top $\to$ bottom, from College Cafe at $v \approx 230$ toward the Skempton walkway at $v \approx 1150$).
- **Scale Calibration (`conventions.plan_px_per_m`)**:
  - **Primary reference (`conventions.scale_reference`)**: Main entrance (Exhibition Road) double doors have a known AccessAble clear opening of **$2.10\text{ m}$** and span **$24\text{ px}$** on `cagb-L2.jpg` ($u = 1538, v \in [436, 460]$):
    $$\text{plan\_px\_per\_m} = s = \frac{24\text{ px}}{2.10\text{ m}} \approx 11.43\text{ px/m} \quad \left(\frac{1}{s} \approx 0.0875\text{ m/px}\right)$$
  - **Cross-checks on `cagb-L2.jpg`**:
    - Dalby Court automatic door ($1.12\text{ m}$ AccessAble) spans $13\text{ px}$ ($13 / 11.43 = 1.14\text{ m}$).
    - Dalby Court ramp width ($1.06\text{ m}$ AccessAble) spans $12\text{ px}$ ($12 / 11.43 = 1.05\text{ m}$).
    - Lift shaft interior width ($\sim 2.0\text{ m}$ standard) spans $23\text{ px}$ ($23 / 11.43 = 2.01\text{ m}$).
- **Metric Transformation**:
  - Define the building metric origin $(X_b, Y_b, Z_b) = (0, 0, 0)$ at the bottom-left image corner $(u_0, v_0) = (0, H) = (0, 1366)$ at Level 2 datum $Z_b = 0$:
    $$X_b = \frac{u}{s}, \qquad Y_b = \frac{H - v}{s}, \qquad Z_b = z_{\text{elevation}}$$
  - This makes $(X_b, Y_b, Z_b)$ a **right-handed, z-up metric frame**: $+X_b$ East, $+Y_b$ North, $+Z_b$ Up.
  - Inverse mapping (Building metric $\to$ Floorplan pixel overlay):
    $$u = s \cdot X_b, \qquad v = H - s \cdot Y_b$$

#### Mapping Edge-Anchored Hazards (`building.example.json` → `objects[]`)
Each corridor hazard in `building.example.json` is anchored to a directed graph edge $e = (\text{from} \to \text{to})$ with node positions $\mathbf{P}_{\text{from}} = (X_{\text{from}}, Y_{\text{from}})$ and $\mathbf{P}_{\text{to}} = (X_{\text{to}}, Y_{\text{to}})$:
1. Unit tangent vector along the walk direction:
   $$\hat{\mathbf{t}} = (t_x, t_y) = \frac{\mathbf{P}_{\text{to}} - \mathbf{P}_{\text{from}}}{\|\mathbf{P}_{\text{to}} - \mathbf{P}_{\text{from}}\|}$$
2. Unit left-hand normal vector (when walking `from -> to` in the right-handed $X_b, Y_b$ plane):
   $$\hat{\mathbf{n}}_{\text{left}} = (-t_y, t_x)$$
3. Given edge width $w_e = \text{edge.min\_width\_m}$, object footprint depth $d = \text{obj.size\_m}[1]$, `along_m`, and `side`:
   $$\sigma = \begin{cases} +1 & \text{if side} = \text{"left"} \\ -1 & \text{if side} = \text{"right"} \\ 0 & \text{if side} = \text{"centre"} \end{cases}, \qquad d_{\text{lat}} = \sigma \cdot \left(\frac{w_e}{2} - \frac{d}{2}\right)$$
   $$\mathbf{P}_{\text{obj}} = \mathbf{P}_{\text{from}} + (\text{along\_m})\,\hat{\mathbf{t}} + d_{\text{lat}}\,\hat{\mathbf{n}}_{\text{left}}$$

---

### Stage 2 → Stage 3: Building Metric Frame to Local Room MuJoCo Frame (`room.example.json`)

Per `room.example.json` (`conventions`), each simulated room has its own local right-handed **z-up** coordinate frame:
- **Origin $(0, 0, 0)$**: Southwest (bottom-left on plan) interior floor corner of the room, standing at pixel $(u_{\text{corner}}, v_{\text{corner}})$.
- **Axes**:
  - $+x_r \in [0, \text{room.dims\_m.x}]$ along wall `y0` ($y_r = 0$, Eastward on plan).
  - $+y_r \in [0, \text{room.dims\_m.y}]$ along wall `x0` ($x_r = 0$, Northward on plan).
  - $+z_r \in [0, \text{room.dims\_m.z}]$ vertically upward from the floor ($z_r = 0$).
- **Wall IDs & Offsets (`conventions.walls`)**:
  - `x0`: plane $x_r = 0$, `offset_m` measured from $(0, 0)$ toward $(0, \text{dims\_m.y})$.
  - `xmax`: plane $x_r = \text{dims\_m.x}$, `offset_m` measured from $(\text{dims\_m.x}, 0)$ toward $(\text{dims\_m.x}, \text{dims\_m.y})$.
  - `y0`: plane $y_r = 0$, `offset_m` measured from $(0, 0)$ toward $(\text{dims\_m.x}, 0)$.
  - `ymax`: plane $y_r = \text{dims\_m.y}$, `offset_m` measured from $(0, \text{dims\_m.y})$ toward $(\text{dims\_m.x}, \text{dims\_m.y})$.
- **Furniture Pose in MuJoCo**:
  - Contract provides floor-footprint centre $\text{pos\_m} = [x_r, y_r]$, full box extents $\text{size\_m} = [L_x, L_y, L_z]$, and $\text{yaw\_deg} = \psi^\circ$ about $+z_r$.
  - **MuJoCo body position** (3D centre of mass at rest on floor $z_r = 0$):
    $$\mathbf{p}_{\text{mj}} = \left(x_r,\; y_r,\; \frac{L_z}{2}\right)$$
  - **MuJoCo box geom half-extents** (MuJoCo `<geom type="box" size="..."/>` requires half-lengths):
    $$\mathbf{s}_{\text{mj}} = \left(\frac{L_x}{2},\; \frac{L_y}{2},\; \frac{L_z}{2}\right)$$
  - **MuJoCo quaternion** (scalar-first $(w, x, y, z)$, rotation by $\psi = \text{yaw\_deg} \cdot \pi / 180$ around $+z_r$):
    $$q_{\text{mj}} = (w_m, x_m, y_m, z_m) = \left(\cos\frac{\psi}{2},\; 0,\; 0,\; \sin\frac{\psi}{2}\right)$$
- **Room-to-Building Pinning Transform** (for zooming Floorplan $\leftrightarrow$ Room Twin on the same canvas):
  - With the room aligned to the building grid ($\theta_{\text{room}} = 0$) and floor corner at $(X_{b,\text{corner}}, Y_{b,\text{corner}}, 0)$:
    $$(X_b, Y_b, Z_b) = (X_{b,\text{corner}} + x_r,\; Y_{b,\text{corner}} + y_r,\; z_r)$$

---

### Stage 3 → Stage 4: Local Room MuJoCo Frame to Three.js Web Viewer Frame (`web/`)

Per `slava/HANDOFF.md` Section 8 (*"MuJoCo is z-up with quaternions (w,x,y,z). Three.js is y-up with (x,y,z,w). Convert in ONE place (`web/`)."*), apply the orthogonal basis change $R_{z\to y} = R_x(-90^\circ)$ in a single helper inside `web/`:

- **Position Conversion** (MuJoCo $(x_m, y_m, z_m)$ $\to$ Three.js $(x_t, y_t, z_t)$):
  $$x_t = x_m, \qquad y_t = z_m, \qquad z_t = -y_m$$
  *(Floor $z_m = 0$ becomes Three.js ground plane $y_t = 0$; $+x_m$ stays $+x_t$ right; $+y_m$ North maps to $-z_t$ into screen).*
- **Quaternion Conversion** (MuJoCo `[w_m, x_m, y_m, z_m]` $\to$ Three.js `new THREE.Quaternion(x_t, y_t, z_t, w_t)`):
  $$x_t = x_m, \qquad y_t = z_m, \qquad z_t = -y_m, \qquad w_t = w_m$$
- **Box Geometry Dimensions** (MuJoCo full extents `size_m = [L_x, L_y, L_z]` $\to$ `new THREE.BoxGeometry(width, height, depth)`):
  $$\text{width}_t = L_x, \qquad \text{height}_t = L_z, \qquad \text{depth}_t = L_y$$
- **Drop-in TypeScript Converter for `web/`**:
  ```ts
  export function mujocoToThreePose(
    posMj: [number, number, number],
    quatMj: [number, number, number, number] // [w, x, y, z]
  ) {
    const [xm, ym, zm] = posMj;
    const [wm, qx, qy, qz] = quatMj;
    return {
      position: [xm, zm, -ym] as [number, number, number],
      quaternion: [qx, qz, -qy, wm] as [number, number, number, number], // [x, y, z, w]
    };
  }
  ```

---

## 3. Zone-by-Zone 3D Reconstruction Specification

All pixel coordinates below are measured directly on `assets/floorplans/cagb-L2.jpg` (`1934 × 1366 px`) at scale `plan_px_per_m = 11.43`.

### 3.1 Calibrated Graph Nodes & Edges (`building.example.json`)

#### Verified `nodes[]` Table
| `id` | `type` | `label` | `plan_px` `[u, v]` | Metric `[X_b, Y_b]` (m) | Notes / Quake Routing Rule |
|---|---|---|---|---|---|
| `room200` | `room` | Room 200 lecture theatre | `[1348, 768]` | `[117.9, 52.3]` | Primary west exit doors of Room 200 opening to vestibule/Breakout space (room centre at `[1420, 805]`). |
| `breakout` | `space` | Breakout space | `[1278, 795]` | `[111.8, 50.0]` | Spine junction outside Room 200 & Room 203; seating bay spans `u ∈ [1082, 1300], v ∈ [780, 845]`. |
| `room203` *(optional node)* | `room` | Room 203 computer room | `[1220, 865]` | `[106.7, 43.8]` | North-east door into Breakout alcove; green box spans `u ∈ [1082, 1258], v ∈ [865, 986]`. |
| `stairs_main` | `stairs` | Stairs near lifts | `[1225, 725]` | `[107.2, 56.1]` | Fire stair core immediately north of Breakout space (`u ∈ [1195, 1250], v ∈ [710, 745]`). |
| `lifts` | `lift` | Lifts | `[1225, 618]` | `[107.2, 65.4]` | 4-car central lift bank (`u ∈ [1190, 1245], v ∈ [580, 655]`). **`usable_in_quake: false` (hard-blocked in A\*)**. |
| `exit_exhibition` | `exit` | Main entrance, Exhibition Road | `[1538, 448]` | `[134.6, 80.3]` | `2.10 m` clear double doors (`v ∈ [436, 460]`) + 6 external steps; step-free ramp along Exhibition Rd. |
| `exit_dalby` | `exit` | Entrance from Dalby Court | `[1230, 368]` | `[107.6, 87.3]` | `1.12 m` automatic door + `1.06 m` steep ramp (`u ∈ [1248, 1395]`) + 10 steps (`u ∈ [1248, 1288]`). |

#### Verified `edges[]` Table
| `id` | `from` | `to` | Polyline Waypoints `plan_px` | `length_m` | `min_width_m` | Physical Bottleneck |
|---|---|---|---|---|---|---|
| `e1` | `room200` | `breakout` | `[1348, 768] -> [1278, 795]` | `6.6` | `1.80` | Double-door vestibule between Room 200 foyer and Breakout space. |
| `e2` | `breakout` | `exit_exhibition` | `[1278, 795] -> [1278, 448] -> [1538, 448]` | `53.1` | `2.10` | North-south main corridor (`2.4 m` wide) $\to$ main foyer colonnade $\to$ `2.10 m` Exhibition Rd double doors (6 steps at exterior threshold; ramp bypass on Exhibition Rd). |
| `e3` | `breakout` | `exit_dalby` | `[1278, 795] -> [1278, 368] -> [1230, 368]` | `41.6` | `1.06` | North-south corridor past lifts $\to$ 10 steps (`3.5 m` wide) or steep ramp (`1.06 m` wide) $\to$ `1.12 m` Dalby Court automatic door. |

---

### 3.2 Extruded 2.5D / 3D Building Shell
Rather than full-building SLAM, the Level 2 shell is reconstructed as a clean 2.5D extrusion draped over the `cagb-L2.jpg` ground plane ($Z_b = 0$):
1. **Floorplan Base Plane**: Textured quad of size $169.2\text{ m} \times 119.5\text{ m}$ ($1934 / 11.43 \times 1366 / 11.43\text{ m}$) at $Z_b = 0$.
2. **Corridor & Foyer Walls**: Extruded to $h_{\text{wall}} = 3.2\text{ m}$ with translucent alpha ($\alpha = 0.35$) so the camera sees both the floorplan labels and interior hazard boxes:
   - **North-South Main Spine**: $u \in [1258, 1305]$ ($2.4–4.1\text{ m}$ wide), running from Breakout space ($v = 845$) past `stairs_main` ($v = 725$) and `lifts` ($v = 618$) to the Main Foyer ($v = 400$).
   - **Exhibition Road Main Entrance Foyer**: $u \in [1360, 1538], v \in [395, 508]$ ($15.6\text{ m} \times 9.9\text{ m}$) with 6 structural columns ($0.6\text{ m} \times 0.6\text{ m}$ each at $v = 405$ and $v = 502$).
   - **Exhibition Road Threshold**: Double doors at $u = 1538, v \in [436, 460]$ ($2.10\text{ m}$ clear width), followed by 6 descending exterior steps ($u \in [1540, 1575]$, total drop $\Delta Z_b = -0.95\text{ m}$) and the southward ramp alternative ($u \in [1500, 1565], v \in [510, 575]$).
   - **Dalby Court Threshold**: North lobby at $u \in [1230, 1395], v \in [342, 392]$. Features a split level transition: a **10-step stair flight** ($u \in [1248, 1288], v \in [356, 392]$) and an adjacent **steep ramp** ($1.06\text{ m}$ wide along the north wall $v \in [342, 358]$) converging on the **$1.12\text{ m}$ automatic door** at $u = 1230, v \in [360, 374]$.
   - **Lifts & Stairs Cores**:
     - `lifts` ($u \in [1190, 1245], v \in [580, 655]$): Rendered as a red cross-hatched keep-out volume (`usable_in_quake: false`).
     - `stairs_main` ($u \in [1195, 1250], v \in [710, 745]$) & `Stairs to upper floors` ($u \in [1218, 1250], v \in [1155, 1200]$): Rendered as stepped geometry volumes marked as vertical egress nodes.

---

### 3.3 Room 200 (Lecture Theatre) — Demo Opener & Evacuation Origin
- **Plan Bounds**: $u \in [1348, 1493]$ ($12.7\text{ m}$ main bowl; $17.3\text{ m}$ including rear stage/prep area up to $u = 1545$), $v \in [743, 868]$ ($11.0\text{ m}$ North-South span). Ceiling height $\approx 4.5\text{ m}$.
- **3D Geometry**:
  - **Raked Seating Bowl**: Curved stepped tiers descending from the rear West wall ($u = 1348, Z_b = +1.8\text{ m}$) toward the East lectern/stage ($u = 1480, Z_b = 0.0\text{ m}$), matching the curved seating arcs drawn on `cagb-L2.jpg`.
  - **Entry / Exit Doors & Connection to Breakout Space**:
    - **Primary Rear (West) Double Doors**: At $u = 1348, v \in [752, 778]$ (two $1.6\text{ m}$ double-door pairs opening into the intermediate vestibule $u \in [1300, 1348]$, which exits straight through $u = 1300, v \in [765, 795]$ into the **Breakout space**).
    - **Secondary Stage-Left (North-East) Exit**: At $u = 1485, v = 743$, leading to the north-east escape stair/corridor.
- **Fixed vs. Loose Hazards**:
  - **Fixed (`anchored: true`, `movable: false`)**: 350 tiered lecture benches and fold-down desks bolted to the concrete risers. That is why `slava/HANDOFF.md` specifies: *not the lecture theatre for the movable-furniture rearrangement loop*.
  - **Loose / Overhead Hazards**: Freestanding AV rack/lectern monitors at the front stage ($u \approx 1475, v \approx 805$), ceiling-suspended projectors/lighting bars, and glazed foyer partition panels outside the West doors.
  - **Shelter Guidance in Opener**: During shaking, Drop, Cover, and Hold On between fixed seating rows (away from the front overhead AV truss and side glazing); once shaking stops, evacuate via the West doors into the Breakout space (`e1`) toward Exhibition Road (`e2`) or Dalby Court (`e3`).

---

### 3.4 Breakout Space & Room 203 — Candidates for the MuJoCo Shake + Fix Loop

The core 30-second stage loop (*Shake 50x $\to$ A\* clearance verify $\to$ Argon moves 2 items $\to$ Re-shake 50x $\to$ Green path*) requires a room on Level 2 with **unanchored tall furniture/monitors near a doorway**.

#### Candidate A (Primary / Fastest to Film): Breakout Space Alcove
- **Plan Bounds**: $u \in [1082, 1300], v \in [780, 845]$ (full bay $19.1\text{ m} \times 5.7\text{ m}$; modelled sub-zone for `room.example.json`: $6.0\text{ m} \times 4.5\text{ m} \times 2.8\text{ m}$ at the West/South alcove adjacent to Room 203, with floor corner origin at $u_{\text{corner}} = 1082, v_{\text{corner}} = 845$).
- **Why it works well**: Zero access friction (open public concourse directly outside Room 200), high-contrast movable tables, chairs, freestanding recycling/vending stations, mobile whiteboard/display totems, and glazed partition walls along the Room 203 boundary ($v = 845..865$).
- **Contract Mapping (`room.example.json`)**:
  - `room.dims_m`: `{ "x": 6.0, "y": 4.5, "z": 2.8 }`
  - `doors`: `[{ "id": "door_main", "wall": "xmax", "offset_m": 1.8, "width_m": 1.8 }]` (opening onto the main north-south corridor spine).
  - `windows`: `[{ "id": "win_partition", "wall": "y0", "offset_m": 1.0, "width_m": 3.5, "sill_m": 0.0, "glass": true }]` (glazed partition toward Room 203).
  - `furniture`: Tall freestanding display/vending unit or mobile shelving (`size_m: [0.8, 0.6, 1.9]`, `mass_kg: 75`, `anchored: false`, `movable: true`) positioned near `xmax` exit passage, plus sturdy study tables (`sturdy_shelter: true`, `movable: true`) and chairs.

#### Candidate B (High-Density Hazard Showcase): Room 203 Computer Room
- **Plan Bounds**: $u \in [1082, 1258], v \in [865, 986]$ ($15.4\text{ m} \times 10.6\text{ m}$; modelled front bay for `room.example.json`: $6.5\text{ m} \times 5.0\text{ m} \times 2.7\text{ m}$, floor corner origin at $u_{\text{corner}} = 1082, v_{\text{corner}} = 986$).
- **Doors & Windows**:
  - North wall (`ymax`): two entry doors at $u = 1150, v = 865$ and $u = 1220, v = 865$ (`width_m: 0.90`) opening into the Breakout alcove, with interior glass vision panels (`glass: true`).
  - West exterior wall (`x0`, $u = 1082$): exterior windows (`sill_m: 0.9, glass: true`).
- **Why it works well**: Dense rows of computer desks (`sturdy_shelter: true`), unanchored dual-monitor stands, tall mobile storage cabinets/racks near the North exit door, and rolling chairs that slide/topple into the $0.90\text{ m}$ wheelchair egress path during a $0.3–0.5\,g$ shake.

---

## 4. Concrete Room-by-Room Filming Sequence (Room 200 First)

**Camera settings (`slava/captures/CAPTURE.md`)**: Landscape orientation, `1080p` (30 fps), held steady at chest height ($\approx 1.3\text{ m}$ above floor), half normal walking speed, no rapid whip-pans. Keep audio recording ON to capture spoken landmark timestamps for Argon.

### Phase 1: Room 200 Opener Context & Exit Threshold (Start of `captures/walk1.mp4`, `t = 0:00 – 0:25`)
1. **`t = 0:00` — Inside Room 200 (Rear Tier looking toward Stage & Exit Doors)**:
   - Stand near the top-west aisle of Room 200 ($u \approx 1365, v \approx 780$).
   - **Say out loud**: *"Starting in Room 200 lecture theatre, Level 2. Fixed tiered benches in the bowl; leaving through the rear west double doors toward the Breakout space."*
   - Frame the tiered benches (2 s) to prove seats are fixed, then pan slowly right to frame the **rear west exit doors** ($u = 1348, v = 768$) with floor-to-ceiling height visible.
2. **`t = 0:15` — Room 200 Vestibule Doors (Scale & Egress Anchor `e1`)**:
   - Pause **2 full seconds** centered 2 metres in front of the Room 200 exit double doors so both door jambs and the floor threshold are in a single undistorted frame.
   - Walk through the vestibule ($u \in [1300, 1348]$) into the Breakout space.

### Phase 2: Breakout Space Junction & Hazard Scan (`captures/walk1.mp4` `t = 0:25 – 0:55` + Dedicated `captures/room.mp4`)
3. **`t = 0:25` — Breakout Space Center (`node: breakout`, $u = 1278, v = 795$)**:
   - Stop at the spine junction outside Room 200.
   - **Say out loud**: *"Breakout space junction. Room 203 computer room on my left, Breakout seating ahead, main corridor to lifts and Exhibition Road on my right."*
   - Perform a slow $180^\circ$ horizontal pan (left $\to$ centre $\to$ right) showing:
     - The full corridor width (`min_width_m`) for edge `e1` and `e2`.
     - Any freestanding signs, recycling bins, display boards, or vending machines along the Breakout walls (pause **2 s** on each hazard so Argon captures a sharp frame for `objects[].evidence`).
4. **Separate Clip: `captures/room.mp4` (15–20 s Physics Deep-Dive Room)**:
   - **Film the Breakout Space seating bay** ($u \in [1082, 1260], v \in [780, 845]$) **AND/OR Room 203** ($u \in [1082, 1258], v \in [865, 986]$, checking nobody's face/screen is filmed):
   - Stand in one corner opposite the exit door so **both the exit door and the tallest movable furniture/monitors are visible in the opening frame**.
   - **Say out loud**: *"Room capture on Level 2: exit door at wall y0/xmax, unanchored tall cabinet on the left, sturdy desks in the centre, glass panels on the right."*
   - Execute one continuous, slow 15–20 second pan across all 4 walls, keeping the floor-wall base intersection visible in frame (critical for Argon to estimate `pos_m = [x, y]` and `room.dims_m`).

### Phase 3: Walk 1 Continuation — Breakout Space $\to$ Exhibition Road Main Exit (`captures/walk1.mp4`, `t = 0:55 – 2:15`)
5. **`t = 0:55` — Stairs Near Lifts (`node: stairs_main`, $u = 1225, v = 725$)**:
   - Walk North along edge `e2` ($u = 1278, v: 795 \to 725$).
   - Pause **2 s** looking left into the stairwell doors. **Say out loud**: *"Stairs near lifts on my left."*
6. **`t = 1:15` — Central Lifts Bank (`node: lifts`, $u = 1225, v = 618$)**:
   - Continue North to $v = 618$. Pause **2 s** facing the 4 lift doors on the left.
   - **Say out loud**: *"Lifts on my left — do not use in an earthquake."*
   - Pan across the opposite right wall ($u = 1300$) to capture any corridor display cases, fire extinguishers, or glazed office partitions along `e2`.
7. **`t = 1:45` — Main Foyer & Exhibition Road Double Doors (`node: exit_exhibition`, $u = 1538, v = 448$)**:
   - Turn right (East) at $v = 448$ into the columned Main Entrance foyer ($u: 1278 \to 1538$).
   - **Say out loud**: *"Entering main foyer toward Exhibition Road exit; structural columns on left and right, glass display cases along the wall."*
   - Pause **2 full seconds** squarely facing the **Exhibition Road main double doors** ($u = 1538, v \in [436, 460]$) from $\sim 3\text{ m}$ back so the full **$2.10\text{ m}$ clear opening** (our primary metric scale reference) and the **6 exterior steps** beyond are clearly visible.
   - **Say out loud**: *"Main entrance Exhibition Road double doors, 2.10 metres wide, six steps down outside, step-free ramp to the right."*

### Phase 4: Walk 2 — Room 200 / Breakout Space $\to$ Dalby Court Alternative Exit (`captures/walk2.mp4`, `1–2 min`)
1. **`t = 0:00` — Start outside Room 200 / Breakout Space (`node: room200` $\to$ `node: breakout`)**:
   - **Say out loud**: *"Walk 2, alternative route from Room 200 through Breakout space to Dalby Court exit."*
2. **`t = 0:20` — North Corridor Spine along Edge `e3` ($u = 1278, v: 795 \to 368$)**:
   - Walk steadily North past `stairs_main` and `lifts`, continuing straight past the Exhibition Road foyer turnoff ($v = 448$) toward the northern end of the corridor ($v = 368$).
   - Pause **2 s** at any vending machines, noticeboards, or narrowing pinch points along the northern corridor segment ($v \in [390, 500]$), stating their side (*"on my left"* / *"on my right"*).
3. **`t = 1:05` — Dalby Court Ramp, 10 Steps & Automatic Door (`node: exit_dalby`, $u = 1230, v = 368$)**:
   - At $v = 368$, turn left (West) facing the Dalby Court exit threshold.
   - Pause **3 full seconds** framing both the **10 steps** ($u \in [1248, 1288]$) and the **$1.06\text{ m}$-wide steep ramp** ($u \in [1248, 1395], v \in [342, 358]$) leading to the **$1.12\text{ m}$ automatic door** ($u = 1230, v \in [360, 374]$).
   - **Say out loud**: *"Dalby Court exit ahead: 10 steps in the centre, 1.06 metre steep ramp on the right, and 1.12 metre automatic exit door."*
