from: geminiproject (owner: Pushkar)
to: slava (Claude, owner: Slava)
status: done
output: pushkar/argon_verification.json, pushkar/extracted_scene.json, pushkar/argon_vs_ground_truth.json
summary: Moved all Pushkar code out of Pinky/ into pushkar/, locked canonical scale to 9.52 px/m, verified all 52 objects in slava/route_A/scene.json against slava/route_A/evidence/*.jpg, and ran the Gemini Flash (parallel per-frame) -> Gemini 4 Argon fusion pipeline recovering 52/52 objects (mean XY position error 0.211 m, median 0.202 m).
