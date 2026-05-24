// ─── gyxi Sync ────────────────────────────────────────────────────────────────
// Синхронизирует весь стейт приложения через gyxi DB.
//
// Стратегия:
//   - Один документ с id="state" в partition=GUID пользователя
//   - Logs: merge (объединение по date+habitId, без потерь)
//   - selectedPresets: merge (union локальных и remote)
//   - custom habits: merge по id, побеждает более свежий updatedAt
//   - theme: last-write-wins по snapshotUpdatedAt
//
// gyxi API:
//   GET  https://germany-get.gyxi.com/{db}/{type}/{partitionValue}/{id}
//   POST https://germany-save.gyxi.com/{db}/{type}/{partitionFieldName}
//   Header: Gyxi-ApiKey

import { logSyncError } from "./syncLog";

// ── Константы ─────────────────────────────────────────────────────────────────
const GYXI_DB = "habittracker";
const GYXI_API_KEY = "HabitSyncKey2026";
const GYXI_REGION = "germany";
const GYXI_GET_BASE = `https://${GYXI_REGION}-get.gyxi.com/${GYXI_DB}`;
const GYXI_SAVE_BASE = `https://${GYXI_REGION}-save.gyxi.com/${GYXI_DB}`;
const GYXI_TYPE = "state";
const GYXI_PARTITION = "guid"; // gyxi читает значение partition из поля "guid" в теле
const DOC_ID = "state";

// ── localStorage ключи ────────────────────────────────────────────────────────
export const SYNC_GUID_KEY = "habit_tracker_sync_guid";
const SYNC_LAST_KEY = "habit_tracker_sync_last";

// ── GUID helpers ──────────────────────────────────────────────────────────────
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

// ── Snapshot типы ─────────────────────────────────────────────────────────────
export interface HabitLog {
  habitId: string;
  date: string;       // YYYY-MM-DD
  timestamp: number;
}

export interface CustomHabit {
  id: string;
  name: string;
  icon: string;
  type: "good" | "bad";
  updatedAt?: number;
}

export interface SyncSnapshot {
  id: typeof DOC_ID;
  guid: string;
  logs: HabitLog[];
  unloggedKeys: string[];    // tombstone снятых отметок: "date__habitId"
  custom: CustomHabit[];
  selectedPresets: string[];
  theme: string;
  themeUpdatedAt: number;  // timestamp последнего изменения темы
  snapshotUpdatedAt: number; // timestamp снимка
}

// ── Чтение localStorage ───────────────────────────────────────────────────────
function parseLocal<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return def;
    return JSON.parse(v) ?? def;
  } catch {
    return def;
  }
}

// ── localStorage → snapshot ───────────────────────────────────────────────────
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
  };
}

