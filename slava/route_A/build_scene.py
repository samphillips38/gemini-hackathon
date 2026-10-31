"""Build slava/route_A/scene.json: CAGB Level 2, Room 200 -> Main Entrance (Exhibition Road).

Sources: two phone walks (V = Room 200 -> entrance, portrait; H = entrance -> Room 200, landscape),
optical-flow walking-speed profile (flow_V.json / flow_H.json), visual catalogue from frames.
Frame: metres, y up, x east, z south. Origin = outside face of Room 200 front-left door.
All sizes/masses are ESTIMATES from video (typ. +-25%); 'basis' says why.
"""
import json, math, sys
import numpy as np

FLOW_DIR, OUT = sys.argv[1], sys.argv[2]

# ---------- route centreline (walked line, outbound) ----------
ROUTE = [(142.0, 62.0, 0), (140.0, 62.0, 0), (140.0, 65.5, 0), (146.0, 69.0, 0), (146.0, 82.0, 0), (146.0, 90.1, 0),
         (146.5, 92.0, 0), (150.5, 93.5, -1.5), (155.0, 94.5, -1.5), (159.1, 94.5, -1.5), (163.0, 94.5, -1.5),
         (166.0, 94.5, -1.5), (168.0, 94.5, -2.4), (180.0, 94.5, -2.4)]
P = np.array(ROUTE, float); seg = np.linalg.norm(np.diff(P, axis=0), axis=1); S = np.concatenate([[0], np.cumsum(seg)])
L = float(S[-1])

def at(s, lateral=0.0):
    """point on route at arc length s, offset sideways (+ = walker's right when walking outbound)."""
    s = min(max(s, 0), L); i = min(int(np.searchsorted(S, s, side="right") - 1), len(seg) - 1)
    u = (s - S[i]) / seg[i]; p = P[i] + u * (P[i + 1] - P[i]); d = P[i + 1] - P[i]
    dx, dy = d[0], d[1]; n = math.hypot(dx, dy) or 1
    right = np.array([dy / n, -dx / n, 0])          # walker's right in X-east / Y-north frame
    q = p + right * lateral; yaw = math.degrees(math.atan2(dx, dy))   # heading, degrees clockwise from north
    return [round(float(q[0]), 2), round(float(q[1]), 2), round(float(q[2]), 2)], round(yaw, 1)

# ---------- walking-speed-aware time -> distance ----------
LANDMARKS = {
  "V": [(71, 0.0, "Room 200 front-left door"), (74, 5.5, "enter central hall"), (94, 25.45, "hall north end / dark portal"),
        (104, 33.55, "automatic glass doors (C&G)"), (106, 35.51, "top of stair/ramp"), (113, 40.04, "foot of stair, main lobby"),
        (124, 48.75, "inner sliding doors"), (136.5, 52.65, "outer sliding doors"), (140, 57.84, "foot of exterior steps"), (156, 69.84, "Exhibition Road pavement")],
  "H": [(0, 60.5, "outside, by IMPERIAL sign"), (21, 52.65, "outer sliding doors"), (23.5, 48.75, "inner sliding doors"),
        (42, 40.04, "foot of stair/ramp"), (47, 33.55, "automatic glass doors (C&G)"), (55, 25.45, "hall north end"),
        (69, 5.5, "hall south end / vestibule"), (78, 0.0, "Room 200 front-left door")],
}
def load_flow(tag):
    r = json.load(open(f"{FLOW_DIR}/flow_{tag}.json")); t = np.array([x["t"] for x in r]); f = np.array([x["fwd"] for x in r])
    k = 5; fs = np.convolve(f, np.ones(k) / k, mode="same"); pos = fs[fs > 0]
    w = np.clip(fs, 0, None) + 0.15 * (np.median(pos) if len(pos) else 1.0)   # floor so slow-but-moving still advances
    return t, w
FLOW = {k: load_flow(k) for k in ("V", "H")}
def s_of_t(tag, t):
    lm = LANDMARKS[tag]; tt, w = FLOW[tag]
    if t <= lm[0][0]: return lm[0][1]
    if t >= lm[-1][0]: return lm[-1][1]
    for (ta, sa, _), (tb, sb, _) in zip(lm, lm[1:]):
        if ta <= t <= tb:
            m = (tt >= ta) & (tt <= tb); W = np.cumsum(w[m]); tm = tt[m]
            if len(W) < 2: return sa + (sb - sa) * (t - ta) / (tb - ta)
            frac = np.interp(t, tm, W) / W[-1]; return float(sa + (sb - sa) * frac)
