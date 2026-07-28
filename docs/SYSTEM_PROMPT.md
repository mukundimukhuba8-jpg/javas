# System prompt assembly

Zero's runtime prompt is assembled by `@zero/agent`.

## Sources

| Layer               | Source                                                  | When                                                      |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| Base identity       | [`CLAUDE.md`](../CLAUDE.md) at repo root                | Always                                                    |
| Specialist overlay  | `SPECIALIST_PROMPTS` in `packages/agent/src/prompts.ts` | Non-orchestrator agent                                    |
| Session append      | `RunOptions.systemAppend`                               | Caller-provided (daily context, merge instructions, etc.) |
| Plan instruction    | `PLAN_INSTRUCTION`                                      | Planning phase only                                       |
| Reflect instruction | `REFLECT_INSTRUCTION`                                   | Reflection phase only                                     |

## Assembly order

```
CLAUDE.md
+ specialist overlay (optional)
+ session append (optional)
(+ plan/reflect instructions for those phases)
```

## Editing guidance

- Change personality, safety, and business behaviour in `CLAUDE.md`
- Change specialist focus lines in `prompts.ts`
- Do not put secrets into prompts
- Keep voice-friendly brevity; TTS arrives in Phase 3

## Fallback

If `CLAUDE.md` is missing at runtime, a short built-in butler prompt is used so the process still boots.
