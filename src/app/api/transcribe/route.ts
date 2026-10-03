import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** POST multipart form field `audio` → OpenAI Whisper transcript. */
export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 64) {
    return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  }

  const filename =
    audio.type.includes("mp4") || audio.type.includes("m4a")
      ? "voice.m4a"
      : audio.type.includes("ogg")
        ? "voice.ogg"
        : "voice.webm";

  const upstream = new FormData();
  upstream.append(
    "file",
    new File([audio], filename, { type: audio.type || "audio/webm" }),
  );
  upstream.append("model", "whisper-1");
  upstream.append("language", "en");
  upstream.append("response_format", "json");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[transcribe]", res.status, detail.slice(0, 400));
      return NextResponse.json(
        { error: "Transcription failed" },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { text?: string };
    const text = String(data.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "No speech detected" }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[transcribe]", err);
    return NextResponse.json({ error: "Transcription error" }, { status: 502 });
  }
}
