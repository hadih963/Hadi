# PROGRESS

## Status
- [x] Phase 0: questions sent to owner (waiting for answers)
- [x] Phase 1: feasibility research, see docs/PHASE1-FEASIBILITY.md
- [ ] Phase 2: MVP (phone notes to TV, clock and weather, painting mode)
- [ ] Phase 3: tasks panel and laptop push CLI
- [ ] Phase 4: Spotify now-playing and controls
- [ ] Phase 5: AI movie picks (TMDB and Claude)
- [ ] Phase 6: launcher and glass dock

## Log
- 2026-11-22: Repo initialised. Phase 1 research done. Recommended approach:
  run one web app on the laptop or a Pi, and show it on the TV first through a
  Titan OS DevView sandbox (if partner access is granted) or AirPlay, with an
  HDMI kiosk device as the reliable fallback.
  Blocked: docs.titanos.tv is not reachable from the cloud dev container, so
  some facts come from search snippets and need checking on the TV.

## On-TV checks the owner must do
1. Settings > About: OS name (Titan OS or not), firmware.
2. Apps list: is there "DevView"? A browser app? Spotify?
3. Laptop: `curl -k https://<TV_IP>:1926/6/system` and `curl http://<TV_IP>:1925/6/system`
   (read-only, harmless). Paste the output.
4. Phone: does the TV show up as an AirPlay target? As a Cast target?
