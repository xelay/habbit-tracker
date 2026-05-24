// ─── Sync Event Log ───────────────────────────────────────────────────────────
// Хранит два типа событий в localStorage:
//   1. Смена ключа (key_change) — старый и новый GUID
//   2. Ошибки связи с gyxi (sync_error) — последние 10

export type SyncEventType = "key_change" | "sync_error";

export interface SyncEvent {
  id: string;          // UUID события
  type: SyncEventType;
  ts: number;          // timestamp
  // key_change fields
  oldKey?: string;
  newKey?: string;
  // sync_error fields
  message?: string;
  endpoint?: string;
  status?: number;
}

const LOG_KEY = "habit_tracker_sync_log";
const MAX_ERRORS = 10;

function loadLog(): SyncEvent[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLog(events: SyncEvent[]): void {
  localStorage.setItem(LOG_KEY, JSON.stringify(events));
}

export function logKeyChange(oldKey: string, newKey: string): void {
  const events = loadLog();
  events.unshift({
    id: crypto.randomUUID(),
    type: "key_change",
    ts: Date.now(),
    oldKey,
    newKey,
  });
  saveLog(events);
}

export function logSyncError(message: string, endpoint?: string, status?: number): void {
  const events = loadLog();
  // Оставляем только последние 10 ошибок
  const errors = events.filter((e) => e.type === "sync_error");
  const others = events.filter((e) => e.type !== "sync_error");

  const newError: SyncEvent = {
    id: crypto.randomUUID(),
    type: "sync_error",
    ts: Date.now(),
    message,
    endpoint,
    status,
  };

  const trimmedErrors = [newError, ...errors].slice(0, MAX_ERRORS);
  saveLog([...others, ...trimmedErrors].sort((a, b) => b.ts - a.ts));
}

export function getSyncLog(): SyncEvent[] {
  return loadLog();
}

export function clearSyncErrors(): void {
  const events = loadLog().filter((e) => e.type !== "sync_error");
  saveLog(events);
}
