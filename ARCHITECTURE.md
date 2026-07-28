# Architecture

Zero is a TypeScript monorepo with strict package boundaries. Runtime composition happens at the edges (`scripts/zero.ts`, `apps/desktop`); domain packages never import the desktop app.

## Design principles

1. **Typed boundaries** — every package exposes a small public API from `src/index.ts`.
2. **Stubs first** — integrations ship as interfaces + no-op implementations until their phase.
3. **Config at the edge** — `@zero/config` validates env once; packages receive what they need.
4. **Streaming by default** — agent, voice, and tools are designed for async iterables (wired in later phases).
5. **Graceful degradation** — missing API keys mark integrations pending; development still boots.

## Package graph

```
@zero/shared          (foundation: Result, Logger, domain types)
    ↑
@zero/config          (Zod env + integration status)
    ↑
@zero/agent  @zero/memory  @zero/voice  @zero/tools  @zero/ui
    ↑              ↑            ↑            ↑          ↑
    └──────────────┴────────────┴────────────┴──────────┘
                         @zero/desktop
                              ↑
                        scripts/zero.ts
```

Service adapters (`@zero/service-*`) depend only on `@zero/shared` and are registered into `@zero/tools` in Phase 5.

## Runtime (Phase 1)

```
pnpm zero
  → pnpm build
  → scripts/zero.ts
       → loadConfig()          # fail fast on invalid shape / prod missing Anthropic
       → create* stubs         # agent, memory, voice, tools, ui
       → createDesktopRuntime()
       → print health + integration matrix
```

## Defaults (locked for later phases)

| Concern          | Choice                                      |
| ---------------- | ------------------------------------------- |
| Desktop shell    | Electron                                    |
| LLM              | Anthropic Claude (latest)                   |
| STT              | Deepgram Streaming → Whisper local fallback |
| TTS              | ElevenLabs Streaming → Fish Audio fallback  |
| Wake word        | Porcupine (openWakeWord optional)           |
| Long-term memory | SQLite                                      |
| Vector memory    | LanceDB (Chroma optional)                   |
| Package manager  | pnpm workspaces                             |

## Configuration

See `.env.example`. `loadConfig()`:

- Parses with Zod (`envSchema`)
- Treats empty strings as unset
- In `production`, requires `ANTHROPIC_API_KEY`
- Reports which integrations are configured vs pending

## Health checks

Every package and service exposes `health(): Promise<HealthStatus>`. The CLI aggregates these on boot. Later phases will expose the same checks over the HUD and a local HTTP probe.

## Testing

- Unit tests live under `tests/` and colocated `*.test.ts` where useful
- Vitest is configured at the repo root
- Phase 1 includes config validation tests

## What is intentionally not here yet

- Claude tool-use loop / swarm merge
- Audio capture, wake word, streaming TTS
- SQLite schema / LanceDB collections
- Live OAuth and third-party API clients
- Electron BrowserWindow / tray

Those arrive in Phases 2–6 without breaking the public stub contracts defined now.
