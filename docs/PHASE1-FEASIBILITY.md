# Phase 1: Feasibility (Philips 43PUS7608/12, TPN23.6E)

Researched 2026-11-22. The Titan OS developer docs (docs.titanos.tv) were not
reachable from the dev container, so the Titan OS facts below come from search
summaries of those pages. Each item is tagged **[verified]** (several sources),
**[likely]** (one source) or **[test on TV]**.

## 1. Is this TV on Titan OS?
- **[likely]** Yes. Retailer Coolblue lists the 2023 PUS7608 platform as
  "Philips New Operating System / Linux", and a Philips fan blog lists
  "PUS7608 (Titan OS)". The TPN2xxE firmware family is Titan OS firmware.
- **[test on TV]** Check Settings > About.

## 2. What Titan OS allows
| Question | Answer |
|---|---|
| Native apps / APK sideload | **No.** Web apps only (HTML5, Chromium engine, Chrome 112 listed) **[verified]** |
| Developer mode | **DevView** app on the TV: pair the TV with the Partner Portal, add your app URL to a "Sandbox", launch it on the TV. **Requires Titan partner approval** **[verified]**. One forum user says Titan did not answer their access request. |
| Private app without store review | Effectively yes, via the DevView sandbox. The public store needs 2 to 4 weeks of QA and is meant for commercial apps. |
| Launch other apps (Netflix, YouTube) from a web app | **Yes, only inside a Titan app**: the Titan SDK "App Control" opens another app by ID, optionally with a deep link **[likely]**. A plain web page loaded by AirPlay or a browser cannot do this. |
| Replace the home screen / autostart at power-on | **No documented way** **[likely]**. The best you can do is open DevView, then your app. |
| Built-in web browser | **None found** **[test on TV]** |
| Google Cast | **Not supported** on Titan OS (9to5Google). Coolblue still lists Chromecast for the 7608, so **[test on TV]**. |
| AirPlay | **Supported** **[verified]**. You can mirror a Mac/iPhone screen; a Linux laptop needs a third-party AirPlay sender. |
| DLNA | Listed by Coolblue only **[test on TV]**. Photos and videos only, so no use for a live web app. |
| Spotify | **No Spotify app** on Titan OS (9to5Google, March 2026). No sign it acts as a Spotify Connect speaker. |
| Network control API (JointSpace) | Titan OS uses **JointSpace v6** (community openHAB Titan OS binding, ports 1925/1926). Some 2023 owners report no API at all **[test on TV]**. Expected features: power, keys, volume, source, maybe app launch. Picture settings such as backlight are not documented. |
| Backlight via HDMI-CEC | **No.** CEC has no standard brightness command; CEC covers power, standby and remote passthrough. |

## 3. Ranking the approaches
Same codebase in every case: a static front-end plus a small Node WebSocket
server running on the laptop or a Pi.

| Rank | Approach | Works today? | Pros | Cons |
|---|---|---|---|---|
| **1** | **(C) Cheap HDMI kiosk device** (Raspberry Pi 4/5, or a used mini PC) running Chromium full-screen | Yes, 100% under your control | Autostart, always on, CEC power on/off from the Pi (`cec-ctl`), the server runs on the same box, no partner approval, can be removed in seconds | ~€40 to €90; cannot launch the TV's own Netflix app (use HDMI input switching or CEC instead) |
| **2** | **(A) Titan OS web app via DevView sandbox** | Only if Titan approves partner access | Native feel, real remote keys, App Control can launch Netflix/YouTube | Approval uncertain; you must open DevView on every start; probably needs a public HTTPS URL, not a LAN IP **[test]**; Titan may revoke access |
| 3 | (D) Laptop over HDMI cable, or AirPlay mirror | Yes | Zero cost, good for development | Laptop must stay on and awake; AirPlay from Linux is flaky |
| 4 | (B) TV browser or cast tab | Probably not | Would be zero cost | No browser found; no Google Cast |

### Recommendation: (C), with (A) applied for in parallel
- Build and test on the laptop (D) in Phase 2. That needs no hardware.
- Buy or reuse a Raspberry Pi as the permanent home for the dashboard (C).
  Kiosk Chromium plus the Node server plus `cec-ctl` for the schedule.
- Apply for Titan partner and DevView access at the same time. If you get it,
  the same URL becomes an app on the TV and the dock can launch native apps.
- Everything is reversible: unplug the Pi and the TV is stock.

### Unconventional options
- **Use the TV's own launcher for apps and the Pi as an "input"**: the dock
  tile for Netflix sends CEC "switch to TV tuner/home" or a JointSpace "Home"
  key, then the Titan remote does the rest.
