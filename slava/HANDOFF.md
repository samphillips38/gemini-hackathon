# HANDOFF — CLEAR EXIT (earthquake room-safety twin) — updated 12:15 GMT

**Agents: read HANDOFF.md -> AGENTS.md (rules, models, judging) -> IDEAS.md (history). This file wins on conflicts.**

## 1. Decision (team consensus, 12:05)
**Film your room -> we shake it 50 times in a physics sim -> prove whether you can still get out -> rearrange it
until you always can.** ECHO is retired. STEP-FREE survives as the wheelchair-clearance mode.
- **Person:** someone living in a quake zone (Istanbul, Tokyo, SF, Kathmandu) setting up a room.
- **Hook stat:** Tokyo Fire Department: furniture overturning, falling or moving causes **about 30–50% of injuries in recent quakes.**
- **Alchemy:** phone video -> 3D twin x rigid-body physics (MuJoCo, DeepMind's own engine) x path planning x Argon redesign loop.
- **Safety-correct framing (judges WILL check):** official guidance is Drop, Cover, Hold On *during* shaking; do not run.
  So: **during** shaking -> verified shelter spot; **after** shaking -> verified exit route. Never route through lifts.

**SCOPE LOCK (12:30): City and Guilds Building, Level 2 only.** One floor, one plan, one map. The room deep dive is also a
room ON Level 2 (e.g. breakout space or Room 203 computer room: monitors and desks), so the demo zooms floor -> room on the same map.
Other floors, other buildings: out of scope (Q&A answer: 'same pipeline, one more walk per floor').

## 2. Core loop = the MVP. Everything else is stretch.
1. **Capture:** 10–20 s video of ONE furnished room (tall furniture + door in frame). Not the lecture theatre (fixed seats).
2. **Perceive:** Flash per frame (parallel) -> Argon fuses -> `contracts/room.example.json` (room box, furniture boxes with
   size/mass/anchored/glass, doors, windows).
3. **Shake:** MuJoCo, headless Python. N=50 runs, random direction, PGA 0.3–0.5 g, synthetic accelerogram. Ground shaking
   applied as force -m*a_g(t) on each free body. Output final poses + keyframes of one run for replay.
4. **Verify (deterministic):** post-quake occupancy grid + glass hazard zones -> A* from spawn points to the door with agent
   clearance (0.4 m walking, 0.9 m wheelchair) -> **P(exit reachable) over N runs**; shelter spot = cell least hit across runs,
   near a sturdy table, away from glass.
5. **Fix (the agent loop):** Argon proposes a rearranged layout (constraints: inside room, no overlaps, not in front of door
   or window) -> steps 3–4 re-run -> keep if P improves -> max 3 iterations, each shown on screen. User approves the final layout.
6. **Show:** Three.js twin, replay one quake, red blocked path -> green clear path, before/after numbers.

**30-second stage moment:** room twin on screen -> SHAKE -> wardrobe falls across the door -> "Exit blocked in 31/50 quakes"
-> FIX -> Argon moves 2 items, sim re-shakes 50x -> "Exit clear in 50/50, wheelchair width" -> green path.
(Numbers above are placeholders. Only show numbers the sim produced.)

## 3. Rigor (say this on stage)
- **Physics sanity unit test:** a lone box starts rocking near the static threshold PGA ~ g*b/h (b = base width, h = height).
- Claims are **frequencies over N simulated quakes**, never "safe". Intensity is stated as **PGA**, not magnitude
  (magnitude is energy at the source; shaking in your room depends on distance and ground).
- Glass is a rule-based hazard zone: a stated simplification.
- Human in control: the user approves the rearrangement.

## 4. Stretch, in this order (only after the core loop runs end to end)
a) wheelchair clearance toggle (cheap: inflate obstacles by agent radius) -> b) Gemini 3.8 Live voice coach
("Drop under the desk on your left") -> c) drill / game mode (spawn in a random room, find the exit).

**Promoted to the demo opener (cheap, 2D, high marketing value):** the judges are sitting in **Room 200, Level 2, City and Guilds
Building**. Plan image already in `captures/floorplans/` (+ `fetch.sh` for full-res L1/L2/L3/L6/L7). Argon reads the L2 plan into a
small graph (Room 200, breakout space, corridor, stairs, lifts, Exhibition Road main entrance, Dalby Court entrance) -> A* ->
route drawn over the plan image. Opener line: *"If a quake hits this room right now: here's where you shelter, and here's your
way out once it stops."* Then zoom into one furnished room for the full physics loop. Owner: module 6 + module 5.

