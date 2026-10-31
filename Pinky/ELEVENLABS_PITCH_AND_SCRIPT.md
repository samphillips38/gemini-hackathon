# ClearExit (`QuakeRoom` + `ExitZero`) — 3-Minute Stage Pitch & ElevenLabs Voiceover Guide

## 1. How to Pitch the Whole Project (The Winning Narrative Arc)

Your team built **ClearExit** — a unified **Macro-to-Micro Seismic Digital Twin & Deterministic Egress Verifier** anchored right here in **Imperial College’s City & Guilds Building (CAGB Level 2, Room 200)**:

1. **The Hook (First 15 Seconds — Venue Shock Value):**
   - Start right where the judges are sitting: **CAGB Level 2, Room 200**.
   - Show the calibrated **`9.52 px/m`** 3D digital twin (`slava/viewer/index.html` or `final/` / `Pinky/`), reconstructed from a real phone walkthrough of the building (`52/52` ground-truth objects verified by **Gemini Flash → Gemini 4 Argon** at **`0.157 m` median spatial error**).
2. **Why Multimodal AI + Deterministic Physics Need Each Other ("Alchemy"):**
   - **Vision (Gemini 4 Argon)** sees *where* objects are (banners, display totems, bookshelves, wardrobes, exit doors).
   - **Voice (Gemini Live)** knows the *invisible physics* a camera can never see: *"I'm on the 10th floor (sway amplification), I'm a student renter who cannot drill into walls, and there are 20kg of textbooks on the top shelf."*
   - **Deterministic Physics + `N=50` Monte Carlo A\* Verifier** proves what happens during and after a `6.8M` (`0.35g`) earthquake:
     - **Analytical Housner Overturning:** $SF = \frac{b / h_{\text{CoM}}}{a_{\text{floor}} / g}$.
     - **Dual-Capsule A\* Egress (`0.40 m` walking vs. `0.90 m` wheelchair):** In CAGB Concourse Hall, a `0.62 m` pinch point passes walking (`50/50`) but traps a wheelchair user (`0/50`). In Room 200 and the Student Bedroom, toppling unanchored furniture seals the exit door (`0/50`).
3. **The Counter-Intuitive "Aha!" Moment (Self-Correcting Argon Remediation):**
   - A renter cannot drill bolts into the wall. Instead, **Gemini 4 Argon + the deterministic verifier** discovers a zero-drill physical fix: **move the `20 kg` textbooks from the top shelf to the bottom shelf as natural ballast**—dropping Center of Mass $h_{\text{CoM}}$ from `1.48 m` to `0.58 m` and raising the overturning Safety Factor from `0.54` (tips!) to `1.42` (stable!)—while relocating blocking hazards out of the exit swing zone to hit **`50/50` verified pass** for both walking and wheelchair egress.
4. **Life-Safety Closing Rule:**
   - **Phase 1 (During Shaking):** **Drop, Cover, and Hold On** under a verified sturdy desk (`1.2s` reach). Never run while the building is shaking.
   - **Phase 2 (After Shaking Stops):** Evacuate along the **verified `50/50` green A\* route** to Exhibition Road—and **never use lifts** (deterministic Lift Lockout Override).

---

## 2. Step-by-Step Guide: How to Generate the Voiceover in ElevenLabs (in 2 Minutes)

1. **Open ElevenLabs:** Go to https://elevenlabs.io/app/speech-synthesis (**Text to Speech** tab).
2. **Pick the Best Voice for a DeepMind Technical Demo:**
   - **Recommended Voice:** **`Brian`** (Deep, authoritative documentary narrator), **`Adam`**, or **`Rachel` / `Jessica`** (Clear, crisp technical presenter).
   - **Model:** Select **`Eleven Multilingual v2`** (best emotional inflection and pause control) or **`Eleven Flash v2.5`** (fastest generation).
3. **Configure Voice Settings (Right Sidebar):**
   - **Stability:** `45% – 55%` (low enough to sound energetic and urgent on stage, high enough to stay consistent).
   - **Similarity:** `75% – 80%`
   - **Style Exaggeration:** `20% – 30%`
   - **Speed:** `1.05x` (keeps the 3-minute demo crisp and punchy).
4. **How to Control Pauses & Emphasis in ElevenLabs:**
   - Use `<break time="0.6s" />` for exact timed pauses while you click buttons on screen (`Cmd+Space`, `Shake 50x`, `Apply Argon Fix`).
   - Use **em-dashes (`—`)** and **ellipses (`...`)** for natural dramatic beats.
   - Spell out units and formulas phonetically (e.g., write `"zero point three five G"`, `"fifty out of fifty"`, `"zero point one five seven meters"` so TTS never misreads symbols).

---

## 3. Ready-to-Paste ElevenLabs Transcript (Timed to the 3-Minute Stage Demo)