- **Old Android phone or tablet with an HDMI/USB-C adapter** in a kiosk app
  (Fully Kiosk Browser) instead of a Pi.
- **Spotify Connect on the Pi itself** (`raspotify` or `librespot`): the Pi
  becomes a Connect speaker and its HDMI audio plays through the TV speakers.
  That gives you real Spotify on the TV, which Titan OS cannot do.

## 4. Painting mode power: honest numbers
- The TV draws about **51 W in SDR** and **89 W in HDR** (Philips spec sheet),
  and about 0.3 W in standby (2 W networked standby).
- On an LED/LCD panel the **backlight** uses most of the power. A black pixel
  is the backlight shining through a closed liquid crystal, so **a dark image
  saves almost nothing unless the backlight itself dims**. The PUS7608 is
  edge-lit with no meaningful local dimming, so a dark painting alone might
  save about 0 to 10% **[test with a plug meter]**.
- What actually saves power:
  1. **Manually lowering the backlight or contrast** in Picture settings, or an
     "Eco" picture preset. Plausibly 30 to 60% of on-mode power. Remote only:
     no documented network/CEC control for this.
  2. **Turning the TV off on a schedule** (CEC standby from the Pi, or the
     TV's own sleep timer). Off is about 0.3 W, the real win.
  3. Possibly a JointSpace "menu items/settings" endpoint for picture
     settings, if the TV exposes v6 **[test on TV]**.
- Burn-in: LCDs do not burn in like OLED; slow pixel drift is cheap insurance
  against image retention, not a necessity.

## Sources
- Titan OS: [Get your app on Titan OS](https://docs.titanos.tv/publishing), [Introduction](https://docs.titanos.tv/introduction), [FAQ](https://docs.titanos.tv/faq), [Testing your app (DevView)](https://docs.titanos.tv/devviewinstall), [App testing](https://docs.titanos.tv/partner-portal/app-testing), [Debugging](https://docs.titanos.tv/debugging), [Platform versions](https://docs.titanos.tv/platform-versions), [App Control](https://docs.titanos.tv/app-control), [Titan SDK](https://docs.titanos.tv/titan-sdk)
- Reference project: [titan-home, an Apple-TV-style home screen for Titan OS via DevView](https://github.com/DeusExMachina1221/titan-home)
- Platform news: [9to5Google, Titan OS (no Google Cast, no Spotify, AirPlay yes)](https://9to5google.com/2026/03/23/google-tv-just-lost-a-big-tv-brand-to-web-app-based-titan-os/), [Philips: What is Titan OS](https://www.philips.co.uk/c-e/tv-buying-guide/tv-101/what-is-titan-os), [What Hi-Fi](https://www.whathifi.com/advice/what-is-titan-os-philips-new-tv-operating-system-explained)
- Model: [Coolblue 43PUS7608](https://www.coolblue.be/en/product/933929/philips-43pus7608-2023.html), [Coolblue 55PUS7608 (platform)](https://www.coolblue.nl/en/product/934605/philips-55pus7608-2023.html), [toengel.net Philips 2023 Titan OS](https://toengel.net/philipsblog/tag/tpn236e/page/3), [Philips spec sheet](https://www.documents.philips.com/assets/20230807/09873aefc1954daba77eb057016eaa99.pdf), [43PUS7607 product sheet](https://www.download.p4c.philips.com/files/4/43pus7607_12/43pus7607_12_prf_fra.pdf)
- JointSpace: [Home Assistant Philips TV](https://www.home-assistant.io/integrations/philips_js/), [Pylips wiki](https://github.com/eslavnov/Pylips/wiki), [openHAB Titan OS binding (JointSpace v6)](https://community.openhab.org/t/beta-titan-os-binding-control-newer-philips-smart-tvs-jointspace-v6-5-0-0/169480), [HA forum: 2023 model API reports](https://community.home-assistant.io/t/philips-android-tv-component/17749?page=32)
- CEC and backlight: [Wikipedia CEC](https://en.wikipedia.org/wiki/Consumer_Electronics_Control), [VideoHelp: CEC has no brightness command](https://forum.videohelp.com/showthread.php?p=2480819), [Arch wiki: display control](https://wiki.archlinux.org/title/Display_control)
- LCD power: [ECEEE 2017 TV power measurement](https://proceedings.eceee.org/docs/2017/7-422-17_Scholand.pdf), [USC backlight scaling paper](https://coldflux.usc.edu/~massoud/Papers/CBCS-date04.pdf)