def speed_profile(tag):
    lm = LANDMARKS[tag]; t0, t1 = lm[0][0], lm[-1][0]; ts = np.arange(t0, t1 + 0.01, 1.0); ss = np.array([s_of_t(tag, t) for t in ts])
    sm = np.convolve(np.pad(ss, 2, mode="edge"), np.ones(5) / 5, mode="valid"); v = np.abs(np.gradient(sm, ts)); return [dict(t=float(a), s=round(float(b), 2), v=round(float(c), 2)) for a, b, c in zip(ts, ss, v)]

# ---------- zones (geometry + materials for realistic rendering) ----------
MAT = {
  "terrazzo": {"base": "#8d8f8c", "speck": ["#2b2d2f", "#d8d8d2", "#5d6063"], "inlay": "#2a2c2e", "rough": 0.35},
  "carpet_charcoal": {"base": "#4b4e53", "rough": 0.95},
  "oak_slats": {"base": "#c49461", "rough": 0.6},
  "oak_perforated": {"base": "#c79a63", "rough": 0.65},
  "stone_grey_clad": {"base": "#9b9d9f", "rough": 0.7},
  "granite_black_speckled": {"base": "#3b3c3d", "rough": 0.5},
  "plaster_white": {"base": "#f2f2ef", "rough": 0.9},
  "stone_tile_dark": {"base": "#5e6164", "rough": 0.55},
  "paving_light": {"base": "#b9b7b1", "rough": 0.85},
  "glass_clear": {"tint": "#d9eef2", "opacity": 0.18},
  "glass_frosted_pattern": {"tint": "#eef4f5", "opacity": 0.35},
  "door_blue": {"base": "#2a4f9f"}, "seat_blue": {"base": "#2f6cb6"}, "desk_white": {"base": "#e7e7e3"},
}
ZONES = [  # building frame (team calibration: cagb-L2.jpg 1934x1366, 9.52 px/m): box = [X0, X1, Y0, Y1]; floor slopes along X if floor_z_end set
  dict(id="room200", name="Room 200 lecture theatre (350 seats)", box=[142.0, 156.7, 51.7, 64.5], floor_z=0, height=7.5, floor="carpet_charcoal",
       walls={"north": "plaster_white", "east": "oak_perforated", "west": "oak_perforated", "south": "oak_perforated"},
       gaps={"west": [[61.4, 63.2]], "south": [[145.0, 146.6]], "east": [[52.7, 54.3]]},
       note="Footprint from team plan (cagb-L2-3d-rooms.json). Stage north; tiers rise south to rear doors. Fixed blue seats + white desks (bolted)."),
  dict(id="vestibule", name="Room 200 vestibule", box=[138.5, 142.0, 59.5, 64.5], floor_z=0, height=3.4, floor="terrazzo",
       walls={"south": "oak_slats", "west": "granite_black_speckled"}, note="Oak-slatted recess, speckled black granite pier."),
  dict(id="hall", name="Central hall (double height)", box=[133.0, 159.0, 64.5, 82.0], floor_z=0, height=7.5, floor="terrazzo",
       walls={"west": "stone_grey_clad", "north": "plaster_white"}, gaps={"north": [[143.0, 149.0]]},
       note="Terrazzo with dark inlay strips; grey stone-clad piers; oak upper band; ring pendants; glazing east (object)."),
  dict(id="corridor", name="North corridor (Level 2 reception)", box=[142.0, 150.0, 82.0, 90.1], floor_z=0, height=3.3, floor="terrazzo",
       walls={"west": "plaster_white", "east": "plaster_white", "north": "plaster_white"}, gaps={"north": [[144.5, 147.5]]},
       note="Dark granite portal at south end; reception desk; WC doors; automatic glass doors north."),
  dict(id="foyer_top", name="C&G entrance landing", box=[142.9, 146.5, 90.1, 102.0], floor_z=0, height=6, floor="stone_tile_dark",
       walls={"north": "plaster_white", "west": "plaster_white"}, note="Landing at Level 2 above the stair and ramp."),
  dict(id="stair_zone", name="Stair down to main lobby", box=[146.5, 150.5, 90.1, 102.0], floor_z=0, floor_z_end=-1.5, height=6, floor="stone_tile_dark",
       walls={"north": "plaster_white"}, note="About 10 steps of ~0.15 m; ramp alongside on the north side; frameless glass balustrades."),
  dict(id="lobby", name="Main entrance lobby (glazed atrium)", box=[150.5, 159.1, 86.0, 106.0], floor_z=-1.5, height=10, floor="stone_tile_dark",
       walls={"north": "glass_clear", "south": "plaster_white"}, note="Glazed atrium, dark stone tiles, white columns, stone-clad cylinder. Extends north of the drawn plan (from video)."),
  dict(id="draught_lobby", name="Entrance draught lobby", box=[159.1, 163.0, 92.5, 96.5], floor_z=-1.5, height=4, floor="stone_tile_dark",
       walls={"north": "glass_frosted_pattern", "south": "glass_frosted_pattern"}, note="Two sets of automatic sliding doors, frosted pattern glass, entrance matting."),
  dict(id="terrace", name="Entrance terrace under canopy", box=[163.0, 166.0, 82.0, 107.0], floor_z=-1.5, height=0, floor="paving_light",
       note="Planters either side of the doors."),
  dict(id="steps", name="Steps down to Exhibition Road", box=[166.0, 168.0, 82.0, 107.0], floor_z=-1.5, floor_z_end=-2.4, height=0, floor="paving_light",
       note="Six steps (AccessAble); ramp alternative along Exhibition Road."),
  dict(id="pavement", name="Exhibition Road pavement", box=[168.0, 182.0, 78.0, 111.0], floor_z=-2.4, height=0, floor="paving_light",
       note="Open pavement; move away from the glazed facade after shaking stops."),
]

