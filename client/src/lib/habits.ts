// Habit types and localStorage storage layer

export type HabitType = "harmful" | "beneficial";

export interface Habit {
  id: string;
  name: string;
  icon: string; // emoji or icon name
  type: HabitType;
  isPreset: boolean;
  updatedAt?: number; // timestamp последнего изменения — используется sync merge
}

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
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
  // Вторая порция
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
  // Третья порция
  { icon: "🪜", label: "Лестница" },
  { icon: "🤸", label: "Растяжка" },
  { icon: "📓", label: "Дневник" },
  { icon: "🚫🍬", label: "Без сахара" },
  { icon: "🧊", label: "Холодная вода" },
  { icon: "🫸", label: "Отжимания" },
  { icon: "🐕", label: "Выгул собаки" },
  { icon: "👁️", label: "Отдых для глаз" },
];

const STORAGE_KEYS = {
  CUSTOM_HABITS: "habit_tracker_custom",
  LOGS: "habit_tracker_logs",
  SELECTED_PRESETS: "habit_tracker_selected_presets",
  PUSH_PERM: "habit_tracker_push",
};

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
  patch: Partial<Pick<Habit, "name" | "icon" | "type">>
): void {
  // ID не меняется — все логи по этой привычке сохраняются
  // updatedAt обновляется чтобы sync merge знал что эта версия свежее remote
  const customs = getCustomHabits().map((h) =>
    h.id === id ? { ...h, ...patch, updatedAt: Date.now() } : h
  );
  saveCustomHabits(customs);
}

export function deleteCustomHabit(id: string): void {
  const customs = getCustomHabits().filter((h) => h.id !== id);
  saveCustomHabits(customs);
  // Also remove logs for this habit
  const logs = getAllLogs().filter((l) => l.habitId !== id);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  // Write tombstone so sync never restores this habit from remote
  try {
    const deleted: string[] = JSON.parse(localStorage.getItem("habit_tracker_deleted_custom") || "[]");
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem("habit_tracker_deleted_custom", JSON.stringify(deleted));
    }
  } catch { /* ignore */ }
}

// Selected presets (user can toggle which presets are shown)
export function getSelectedPresetIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SELECTED_PRESETS);
    if (raw) return JSON.parse(raw);
    // Default: all presets selected
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

// Logs
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

// Backward-compatible alias
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

// Backward-compatible alias
export function logHabit(habitId: string): void {
  logHabitForDate(habitId, getTodayString());
}
export function unlogHabit(habitId: string): void {
  unlogHabitForDate(habitId, getTodayString());
}
export function toggleHabit(habitId: string): boolean {
  return toggleHabitForDate(habitId, getTodayString());
}

// Stats for push notifications
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

  const weekLogs = logs.filter(
    (l) => new Date(l.date) >= weekAgo
  );

  let beneficial = 0;
  let harmful = 0;

  for (const log of weekLogs) {
    const habit = habitMap.get(log.habitId);
    if (!habit) continue;
    if (habit.type === "beneficial") beneficial++;
    else harmful++;
  }

  // Simple streak: consecutive days with at least one beneficial habit
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLogs = logs.filter((l) => l.date === dateStr);
    const hasBeneficial = dayLogs.some((l) => {
      const h = habitMap.get(l.habitId);
      return h?.type === "beneficial";
    });
    if (hasBeneficial) streak++;
    else break;
  }

  return { beneficial, harmful, streak };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface DayStats {
  date: string;           // YYYY-MM-DD
  beneficial: number;
  harmful: number;
}

export interface HabitStat {
  habit: Habit;
  total: number;          // total logged days
  lastWeek: number;       // last 7 days
  streak: number;         // current consecutive days
  bestStreak: number;
}

/** Returns last N days (today first) as YYYY-MM-DD strings */
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

/** Daily beneficial/harmful counts for the last N days (ascending order) */
export function getDailyStats(days = 30): DayStats[] {
  const logs = getAllLogs();
  const allHabits = getAllHabits();
  const habitMap = new Map(allHabits.map((h) => [h.id, h]));
  const dates = getLastNDates(days).reverse(); // ascending

  return dates.map((date) => {
    const dayLogs = logs.filter((l) => l.date === date);
    let beneficial = 0;
    let harmful = 0;
    for (const log of dayLogs) {
      const h = habitMap.get(log.habitId);
      if (!h) continue;
      if (h.type === "beneficial") beneficial++;
      else harmful++;
    }
    return { date, beneficial, harmful };
  });
}

/** Per-habit statistics */
export function getHabitStats(): HabitStat[] {
  const logs = getAllLogs();
  const allHabits = getAllHabits();
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  return allHabits.map((habit) => {
    const habitLogs = logs.filter((l) => l.habitId === habit.id);
    const logDates = new Set(habitLogs.map((l) => l.date));

    const total = logDates.size;

    const lastWeek = habitLogs.filter((l) => new Date(l.date) >= weekAgo).length;

    // Current streak
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      if (logDates.has(ds)) streak++; else break;
    }

    // Best streak
    const sortedDates = Array.from(logDates).sort();
    let best = 0;
    let cur = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        cur = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      }
      if (cur > best) best = cur;
    }

    return { habit, total, lastWeek, streak, bestStreak: best };
  });
}

/** Total logged days (any habit) across all time */
export function getActiveDaysCount(): number {
  const logs = getAllLogs();
  return new Set(logs.map((l) => l.date)).size;
}

/** Best single day: most habits logged */
export function getBestDay(): { date: string; count: number } | null {
  const logs = getAllLogs();
  if (logs.length === 0) return null;
  const byDate: Record<string, number> = {};
  for (const log of logs) {
    byDate[log.date] = (byDate[log.date] ?? 0) + 1;
  }
  const best = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
  return best ? { date: best[0], count: best[1] } : null;
}
