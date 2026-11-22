# PROGRESS

## Status
- [x] Phase 0: questions answered
- [x] Phase 1: feasibility research, see docs/PHASE1-FEASIBILITY.md
- [x] Phase 2: MVP (phone notes to TV, clock and weather, painting mode). Built, tested headless; needs a test on the real TV
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

- 2026-11-22: Owner answers: tasks = no preference (plan: local JSON file);
  spare devices = old Android phones; phone = Android; laptop always-on = unknown;
  Spotify Premium = yes; painting mode = manual; no camera photos; TV shows up
  as a **Cast target**. New plan: cast a laptop Chrome tab first (zero hardware),
  then an old Android phone as an always-on host (Termux + screen cast), Pi only if needed.
- 2026-11-22: Phase 2 MVP built: Node + ws server, /tv/ and /phone/ pages,
  Open-Meteo weather with 10 min cache, painting mode (dim layer, drift every
  3 min, rotation, night dim), remote focus navigation. 5 automated tests pass;
  phone-to-TV drawing verified end to end in headless Chromium. Screenshots in screenshots/.

- 2026-11-22: Correction from owner: the TV does **screen mirroring**, not Google Cast.
  New primary route: old Android phone runs the server in Termux, shows /tv/ as an
  installed full-screen app, and mirrors it. /tv/ now renders on a fixed 1920x1080 stage
  scaled to any screen, adds a web manifest (full-screen landscape), tap-to-fullscreen
  and a screen wake lock. Checked in headless Chromium at TV size and phone-landscape size.

## Owner answers (Phase 0)
| Question | Answer |
|---|---|
| Tasks source | No preference, so use a local `data/tasks.json` with CLI editing |
| Spare HDMI device | Old Android phones |
| Phone | Android |
| Laptop always on | Unknown |
| Spotify Premium | Yes |
| Painting schedule | Manual ("when I choose it") |
| Camera feedback | No |
| TV visible as | Screen-mirroring target (not Google Cast) |

## On-TV checks the owner must do
1. Settings > About: OS name (Titan OS or not), firmware.
2. Apps list: is there "DevView"? A browser app? Spotify?
3. Laptop: `curl -k https://<TV_IP>:1926/6/system` and `curl http://<TV_IP>:1925/6/system`
   (read-only, harmless). Paste the output.
4. Phone: Cast target: YES (done).
5. Phase 2: mirror an old phone running the dashboard (README section 2A) and report: does it appear,
   is text sharp, how big is the drawing lag, does the dashboard fill the screen
   (no black bars, nothing cut off at the edges)?
6. Phase 2: draw on the phone while it shows on the TV.
7. Try Settings > Picture: lower Backlight/Contrast while in painting mode and
   note what still looks good (and, if you have a plug meter, the watts).