# ---------- catalogue ----------
# placement: ("route", video, t, lateral_m) or ("xyz", x, y, z). size_m = [w(across), d, h]
O = []
def add(id, zone, type, label, place, size, mass, anchored, glass, model, basis, hazard, evidence, color=None, extra=None, yaw=None):
    O.append(dict(id=id, zone=zone, type=type, label=label, place=place, size_m=size, mass_kg=mass, anchored=anchored, glass=glass,
                  model=model, basis=basis, hazard=hazard, evidence=evidence, color=color, yaw=yaw, **(extra or {})))

# Room 200 (direct coordinates; tiers are generated from zone.raked)
add("r200_seating", "room200", "fixed_seating", "Tiered fixed seats + desks (13 rows)", ("xyz", 10, 0, 11), [20, 12, 3.6], None, True, False,
    "theatre_tiers", "350 seats (Imperial room page); rows counted approx from video", "Anchored. Aisles ~1.2 m are the escape lanes; bags/laptops on aisle steps are trip hazards.", ["V 18", "V 20", "V 22"])
add("r200_lectern", "room200", "av_lectern", "Teaching desk / AV lectern", ("xyz", 4.0, 0, 2.6), [1.4, 0.75, 1.05], 120, "unknown", False,
    "lectern", "steel cabinet + monitor, typical lecture-theatre unit", "Heavy, may slide toward the front-left exit.", ["H 80"])
add("r200_food_tables", "room200", "folding_table", "Hackathon food tables (x2)", ("xyz", 9.5, 0, 2.2), [3.6, 0.75, 0.74], 30, False, False,
    "folding_tables", "2 x 1.8 m folding tables with pizza boxes", "Light, topple/slide; spill. Sits in the queue zone by the front exit.", ["V 52"])
add("r200_banner_front", "room200", "pullup_banner", "Pull-up banner (front)", ("xyz", 1.0, 0, 1.2), [0.85, 0.35, 2.0], 6, False, False,
    "banner", "standard 85x200 cm roll-up stand", "Topples at very low shaking; falls across the front-left exit lane.", ["V 6"])
