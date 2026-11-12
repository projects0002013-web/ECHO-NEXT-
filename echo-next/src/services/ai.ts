export interface PersonalizedVoiceProvider {
  readonly processing: "local" | "cloud";
  readonly name: string;
  generate(request: {
    text: string;
    sample: Blob;
    consent: boolean;
    signal: AbortSignal;
    onProgress: (progress: number) => void;
  }): Promise<Blob>;
  deleteData(): Promise<void>;
}
export function validateVoiceRequest(text: string, consent: boolean) {
  if (!consent) throw new Error("Explicit consent is required");
  if (!text.trim() || text.length > 2000)
    throw new Error("Enter between 1 and 2000 characters");
}
// No provider is configured. Samples never leave the device. Integrations must implement this contract.
export const personalizedVoiceProvider: PersonalizedVoiceProvider | null = null;