// ── snapshot → localStorage (merge) ──────────────────────────────────────────
function mergeSnapshot(remote: SyncSnapshot): void {
  // 1. Unlogged tombstones: union первым — нужны до merge логов
  const localUnlogged = parseLocal<string[]>("habit_tracker_unlogged", []);
  const mergedUnlogged = Array.from(new Set([...localUnlogged, ...(remote.unloggedKeys ?? [])]));
  localStorage.setItem("habit_tracker_unlogged", JSON.stringify(mergedUnlogged));
  const unloggedSet = new Set(mergedUnlogged);

  // 2. Logs: union by date+habitId, затем вычитаем tombstone
  const localLogs = parseLocal<HabitLog[]>("habit_tracker_logs", []);
  const logMap = new Map<string, HabitLog>();
  for (const log of localLogs) logMap.set(`${log.date}__${log.habitId}`, log);
  for (const log of remote.logs) logMap.set(`${log.date}__${log.habitId}`, log);
  // Tombstone wins: удалённые пользователем отметки не возвращаются с remote
  for (const key of unloggedSet) logMap.delete(key);
  const mergedLogs = Array.from(logMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  localStorage.setItem("habit_tracker_logs", JSON.stringify(mergedLogs));

  // 2. Tombstones: union deleted IDs — once deleted, stays deleted everywhere
  const localDeleted = parseLocal<string[]>("habit_tracker_deleted_custom", []);
  const mergedDeleted = Array.from(new Set([...localDeleted, ...(remote.deletedCustomIds ?? [])]));
  localStorage.setItem("habit_tracker_deleted_custom", JSON.stringify(mergedDeleted));
  const deletedSet = new Set(mergedDeleted);

  // 3. Custom habits: merge by id, tombstone wins over any version
  const localCustom = parseLocal<CustomHabit[]>("habit_tracker_custom", []);
  const customMap = new Map<string, CustomHabit>();
  for (const h of localCustom) {
    if (!deletedSet.has(h.id)) customMap.set(h.id, h);
  }
  for (const h of remote.custom) {
    if (deletedSet.has(h.id)) continue;
    const local = customMap.get(h.id);
    // remote побеждает только если его updatedAt строго больше;
    // при равенстве побеждает local (пользователь только что изменил)
    if (!local || (h.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      customMap.set(h.id, h);
    }
  }
  localStorage.setItem("habit_tracker_custom", JSON.stringify(Array.from(customMap.values())));

  // 4. selectedPresets: union of selected minus explicitly deselected
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

  // 5. Theme: last-write-wins by themeUpdatedAt
  const localThemeTs = Number(localStorage.getItem("habit_tracker_theme_updated_at") ?? "0");
  const remoteThemeTs = remote.themeUpdatedAt ?? 0;
  if (remoteThemeTs > localThemeTs) {
    localStorage.setItem("habit_tracker_theme", remote.theme);
    localStorage.setItem("habit_tracker_theme_updated_at", String(remoteThemeTs));
  }
}

// ── gyxi API ──────────────────────────────────────────────────────────────────
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

// ── Intent types ──────────────────────────────────────────────────────────────
// Intent = явное намерение пользователя, которое применяется ПОСЛЕ merge,
// чтобы remote не мог его перебить.

export type SyncIntent =
  | { type: "log";      habitId: string; date: string }   // отметить привычку
  | { type: "unlog";    habitId: string; date: string }   // снять отметку
  | { type: "none" };                                      // просто синхр.

function applyIntent(intent: SyncIntent): void {
  if (intent.type === "none") return;

  const LOGS_KEY = "habit_tracker_logs";
  const UNLOGGED_KEY = "habit_tracker_unlogged";
  const tombstoneKey = `${intent.date}__${intent.habitId}`;
  let logs: HabitLog[] = [];
  try { logs = JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"); } catch { /**/ }
  let unlogged: string[] = [];
  try { unlogged = JSON.parse(localStorage.getItem(UNLOGGED_KEY) || "[]"); } catch { /**/ }

  if (intent.type === "log") {
    // Удаляем tombstone — пользователь опять хочет эту отметку
    const newUnlogged = unlogged.filter((k) => k !== tombstoneKey);
    localStorage.setItem(UNLOGGED_KEY, JSON.stringify(newUnlogged));
    // Добавляем лог если ещё нет
    const exists = logs.some((l) => l.habitId === intent.habitId && l.date === intent.date);
    if (!exists) {
      logs.push({ habitId: intent.habitId, date: intent.date, timestamp: Date.now() });
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }
  } else if (intent.type === "unlog") {
    // Записываем tombstone — remote больше не вернёт эту отметку
    if (!unlogged.includes(tombstoneKey)) {
      unlogged.push(tombstoneKey);
      localStorage.setItem(UNLOGGED_KEY, JSON.stringify(unlogged));
    }
    // Удаляем лог
    const filtered = logs.filter((l) => !(l.habitId === intent.habitId && l.date === intent.date));
    localStorage.setItem(LOGS_KEY, JSON.stringify(filtered));
  }
}

// ── Таймаут для fetch ─────────────────────────────────────────────────────────
const PULL_TIMEOUT_MS = 5000;  // 5 сек — после этого pull считается неудачным
const PUSH_TIMEOUT_MS = 8000;  // 8 сек — push чуть дольше, он критичнее

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timer = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timer]);
}

// ── Публичный интерфейс ───────────────────────────────────────────────────────

/**
 * Синхронизация: pull (с таймаутом) → merge → apply intent → notify UI → push (фон).
 *
 * UI не ждёт ни pull ни push — возвращаемся сразу после apply intent.
 * Весь сетевой код выполняется асинхронно и не блокирует интерфейс.
 *
 * intent = намерение пользователя (log/unlog), применяется ПОСЛЕ merge,
 * поэтому remote никогда не может его перебить.
 */
export function syncWithGyxi(intent: SyncIntent = { type: "none" }): void {
  const guid = getSyncGuid();

  (async () => {
    // 1. Pull с таймаутом — если сервер тормозит, продолжаем без него
    const remote = await withTimeout(gyxiGet(guid), PULL_TIMEOUT_MS, null);
    if (remote) {
      mergeSnapshot(remote);
    }

    // 2. Intent поверх merge — намерение пользователя всегда побеждает
    applyIntent(intent);

    // 3. Notify UI — компоненты перечитывают из актуального localStorage
    window.dispatchEvent(new CustomEvent("sync:updated"));

    // 4. Push с таймаутом — fire-and-forget, UI уже обновлён
    const snapshot = buildSnapshot(guid);
    const ok = await withTimeout(gyxiSave(guid, snapshot), PUSH_TIMEOUT_MS, false);
    if (ok) localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
  })();
}

/**
 * Смена GUID: pull с нового ключа → merge → push под новым ключом.
 * Блокирующая версия — используется там где нужен результат.
 */
export async function changeGuid(newGuid: string): Promise<boolean> {
  const remote = await gyxiGet(newGuid);
  if (remote) mergeSnapshot(remote);
  setSyncGuid(newGuid);
  const snapshot = buildSnapshot(newGuid);
  const ok = await gyxiSave(newGuid, snapshot);
  if (ok) localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
  return ok;
}

/**
 * Смена GUID — fire-and-forget версия.
 * UI сразу получает новый ключ, сетевая работа в фоне с таймаутами.
 * onDone вызывается после завершения (успех или нет) — обновить lastSync в UI.
 */
export function changeGuidAsync(
  newGuid: string,
  onDone?: () => void,
): void {
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

/**
 * Вызывать при изменении темы — фиксирует timestamp чтобы theme выиграл last-write-wins.
 */
export function markThemeUpdated(): void {
  localStorage.setItem("habit_tracker_theme_updated_at", String(Date.now()));
}
