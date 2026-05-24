// Habit types and localStorage storage layer

export type HabitType = "harmful" | "beneficial";
export type TrackingType = "bool" | "counter";

export interface Habit {
  id: string;
  name: string;
  icon: string;
  type: HabitType;
  trackingType?: TrackingType; // undefined → "bool" (backward-compat)
  isPreset: boolean;
  updatedAt?: number;
}

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

// Counter log: отдельное хранилище для счётчиков
export interface CounterLog {
  habitId: string;
  date: string; // YYYY-MM-DD
  count: number;
  updatedAt: number;
}

// Preset habits
export const PRESET_HABITS: Habit[] = [
  { id: "smoking", name: "Курение", icon: "🚬", type: "harmful", isPreset: true },
  { id: "alcohol", name: "Алкоголь", icon: "🍺", type: "harmful", isPreset: true },
  { id: "running", name: "Бег", icon: "🏃", type: "beneficial", isPreset: true },
  { id: "gym", name: "Спортзал", icon: "💪", type: "beneficial", isPreset: true },
  { id: "steps", name: "10 000 шагов", icon: "👟", type: "beneficial", isPreset: true },
];

// Available icons for custom habits
export const ICON_CATALOG = [
  { icon: "🧘", label: "Медитация" },
  { icon: "📚", label: "Чтение" },
  { icon: "💧", label: "Вода" },
  { icon: "🥗", label: "Питание" },
  { icon: "😴", label: "Сон" },
  { icon: "🚴", label: "Велосипед" },
  { icon: "🏊", label: "Плавание" },
  { icon: "🎯", label: "Цель" },
  { icon: "☕", label: "Кофе" },
  { icon: "🍕", label: "Фастфуд" },
  { icon: "🎮", label: "Игры" },
  { icon: "📱", label: "Телефон" },
  { icon: "💊", label: "Таблетки" },
  { icon: "🧠", label: "Учёба" },
  { icon: "✍️", label: "Запись" },
  { icon: "🌿", label: "Природа" },
  { icon: "🎵", label: "Музыка" },
  { icon: "🍷", label: "Вино" },
  { icon: "🧃", label: "Сок" },
  { icon: "🏋️", label: "Тяжёлая атлетика" },
  { icon: "🧹", label: "Уборка" },
  { icon: "🛁", label: "Ванна" },
  { icon: "🌅", label: "Ранний подъём" },
  { icon: "🍫", label: "Сладкое" },
  { icon: "😵", label: "Плохой сон" },
  { icon: "🥤", label: "Без алкоголя" },
  { icon: "🚭", label: "Без сигарет" },
  { icon: "🔞", label: "Порно" },
  { icon: "🍔", label: "Обжорство" },
  { icon: "📞", label: "Позвонил близким" },
  { icon: "🤫", label: "Не позвонил" },
  { icon: "🧺", label: "Уборка дома" },
  { icon: "💸", label: "Лишние траты" },
  { icon: "🥊", label: "Бокс" },
  { icon: "🧘‍♀️", label: "Йога" },
  { icon: "🌊", label: "Холодный душ" },
  { icon: "🍎", label: "Здоровая еда" },
  { icon: "🚶", label: "Прогулка" },
  { icon: "🧂", label: "Много соли" },
  { icon: "🎂", label: "День рождения" },
  { icon: "💬", label: "Общение" },
  { icon: "😤", label: "Раздражение" },
  { icon: "🙏", label: "Благодарность" },
  { icon: "💻", label: "Работа" },
  { icon: "🌙", label: "Поздно лёг" },
  { icon: "⚡", label: "Энергетик" },
  { icon: "🚗", label: "Машина" },
  { icon: "🤝", label: "Помог кому-то" },
  { icon: "🪜", label: "Лестница" },
  { icon: "🤸", label: "Растяжка" },
  { icon: "📓", label: "Дневник" },
  { icon: "🍭", label: "Без сахара" },
  { icon: "🧊", label: "Холодная вода" },
  { icon: "🫸", label: "Отжимания" },
  { icon: "🐕", label: "Выгул собаки" },
  { icon: "👁️", label: "Отдых для глаз" },
];

const STORAGE_KEYS = {
  CUSTOM_HABITS: "habit_tracker_custom",
  LOGS: "habit_tracker_logs",
  COUNTER_LOGS: "habit_tracker_counter_logs",
  SELECTED_PRESETS: "habit_tracker_selected_presets",
  PUSH_PERM: "habit_tracker_push",
};

// ─── Helper ────────────────────────────────────────────────────────────────
export function getTrackingType(habit: Habit): TrackingType {
  return habit.trackingType ?? "bool";
}

// Custom habits CRUD
export function getCustomHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_HABITS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomHabits(habits: Habit[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_HABITS, JSON.stringify(habits));
}

export function addCustomHabit(habit: Omit<Habit, "isPreset">): Habit {
  const customs = getCustomHabits();
  const newHabit: Habit = { ...habit, isPreset: false, updatedAt: Date.now() };
  customs.push(newHabit);
  saveCustomHabits(customs);
  return newHabit;
}

