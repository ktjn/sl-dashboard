# Raspberry Pi home dashboard

**Working draft for review.** Build a wall-mounted dashboard that answers three questions at a glance: When should I leave? What is it like outside? How are the teams doing? The primary use case is reading the screen from across the room, without touching it.

## What the board must do

| ID | Requirement | Example acceptance check |
|---|---|---|
| PI-01 | Keep SL departures visible during screen hours. Group by configured station and mode, filter by direction, and show line, destination, departure countdown, walking time and relevant disruptions. | With Duvbo configured for a 10-minute walk, an expected departure 14 minutes away reads “Gå om 4 min”. Rotating the football table leaves that row visible. |
| PI-02 | Show a persistent local clock and the weather at the configured location. Start with temperature in °C and the next hour’s precipitation probability. | The clock advances through an hour boundary while the weather endpoint is offline. The weather panel identifies the age of its last reading. |
| PI-03 | Show civil dawn, sunrise, sunset, civil dusk and total daylight duration for the local date. | For a fixed Stockholm date, daylight duration equals sunset minus sunrise. Crossing local midnight updates all four times. |
| PI-04 | Show the current season’s Allsvenskan standings and those of a second configurable competition. Show competition, season, position, team, played, goal difference and points. | Both competitions can be read within one rotation. Rows follow the provider’s ranking, including tied points. Each table identifies its season during the off-season. |
| PI-05 | Support separate weekday and weekend display hours, including multiple windows per day. Switch the physical display into standby outside those windows and wake it automatically. The Pi stays online. | With a 06:00–09:00 window, the backlight wakes at 06:00 and goes dark at 09:00 within one minute. A reboot at 09:15 restores standby. Waking triggers a departures refresh. |
| PI-06 | Deploy code, assets and validated configuration together from GitHub. Support unattended startup and recovery. | A walking-time-only change reaches the Pi through a release. A release that fails to render its first frame rolls back and is skipped on the next update check. |

## Proposed screen and runtime

Use one fullscreen Rust application. Prototype Macroquad on the chosen Pi and LCD. Keep clock and weather in the header, departures in a fixed area, daylight in a narrow strip and football in a rotating panel. Start with a split-flap transition on changed digits. A fixture replay on the physical screen should establish legibility, frame times and whether the 3D effect earns its space.

Fetch data outside the render loop. Keep a timestamped snapshot per provider and station or league so one failing request only affects the corresponding panel. Distinguish a successful empty result from an unavailable feed. Remove elapsed departures, mark stale values, and show an unavailable state when no usable data exists. Calculate the clock, countdowns and daylight locally.

| Input | Proposed source and cadence |
|---|---|
| Departures and disruptions | SL Transport API. Start with the web app’s 30-second departure and 120-second disruption intervals. Fetch once per distinct site and apply configured filters locally. |
| Weather | Open-Meteo candidate. Refresh every 15 minutes. |
| Football | One standings adapter for both competitions if coverage and terms permit. Start with hourly refresh and cache the last successful table per competition and season. |
| Daylight and clock | Configured coordinates, local system time and an IANA time zone, initially Europe/Stockholm. Recompute solar events daily. |

## Configuration and delivery

Version `board.toml` in this repo. It defines station filters and walking times, coordinates, time zone, competitions, display windows and panel rotation. Provision any provider credentials separately on the Pi. Example display windows for discussion are 06:00–09:00 and 16:00–22:30 on weekdays, 08:00–23:00 on weekends. Evaluate windows in local civil time, including daylight-saving transitions.

1. GitHub Actions validates configuration, tests the app and publishes an ARM64 bundle to GitHub Releases. Proposed target is 64-bit Raspberry Pi OS Desktop.
2. The graphical session starts the installed app under a dedicated user. An independent user timer reconciles the screen power state at startup, after deployment and every minute. Verify Wayland output power control against the actual panel.
3. The Pi periodically pulls a release, verifies its digest, stages it, switches versions atomically and checks local startup health. During scheduled standby, defer activation until wake if the renderer cannot confirm its first frame. Keep the last working bundle available for rollback.
4. Test a cold boot without network access. The installed board should show local information and identify unavailable feeds. When connectivity returns, each panel recovers independently.

## Decisions for the next review

1. Which competition does “League A” mean? Confirm season structure, group handling, data coverage, cost and licence before choosing a football provider.
2. Which Pi, LCD, orientation and viewing distance should define the layout? Decide whether to page full standings or show leaders and selected teams.
3. Which display windows, location and stale-data thresholds should ship? The times and refresh intervals above are starting values.
4. How much animation is useful? First prototype one Duvbo row, clock, and scheduled sleep/wake on the target device. Record frame times and check that the physical backlight turns off and returns reliably.

## Repository baseline

The existing React app provides the reference for station selection, transport modes, directions, walking times and disruption handling. Its GitHub Pages deployment is independent of the proposed Pi release workflow. [Existing application](../README.md) · [Default stations and polling intervals](../src/constants.ts)
