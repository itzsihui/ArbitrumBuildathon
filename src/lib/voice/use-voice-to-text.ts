"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickRecorderMime, transcribeAudioBlob } from "./transcribe-client";

export type VoiceInputStatus = "idle" | "listening" | "transcribing";

type Options = {
  /** Called with transcript — default behavior is fill composer, not auto-send. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export function useVoiceToText({ onTranscript, disabled }: Options) {
  const [status, setStatus] = useState<VoiceInputStatus>("idle");
  const [hint, setHint] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => releaseMic(), [releaseMic]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseMic();
      setStatus("idle");
      return;
    }

    setHint(null);
    setStatus("transcribing");

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.onerror = () => reject(new Error("Recording failed"));
      try {
        recorder.stop();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not stop mic"));
      }
    }).finally(() => {
      releaseMic();
    });

    try {
      if (blob.size < 256) {
        setHint("Recording too short — tap Voice, speak, then tap again.");
        setStatus("idle");
        return;
      }
      const text = await transcribeAudioBlob(blob);
      onTranscript(text);
      setStatus("idle");
    } catch (err) {
      setHint(
        err instanceof Error ? err.message : "Voice transcription failed",
      );
      setStatus("idle");
    }
  }, [onTranscript, releaseMic]);

  const startRecording = useCallback(async () => {
    if (disabled) return;
    setHint(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setHint("Microphone not available on this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setStatus("listening");
    } catch {
      releaseMic();
      setHint("Microphone blocked — allow mic access for this site.");
      setStatus("idle");
    }
  }, [disabled, releaseMic]);

  const toggleVoice = useCallback(() => {
    if (disabled || status === "transcribing") return;
    if (status === "listening") {
      void stopAndTranscribe();
      return;
    }
    void startRecording();
  }, [disabled, startRecording, status, stopAndTranscribe]);

  return {
    status,
    hint,
    toggleVoice,
    listening: status === "listening",
    transcribing: status === "transcribing",
  };
}