export function updateCustomHabit(
  id: string,
  patch: Partial<Pick<Habit, "name" | "icon" | "type" | "trackingType">>
): void {
  const customs = getCustomHabits().map((h) =>
    h.id === id ? { ...h, ...patch, updatedAt: Date.now() } : h
  );
  saveCustomHabits(customs);
}

export function deleteCustomHabit(id: string): void {
  const customs = getCustomHabits().filter((h) => h.id !== id);
  saveCustomHabits(customs);
  const logs = getAllLogs().filter((l) => l.habitId !== id);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  const cLogs = getAllCounterLogs().filter((l) => l.habitId !== id);
  localStorage.setItem(STORAGE_KEYS.COUNTER_LOGS, JSON.stringify(cLogs));
  try {
    const deleted: string[] = JSON.parse(localStorage.getItem("habit_tracker_deleted_custom") || "[]");
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem("habit_tracker_deleted_custom", JSON.stringify(deleted));
    }
  } catch { /* ignore */ }
}

// Selected presets
export function getSelectedPresetIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SELECTED_PRESETS);
    if (raw) return JSON.parse(raw);
    return PRESET_HABITS.map((h) => h.id);
  } catch {
    return PRESET_HABITS.map((h) => h.id);
  }
}

export function setSelectedPresetIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEYS.SELECTED_PRESETS, JSON.stringify(ids));
}

// All active habits
export function getAllHabits(): Habit[] {
  const selectedIds = getSelectedPresetIds();
  const presets = PRESET_HABITS.filter((h) => selectedIds.includes(h.id));
  const customs = getCustomHabits();
  return [...presets, ...customs];
}

// ─── Bool Logs ─────────────────────────────────────────────────────────────
export function getAllLogs(): HabitLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getLoggedHabitsForDate(date: string): string[] {
  return getAllLogs()
    .filter((l) => l.date === date)
    .map((l) => l.habitId);
}

export function getLoggedHabitsToday(): string[] {
  return getLoggedHabitsForDate(getTodayString());
}

export function logHabitForDate(habitId: string, date: string): void {
  const logs = getAllLogs();
  if (!logs.find((l) => l.habitId === habitId && l.date === date)) {
    logs.push({ habitId, date, timestamp: Date.now() });
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }
}

export function unlogHabitForDate(habitId: string, date: string): void {
  const logs = getAllLogs().filter(
    (l) => !(l.habitId === habitId && l.date === date)
  );
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
}

export function toggleHabitForDate(habitId: string, date: string): boolean {
  const logged = getLoggedHabitsForDate(date);
  if (logged.includes(habitId)) {
    unlogHabitForDate(habitId, date);
    return false;
  } else {
    logHabitForDate(habitId, date);
    return true;
  }
}

export function logHabit(habitId: string): void {
  logHabitForDate(habitId, getTodayString());
}
export function unlogHabit(habitId: string): void {
  unlogHabitForDate(habitId, getTodayString());
}
export function toggleHabit(habitId: string): boolean {
  return toggleHabitForDate(habitId, getTodayString());
}

// ─── Counter Logs ─────────────────────────────────────────────────────────
export function getAllCounterLogs(): CounterLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COUNTER_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAllCounterLogs(logs: CounterLog[]): void {
  localStorage.setItem(STORAGE_KEYS.COUNTER_LOGS, JSON.stringify(logs));
}

export function getCounterForDate(habitId: string, date: string): number {
  const logs = getAllCounterLogs();
  const entry = logs.find((l) => l.habitId === habitId && l.date === date);
  return entry?.count ?? 0;
}

export function setCounterForDate(habitId: string, date: string, count: number): void {
  const logs = getAllCounterLogs();
  const idx = logs.findIndex((l) => l.habitId === habitId && l.date === date);
  const entry: CounterLog = { habitId, date, count, updatedAt: Date.now() };
  if (idx >= 0) {
    logs[idx] = entry;
  } else {
    logs.push(entry);
  }
  saveAllCounterLogs(logs);
}

export function incrementCounter(habitId: string, date: string): number {
  const current = getCounterForDate(habitId, date);
  const next = current + 1;
  setCounterForDate(habitId, date, next);
  return next;
}

export function resetCounter(habitId: string, date: string): void {
  setCounterForDate(habitId, date, 0);
}

// ─── Stats ─────────────────────────────────────────────────────────────────
export function getWeeklyStats(): {
  beneficial: number;
  harmful: number;
  streak: number;
} {
  const logs = getAllLogs();
  const allHabits = getAllHabits();
  const habitMap = new Map(allHabits.map((h) => [h.id, h]));

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weekLogs = logs.filter((l) => new Date(l.date) >= weekAgo);

  let beneficial = 0;
  let harmful = 0;

  for (const log of weekLogs) {
    const habit = habitMap.get(log.habitId);
    if (!habit) continue;
    if (habit.type === "beneficial") beneficial++;
    else harmful++;
  }

  const counterLogs = getAllCounterLogs();
  for (const cl of counterLogs) {
    if (cl.count <= 0) continue;
    if (new Date(cl.date) < weekAgo) continue;
    const habit = habitMap.get(cl.habitId);
    if (!habit) continue;
    if (habit.type === "beneficial") beneficial++;
    else harmful++;
  }

  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLogs = logs.filter((l) => l.date === dateStr);
    const dayCounters = counterLogs.filter((l) => l.date === dateStr && l.count > 0);
    const hasBeneficial =
      dayLogs.some((l) => habitMap.get(l.habitId)?.type === "beneficial") ||
      dayCounters.some((l) => habitMap.get(l.habitId)?.type === "beneficial");
    if (hasBeneficial) streak++;
    else break;
  }

  return { beneficial, harmful, streak };
}

