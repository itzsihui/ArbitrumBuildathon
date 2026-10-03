import { emitProtocolMetric, logProtocolLine } from "@/lib/aws/metrics";
import type { ProtocolEvent } from "@/lib/store/types";

const MAX = 200;
const recent: ProtocolEvent[] = [];
const listeners = new Set<(event: ProtocolEvent) => void>();

export function emit(
  event: Omit<ProtocolEvent, "ts"> & { ts?: number },
): ProtocolEvent {
  const full: ProtocolEvent = { ...event, ts: event.ts ?? Date.now() };
  recent.push(full);
  if (recent.length > MAX) recent.shift();
  logProtocolLine(full);
  if (full.status === 402 || full.status === 200) {
    emitProtocolMetric(full.status, full.rail);
  }
  for (const listener of listeners) {
    try {
      listener(full);
    } catch {
      /* drop dead SSE clients */
    }
  }
  return full;
}

export function getRecentEvents() {
  return [...recent];
}

export function subscribe(listener: (event: ProtocolEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
