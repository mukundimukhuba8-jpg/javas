# Architecture

Zero is a TypeScript monorepo with strict package boundaries. Runtime composition happens at the edges (`scripts/zero.ts`, `apps/desktop`); domain packages never import the desktop app.

## Design principles

1. **Typed boundaries** — every package exposes a small public API from `src/index.ts`.
2. **Stubs first** — integrations ship as interfaces + no-op implementations until their phase.
3. **Config at the edge** — `@zero/config` validates env once; packages receive what they need.
4. **Streaming by default** — agent text and tool events are async iterables; voice follows in Phase 3.
5. **Graceful degradation** — missing API keys mark integrations pending; development still boots.

## Package graph

```
@zero/shared          (foundation: Result, Logger, domain types)
    ↑
@zero/config          (Zod env + integration status)
@zero/tools           (tool registry)
    ↑
@zero/agent           (Claude LLM, reasoning loop, swarm)
@zero/memory  @zero/voice  @zero/ui
    ↑
@zero/desktop
    ↑
scripts/zero.ts
```

Service adapters (`@zero/service-*`) depend only on `@zero/shared` and are registered into `@zero/tools` in Phase 5.

## Runtime (Phase 2)

```
pnpm zero [--ask "prompt"]
  → pnpm build
  → scripts/zero.ts
       → loadConfig()
       → createToolRegistry() + builtin tools
       → createAgentOrchestrator({ apiKey, model, tools })
       → createDesktopRuntime({ agent, tools })
       → print health + integration matrix
       → optional streamed --ask turn
```

### Agent loop

```
plan → execute (stream + tools) → reflect → retry? → done
```

Swarm mode runs selected specialists in parallel, then merges via the orchestrator.

## Defaults (locked)

| Concern          | Choice                                      |
| ---------------- | ------------------------------------------- |
| Desktop shell    | Electron                                    |
| LLM              | Anthropic Claude (`claude-sonnet-5`)        |
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
- Agent knobs: `ANTHROPIC_MODEL`, `ANTHROPIC_MAX_TOKENS`, `AGENT_MAX_ITERATIONS`, `AGENT_MAX_RETRIES`

## Health checks

Every package and service exposes `health(): Promise<HealthStatus>`. The CLI aggregates these on boot. Later phases will expose the same checks over the HUD and a local HTTP probe.

## Testing

- Unit tests live under `tests/` and colocated `*.test.ts` where useful
- Vitest is configured at the repo root
- Agent tests use `createScriptedLlm` (no network)

## What is intentionally not here yet

- Audio capture, wake word, streaming TTS (Phase 3)
- SQLite schema / LanceDB collections (Phase 4)
- Live OAuth and third-party API clients (Phase 5)
- Electron BrowserWindow / tray (Phase 6)
