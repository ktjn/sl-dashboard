# Family Dashboard Plan

## Goal

Expand the SL departure board into a family dashboard on a Raspberry Pi + TV. Widgets: SL, Google Calendar, weather, sun calendar, football. Config as code. No backend. Easy to rebuild.

Status: proposal, not started.

## Decisions

- Keep the stack (Vite + React 19 + TS). Restructure in place; rename repo later.
- Pi runs only Chromium in kiosk mode. No timers, no static server, no sync script.
- App fetches everything client-side.
- Drop URL-param configurator. Config lives in `src/config.ts`.

## Calendar access

Google secret ICS URLs send no CORS headers. Options:

| Option | Trade-off |
|---|---|
| Chrome with `--disable-web-security` | No infra. Disables same-origin protection for the kiosk profile. |
| Public calendar + API key | Calendar public. Rejected. |
| In-browser OAuth | 1h token expiry, interactive sign-in. Rejected. |
| Third-party CORS proxy | Leaks secret URL. Rejected. |

Chosen: the flag, with mitigations:

- Dedicated `--user-data-dir`, never used for browsing.
- `--kiosk`: no URL bar, no navigation.
- Never open other sites in that profile. Do not expose the debugging port.

NOTE: the secret ICS URL grants read access to the calendar. Keep it out of git and any public host. Rotate via Google Calendar settings ("Reset secret address").

## Secrets

- `.env.local` (gitignored): `VITE_ICS_URL=...`
- Build on the Pi. Load the app from disk (`file://`). Do not host publicly.

## Weather

Open-Meteo. No key, CORS enabled. Lat/lon and units in config.

## Sun calendar

Goal: sunrise, sunset, day length for today plus the next N days. Show day-length delta vs previous day (shrinking/growing).

Source options:

| Option | Trade-off |
|---|---|
| Open-Meteo `daily=sunrise,sunset` | Same request as weather. No new dependency. Needs network. |
| `suncalc` computed locally | Offline. Deterministic. Adds one small dependency. |

Chosen: Open-Meteo, reuse the weather fetch. Fallback to `suncalc` if the fetch fails (stale-marker rule still applies).

- Config: `days` (default 7), shares `lat`/`lon` with the weather widget.
- Render: one row per day: sunrise ↑, sunset ↓, day length, delta in minutes.
- Highlight today. Mark solstice/equinox days.
- Timezone: Europe/Stockholm, passed explicitly to the API.

## Football

Scope (fixed in config, list of leagues):

- Allsvenskan
- "League a": assumed Serie A. Confirm.

Per league:

- League table: position, team, played, points, goal difference. Highlight favorite team(s) from config.
- Recent results (last matchday).
- Upcoming fixtures (next matchday).

Source options:

| Option | Trade-off |
|---|---|
| API-Football (api-sports.io) | Covers both leagues. Free tier 100 req/day. API key. |
| football-data.org | Serie A on free tier. Allsvenskan not covered. Rejected. |
| TheSportsDB | Free test key. Limited standings/fixtures on free tier. Fallback only. |

Chosen: API-Football. Verify CORS and free-tier league coverage before step 6.

- Key in `.env.local` as `VITE_FOOTBALL_KEY`. Same rules as the ICS URL: never in git, never on a public host.
- Request budget: 2 leagues x (standings + fixtures) = 4 calls per refresh. At 100/day, refresh every 3h, or hourly on matchdays only.
- Cache last response in `localStorage`. Survives reload, backs the stale marker.
- Off-season: Allsvenskan runs ~Mar-Nov. Show final table and last results with a "season finished" label. Serie A runs ~Aug-May.
- Live scores: out of scope for v1.

## Architecture

```
src/
  config.ts
  widgets/
    registry.ts
    sl/
    calendar/
    weather/
    sun/
    football/
  Dashboard.tsx
deploy/
  setup.sh
```

```ts
export default defineConfig({
  columns: 3,
  widgets: [
    { type: "sl", stations: [] },
    { type: "calendar", days: 7 },
    { type: "weather", lat: 59.37, lon: 17.97 },
    { type: "sun", days: 7 },
    { type: "football", leagues: ["allsvenskan", "serie-a"] },
  ],
})
```

- `defineConfig` is a discriminated union on `type`.
- Vite `base: "./"` for `file://` loading.

## App responsibilities

- Poll SL, weather (incl. sun), ICS, football on intervals. Football interval set by API quota. Keep last good data, show a stale marker on failure.
- Nightly `location.reload()` to bound memory growth.
- Dim/blank overlay by time of day (burn-in).
- Parse ICS in-browser with `ical.js`. Expand RRULEs, apply timezone.
- Multiple calendars: one ICS URL each, merged with per-calendar color.

## Pi setup

```bash
git clone <repo> ~/dash && cd ~/dash
echo 'VITE_ICS_URL=...' > .env.local
pnpm install && pnpm build
```

Autostart:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars --test-type \
  --disable-web-security --user-data-dir=/home/pi/.kiosk-profile \
  --allow-file-access-from-files --autoplay-policy=no-user-gesture-required \
  file:///home/pi/dash/dist/index.html
```

Update: `git pull && pnpm build`, reload.

## Steps

1. Move SL to `widgets/sl/`. Add `config.ts`, registry, grid. Remove configurator.
2. Weather widget.
3. Calendar widget (`ical.js`, `VITE_ICS_URL`).
4. `base: "./"`, `deploy/setup.sh`, nightly reload, dim schedule.
5. Sun calendar widget (extend weather fetch with sunrise/sunset, `suncalc` fallback).
6. Football widget: provider spike (CORS, coverage, quota), then table + results + fixtures, cache, off-season state.

## Open questions

- Which league is "league a": Serie A, or something else?
- Favorite football team(s) to highlight.
- Sun calendar horizon: 7 days or longer.
- Football fixtures: show next matchday, or only favorite team's matches.
- TV resolution and orientation (grid defaults).
- Number of calendars.
- Rename repo now or after step 1.
