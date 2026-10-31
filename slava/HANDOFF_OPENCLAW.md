# HANDOFF → OpenClaw (Gemini 4 Argon) · v2 · 14:45 GMT

**Goal now:** one realistic, **first-person** 3D model of the **main exit route** (Room 200 → Exhibition Road doors, CAGB Level 2) that runs inside the earthquake simulator, with numbers that are computed, not typed.
**Deadlines:** feature freeze 15:15 · backup video 15:45 · submit 16:00 · demo 16:30 (3 min, product first).

## Where things are (on main once Slava pushes)
| What | Path | State |
|---|---|---|
| **The demo screen** | `slava/viewer/index.html` (+ `slava/viewer/textures/*.jpg`) | Works. Overview + **"👣 Walk the exit (first person)"** (auto-walk at eye height, WASD + drag to look, "Shake here"). Real photo textures (terrazzo, stone cladding, oak) cropped from Slava's walk videos. |
| Earthquake simulator | inside the same file: `runMonteCarlo()` | **Real, seeded N=50**: lognormal PGA around the slider, tip thresholds (b/2)/h_CoM, cart rolling, corridor free width sampled every 0.2 m. Same PGA → same result. |
| Current results (main exit, 0.35 g) | `slava/contracts/building.cagb_l2_live.json` → `results` | **Before fix 25/50 clear, after fix 50/50** (walking and wheelchair). 0.25 g: 30→50, 0.50 g: 9→50. Blockers: the two pull-up banners in the Room 200 vestibule. Fix: move banners off the lane, park + lock the cart, bolt the LED totem. |
| Real object catalogue (52 objects, video evidence, walking-speed-aware positions) | `slava/route_A/scene.json`, `slava/route_A/evidence/` | Not yet loaded by the viewer (viewer has ~11 hand-placed objects). |
| React components (for team apps) | `slava/scene3d/RealisticCAGBModels.tsx` | Local agent's; untested in an app. |
| Plan + scale | `assets/floorplans/cagb-L2.jpg`, `cagb-L2-graph.json` (**9.52 px/m**) | Canonical. |
| Agent inbox | `coordination/PROTOCOL.md`, `coordination/inbox/<name>/` | Requests open to sam + pushkar. |

## Facts that were corrected (do not re-introduce)
- The glass-disc sculpture is **outside** on the Exhibition Road plaza (seen through the facade, walk1 110–116 s), not over the indoor route.
- Laidlaw totem and sculpture live inside `atriumGroup` (offset 12, 0, −17): convert to world coords before any physics.
- No hardcoded "x/50" strings and no "Argon" label on anything Argon did not compute. The fix button is "APPLY FIX LAYOUT · RE-VERIFY 50x" until Argon really produces the layout.
- Tip threshold = (b/2)/h_CoM (b = full base width).

## Next tasks for you, in order (stop adding features at 15:15)
1. **Realism of the first-person walk (highest visual value):**
   - Room 200 at eye level: the walk starts at the west doors because the camera clipped under the tiers. Add a short intro *inside* Room 200 standing on the flat front floor (find the tier geometry in `room200Group`, place the camera above `floor + 1.65 m`).
   - Replace the dark concourse floor with the photo terrazzo everywhere along the route (`textures/terrazzo.jpg`, MirroredRepeatWrapping ~2.2 m tile). Make the egress tube thinner in first person (radius 0.05, slightly above floor) or draw it as floor chevrons.
   - Fall animations: when SHAKE runs, animate banners/cart/totem from upright to the pose chosen by `runMonteCarlo()`'s example run (currently they snap).
2. **Gemini-truthful pipeline:** read `pushkar/extraction_evaluation.json` (Argon recovered X of 52 objects). If Ava's agent produces `ava/results/argon_fix_main_exit.json`, load it as the fix layout and only then label the button "Argon fix".
3. **Load real objects:** add the hazards from `slava/route_A/scene.json` that lie on the main exit route (banner "Build the Future", recycling bins, refreshment table, jet-engine exhibit, LED totem, statue, wayfinding totem) into `hazardsFor()` with their sizes/masses/thresholds, converting building frame → viewer coords. Re-run and record the new numbers in `building.cagb_l2_live.json` (computed_by field).
4. **Demo script `slava/DEMO.md` + backup video by 15:45:** 0:00 overview with Room 200 pinned → 0:15 "Walk the exit" first person → 0:50 Shake 50x at 0.35 g: "25 of 50 quakes block the exit, the banners in the vestibule" → 1:40 apply fix, re-verify 50/50 → 2:20 "Gemini watched our walk and built this twin" (with Pushkar's number) → 2:50 close.

## How to run and check
```bash
cd ~/dev/gemini-hackathon && python3 -m http.server 8080
# open http://localhost:8080/slava/viewer/  → click "👣 Walk the exit (first person)"
```
Test any change by: Shake 50x at 0.35 g must give 25/50 before and 50/50 after unless you changed the hazard data on purpose (then update the results JSON with the new computed numbers).

## Team sync (not done yet; do this first, 5 min)
- `git pull --rebase` and read the root `AGENTS.md` + `coordination/inbox/slava/` for replies.
- Post once in Discord: "Demo screen = slava/viewer (first-person walk + real Monte Carlo). Results file: slava/contracts/building.cagb_l2_live.json. Ava: Argon fix → ava/results/argon_fix_main_exit.json. Sam: cross-check with your TS solver → sam/results/route_A_montecarlo.json. Pushkar: extraction score → pushkar/extraction_evaluation.json."
- Rules: write only in `slava/`; requests to others go through `coordination/inbox/`; never commit `.env`, videos, or frames with faces (`assets/frames/` has crowd frames: don't commit it).