add("r200_screens", "room200", "projection_screen", "Projection screens + whiteboards (front wall)", ("xyz", 10, 3.4, 0.15), [12, 0.1, 3.0], None, True, False,
    "screens", "two screens + boards on north wall", "Wall-mounted.", ["V 32", "V 42"])
add("r200_door_front_left", "room200", "door", "Front-left exit (blue double door, vision panels)", ("xyz", 2.0, 0, 0.0), [1.8, 0.1, 2.2], None, True, False,
    "door_double_blue", "two 0.9 m leaves, push plates, closer; exit sign + clock above", "Main exit used today; congested by the food queue.", ["V 72", "V 70"])
add("r200_door_rear", "room200", "door", "Rear exit at top of centre-left aisle", ("xyz", 6.3, 3.64, 18.0), [1.6, 0.1, 2.1], None, True, False,
    "door_double_blue", "seen at top of aisle with exit sign", "Alternative exit away from the front crowd.", ["V 18", "V 16"])
add("r200_door_side", "room200", "door", "Upper side exit (east wall)", ("xyz", 20.0, 2.8, 14.0), [1.6, 0.1, 2.1], None, True, False,
    "door_double_blue", "blue double door beside perforated oak wall", "Alternative exit.", ["V 38"], yaw=90)
add("r200_crowd", "room200", "crowd", "Hackathon crowd (front queue + seated)", ("xyz", 6, 0, 3), [10, 4, 1.75], None, False, False,
    "crowd", "dense standing group at the front (food), ~40% seats occupied", "Bottleneck at the front-left door; rear exits are faster from upper rows.", ["V 4", "V 34", "V 56", "H 82"],
    extra=dict(standing=55, seated=140, standing_zone=[0.5, 13, 0.6, 4.8]))

# Vestibule
add("banner_build_future", "vestibule", "pullup_banner", "Pull-up banner 'Build the Future. Together.'", ("route", "H", 68, -1.4), [0.85, 0.35, 2.0], 7, False, False,
    "banner", "standard roll-up stand", "Topples into the 3-4 m vestibule lane right outside Room 200.", ["H 68", "H 74"], color="#1d2230")
add("recycling_bins", "vestibule", "bins", "Recycling bins x3", ("route", "H", 70, -1.8), [1.4, 0.45, 1.0], 36, False, False,
    "bins", "3 x ~12 kg bins", "Light, roll/topple; minor obstruction.", ["H 70"])

# Hall
for i, s in enumerate([11, 18, 25, 32]):
    add(f"ring_pendant_{i+1}", "hall", "pendant_light", f"Ring pendant light {i+1}", ("xyz", *at(s, 0.5)[0][:1], 5.6, at(s, 0.5)[0][2]), [2.0, 2.0, 0.12], 25, True, False,
        "ring_light", "~2 m LED ring on suspension cables", "Swings overhead; fall risk if a cable fails. Do not shelter under.", ["V 80", "V 86", "H 56"])
add("blue_benches", "hall", "bench", "Blue modular benches along the glazing", ("route", "V", 80, 4.6), [1.0, 14.0, 0.8], 300, False, False,
    "bench_row", "5 L/straight units ~60 kg each", "Slide on polished terrazzo; can pin against glass.", ["V 78", "V 86", "H 58", "H 66"], color="#1f4fa3")
add("jet_engine_exhibit", "hall", "exhibit", "Turbofan engine exhibit on A-frame stand", ("route", "V", 88, 4.2), [1.6, 1.1, 1.9], 250, "unknown", False,
    "jet_engine", "fan ~1.5 m dia on steel stand; exhibit mass guess +-50%", "Top-heavy freestanding exhibit by the route: high topple risk.", ["H 56", "V 88"])
add("refreshment_table", "hall", "folding_table", "Refreshment table (urns, cups)", ("route", "V", 76.5, 3.0), [1.2, 0.6, 0.75], 25, False, False,
    "folding_tables", "white folding table + drink dispensers", "Topple + hot-water spill near the route.", ["H 64", "V 76"])
add("fire_extinguishers", "hall", "extinguisher", "Fire extinguishers on floor stand (x2)", ("route", "H", 63, 5.5), [0.6, 0.3, 0.65], 24, False, False,
    "extinguishers", "2 x ~12 kg cylinders", "Can topple and roll; needed after the quake.", ["H 64", "H 62"])
