export function configureModelAccess(options: {
  localOnly?: boolean;
  signal?: AbortSignal;
}): void;

export function loadTextToSpeech(
  path: string,
  options: Record<string, unknown>,
  progress?: (name: string, current: number, total: number) => void,
): Promise<{ textToSpeech: unknown; cfgs: unknown }>;

export function loadVoiceStyle(paths: string[], verbose?: boolean): Promise<unknown>;
export function releaseInferenceSessions(
  sessions: Array<{ release?: () => Promise<void> | void }>,
): Promise<void>;
export function writeWavFile(audio: number[], sampleRate: number): ArrayBuffer;
export function chunkText(text: string, maxLen?: number): string[];
