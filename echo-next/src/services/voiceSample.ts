export type VoiceSampleAssessment = {
  durationSeconds: number;
  rms: number;
  clippedRatio: number;
  accepted: boolean;
  problems: string[];
};

/** Pure quality gate shared by imported and recorded personal-voice samples. */
export function assessVoiceSample(
  channels: readonly Float32Array[],
  sampleRate: number,
): VoiceSampleAssessment {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error("The audio sample could not be decoded.");
  const frames = Math.max(...channels.map((channel) => channel.length));
  const durationSeconds = frames / sampleRate;
  let squares = 0;
  let clipped = 0;
  let samples = 0;
  for (const channel of channels)
    for (const value of channel) {
      if (!Number.isFinite(value)) continue;
      squares += value * value;
      if (Math.abs(value) >= 0.99) clipped++;
      samples++;
    }
  const rms = samples ? Math.sqrt(squares / samples) : 0;
  const clippedRatio = samples ? clipped / samples : 0;
  const problems: string[] = [];
  if (durationSeconds < 3) problems.push("Record at least 3 seconds.");
  if (durationSeconds > 60) problems.push("Keep the sample under 60 seconds.");
  if (rms < 0.01) problems.push("The sample is silent or too quiet.");
  if (clippedRatio > 0.01)
    problems.push("The sample is distorted or clipped. Record more quietly.");
  return {
    durationSeconds,
    rms,
    clippedRatio,
    accepted: problems.length === 0,
    problems,
  };
}

export async function inspectVoiceSample(
  blob: Blob,
): Promise<VoiceSampleAssessment> {
  if (!blob.size) throw new Error("The audio file is empty.");
  if (blob.size > 10 * 1024 * 1024)
    throw new Error("A voice sample cannot exceed 10 MB.");
  const AudioContextClass = globalThis.AudioContext;
  if (!AudioContextClass)
    throw new Error("Audio quality analysis is unavailable on this device.");
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
      decoded.getChannelData(i),
    );
    return assessVoiceSample(channels, decoded.sampleRate);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The ")) throw error;
    throw new Error("The audio format could not be decoded on this device.");
  } finally {
    await context.close().catch(() => undefined);
  }
}