Copy and paste the block below directly into **ElevenLabs Text-to-Speech** (or generate it in 5 short paragraphs so you can drop each audio clip onto your video timeline):

```text
Right now, we are sitting inside Room 200 on Level 2 of Imperial College’s City and Guilds Building. If an earthquake or fire hits this floor, static wall maps won't tell you which objects will topple into your exit path—or whether a corridor that looks open is actually a trap for a wheelchair user.

<break time="0.6s" />

Meet ClearExit—a multimodal 3D seismic digital twin and deterministic safety verifier powered by Gemini 4 Argon.

<break time="0.5s" />

First, we walked our primary evacuation route from Room 200 out to Exhibition Road with a phone camera, calibrating the Level 2 floorplan at nine point five two pixels per meter. Using a parallel Gemini Flash to Gemini 4 Argon spatial pipeline, we extracted and verified all fifty-two real objects along this route—from freestanding banners and display totems to the breakout concourse furniture—achieving one hundred percent recall with a median spatial error of just zero point one five seven meters.

<break time="0.8s" />

Watch what happens as we step into the first-person digital twin of Room 200 and trigger a fifty-run Monte Carlo earthquake simulation at zero point three five G.

<break time="1.0s" />

Vision alone sees furniture. Voice gives Gemini the invisible physics a camera cannot see: what floor we are on, whether a student renter is forbidden from drilling into walls, and where heavy twenty-kilogram loads sit on high shelves.

<break time="0.6s" />

Using analytical Housner center-of-mass overturning mechanics and a dual-capsule A-star pathfinder, our solver reveals a critical failure. In Room 200 and the Exhibition Road lobby, toppling unanchored totems and wardrobes block the exit in fifty out of fifty runs. And in the Concourse Hall, fallen obstacles narrow the corridor to zero point six two meters—passing walking egress at zero point four meters, but completely trapping a wheelchair user who requires zero point nine meters of clearance. Meanwhile, our deterministic safety engine immediately locks out the central lifts.

<break time="0.8s" />

Now, watch the self-correcting Gemini 4 Argon remediation loop in action.

<break time="0.7s" />

Without drilling a single screw into a renter’s wall, Argon proposes moving twenty kilograms of heavy textbooks from the top shelf to the bottom shelf as natural ballast—dropping the center of mass from one point four eight meters to zero point five eight meters, and raising the overturning safety factor from zero point five four to one point four two. Along Route A, it relocates the unanchored banners and widens the Concourse Hall pinch point to one point four five meters.

<break time="0.6s" />

We re-run all fifty Monte Carlo seismic trials in real time. The result: fifty out of fifty verified clear—for both walking and wheelchair evacuation.

<break time="0.6s" />

ClearExit enforces two-phase life safety: during shaking, Drop, Cover, and Hold On under a verified shelter; after shaking stops, evacuate along a mathematically verified, barrier-free path to safety.
```

---

## 4. Stage Choreography Cheat-Sheet (While the Audio Plays)

| Timestamp | Visual Action on Screen (`slava/viewer/index.html` or `Pinky/` / `final/`) | Key Metric to Point At |
| :--- | :--- | :--- |
| **`0:00 – 0:25`** | Start in **Macro Overview** with **Room 200** pinned (`1` key). | Point to **Room 200 → Exhibition Rd** (`9.52 px/m`). |
| **`0:25 – 0:55`** | Press **First-Person Walk** through the blue double doors into the Breakout Hall. Open `Cmd+Space` and click any object (`Jet Engine` / `Banner`) to flash the real walk photo evidence. | **`52 / 52` objects recovered (`0.157 m` median error)**. |
| **`0:55 – 1:45`** | Press `Cmd+Space` → click **"⚡ Shake 50x at 0.35 g"** (or click **Trigger 6.8M Quake** in `Pinky/`). Let the WebAudio P/S-wave rumble play as hazards tip into the path. | Show **`0/50` blocked** in Room 200/Lobby & **`50/50` walk vs. `0/50` wheelchair** (`0.62 m < 0.90 m`) in Hall + **Lift Lockout**. |
| **`1:45 – 2:35`** | Press `Cmd+Space` → click **"🛠️ Apply Argon Fix · Re-Verify 50x"** (or **Synthesize & Verify Renter-Safe Layout** in `Pinky/`). Show side-by-side Before vs. After. | Bottom-shelf ballast drops $h_{\text{CoM}}$ `1.48m → 0.58m` ($SF: 0.54 \to 1.42$); clearance flips **`0/50 → 50/50`**. |
| **`2:35 – 3:00`** | Walk the glowing green floor chevrons out to **Exhibition Road** and close on the 2-Phase Life-Safety banner (*Drop, Cover & Hold On* during shaking → evacuate after). | **`50/50` Walk (`0.4m`) & Wheelchair (`0.9m`) Verified Clear**. |
