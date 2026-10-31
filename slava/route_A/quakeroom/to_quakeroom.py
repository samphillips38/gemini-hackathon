"""Export slava/route_A/scene.json zones as Plan B RoomSceneGraph JSON (Ana/ava/sam contracts.ts) so the team's
QuakeRoom solver + Monte Carlo can run on the real CAGB Level 2 spaces. Extra fields (source_id, model, yaw_deg,
tip_threshold_g, evidence, pga_g) are additive; the solver can ignore them."""
import json, sys
S = json.load(open(sys.argv[1])); out = sys.argv[2]
CAT = {"door": "exit_door", "glazing": "window", "balustrade": "fragile_glass", "stair_enclosure": "fragile_glass",
       "desk": "desk", "av_lectern": "desk", "folding_table": "desk", "chair": "chair", "bench": "chair", "beam_seating": "chair",
       "screen_totem": "tv_monitor", "projection_screen": "tv_monitor"}
SKIP = {"structure", "floor_marking", "portal", "stair", "ramp", "crowd", "fixed_seating", "pendant_light", "lift", "wall", "sign", "bikes"}
GROUP = {"room200": ["room200"], "hall": ["hall", "vestibule"], "corridor": ["corridor"], "lobby": ["lobby", "foyer_top", "stair_zone", "draught_lobby"]}
zones = {z["id"]: z for z in S["zones"]}; index = []
for gid, zids in GROUP.items():
    X0 = min(zones[z]["box"][0] for z in zids); X1 = max(zones[z]["box"][1] for z in zids)
    Y0 = min(zones[z]["box"][2] for z in zids); Y1 = max(zones[z]["box"][3] for z in zids)
    objs = []
    for o in S["objects"]:
        if o["zone"] not in zids or o["type"] in SKIP: continue
        if o["type"] == "sign" and o.get("mass_kg") is None: continue
        w, d, h = o["size_m"]; yaw = o.get("yaw") or 0; r = int(round(yaw / 90.0)) % 4 * 90
        objs.append(dict(id=o["id"], category=CAT.get(o["type"], "heavy_item"), label=o["label"], parent_id=None,
            x_m=round(o["pos"][0] - X0, 2), z_m=round(o["pos"][1] - Y0, 2), width_m=w, height_m=h, depth_m=d, rotation_deg=r,
            mass_kg=o["mass_kg"] if o["mass_kg"] is not None else 0, anchored_to_wall=(o["anchored"] is True), is_fragile=bool(o["glass"]),
            source_id=o["id"], model=o["model"], yaw_deg=yaw, tip_threshold_g=o.get("tip_threshold_g"), hazard=o.get("hazard"), evidence=o.get("evidence")))
    g = dict(_about=f"CAGB Level 2 '{gid}' from slava/route_A/scene.json. x_m = X - {X0}, z_m = Y - {Y0} (building frame, metres, z_m = north). Real objects from the walk videos.",
             room=dict(width_m=round(X1 - X0, 2), depth_m=round(Y1 - Y0, 2), height_m=max(zones[z]["height"] for z in zids) or 3.0, floor_level=2, renter_no_drill=True),
             earthquake=dict(magnitude_mw=6.8, duration_s=15.0, dominant_axis="XZ", pga_g=0.4, pga_g_range=[0.3, 0.5]),
             objects=objs, origin_building_m=[X0, Y0])
    json.dump(g, open(f"{out}/{gid}.json", "w"), indent=1); index.append((gid, len(objs)))
print(index)
