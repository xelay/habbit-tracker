// ─── gyxi Sync ────────────────────────────────────────────────────────────────
import { logSyncError } from "./syncLog";
import type { CounterLog } from "./habits";

const GYXI_DB = "habittracker";
const GYXI_API_KEY = "HabitSyncKey2026";
const GYXI_REGION = "germany";
const GYXI_GET_BASE = `https://${GYXI_REGION}-get.gyxi.com/${GYXI_DB}`;
const GYXI_SAVE_BASE = `https://${GYXI_REGION}-save.gyxi.com/${GYXI_DB}`;
const GYXI_TYPE = "state";
const GYXI_PARTITION = "guid";
const DOC_ID = "state";

export const SYNC_GUID_KEY = "habit_tracker_sync_guid";
const SYNC_LAST_KEY = "habit_tracker_sync_last";

export function getSyncGuid(): string {
  let guid = localStorage.getItem(SYNC_GUID_KEY);
  if (!guid) {
    guid = crypto.randomUUID();
    localStorage.setItem(SYNC_GUID_KEY, guid);
  }
  return guid;
}

export function setSyncGuid(newGuid: string): void {
  localStorage.setItem(SYNC_GUID_KEY, newGuid.trim());
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(SYNC_LAST_KEY);
}

export interface HabitLog {
  habitId: string;
  date: string;
  timestamp: number;
}

export interface CustomHabit {
  id: string;
  name: string;
  icon: string;
  type: "good" | "bad";
  trackingType?: "bool" | "counter";
  updatedAt?: number;
}

export interface SyncSnapshot {
  id: typeof DOC_ID;
  guid: string;
  logs: HabitLog[];
  unloggedKeys: string[];
  custom: CustomHabit[];
  selectedPresets: string[];
  theme: string;
  themeUpdatedAt: number;
  snapshotUpdatedAt: number;
  counterLogs?: CounterLog[];
}

function parseLocal<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return def;
    return JSON.parse(v) ?? def;
  } catch {
    return def;
  }
}

function buildSnapshot(guid: string): SyncSnapshot {
  return {
    id: DOC_ID,
    guid,
    logs: parseLocal<HabitLog[]>("habit_tracker_logs", []),
    unloggedKeys: parseLocal<string[]>("habit_tracker_unlogged", []),
    custom: parseLocal<CustomHabit[]>("habit_tracker_custom", []),
    selectedPresets: parseLocal<string[]>("habit_tracker_selected_presets", []),
    theme: localStorage.getItem("habit_tracker_theme") ?? "system",
    themeUpdatedAt: Number(localStorage.getItem("habit_tracker_theme_updated_at") ?? "0"),
    snapshotUpdatedAt: Date.now(),
    counterLogs: parseLocal<CounterLog[]>("habit_tracker_counter_logs", []),
  };
}

