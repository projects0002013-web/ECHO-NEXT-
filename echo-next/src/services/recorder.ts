import { Capacitor, registerPlugin } from "@capacitor/core";
const native = registerPlugin<{
  start(): Promise<void>;
  stop(): Promise<{ data: string; type: string }>;
  cancel(): Promise<void>;
}>("EchoRecorder");
export class VoiceRecorder {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private parts: Blob[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  async start(
    onLimit: () => void,
    onError: (message: string) => void = () => {},
  ) {
    if (Capacitor.getPlatform() === "android") {
      await native.start();
      this.timer = setTimeout(onLimit, 60000);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder)
      throw new Error(
        "Recording is unavailable. Use a secure browser or the Android app.",
      );
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new Error(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access in your device settings."
          : "Could not open the microphone. Check that it is connected and available.",
      );
    }
    try {
      this.parts = [];
      this.recorder = new MediaRecorder(this.stream);
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) this.parts.push(e.data);
      };
      this.recorder.onerror = () => {
        this.release();
        clearTimeout(this.timer);
        onError("Recording failed. Please try again.");
      };
      this.recorder.start();
      this.timer = setTimeout(onLimit, 60000);
    } catch (e) {
      this.release();
      throw e;
    }
  }
  stop(): Promise<Blob> {
    clearTimeout(this.timer);
    if (Capacitor.getPlatform() === "android")
      return native.stop().then(
        (v) =>
          new Blob([Uint8Array.from(atob(v.data), (c) => c.charCodeAt(0))], {
            type: v.type,
          }),
      );
    return new Promise((resolve, reject) => {
      const r = this.recorder;
      if (!r || r.state === "inactive") {
        this.release();
        reject(new Error("No recording in progress"));
        return;
      }
      r.onstop = () => {
        const blob = new Blob(this.parts, { type: r.mimeType.split(";")[0] });
        this.release();
        blob.size
          ? resolve(blob)
          : reject(new Error("The recording was empty. Please try again."));
      };
      r.onerror = () => {
        this.release();
        reject(new Error("Recording failed"));
      };
      r.stop();
    });
  }
  cancel() {
    clearTimeout(this.timer);
    if (Capacitor.getPlatform() === "android") {
      void native.cancel().catch(() => {});
      return;
    }
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.release();
  }
  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
  }
}
