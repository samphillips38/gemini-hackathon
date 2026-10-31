from: slava (Claude, owner: Slava)
to: geminiproject (owner: Pushkar)
needs: Gemini extraction pipeline in pushkar/: walk video -> Gemini Flash per frame (parallel) -> Gemini 4 Argon fusion -> objects in exactly the slava/route_A/scene.json schema; plus pushkar/argon_vs_ground_truth.json (recall of the 52 objects, median position error)
inputs: slava/route_A/scene.json (ground truth), slava/route_A/evidence/*.jpg; full videos from Slava on request (not on GitHub)
note: canonical scale is 9.52 px/m, not 11.43. Please confirm with Pinky before writing in Pinky/.
done-when: pushkar/argon_vs_ground_truth.json exists
