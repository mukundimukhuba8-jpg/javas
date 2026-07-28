# Zero

Personal AI desktop assistant — calm, capable, always on.

Zero is designed to feel like a British butler: concise, proactive, and never robotic. This repository is a **production-oriented monorepo**. Phase 1 delivers the scaffold, package boundaries, configuration validation, and a runnable health bootstrap. Feature work lands in later phases.

## Quick start

```bash
pnpm install          # or: npm install -g pnpm && pnpm install
cp .env.example .env  # add keys as you enable integrations
pnpm build
pnpm zero             # validates config, boots stubs, prints health
```

`npm run zero` works the same once dependencies are installed (npm will run the root script).

## Requirements

- Node.js 20+
- pnpm 9+

## Monorepo layout

```
apps/desktop          Electron HUD host (stub → Phase 6)
packages/
  shared              Result types, logger, domain types
  config              Zod env schema + startup validation
  agent               Claude brain / swarm (Phase 2)
  memory              SQLite + vector memory (Phase 4)
  voice               Wake word, STT, TTS (Phase 3)
  tools               MCP-style tool registry (Phase 5)
  ui                  HUD primitives (Phase 6)
services/             External API adapters (Phase 5 stubs)
business/daily/       Markdown daily business context
memory/sqlite|vectors Runtime data directories
scripts/zero.ts       `pnpm zero` entrypoint
docs/                 Architecture and subsystem docs
```

## Phased delivery

| Phase | Focus                                                    | Status      |
| ----- | -------------------------------------------------------- | ----------- |
| 1     | Monorepo scaffold, strict TS, lint/format, stubs, config | **Current** |
| 2     | Core agent — Claude tool use, planner, reflection        | Next        |
| 3     | Voice — wake word, Deepgram, ElevenLabs streaming        | Pending     |
| 4     | Memory — SQLite + LanceDB, daily context load            | Pending     |
| 5     | Tool integrations                                        | Pending     |
| 6     | Desktop HUD                                              | Pending     |
| 7     | Polish                                                   | Pending     |

## Scripts

| Command          | Purpose                                |
| ---------------- | -------------------------------------- |
| `pnpm zero`      | Build + start health bootstrap         |
| `pnpm build`     | Compile all packages / services / apps |
| `pnpm typecheck` | Typecheck without emit                 |
| `pnpm lint`      | ESLint (zero warnings)                 |
| `pnpm format`    | Prettier write                         |
| `pnpm test`      | Vitest                                 |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — package boundaries and runtime flow
- [docs/INSTALL.md](./docs/INSTALL.md) — API keys and setup
- Further docs (`CLAUDE.md`, `VOICE.md`, …) land with their phases

## License

Private — all rights reserved.
