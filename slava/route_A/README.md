# Route A twin data — Room 200 → Exhibition Road (CAGB Level 2)

Built from two phone walks filmed at 13:20 and 13:22 on 31 Oct (videos stay off GitHub; ask Slava):
- **V** `20261031_132011.mp4`: portrait, Room 200 → main entrance, 157 s (first ~70 s is a tour inside Room 200)
- **H** `20261031_132259.mp4`: landscape, main entrance → Room 200, 87 s

| File | What |
|---|---|
| `scene.json` | Zones (floors, walls, glazing, stair/ramp), 52 objects with model type, position, yaw, size, mass, anchoring, glass, hazard note, static tip threshold and video evidence |
| `evidence/*.jpg` | 30 face-free frames, named `<video>_<seconds>_<what>.jpg`, referenced by `objects[].evidence` |
| `speed_profile.png` | Measured walking pace for both videos |

## Coordinates (shared with `assets/floorplans/cagb-L2-graph.json`)
Building frame, metres: X east = u / 9.52, Y north = (1366 − v) / 9.52 on `assets/floorplans/cagb-L2.jpg` (1934×1366), Z up.
three.js: `position = [X − 150, Z, −(Y − 80)]`, `rotation.y = −yaw · π/180` (yaw = degrees clockwise from north).
Models are built facing local −z with the footprint centred on the origin: `slava/twin/models.js` → `buildModel(THREE, obj, mats)`.

## How positions were found (walking speed varies)
Phone video pace changes a lot (stops at doors, slow on the stair, fast through the hall), so time is not distance.
1. Farneback optical flow at 5 fps; forward motion = median radial expansion of the flow field after removing global pan.
2. Landmarks pinned per video (Room 200 door, hall ends, C&G glass doors, stair foot, inner/outer sliding doors, steps).
3. Between landmarks, distance is shared out by cumulative forward motion, so an object seen at time *t* lands at the distance actually walked.
Measured door-to-outside: **66 s (V)** and **57 s (H)** while filming; route length ≈ **70 m** on the calibrated plan.

## Accuracy
- Sizes and masses: estimates from video, typically ±25% (statue and jet-engine exhibit ±50%).
- Positions: ±2–4 m along the route, ±1–2 m sideways. The main lobby extends north of the drawn plan, so it is placed from video only.
- `tip_threshold_g = (b/2)/h_CoM` (b = smaller base side, h_CoM = 0.5–0.6 h): static overturning estimate for freestanding objects; `null` = anchored or not applicable.

## Most important hazards on this route
| Object | Why | Tips at ≈ |
|---|---|---|
| Pull-up banners (vestibule, Room 200 front) | Fall across the exit lane right outside Room 200 | 0.17 g |
| Digital screen totem (lobby) | Top-heavy, freestanding, beside the walking line | 0.18 g |
| Wayfinding totem (lobby, by the doors) | Freestanding near the inner sliding doors | 0.17 g |
| Marble statue on plinth | ~1.4 t; topples only if not dowelled | 0.30 g |
| Turbofan exhibit (hall) | Top-heavy steel exhibit on an A-frame | 0.48 g |
| Glass: hall glazing, spiral stair, C&G glass doors, balustrades, atrium facade, sliding doors | Shatter zones along the whole second half of the route | — |
| Automatic doors | Stop on power loss: use manual break-out | — |
| Crowd at Room 200 front-left door | Food queue blocks the main exit; rear doors are faster from upper rows | — |