**Building walk (team idea, 12:25), bounded:** film ONE route on Level 2 (Room 200 -> Exhibition Road exit, plus the Dalby
Court alternative). **The plan gives geometry, the video gives contents:** Argon watches the walk (video + narrated audio),
lists hazard objects (vending machines, shelving, glass panels, display cases) and anchors each to a plan edge -> those objects
go through the same shake + A* check -> route clear probability per exit. **Every detected object carries a video timestamp as
evidence; clicking it shows the frame** (cheap rigor: the judges can see the model didn't make it up).
Protocol: `captures/CAPTURE.md`. Contract: `contracts/building.example.json`. Module 1 handles both room and walk videos.
Not in scope: full-building 3D, other floors, SLAM.

## 5. Clock (GMT)
| Time | Gate |
|---|---|
| 12:45 | Repo up, owners named in section 6, contracts v1 frozen, walk1 + walk2 + room videos captured (`captures/CAPTURE.md`) |
| 13:00 | Every module runs **alone** on `contracts/room.example.json` |
| 13:00–13:30 | Lunch (eat at the keyboard if behind) |
| 14:15 | **End-to-end:** video -> JSON -> shake -> verify -> numbers + path on screen |
| 15:15 | Fix loop + polish done. **Feature freeze** |
| 15:45 | Backup demo video recorded, code pushed |
| 16:00 | **Hard submission deadline.** 16:30 live demo, 3 min + 1 min Q&A |

## 6. Team (6 people): one owner per module, one directory each
| # | Module | Dir | Owner |
|---|---|---|---|
| 1 | Perceive: video -> room JSON (Flash swarm + Argon) | `engine/perceive/` | ? |
| 2 | Shake: MuJoCo Monte Carlo + keyframe export | `engine/sim/` | ? |
| 3 | Verify: occupancy grid, A*, clearance, shelter spot, report | `engine/verify/` | ? |
| 4 | Fix loop + API server gluing 1–3; **owns the contract** | `engine/fix/`, `engine/server/`, `contracts/` | ? |
| 5 | Show: Three.js twin, replay, before/after UI | `web/` | ? |
| 6 | Demo lead: capture the room NOW, evacuation-plan photo, pitch script, backup video, submission | `captures/`, `docs/` | ? |

## 7. Coordination
- **Team repo: github.com/samphillips38/gemini-hackathon** = single source of truth (these notes live in `slava/`).
- **Discord is for humans. Agents coordinate through the repo** (this file, `contracts/`, small commits), not by chatting.
- Edit only your own directory. Small commits, `git pull --rebase` before every push.
- Contract changes: module 4 owner only, then announce in Discord and in the status board.
- Slava's machine: herdr pane 1 Claude Code, pane 2 Codex, pane 3 shell (exact CLI syntax: `HERDR-SKILL.md`).

## 8. Gotchas (pre-solved)
- **Frames:** MuJoCo is z-up with quaternions (w,x,y,z). Three.js is y-up with (x,y,z,w). Convert in ONE place (`web/`).
  This is the classic integration bug.
- `pip install mujoco` has official Apple Silicon wheels. Keep the sim headless; the web only replays keyframes.
- Keys: `GEMINI_API_KEY` only in `.env` (gitignored), never in `web/`. Browser -> `engine/server` -> Gemini.
- Argon video analysis can take 30–60 s: cache the last good room JSON; pre-warm before 16:30.
- Codex sandbox may block network: enable it in Codex config or let the engine make all API calls.
- Hackathon account dies tomorrow: export any AI Studio prompt/app into the repo.
- Module directories (`engine/`, `web/`, ...) are a proposal: align them with the team repo's root layout before coding.
- Venue Wi-Fi: keep a recorded run + cached JSON so the demo works offline.

## 9. Status board (edit only your own row; GMT)
| Owner | Task | Status | Updated |
|---|---|---|---|
| Module 1 | perceive | not started | 12:15 |
| Module 2 | sim | not started | 12:15 |
| Module 3 | verify | not started | 12:15 |
| Module 4 | fix + server + contract | not started | 12:15 |
| Module 5 | web | not started | 12:15 |
| Module 6 | capture + pitch | not started | 12:15 |