add("spiral_glass_stair", "hall", "stair_enclosure", "Glass-walled spiral stair", ("route", "V", 86, 6.0), [3.0, 3.0, 7.0], None, True, True,
    "spiral_stair", "double-height glass enclosure", "Glass hazard zone around enclosure.", ["V 86"])
add("hazard_tape_marking", "hall", "floor_marking", "Yellow/black taped floor rectangle", ("route", "V", 88, -1.0), [1.4, 1.2, 0.01], None, True, False,
    "floor_tape", "taped rectangle on terrazzo", "Marks a floor feature; not a quake hazard.", ["V 88", "H 58"])
for i, s in enumerate([13, 21, 29]):
    add(f"stone_pier_{i+1}", "hall", "structure", f"Stone-clad pier {i+1}", ("xyz", at(s, -4.2)[0][0], 0, at(s, -4.2)[0][2]), [1.4, 1.4, 7.5], None, True, False,
        "pier", "grey stone-clad structural pier", "Structural; good 'triangle of life' reference is NOT recommended: follow Drop-Cover-Hold.", ["V 84", "V 90", "V 92"])
add("glazing_hall_east", "hall", "glazing", "Full-height glazing (hall east)", ("xyz", 12, 0, -19), [0.05, 30, 7.5], None, True, True,
    "glazing", "curtain wall", "Shatter zone: keep 1.5 m from glass while shaking.", ["V 78", "H 56"])
add("lifts", "hall", "lift", "Lifts (from plan)", ("route", "V", 84, -6.5), [2.4, 0.3, 2.3], None, True, False,
    "lift_doors", "from floor plan; doors not clearly in video", "Never use lifts in a quake.", ["plan"])

# Corridor
add("dark_portal", "corridor", "portal", "Black granite portal with exit sign", ("route", "V", 94, 0), [6.0, 0.6, 3.3], None, True, False,
    "portal", "speckled black granite frame", "Structural.", ["V 94"])
add("accessible_wc", "corridor", "door", "Accessible WC door (blue)", ("route", "V", 96, -3.0), [1.0, 0.1, 2.1], None, True, False,
    "door_single_blue", "wheelchair sign", "", ["V 96"], yaw=90)
add("reception_L2", "corridor", "desk", "Curved reception desk (Level 2)", ("route", "V", 100, 1.8), [2.4, 0.9, 1.1], 200, True, False,
    "reception_curved", "grey curved desk", "Likely fixed.", ["V 100", "V 98"], color="#8e939b")
add("directory_pylon", "corridor", "sign", "Level 2 directory pylon", ("route", "V", 102, -0.9), [0.6, 0.6, 2.6], None, True, False,
    "pylon", "column wrapped with blue directory", "Fixed.", ["V 102"])
add("lounge_chair", "corridor", "chair", "High-back lounge chair", ("route", "V", 102, 1.6), [0.9, 0.9, 1.2], 35, False, False,
    "armchair", "upholstered grey", "Slides; minor.", ["V 102"], color="#8f949c")
add("auto_glass_doors_cg", "corridor", "door", "Automatic glass double doors (C&G)", ("route", "V", 104, 0), [1.8, 0.1, 2.2], None, True, True,
    "door_glass_auto", "frameless glass, 'Automatic door' signs", "Glass; may stop on power loss: use manual push.", ["V 106", "H 48"])

# Stair + ramp
add("cg_stair", "stair_ramp", "stair", "Stair down to main lobby (10 steps)", ("xyz", 10.5, 0, -48.0), [3.0, 4.0, 1.5], None, True, False,
    "stair", "approx 10 x 0.15 m", "Able-bodied route; wheelchair users use the ramp.", ["V 106", "H 42"])
add("cg_ramp", "stair_ramp", "ramp", "Ramp alongside stair", ("xyz", 17, 0, -44), [18, 2.0, 1.5], None, True, False,
    "ramp", "long gentle ramp with handrails", "Accessible route.", ["V 110"])
add("glass_balustrades", "stair_ramp", "balustrade", "Frameless glass balustrades + steel handrails", ("xyz", 17, 0, -45.2), [18, 0.02, 1.1], None, True, True,
    "balustrade", "toughened glass ~1.1 m", "Glass edge along the descent.", ["V 106", "V 110", "H 36"])

