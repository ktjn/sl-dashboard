# SL Departure Board

A configurable real-time departure board for Stockholm public transit (SL). Add any station, transport mode, and direction filter through the built-in configurator — your setup is encoded in the URL, so it's easy to bookmark or share.

## Features

- Real-time departures from the SL Transport API
- Configurable stations, transport modes (Tunnelbana, Pendeltåg, Tvärbanan, Buss), and direction filters
- Walking time indicators showing when to leave
- Responsive design for mobile and desktop

The default board shown on first load covers Metro from Duvbo and Commuter train + Tram from Sundbyberg, towards Stockholm — open the ⚙ menu to configure your own.

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

# Run unit tests
pnpm test

# Run end-to-end tests
pnpm test:e2e

# Lint
pnpm lint
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
