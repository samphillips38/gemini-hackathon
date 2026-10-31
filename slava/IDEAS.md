# Idea board — decide by 12:00 GMT (slides said 11:30)

## Selection lens (Claude)
- **Pick a domain where the verifier's tolerance is wider than the model's error.** Rough guess: Gemini's
  metric estimates from phone video are off by about 10–20% (test this in the first 30 min against a tape measure).
  If a 5 cm error flips the verdict, the live demo dies. If ±20% still impresses, it survives.
- Must hit all four judging criteria: one real person, a surprising combination, a falsifiable check, live in 10 s.
- If a judge can map it to Desk Racer or LabTwin in one second, it loses on novelty.

## Shared engine (the agent orchestration lives *inside the product*)
phone video (10–20 s) -> sample N frames -> **Flash swarm** (one worker per frame: surfaces, materials,
scale cues) -> **Argon fuser** (reconciles conflicting estimates into one metric scene-graph JSON with
uncertainty) -> **sandbox verifier** (deterministic domain solver + consistency checks; fail -> Argon refines)
-> **Three.js twin** + **Live voice** narrator.

## Slate (ranked)

### 1. ECHO — hear a room before you play in it   <- Claude's pick
- **Person:** bedroom producer / band choosing a rehearsal room or treating a home studio.
- **30 s moment:** film the lecture theatre from the stage -> 3D twin with predicted reverb time (RT60) and bass
  hotspots -> **pop a balloon** -> app measures the real RT60 live, shows predicted vs measured side by side ->
  plays a track through the room's predicted acoustics ("hear it before you're in it").
- **Alchemy:** camera vision x acoustic physics x music.
- **Verifier:** Python computes Sabine/Eyring RT60 per octave band and axial room modes (f = n*c / 2L);
  measured RT60 comes from Schroeder backward integration (T20) of the balloon/clap recording. Reality is the judge.
- **Track:** 2, with Track 1-grade verification.
- **Risks -> fixes:** noisy room / low SNR -> balloon pop + T20; Lyria API access unknown -> WebAudio convolution
  with a synthetic impulse response built from predicted RT60; dimension error -> roughly proportional RT60 error, tolerable.
- **Upside:** "Shazam for rooms" — every musician, podcaster, venue, home studio; acoustic consults cost hundreds.

### 2. STEP-FREE — "Can I get in?"
- **Person:** wheelchair user checking a venue or flat before going.
- **30 s:** film the theatre door/aisle -> 3D route coloured green/red with door widths, step heights,
  1.5 m turning circles; Live voice mode for low-vision users.
- **Verifier:** deterministic checks against UK Part M / BS 8300 thresholds; tape-measure the real door on stage.
- **Risk:** threshold flip (5 cm error flips a verdict). Needs a scale reference (A4 sheet / bank card) and honest
  bands ("passes / borderline: check / fails").
- **Upside:** access surveys are manual and rare; every venue, Airbnb, rental listing needs one.

### 3. ORACLE THROW — falsifiable physics
- **30 s:** film one throw/roll -> twin + fitted physics (g, drag, restitution) -> **predicts where the next throw
  lands before it happens** -> throw -> hit or miss.
- **Verifier:** reality (system identification from video). **Track 1.**
- **Risk:** tracking precision + Argon video latency (30–60 s) breaks the live loop; closest to LabTwin.

### 4. VIEWING TRUTH — London flat-viewing agent
- **30 s:** film a viewing -> floor plan + measured m2 vs the listing's claim + "will my sofa fit" + damp flags;
  Live voice suggests questions to ask the letting agent.
- **Verifier:** area reconciliation vs listing; furniture collision check.
- **Risk:** same threshold flip as #2; less surprising.

### 5. SWARM TWIN — the engine itself as a Track 1 entry
- Live convergence graph: N Flash agents each own a viewpoint, Argon resolves conflicts, verifier re-renders the
  twin from each camera pose and scores silhouette IoU against the real frames; loop until above threshold.
- Best used as the 20-second "how it works" inside #1 or #2, not standalone (judges punish "platforms").

## a16z "Big Ideas 2026" lens (Claude, 12:00)
- **Two different scoring functions.** Judges at 16:30 score specificity, alchemy, rigor and courage. A power-law startup
  needs market size and a path from wedge to platform. Demo the safest wedge on stage; give the engine/platform one sentence in Q&A.
- **ECHO** fits #5 multimodal creation and #7 world models. Best demo, smaller market (creators, studios).
- **STEP-FREE** fits #20 physical monitoring of cities, #13 AI for non-Silicon-Valley industries, #10 multi-party coordination
  (venues, councils, disabled visitors). Legal pull (UK Equality Act reasonable-adjustment duty). Data network effect: every
  scan adds to a city accessibility layer; Argon supports Google Maps grounding. Bigger startup, riskier demo.
- **Shared engine** (phone video -> verified metric twin) also fits #28 AI-native insurance (claims from video) and property listings.
- **Decision rule instead of a debate:** 12:00–12:45 both agents build only shared parts (capture, Flash swarm, Argon fusion,
  room twin). **12:45 calibration test:** tape-measure one door + one room vs Argon's estimate.
  Error <= 5% -> STEP-FREE. Error > 5% -> ECHO. Log the numbers here.

## Questions for Codex / Astra (answer in your section below)
1. Kill one idea and say why.
2. Propose one idea **more** outlier than #1 that still has a falsifiable live check.
3. Pre-mortem #1: the 3 most likely ways the live demo fails at 16:30, and the fix for each.
4. Check: is Lyria 3.5 callable from the API with the hackathon key? Is Gemini 3.8 Live usable for this account?

## Codex / Astra critique
(Codex writes here)

## Decision log
- 11:50 GMT — slate written (Claude). Pending: Slava picks after Codex critique.
- 11:58 GMT — HANDOFF.md + contracts/scene.example.json written; roles: Claude Code = lead+engine, Codex = frontend+critic (Claude).
- 12:00 GMT — a16z lens added; proposed decision rule: 12:45 calibration error picks STEP-FREE (<=5%) or ECHO (>5%) (Claude). Awaiting Slava.
- 12:15 GMT — **Team consensus: CLEAR EXIT (earthquake room-safety twin).** ECHO retired; STEP-FREE folded in as wheelchair-clearance mode; calibration rule dropped (scale error matters little here: toppling depends on proportions, exit reachability on relative positions). HANDOFF.md rewritten; new contract contracts/room.example.json; old contract moved to contracts/_retired/ (Claude).
- Codex: questions 1–3 above now apply to CLEAR EXIT (kill a feature instead of an idea; pre-mortem the 16:30 demo).
- 12:22 GMT — CAGB floor plans found (L1/L2/L3/L6/L7, official Imperial pages) -> captures/floorplans/. Building route promoted to a cheap 2D demo opener (Room 200 -> Exhibition Road exit). Safety framing fixed: shelter DURING shaking, exit AFTER (Claude).
- 12:25 GMT — Building walk accepted, bounded to one Level 2 route + alternative; plan = geometry, video = contents; objects carry video-timestamp evidence. CAPTURE.md + building.example.json added; videos gitignored (Claude).
- 12:30 GMT — **Scope lock: CAGB Level 2 only** (Slava). Room deep dive must also be a Level 2 room.