# Main lobby
add("statue_marble", "lobby", "statue", "White marble statue on plinth", ("route", "V", 118, -3.8), [0.9, 0.9, 2.5], 1400, "unknown", False,
    "statue", "life-size marble ~0.5 m3 x 2700 kg/m3 + plinth", "Very heavy; if not dowelled to plinth it can topple onto the route.", ["V 118", "H 36", "H 38"], color="#e8e4da")
add("digital_totem", "lobby", "screen_totem", "Freestanding digital screen totem", ("route", "H", 33, 3.0), [1.1, 0.45, 2.1], 130, False, False,
    "screen_totem", "double-sided ~55 in display in plinth", "Top-heavy; topples into the lobby path.", ["H 30", "H 34"])
add("wayfinding_totem", "lobby", "sign", "'Welcome to South Kensington Campus' totem", ("route", "H", 28, 2.4), [0.6, 0.35, 2.0], 60, "unknown", False,
    "sign_totem", "freestanding campus map", "Topples if freestanding.", ["H 28"])
add("cylinder_core", "lobby", "structure", "Stone-clad cylindrical core", ("xyz", 36, -1.5, -38.5), [4.0, 4.0, 11], None, True, False,
    "cylinder", "round core, warm grey stone", "Structural.", ["V 116", "H 34"])
add("reception_main", "lobby", "desk", "Main reception desk 'WELCOME'", ("xyz", 41, -1.5, -58.5), [4.0, 0.9, 1.1], 400, True, False,
    "reception_long", "long white desk before blue feature wall", "Likely fixed.", ["H 26", "H 28"], color="#efefeb")
add("feature_wall_brain", "lobby", "wall", "Blue feature wall (brain graphic)", ("xyz", 41, -1.5, -61.8), [9, 0.2, 5], None, True, False,
    "feature_wall", "printed graphic wall", "Fixed.", ["H 26", "H 28"], color="#163a8c")
add("planters_lobby", "lobby", "planter", "Large planters with shrubs (x2)", ("xyz", 37.5, -1.5, -58), [0.6, 0.6, 1.6], 160, False, False,
    "planter_pair", "2 x ~80 kg soil-filled", "Low centre of mass; slide only.", ["H 26"])
add("chair_row", "lobby", "beam_seating", "Row of black linked chairs", ("xyz", 31, -1.5, -58.5), [3.2, 0.6, 0.8], 50, False, False,
    "beam_chairs", "5-seat beam", "Slides; minor.", ["H 26"])
add("glazing_lobby", "lobby", "glazing", "Glazed atrium facade", ("xyz", 50, -1.5, -48), [0.05, 28, 11], None, True, True,
    "glazing", "full-height curtain wall", "Large shatter zone along the facade.", ["V 112", "V 116", "H 34"])

# Entrance + forecourt
add("sliding_doors_inner", "draught_lobby", "door", "Inner automatic sliding doors", ("xyz", 50, -1.5, -47), [2.1, 0.1, 2.4], None, True, True,
    "door_sliding", "AccessAble: 210 cm opening", "Glass; on power loss use manual break-out.", ["V 124"], yaw=90)
add("sliding_doors_outer", "draught_lobby", "door", "Outer automatic sliding doors", ("xyz", 54, -1.5, -47), [2.1, 0.1, 2.4], None, True, True,
    "door_sliding", "frosted 'I' pattern manifestation", "Glass; on power loss use manual break-out.", ["V 136", "H 20"], yaw=90)
add("planters_forecourt", "forecourt", "planter", "White tapered planters with small trees (x6)", ("xyz", 55.5, -1.5, -47), [0.75, 0.75, 1.8], 150, False, False,
    "planter_row", "soil-filled GRP planters", "Low CoM; obstruct the door approach if they slide.", ["H 16", "H 18", "V 130"])
add("steps_exterior", "forecourt", "stair", "6 steps down to Exhibition Road", ("xyz", 58.9, -1.5, -47), [10, 1.8, 0.9], None, True, False,
    "stair_wide", "AccessAble: six deep steps + ramp along Exhibition Road", "Wheelchair users: ramp along Exhibition Road.", ["V 140", "H 12"])
