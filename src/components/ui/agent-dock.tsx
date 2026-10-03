"use client";

import {
  ChatIcon,
  MicrophoneIcon,
  PaperPlaneTiltIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type AgentDockMode = "idle" | "composing" | "working" | "listening";

type DockMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type AgentDockProps = {
  agentName: string;
  avatarSrc: string;
  className?: string;
  idleStatus?: string;
  workingStatus?: string;
  /** Return the assistant reply string so it appears in the thread. */
  onMessageSubmit?: (
    message: string,
  ) => void | string | Promise<void | string>;
};

const dockTransition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
} as const;

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentDock({
  agentName,
  avatarSrc,
  className,
  idleStatus = "Ready",
  workingStatus = "Working...",
  onMessageSubmit,
}: AgentDockProps) {
  const [mode, setMode] = useState<AgentDockMode>("idle");
  const [message, setMessage] = useState("");
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [thread, setThread] = useState<DockMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => releaseMic(), [releaseMic]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [thread, mode, transcribing]);

  function openComposer() {
    if (mode === "listening") {
      stopAndTranscribe().catch(() => {});
      return;
    }
    setVoiceHint(null);
    setMode("composing");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function submitMessage(raw?: string) {
    const nextMessage = (raw ?? message).trim();
    if (!nextMessage) {
      openComposer();
      return;
    }
    setMessage("");
    setVoiceHint(null);
    setThread((prev) => [
      ...prev,
      { id: newId(), role: "user", text: nextMessage },
    ]);
    setMode("working");
    try {
      const reply = await onMessageSubmit?.(nextMessage);
      const text =
        typeof reply === "string" && reply.trim()
          ? reply.trim()
          : "No answer.";
      setThread((prev) => [
        ...prev,
        { id: newId(), role: "assistant", text },
      ]);
      setMode("composing");
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      setThread((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: "Something went wrong — try again.",
        },
      ]);
      setMode("composing");
    }
  }

  async function transcribeBlob(blob: Blob): Promise<string> {
    const form = new FormData();
    form.append("audio", blob, "voice.webm");
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

  async function stopAndTranscribe() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseMic();
      setMode("idle");
      return;
    }

    setVoiceHint(null);
    setTranscribing(true);
    setMode("working");

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
        setVoiceHint("Recording too short — click Voice, speak, then Stop.");
        setTranscribing(false);
        setMode("idle");
        return;
      }
      const text = await transcribeBlob(blob);
      setTranscribing(false);
      await submitMessage(text);
    } catch (err) {
      setTranscribing(false);
      setVoiceHint(
        err instanceof Error ? err.message : "Voice transcription failed",
      );
      setMode("idle");
    }
  }

  async function startRecording() {
    setVoiceHint(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceHint("Microphone not available. Use Chat.");
      openComposer();
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
      setMode("listening");
    } catch {
      releaseMic();
      setVoiceHint("Microphone blocked — allow mic access for this site.");
      setMode("idle");
    }
  }

  function toggleVoice() {
    if (mode === "listening") {
      void stopAndTranscribe();
      return;
    }
    if (mode === "working") return;
    void startRecording();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "composing") {
      void submitMessage();
      return;
    }
    openComposer();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void submitMessage();
  }

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        toggleVoice();
      }
      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        if (mode !== "listening") openComposer();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const statusText =
    mode === "listening"
      ? "Listening… click Voice again to send"
      : mode === "working"
        ? voiceHint || (transcribing ? "Transcribing…" : workingStatus)
        : voiceHint || idleStatus;

  const showThread = thread.length > 0 || mode === "working";

  return (
    <form className={cn("flex w-full flex-col gap-2", className)} onSubmit={handleSubmit}>
      {showThread ? (
        <div
          ref={threadRef}
          className="max-h-56 w-full space-y-2 overflow-y-auto rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur"
        >
          {thread.map((line) => (
            <div
              key={line.id}
              className={cn(
                "flex",
                line.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                  line.role === "user"
                    ? "bg-foreground text-background"
                    : "border border-border bg-muted/50 text-foreground",
                )}
              >
                {line.text}
              </div>
            </div>
          ))}
          {mode === "working" ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-3 py-2 text-xs text-foreground/60">
                <span className="size-1.5 animate-pulse rounded-full bg-foreground/50" />
                {transcribing ? "Transcribing…" : workingStatus}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex w-full flex-col-reverse overflow-hidden rounded-2xl border border-border bg-foreground p-2 text-background shadow-lg">
        <div className="flex items-center gap-3">
          <Image
            alt=""
            aria-hidden="true"
            className="size-9 shrink-0 rounded-xl"
            height={36}
            src={avatarSrc}
            unoptimized
            width={36}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-none">
              {agentName}
            </p>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 truncate text-xs text-background/55"
                exit={{ opacity: 0, y: -6 }}
                initial={{ opacity: 0, y: 6 }}
                key={`${mode}-${statusText}`}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {statusText}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <DockButton
              active={mode === "listening"}
              icon={<MicrophoneIcon weight="bold" />}
              label={mode === "listening" ? "Stop" : "Voice"}
              onClick={toggleVoice}
              shortcut="V"
              title={
                mode === "listening"
                  ? "Stop and send"
                  : "Click Voice, speak, click again to send"
              }
            />
            <DockButton
              icon={
                mode === "composing" ? (
                  <PaperPlaneTiltIcon weight="fill" />
                ) : (
                  <ChatIcon weight="bold" />
                )
              }
              label={mode === "composing" ? "Send" : "Chat"}
              shortcut="C"
              type="submit"
            />
          </div>
        </div>
        <motion.div
          animate={{
            height: mode === "composing" ? 120 : 0,
            opacity: mode === "composing" ? 1 : 0,
          }}
          aria-hidden={mode !== "composing"}
          className="overflow-hidden"
          initial={false}
          transition={shouldReduceMotion ? { duration: 0 } : dockTransition}
        >
          <div className="relative mb-2">
            <button
              aria-label="Close composer"
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md text-background/50 hover:bg-background/10 hover:text-background"
              onClick={() => {
                releaseMic();
                setMode("idle");
              }}
              type="button"
            >
              <XIcon className="size-3.5" weight="bold" />
            </button>
            <textarea
              aria-label="Message agent"
              className="h-28 w-full resize-none bg-transparent px-2 py-2 pr-9 text-sm leading-6 outline-none placeholder:text-background/40"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Ask about this inventory…"
              ref={textareaRef}
              value={message}
            />
          </div>
        </motion.div>
      </div>
    </form>
  );
}

function DockButton({
  icon,
  label,
  shortcut,
  type = "button",
  title,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  shortcut: string;
  type?: "button" | "submit";
  title?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium hover:bg-background/10",
        active && "bg-background/15",
      )}
      onClick={onClick}
      type={type}
      title={title}
    >
      <span className="size-4">{icon}</span>
      <span>{label}</span>
      <kbd className="flex size-6 items-center justify-center rounded-md bg-background/10 font-mono text-xs">
        {shortcut}
      </kbd>
    </button>
  );
}
