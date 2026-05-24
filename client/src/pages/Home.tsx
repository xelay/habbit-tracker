import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Settings, BarChart2, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  getAllHabits,
  getLoggedHabitsForDate,
  toggleHabitForDate,
  getTodayString,
  type Habit,
} from "@/lib/habits";
import { syncWithGyxi, type SyncIntent } from "@/lib/sync";

// ─── Date helpers ────────────────────────────────────────────────────────────

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string, todayStr: string): string {
  const date = new Date(dateStr);
  const diff = Math.round(
    (new Date(dateStr).setHours(12) - new Date(todayStr).setHours(12)) /
      86400000
  );

  const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" });
  const dayMonth = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  if (diff === 0) return `Сегодня, ${dayMonth}`;
  if (diff === -1) return `Вчера, ${dayMonth}`;
  if (diff === -2) return `Позавчера, ${dayMonth}`;
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`;
}

// ─── Habit button ─────────────────────────────────────────────────────────────

function HabitButton({
  habit,
  logged,
  onToggle,
}: {
  habit: Habit;
  logged: boolean;
  onToggle: (id: string) => void;
}) {
  const stateClass = logged
    ? habit.type === "beneficial"
      ? "habit-btn-beneficial"
      : "habit-btn-harmful"
    : "habit-btn-idle";

  return (
    <button
      className={`habit-btn ${stateClass}`}
      onClick={() => onToggle(habit.id)}
      data-testid={`habit-btn-${habit.id}`}
      aria-pressed={logged}
      title={logged ? "Нажмите, чтобы отменить" : "Нажмите, чтобы отметить"}
    >
      <span className="text-3xl leading-none" role="img" aria-label={habit.name}>
        {habit.icon}
      </span>
      <span className="text-sm font-medium text-center leading-tight">
        {habit.name}
      </span>
      {logged && (
        <span className="absolute top-2 right-2 text-xs opacity-70" aria-label="Отмечено">
          ✓
        </span>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const today = getTodayString();
  const [currentDate, setCurrentDate] = useState(today);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loggedIds, setLoggedIds] = useState<string[]>([]);

  const isToday = currentDate === today;
  // Не позволяем заходить в будущее
  const canGoForward = currentDate < today;

  const reloadLogs = useCallback((date: string) => {
    setLoggedIds(getLoggedHabitsForDate(date));
  }, []);

  useEffect(() => {
    setHabits(getAllHabits());
  }, []);

  useEffect(() => {
    reloadLogs(currentDate);
  }, [currentDate, reloadLogs]);

  // Перечитываем UI когда синхронизация записала новые данные в localStorage
  useEffect(() => {
    const onSyncUpdated = () => {
      setHabits(getAllHabits());
      reloadLogs(currentDate);
    };
    window.addEventListener("sync:updated", onSyncUpdated);
    return () => window.removeEventListener("sync:updated", onSyncUpdated);
  }, [currentDate, reloadLogs]);

  const goBack = () => setCurrentDate((d) => offsetDate(d, -1));
  const goForward = () => {
    if (canGoForward) setCurrentDate((d) => offsetDate(d, 1));
  };
  const goToday = () => setCurrentDate(today);

  const handleToggle = (id: string) => {
    // Определяем намерение по текущему локальному state (loggedIds)
    const isLogged = loggedIds.includes(id);
    const intent: SyncIntent = isLogged
      ? { type: "unlog", habitId: id, date: currentDate }
      : { type: "log",   habitId: id, date: currentDate };

    // Сразу применяем локально для отзывчивости UI
    toggleHabitForDate(id, currentDate);
    reloadLogs(currentDate);

    // Синхронизация с intent: pull → merge → apply intent → push
    // intent гарантирует что remote не перебьёт действие пользователя
    syncWithGyxi(intent);
  };

  const beneficial = habits.filter((h) => h.type === "beneficial");
  const harmful = habits.filter((h) => h.type === "harmful");
  const loggedBeneficial = beneficial.filter((h) => loggedIds.includes(h.id)).length;
  const loggedHarmful = harmful.filter((h) => loggedIds.includes(h.id)).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between gap-2">

          {/* Date navigation */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <button
              onClick={goBack}
              className="shrink-0 rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="btn-prev-day"
              aria-label="Предыдущий день"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex-1 min-w-0 text-center">
              <p className="text-sm font-semibold leading-tight truncate capitalize">
                {formatDate(currentDate, today)}
              </p>
            </div>

            <button
              onClick={goForward}
              disabled={!canGoForward}
              className={`shrink-0 rounded-xl border border-border bg-card p-2 transition-colors ${
                canGoForward
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-border cursor-default"
              }`}
              data-testid="btn-next-day"
              aria-label="Следующий день"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Кнопка "Сегодня" — только когда не на сегодня */}
            {!isToday && (
              <button
                onClick={goToday}
                className="rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-medium text-primary hover:bg-muted transition-colors"
                data-testid="btn-today"
                aria-label="Вернуться к сегодня"
              >
                <CalendarDays size={15} />
              </button>
            )}
            <Link href="/statistics">
              <button
                className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="btn-statistics"
                aria-label="Статистика"
              >
                <BarChart2 size={16} />
              </button>
            </Link>
            <Link href="/settings">
              <button
                className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="btn-settings"
                aria-label="Настройки"
              >
                <Settings size={16} />
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-8">

        {/* Past day banner */}
        {!isToday && (
          <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Редактирование прошлого дня
            </p>
            <button
              onClick={goToday}
              className="text-xs font-medium text-primary hover:opacity-80 transition-opacity whitespace-nowrap"
              data-testid="btn-today-banner"
            >
              К сегодня →
            </button>
          </div>
        )}

        {/* Summary */}
        {habits.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Полезных</p>
              <p className="text-xl font-bold" data-testid="count-beneficial">
                {loggedBeneficial}
                <span className="text-sm font-normal text-muted-foreground">
                  /{beneficial.length}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Вредных</p>
              <p className="text-xl font-bold" data-testid="count-harmful">
                {loggedHarmful}
                <span className="text-sm font-normal text-muted-foreground">
                  /{harmful.length}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Beneficial habits */}
        {beneficial.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Полезные
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {beneficial.map((habit) => (
                <HabitButton
                  key={habit.id}
                  habit={habit}
                  logged={loggedIds.includes(habit.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Harmful habits */}
        {harmful.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Вредные
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {harmful.map((habit) => (
                <HabitButton
                  key={habit.id}
                  habit={habit}
                  logged={loggedIds.includes(habit.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {habits.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🎯</p>
            <p className="font-medium text-foreground mb-1">Нет привычек</p>
            <p className="text-sm text-muted-foreground mb-6">
              Добавь привычки в настройках, чтобы начать отслеживать
            </p>
            <Link href="/settings">
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity">
                <Settings size={16} />
                Перейти в настройки
              </button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
