# Family Dashboard Plan

## Goal

Expand the SL departure board into a family dashboard on a Raspberry Pi + TV. Widgets: SL, Google Calendar, weather. Config as code. No backend. Easy to rebuild.

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

## Architecture

```
src/
  config.ts
  widgets/
    registry.ts
    sl/
    calendar/
    weather/
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
  ],
})
```

- `defineConfig` is a discriminated union on `type`.
- Vite `base: "./"` for `file://` loading.

## App responsibilities

- Poll SL, weather, ICS on intervals. Keep last good data, show a stale marker on failure.
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

## Open questions

- TV resolution and orientation (grid defaults).
- Number of calendars.
- Rename repo now or after step 1.