// ─── Analytics ─────────────────────────────────────────────────────────────

export interface DayStats {
  date: string;
  beneficial: number;
  harmful: number;
  // иконки привычек за этот день
  beneficialIcons: string[];
  harmfulIcons: string[];
}

export interface HabitStat {
  habit: Habit;
  total: number;
  lastWeek: number;
  streak: number;
  bestStreak: number;
  totalCount?: number;
  lastWeekCount?: number;
}

export function getLastNDates(n: number): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().split("T")[0]);
  }
  return result;
}

export function getDailyStats(days = 30): DayStats[] {
  const logs = getAllLogs();
  const counterLogs = getAllCounterLogs();
  const allHabits = getAllHabits();
  const habitMap = new Map(allHabits.map((h) => [h.id, h]));
  const dates = getLastNDates(days).reverse();

  return dates.map((date) => {
    const dayLogs = logs.filter((l) => l.date === date);
    const dayCounters = counterLogs.filter((l) => l.date === date && l.count > 0);
    const beneficialIcons: string[] = [];
    const harmfulIcons: string[] = [];
    for (const log of dayLogs) {
      const h = habitMap.get(log.habitId);
      if (!h) continue;
      if (h.type === "beneficial") beneficialIcons.push(h.icon);
      else harmfulIcons.push(h.icon);
    }
    for (const cl of dayCounters) {
      const h = habitMap.get(cl.habitId);
      if (!h) continue;
      if (h.type === "beneficial") beneficialIcons.push(h.icon);
      else harmfulIcons.push(h.icon);
    }
    return {
      date,
      beneficial: beneficialIcons.length,
      harmful: harmfulIcons.length,
      beneficialIcons,
      harmfulIcons,
    };
  });
}

export function getHabitStats(): HabitStat[] {
  const logs = getAllLogs();
  const counterLogs = getAllCounterLogs();
  const allHabits = getAllHabits();
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  return allHabits.map((habit) => {
    if (getTrackingType(habit) === "counter") {
      const hLogs = counterLogs.filter((l) => l.habitId === habit.id && l.count > 0);
      const logDates = new Set(hLogs.map((l) => l.date));
      const total = logDates.size;
      const lastWeek = hLogs.filter((l) => new Date(l.date) >= weekAgo).length;
      const totalCount = counterLogs
        .filter((l) => l.habitId === habit.id)
        .reduce((s, l) => s + l.count, 0);
      const lastWeekCount = hLogs
        .filter((l) => new Date(l.date) >= weekAgo)
        .reduce((s, l) => s + l.count, 0);

      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        if (logDates.has(ds)) streak++; else break;
      }

      const sortedDates = Array.from(logDates).sort();
      let best = 0, cur = 0;
      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) { cur = 1; }
        else {
          const diff = (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000;
          cur = diff === 1 ? cur + 1 : 1;
        }
        if (cur > best) best = cur;
      }

      return { habit, total, lastWeek, streak, bestStreak: best, totalCount, lastWeekCount };
    }

    const habitLogs = logs.filter((l) => l.habitId === habit.id);
    const logDates = new Set(habitLogs.map((l) => l.date));
    const total = logDates.size;
    const lastWeek = habitLogs.filter((l) => new Date(l.date) >= weekAgo).length;

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      if (logDates.has(ds)) streak++; else break;
    }

    const sortedDates = Array.from(logDates).sort();
    let best = 0, cur = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { cur = 1; }
      else {
        const diff = (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      }
      if (cur > best) best = cur;
    }

    return { habit, total, lastWeek, streak, bestStreak: best };
  });
}

export function getActiveDaysCount(): number {
  const logs = getAllLogs();
  const counterLogs = getAllCounterLogs().filter((l) => l.count > 0);
  const dates = new Set([
    ...logs.map((l) => l.date),
    ...counterLogs.map((l) => l.date),
  ]);
  return dates.size;
}

export function getBestDay(): { date: string; count: number } | null {
  const logs = getAllLogs();
  const counterLogs = getAllCounterLogs().filter((l) => l.count > 0);
  if (logs.length === 0 && counterLogs.length === 0) return null;
  const byDate: Record<string, number> = {};
  for (const log of logs) {
    byDate[log.date] = (byDate[log.date] ?? 0) + 1;
  }
  for (const cl of counterLogs) {
    byDate[cl.date] = (byDate[cl.date] ?? 0) + 1;
  }
  const best = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
  return best ? { date: best[0], count: best[1] } : null;
}