function mergeSnapshot(remote: SyncSnapshot): void {
  // 1. Unlogged tombstones
  const localUnlogged = parseLocal<string[]>("habit_tracker_unlogged", []);
  const mergedUnlogged = Array.from(new Set([...localUnlogged, ...(remote.unloggedKeys ?? [])]));
  localStorage.setItem("habit_tracker_unlogged", JSON.stringify(mergedUnlogged));
  const unloggedSet = new Set(mergedUnlogged);

  // 2. Bool Logs: union by date+habitId, apply tombstones
  const localLogs = parseLocal<HabitLog[]>("habit_tracker_logs", []);
  const logMap = new Map<string, HabitLog>();
  for (const log of localLogs) logMap.set(`${log.date}__${log.habitId}`, log);
  for (const log of remote.logs) logMap.set(`${log.date}__${log.habitId}`, log);
  for (const key of unloggedSet) logMap.delete(key);
  const mergedLogs = Array.from(logMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  localStorage.setItem("habit_tracker_logs", JSON.stringify(mergedLogs));

  // 3. Deleted custom tombstones
  const localDeleted = parseLocal<string[]>("habit_tracker_deleted_custom", []);
  const mergedDeleted = Array.from(new Set([...localDeleted, ...(remote.deletedCustomIds ?? [])]));
  localStorage.setItem("habit_tracker_deleted_custom", JSON.stringify(mergedDeleted));
  const deletedSet = new Set(mergedDeleted);

  // 4. Custom habits: last-write-wins by updatedAt
  const localCustom = parseLocal<CustomHabit[]>("habit_tracker_custom", []);
  const customMap = new Map<string, CustomHabit>();
  for (const h of localCustom) {
    if (!deletedSet.has(h.id)) customMap.set(h.id, h);
  }
  for (const h of remote.custom) {
    if (deletedSet.has(h.id)) continue;
    const local = customMap.get(h.id);
    if (!local || (h.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      customMap.set(h.id, h);
    }
  }
  localStorage.setItem("habit_tracker_custom", JSON.stringify(Array.from(customMap.values())));

  // 5. selectedPresets
  const localPresets = parseLocal<string[]>("habit_tracker_selected_presets", []);
  const localDeselected = parseLocal<string[]>("habit_tracker_deselected_presets", []);
  const remoteDeselected = remote.deselectedPresets ?? [];
  const mergedDeselected = Array.from(new Set([...localDeselected, ...remoteDeselected]));
  localStorage.setItem("habit_tracker_deselected_presets", JSON.stringify(mergedDeselected));
  const deselectedSet = new Set(mergedDeselected);
  const mergedPresets = Array.from(
    new Set([...localPresets, ...remote.selectedPresets])
  ).filter((id) => !deselectedSet.has(id));
  localStorage.setItem("habit_tracker_selected_presets", JSON.stringify(mergedPresets));

  // 6. Theme: last-write-wins
  const localThemeTs = Number(localStorage.getItem("habit_tracker_theme_updated_at") ?? "0");
  const remoteThemeTs = remote.themeUpdatedAt ?? 0;
  if (remoteThemeTs > localThemeTs) {
    localStorage.setItem("habit_tracker_theme", remote.theme);
    localStorage.setItem("habit_tracker_theme_updated_at", String(remoteThemeTs));
  }

  // 7. Counter logs: last-write-wins by updatedAt per habitId+date
  const localCounters = parseLocal<CounterLog[]>("habit_tracker_counter_logs", []);
  const remoteCounters: CounterLog[] = remote.counterLogs ?? [];
  const counterMap = new Map<string, CounterLog>();
  for (const cl of localCounters) counterMap.set(`${cl.date}__${cl.habitId}`, cl);
  for (const cl of remoteCounters) {
    const key = `${cl.date}__${cl.habitId}`;
    const existing = counterMap.get(key);
    if (!existing || (cl.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      counterMap.set(key, cl);
    }
  }
  localStorage.setItem("habit_tracker_counter_logs", JSON.stringify(Array.from(counterMap.values())));
}

async function gyxiGet(guid: string): Promise<SyncSnapshot | null> {
  const url = `${GYXI_GET_BASE}/${GYXI_TYPE}/${guid}/${DOC_ID}`;
  try {
    const resp = await fetch(url, { headers: { "Gyxi-ApiKey": GYXI_API_KEY } });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      logSyncError(`GET failed: ${await resp.text()}`, url, resp.status);
      return null;
    }
    return await resp.json() as SyncSnapshot;
  } catch (e: unknown) {
    logSyncError(`GET exception: ${e instanceof Error ? e.message : String(e)}`, url);
    return null;
  }
}

async function gyxiSave(guid: string, snapshot: SyncSnapshot): Promise<boolean> {
  const url = `${GYXI_SAVE_BASE}/${GYXI_TYPE}/${GYXI_PARTITION}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Gyxi-ApiKey": GYXI_API_KEY },
      body: JSON.stringify({ ...snapshot, guid }),
    });
    if (!resp.ok) {
      logSyncError(`SAVE failed: ${await resp.text()}`, url, resp.status);
      return false;
    }
    return true;
  } catch (e: unknown) {
    logSyncError(`SAVE exception: ${e instanceof Error ? e.message : String(e)}`, url);
    return false;
  }
}

export type SyncIntent =
  | { type: "log";     habitId: string; date: string }
  | { type: "unlog";   habitId: string; date: string }
  | { type: "counter"; habitId: string; date: string; count: number }
  | { type: "none" };

function applyIntent(intent: SyncIntent): void {
  if (intent.type === "none") return;

  if (intent.type === "counter") {
    // Просто записываем актуальный count из localStorage (уже обновлён в UI)
    // Здесь intent.count — финальное значение после локального обновления
    const COUNTER_KEY = "habit_tracker_counter_logs";
    let counters: CounterLog[] = [];
    try { counters = JSON.parse(localStorage.getItem(COUNTER_KEY) || "[]"); } catch { /**/ }
    const idx = counters.findIndex(
      (l) => l.habitId === intent.habitId && l.date === intent.date
    );
    const entry: CounterLog = {
      habitId: intent.habitId,
      date: intent.date,
      count: intent.count,
      updatedAt: Date.now(),
    };
    if (idx >= 0) counters[idx] = entry;
    else counters.push(entry);
    localStorage.setItem(COUNTER_KEY, JSON.stringify(counters));
    return;
  }

  const LOGS_KEY = "habit_tracker_logs";
  const UNLOGGED_KEY = "habit_tracker_unlogged";
  const tombstoneKey = `${intent.date}__${intent.habitId}`;
  let logs: HabitLog[] = [];
  try { logs = JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"); } catch { /**/ }
  let unlogged: string[] = [];
  try { unlogged = JSON.parse(localStorage.getItem(UNLOGGED_KEY) || "[]"); } catch { /**/ }

  if (intent.type === "log") {
    const newUnlogged = unlogged.filter((k) => k !== tombstoneKey);
    localStorage.setItem(UNLOGGED_KEY, JSON.stringify(newUnlogged));
    const exists = logs.some((l) => l.habitId === intent.habitId && l.date === intent.date);
    if (!exists) {
      logs.push({ habitId: intent.habitId, date: intent.date, timestamp: Date.now() });
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }
  } else if (intent.type === "unlog") {
    if (!unlogged.includes(tombstoneKey)) {
      unlogged.push(tombstoneKey);
      localStorage.setItem(UNLOGGED_KEY, JSON.stringify(unlogged));
    }
    const filtered = logs.filter((l) => !(l.habitId === intent.habitId && l.date === intent.date));
    localStorage.setItem(LOGS_KEY, JSON.stringify(filtered));
  }
}

const PULL_TIMEOUT_MS = 5000;
const PUSH_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timer = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timer]);
}

export function syncWithGyxi(intent: SyncIntent = { type: "none" }): void {
  const guid = getSyncGuid();

  (async () => {
    const remote = await withTimeout(gyxiGet(guid), PULL_TIMEOUT_MS, null);
    if (remote) mergeSnapshot(remote);
    applyIntent(intent);
    window.dispatchEvent(new CustomEvent("sync:updated"));
    const snapshot = buildSnapshot(guid);
    const ok = await withTimeout(gyxiSave(guid, snapshot), PUSH_TIMEOUT_MS, false);
    if (ok) localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
  })();
}

export async function changeGuid(newGuid: string): Promise<boolean> {
  const remote = await gyxiGet(newGuid);
  if (remote) mergeSnapshot(remote);
  setSyncGuid(newGuid);
  const snapshot = buildSnapshot(newGuid);
  const ok = await gyxiSave(newGuid, snapshot);
  if (ok) localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
  return ok;
}

export function changeGuidAsync(newGuid: string, onDone?: () => void): void {
  setSyncGuid(newGuid);
  (async () => {
    const remote = await withTimeout(gyxiGet(newGuid), PULL_TIMEOUT_MS, null);
    if (remote) mergeSnapshot(remote);
    window.dispatchEvent(new CustomEvent("sync:updated"));
    const snapshot = buildSnapshot(newGuid);
    const ok = await withTimeout(gyxiSave(newGuid, snapshot), PUSH_TIMEOUT_MS, false);
    if (ok) localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
    onDone?.();
  })();
}

export function markThemeUpdated(): void {
  localStorage.setItem("habit_tracker_theme_updated_at", String(Date.now()));
}
