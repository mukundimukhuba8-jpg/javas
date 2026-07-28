import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { package: "voice" });

export const manifest: PackageManifest = {
  name: "@zero/voice",
  version: "0.1.0",
  phase: 3,
  status: "stub",
};

export type WakeWordEngine = "porcupine" | "openwakeword";

export interface TranscriptChunk {
  readonly text: string;
  readonly isFinal: boolean;
  readonly confidence?: number;
}

export interface AudioChunk {
  readonly pcm: Uint8Array;
  readonly sampleRate: number;
}

export interface VoiceEngine {
  health(): Promise<HealthStatus>;
  /** Phase 3: continuous wake-word listening */
  startWakeWord(_engine?: WakeWordEngine): Promise<void>;
  stopWakeWord(): Promise<void>;
  /** Phase 3: Deepgram streaming STT (Whisper local fallback) */
  startListening(_onTranscript: (chunk: TranscriptChunk) => void): Promise<void>;
  stopListening(): Promise<void>;
  /** Phase 3: ElevenLabs streaming TTS (Fish Audio fallback) */
  speak(_text: AsyncIterable<string>, _onAudio: (chunk: AudioChunk) => void): Promise<void>;
}

export function createVoiceEngine(): VoiceEngine {
  logger.info("Voice engine stub created — implementation begins in Phase 3");

  return {
    health: async () => ({
      name: "@zero/voice",
      healthy: true,
      details: "Stub ready — Deepgram / ElevenLabs / wake word not yet wired",
      checkedAt: new Date().toISOString(),
    }),
    startWakeWord: async () => {
      logger.warn("startWakeWord called on stub");
    },
    stopWakeWord: async () => undefined,
    startListening: async () => {
      logger.warn("startListening called on stub");
    },
    stopListening: async () => undefined,
    speak: async () => {
      logger.warn("speak called on stub");
    },
  };
}
