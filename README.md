# SL Departure Board

A real-time departure board for public transit from Duvbo and Sundbyberg stations towards Stockholm C.

## Features

.

- Real-time departures from SL API
- Metro (Tunnelbana) from Duvbo
- Commuter train (Pendeltag) from Sundbyberg
- Tram (Tvarbanan) from Sundbyberg
- Walking time indicators showing when to leave
- Responsive design for mobile and desktop

## Tech Stack

- React 19
- TypeScript
- Vite
- pnpm

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type check
pnpm typecheck

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Deployment

The app is automatically deployed to GitHub Pages on push to main.

Live at: https://ktjn.github.io/sl-dashboard/

## API

Uses the SL Transport API:

- https://transport.integration.sl.se/v1/sites/{siteId}/departures

Site IDs:

- Duvbo: 9324
- Sundbyberg: 9325
