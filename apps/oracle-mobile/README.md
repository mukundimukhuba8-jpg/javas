# Oracle Mobile

Pixel-faithful Expo recreation of the Oracle home screen (dark fintech / neon-blue trading UI).

## Requirements

- Node.js 20+
- npm (local to this app) or Expo CLI

## Run

```bash
cd apps/oracle-mobile
npm install
npx expo start
```

Then press:

- `w` — open in the browser (Expo web)
- `i` — iOS simulator (macOS)
- `a` — Android emulator
- or scan the QR code with Expo Go

Web-only:

```bash
cd apps/oracle-mobile
npx expo start --web --port 8081
```

## Swap the Oracle hero image

Replace a single file:

```
apps/oracle-mobile/assets/oracle-hero.jpg
```

The home card loads it via `ORACLE_HERO` in `src/components/OracleCard.tsx`. Keep the filename (or update that one `require`).

## Tabs

- **Home** — full Oracle card, Add Robot control, bottom nav
- **AI Scanner** / **MetaTrader** — placeholder shells (no trading integrations)

## Monorepo note

This app lives under `apps/oracle-mobile` in the Zero monorepo. It uses its own `package-lock.json` / `node_modules` so Expo tooling stays isolated from the root pnpm workspace.
