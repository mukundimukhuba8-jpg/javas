# Install

## Prerequisites

- Node.js **20+** (`node -v`)
- pnpm **9+** (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm zero
```

You should see package status (`stub`), subsystem health checks, and an integrations matrix. Missing keys are expected in Phase 1.

## API keys

Fill only what you need for the phase you are enabling. Never commit `.env`.

| Variable                                        | Used by              | Phase                      |
| ----------------------------------------------- | -------------------- | -------------------------- |
| `ANTHROPIC_API_KEY`                             | Brain / agent        | 2 (required in production) |
| `DEEPGRAM_API_KEY`                              | Streaming STT        | 3                          |
| `WHISPER_MODEL_PATH`                            | Local STT fallback   | 3                          |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID`    | Streaming TTS        | 3                          |
| `FISH_AUDIO_API_KEY`                            | TTS fallback         | 3                          |
| `PORCUPINE_ACCESS_KEY`                          | Wake word            | 3                          |
| `TELEGRAM_BOT_TOKEN`                            | Messaging            | 5                          |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` | Calendar, Gmail, Ads | 5                          |
| `META_*`                                        | Meta Ads             | 5                          |
| `NOTION_API_KEY`                                | CRM / docs           | 5                          |
| `AIRTABLE_API_KEY` / `AIRTABLE_BASE_ID`         | CRM                  | 5                          |
| `RESEND_API_KEY`                                | Transactional email  | 5                          |
| `TAVILY_API_KEY`                                | Research             | 5                          |
| `BRAVE_SEARCH_API_KEY`                          | Research             | 5                          |
| `CALCOM_API_KEY`                                | Scheduling           | 5                          |
| `SQLITE_PATH` / `VECTOR_DB_*`                   | Memory               | 4                          |

## Daily business context

Edit files under `business/daily/*.md`. Zero will load them automatically once memory lands in Phase 4.

## Troubleshooting

- **Invalid environment configuration** — check types/enums in `.env` against `.env.example`.
- **Production config incomplete** — set `ANTHROPIC_API_KEY` when `NODE_ENV=production`.
- **Workspace resolution errors** — run `pnpm install` from the repo root, not a subpackage.
