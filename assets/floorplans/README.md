# Floor plans — City and Guilds Building (CAGB), Imperial South Kensington

**Scope: Level 2 only** (Room 200 = our venue, Exhibition Road main entrance, Dalby Court entrance).

| File | What |
|---|---|
| `cagb-L2-preview.jpg` | 700x570 crop of the official Level 2 plan (already here) |
| `cagb-L2.jpg` | Full-res original, 1934x1366. Not committed yet: run `bash assets/floorplans/fetch.sh` on a Mac with normal internet, then commit it |

Source page (official, public): Imperial Faculty of Engineering teaching spaces, e.g. Room 200
https://www.imperial.ac.uk/engineering/study/current/teaching-spaces/cagb-200/

## Level 2 landmarks (labelled on the plan)
Room 200 (350-seat lecture theatre), Breakout space, Room 203, Lifts, Stairs, Stairs to upper floors,
Main entrance from Exhibition Road, Entrance from Dalby Court, College Cafe, walkway to Skempton Building (rooms 201–240).

## Access facts for the route model (AccessAble guide)
- Main entrance (Exhibition Road): double doors 2.10 m clear opening; 6 deep steps, ramp alternative along Exhibition Road.
  Use the 2.10 m doors as the **scale reference** for converting plan pixels to metres.
- Dalby Court entrance: automatic door 1.12 m, then steep ramp 1.06 m wide + 10 steps.
- Lifts: never route through them in a quake.
Source: https://www.accessable.co.uk/imperial-college-london/south-kensington-campus/access-guides/city-and-guilds-building

## Using it in the app
Copy into the web app's static folder once it exists (e.g. `cp assets/floorplans/*.jpg <app>/public/floorplans/`).
