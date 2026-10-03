/** Client-side Whisper transcription via /api/transcribe. */

export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export async function transcribeAudioBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  const type = blob.type || "audio/webm";
  const name = type.includes("mp4")
    ? "voice.m4a"
    : type.includes("ogg")
      ? "voice.ogg"
      : "voice.webm";
  form.append("audio", blob, name);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Transcription failed (${res.status})`);
  }
  const text = String(data.text || "").trim();
  if (!text) throw new Error("No speech detected");
  return text;
}