add("sign_wall_imperial", "forecourt", "sign", "'IMPERIAL Main Entrance' sign wall", ("xyz", 59, -1.5, -43.5), [2.2, 0.4, 1.3], None, True, False,
    "sign_wall", "blue sign on stone cheek wall", "Fixed.", ["V 140", "H 0"], color="#1f47b8")
add("canopy_facade_overhead", "forecourt", "glazing", "Canopy + glazed facade overhead", ("xyz", 56, 6, -47), [4, 26, 0.3], None, True, True,
    "canopy", "white steel columns, glazed facade above", "Falling glass: once outside, move well away from the building.", ["V 150", "H 8", "H 10"])
add("ebike_docks", "forecourt", "bikes", "Hire e-bike docks (Exhibition Road)", ("xyz", 70, -2.4, -55), [8, 1.8, 1.1], 400, False, False,
    "bike_row", "~15 parked bikes", "Topple domino along pavement; minor.", ["V 150", "H 2", "H 6"])


OVR = {  # id: (X, Y, Z, size or None, yaw or None, extra or None)
  "r200_seating": (149.35, 56.4, 0, [14.7, 9.4, 3.0], 0, dict(raked=dict(rows=11, row_depth=0.85, rise=0.27, aisles_local_x=[-2.7, 2.7], aisle_w=1.1, curve_radius=26, seat_w=0.55, occupancy=0.4))),
  "r200_lectern": (143.9, 62.6, 0, None, 180, None), "r200_food_tables": (148.8, 63.3, 0, None, 0, None),
  "r200_banner_front": (142.7, 63.8, 0, None, 180, None), "r200_screens": (150.5, 64.35, 1.4, [10, 0.1, 3.0], 180, None),
  "r200_door_front_left": (142.0, 62.3, 0, None, 90, None), "r200_door_rear": (145.8, 51.7, 2.97, None, 0, None),
  "r200_door_side": (156.7, 53.5, 2.7, None, 90, None), "r200_crowd": (147.3, 62.8, 0, [9.0, 2.8, 1.8], 0, None),
  "ring_pendant_1": (147, 71, 5.6, None, 0, None), "ring_pendant_2": (147, 77, 5.6, None, 0, None),
  "ring_pendant_3": (152, 74, 5.6, None, 0, None), "ring_pendant_4": (152, 80, 5.6, None, 0, None),
  "stone_pier_1": (141.5, 70.5, 0, None, 0, None), "stone_pier_2": (141.5, 77.5, 0, None, 0, None), "stone_pier_3": (150.5, 81.0, 0, None, 0, None),
  "glazing_hall_east": (159.0, 73.25, 0, [17.5, 0.05, 7.5], 90, None), "spiral_glass_stair": (154.5, 79.0, 0, None, 0, None),
  "blue_benches": (157.4, 72.5, 0, [1.0, 12.0, 0.8], 0, None), "lifts": (133.2, 74.0, 0, None, 90, None),
  "cg_stair": (148.5, 92.75, -1.5, [3.0, 4.0, 1.5], 270, None), "cg_ramp": (147.0, 100.5, -1.5, [8.0, 1.6, 1.5], 0, None),
  "glass_balustrades": (147.0, 99.6, -1.5, [8.0, 0.02, 1.1], 0, None),
  "cylinder_core": (157.0, 100.0, -1.5, None, 0, None), "reception_main": (154.8, 104.6, -1.5, None, 180, None),
  "feature_wall_brain": (154.8, 105.9, -1.5, [8, 0.2, 5], 180, None), "planters_lobby": (151.3, 103.0, -1.5, [3.0, 0.6, 1.6], 0, None),
  "chair_row": (152.8, 88.2, -1.5, None, 0, None), "glazing_lobby": (159.1, 96.0, -1.5, [20, 0.05, 10], 90, None),
  "sliding_doors_inner": (159.1, 94.5, -1.5, None, 90, None), "sliding_doors_outer": (163.0, 94.5, -1.5, None, 90, None),
  "planters_forecourt": (164.5, 99.0, -1.5, [5.0, 0.75, 1.8], 90, None),
  "steps_exterior": (167.0, 94.5, -1.5, [2.0, 10.0, 0.9], 0, None), "sign_wall_imperial": (167.0, 100.6, -1.5, None, 90, None),
  "canopy_facade_overhead": (162.5, 94.5, 3.5, [7.0, 20.0, 0.3], 0, None), "ebike_docks": (176.0, 86.5, -2.4, None, 0, None),
  "spiral_glass_stair_": None,
}
import copy
for o in O:
    v = OVR.get(o["id"])
    if v:
        X, Y, Z, size, yaw, extra = v; o["place"] = ("xyz", X, Y, Z)
        if size: o["size_m"] = size
        if yaw is not None: o["yaw"] = yaw
        if extra: o.update(extra)
