import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown =>
  value === "" || value === undefined ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(8192),
  AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(12),
  AGENT_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),

  DEEPGRAM_API_KEY: optionalString,
  WHISPER_MODEL_PATH: optionalString,

  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_VOICE_ID: optionalString,
  FISH_AUDIO_API_KEY: optionalString,

  PORCUPINE_ACCESS_KEY: optionalString,
  WAKE_WORD_ENGINE: z.enum(["porcupine", "openwakeword"]).default("porcupine"),

  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_ALLOWED_CHAT_IDS: optionalString,

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REFRESH_TOKEN: optionalString,

  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_ACCESS_TOKEN: optionalString,
  META_AD_ACCOUNT_ID: optionalString,

  NOTION_API_KEY: optionalString,
  AIRTABLE_API_KEY: optionalString,
  AIRTABLE_BASE_ID: optionalString,

  RESEND_API_KEY: optionalString,
  GMAIL_USER: optionalString,

  TAVILY_API_KEY: optionalString,
  BRAVE_SEARCH_API_KEY: optionalString,

  CALCOM_API_KEY: optionalString,

  SQLITE_PATH: z.string().default("./memory/sqlite/zero.db"),
  VECTOR_DB_PATH: z.string().default("./memory/vectors"),
  VECTOR_DB_PROVIDER: z.enum(["lancedb", "chroma"]).default("lancedb"),

  ZERO_HUD_TRANSPARENT: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ZERO_ALWAYS_ON: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ZERO_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export type IntegrationStatus = {
  readonly id: string;
  readonly configured: boolean;
  readonly requiredKeys: readonly string[];
};

export function integrationStatuses(env: Env): readonly IntegrationStatus[] {
  const has = (key: keyof Env): boolean => {
    const value = env[key];
    return typeof value === "string" && value.length > 0;
  };

  return [
    {
      id: "anthropic",
      configured: has("ANTHROPIC_API_KEY"),
      requiredKeys: ["ANTHROPIC_API_KEY"],
    },
    {
      id: "deepgram",
      configured: has("DEEPGRAM_API_KEY"),
      requiredKeys: ["DEEPGRAM_API_KEY"],
    },
    {
      id: "elevenlabs",
      configured: has("ELEVENLABS_API_KEY"),
      requiredKeys: ["ELEVENLABS_API_KEY"],
    },
    {
      id: "porcupine",
      configured: has("PORCUPINE_ACCESS_KEY"),
      requiredKeys: ["PORCUPINE_ACCESS_KEY"],
    },
    {
      id: "telegram",
      configured: has("TELEGRAM_BOT_TOKEN"),
      requiredKeys: ["TELEGRAM_BOT_TOKEN"],
    },
    {
      id: "google",
      configured:
        has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET") && has("GOOGLE_REFRESH_TOKEN"),
      requiredKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    },
    {
      id: "meta-ads",
      configured: has("META_ACCESS_TOKEN") && has("META_AD_ACCOUNT_ID"),
      requiredKeys: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    },
    {
      id: "notion",
      configured: has("NOTION_API_KEY"),
      requiredKeys: ["NOTION_API_KEY"],
    },
    {
      id: "airtable",
      configured: has("AIRTABLE_API_KEY") && has("AIRTABLE_BASE_ID"),
      requiredKeys: ["AIRTABLE_API_KEY", "AIRTABLE_BASE_ID"],
    },
    {
      id: "resend",
      configured: has("RESEND_API_KEY"),
      requiredKeys: ["RESEND_API_KEY"],
    },
    {
      id: "tavily",
      configured: has("TAVILY_API_KEY"),
      requiredKeys: ["TAVILY_API_KEY"],
    },
    {
      id: "brave-search",
      configured: has("BRAVE_SEARCH_API_KEY"),
      requiredKeys: ["BRAVE_SEARCH_API_KEY"],
    },
    {
      id: "calcom",
      configured: has("CALCOM_API_KEY"),
      requiredKeys: ["CALCOM_API_KEY"],
    },
  ] as const;
}
