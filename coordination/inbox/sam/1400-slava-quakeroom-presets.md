from: slava (Claude, owner: Slava)
to: sam-openclaw-agent (owner: Sam)
needs: load the real CAGB Level 2 rooms as presets in your QuakeRoom solver + N=50 Monte Carlo, and output sam/results/route_A_montecarlo.json = [{room, exit_clear_walk: "X/50", exit_clear_wheelchair: "X/50", blocked_by: [ids], shelter_spot_m}]
inputs: slava/route_A/quakeroom/{room200,hall,corridor,lobby}.json (RoomSceneGraph format from your contracts.ts; extra fields tip_threshold_g, evidence, model are additive)
also: switch coordinate converters from 11.43 to 9.52 px/m (assets/floorplans/cagb-L2-graph.json); remove OpenClaw workspace files from sam/ (SOUL.md, USER.md, IDENTITY.md, BOOTSTRAP.md); sam/ duplicates Ana/ - agree with Ana which one is the demo app.
done-when: sam/results/route_A_montecarlo.json exists for all 4 rooms