# second planter group south of the doors
_p = copy.deepcopy(next(o for o in O if o["id"] == "planters_forecourt")); _p.update(id="planters_forecourt_s", label="White tapered planters with small trees (south of doors)", place=("xyz", 164.5, 90.0, -1.5)); O.append(_p)
for o in O:
    if o["id"] == "r200_crowd": o.update(standing=55, seated_fraction=0.4)
    if o["id"] == "jet_engine_exhibit": o["yaw"] = 225
    if o["id"] == "statue_marble": o["yaw"] = 180

# ---------- resolve placements ----------
def tip_threshold_g(o):
    if o["anchored"] is True or not o.get("mass_kg") or o["size_m"][2] < 0.3: return None
    w, d, h = o["size_m"]; b = min(w, d); hcm = h * (0.6 if o["type"] in ("exhibit", "screen_totem", "statue") else 0.5)
    return round((b / 2) / hcm, 2)
for o in O:
    pl = o.pop("place")
    if pl[0] == "route":
        _, tag, t, lat = pl; s = s_of_t(tag, t); pos, yaw = at(s, lat)
        o.update(pos=pos, route_s=round(s, 1), yaw=o["yaw"] if o["yaw"] is not None else yaw, side=("right" if lat > 0.3 else "left" if lat < -0.3 else "centre"))
    else:
        o.update(pos=[float(pl[1]), float(pl[2]), float(pl[3])], route_s=None, yaw=o["yaw"] or 0, side=None)
    o["tip_threshold_g"] = tip_threshold_g(o)

scene = dict(
  _about="CAGB Level 2: Room 200 -> Main Entrance (Exhibition Road). Built from two phone walks + optical-flow speed profile. Sizes/masses are estimates (+-25% typ.). Coordinates: BUILDING frame shared with assets/floorplans/cagb-L2-graph.json (metres; X east = u/9.52, Y north = (1366-v)/9.52 on cagb-L2.jpg 1934x1366; Z up). three.js: [X-150, Z, -(Y-80)], rotation.y = -yaw (yaw = degrees clockwise from north). tip_threshold_g = (b/2)/h_CoM static overturning estimate for freestanding objects (b = smaller base dimension).",
  version="2.0", units="m, kg, s", frame=dict(name="building", plan_px_per_m=9.52, plan_image="assets/floorplans/cagb-L2.jpg", three_offset=[150, 80]), route=dict(points=ROUTE, length_m=round(L, 1),
    landmarks={k: [dict(t=t, s=s, label=lab) for t, s, lab in v] for k, v in LANDMARKS.items()}),
  walk=dict(videos={"V": dict(file="20261031_132011.mp4", direction="Room 200 -> Main Entrance", orientation="portrait", duration_s=156.6),
                    "H": dict(file="20261031_132259.mp4", direction="Main Entrance -> Room 200", orientation="landscape", duration_s=86.6)},
            measured_walk_time_s={"V_door_to_outside": 66, "H_outside_to_door": 57},
            speed_profile={k: speed_profile(k) for k in ("V", "H")},
            method="Farneback optical flow at 5 fps; forward motion = median radial expansion after removing global pan; distance between landmarks distributed by cumulative forward motion (not by time)."),
  materials=MAT, zones=ZONES, objects=O)
json.dump(scene, open(OUT, "w"), indent=1)
print("objects", len(O), "route length", round(L, 1))
for o in O:
    if o["route_s"] is not None: print(f'  {o["id"]:24s} s={o["route_s"]:6.1f} pos={o["pos"]} tip={o["tip_threshold_g"]}')
