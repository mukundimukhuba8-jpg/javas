# Zero

Personal AI desktop assistant — calm, capable, always on.

Zero is designed to feel like a British butler: concise, proactive, and never robotic. This repository is a **production-oriented monorepo**. Phase 1 delivered the scaffold; **Phase 2** wires the Claude reasoning loop, tool use, streaming, and specialist swarm merge.

## Quick start

```bash
pnpm install          # or: npm install -g pnpm && pnpm install
cp .env.example .env  # add ANTHROPIC_API_KEY for live replies
pnpm build
pnpm zero             # health bootstrap
pnpm zero --ask "Good evening Zero."
```

`npm run zero` works the same once dependencies are installed.

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
CLAUDE.md             Production system prompt
```

## Phased delivery

| Phase | Focus                                                    | Status      |
| ----- | -------------------------------------------------------- | ----------- |
| 1     | Monorepo scaffold, strict TS, lint/format, stubs, config | Done        |
| 2     | Core agent — Claude tool use, planner, reflection        | **Current** |
| 3     | Voice — wake word, Deepgram, ElevenLabs streaming        | Pending     |
| 4     | Memory — SQLite + LanceDB, daily context load            | Pending     |
| 5     | Tool integrations                                        | Pending     |
| 6     | Desktop HUD                                              | Pending     |
| 7     | Polish                                                   | Pending     |

## Scripts

| Command                 | Purpose                                |
| ----------------------- | -------------------------------------- |
| `pnpm zero`             | Build + start health bootstrap         |
| `pnpm zero --ask "..."` | One-shot streamed agent turn           |
| `pnpm build`            | Compile all packages / services / apps |
| `pnpm typecheck`        | Typecheck without emit                 |
| `pnpm lint`             | ESLint (zero warnings)                 |
| `pnpm format`           | Prettier write                         |
| `pnpm test`             | Vitest                                 |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — package boundaries and runtime flow
- [docs/INSTALL.md](./docs/INSTALL.md) — API keys and setup
- [CLAUDE.md](./CLAUDE.md) — production system prompt
- [docs/SYSTEM_PROMPT.md](./docs/SYSTEM_PROMPT.md) — prompt assembly
- Further docs (`VOICE.md`, `MEMORY.md`, `TOOLS.md`) land with their phases

## License

Private — all rights reserved.
