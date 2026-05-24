import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Flame, Calendar, TrendingUp, Award } from "lucide-react";
import {
  getDailyStats,
  getHabitStats,
  getActiveDaysCount,
  getBestDay,
  getWeeklyStats,
  getAllHabits,
  getAllLogs,
  getAllCounterLogs,
  getTrackingType,
  type DayStats,
  type HabitStat,
  type Habit,
} from "@/lib/habits";

// ─── Micro bar chart ─────────────────────────────────────────────────────────────

function MiniBar({ value, max, type, totalHeight }: {
  value: number; max: number; type: "beneficial" | "harmful"; totalHeight: number;
}) {
  const pct = max === 0 ? 0 : value / max;
  const barPx = Math.max(Math.round(pct * totalHeight), 3);
  return (
    <div
      className={`w-full rounded-sm transition-all ${
        type === "beneficial" ? "bg-green-500 dark:bg-green-400" : "bg-red-400 dark:bg-red-500"
      }`}
      style={{ height: `${barPx}px` }}
    />
  );
}

function ActivityChart({ data }: { data: DayStats[] }) {
  const maxBeneficial = Math.max(...data.map((d) => d.beneficial), 1);
  const maxHarmful = Math.max(...data.map((d) => d.harmful), 1);
  const last14 = data.slice(-14);
  return (
    <div>
      <div className="flex items-end gap-1">
        {last14.map((day) => (
          <div key={day.date} className="flex-1 flex flex-col justify-end gap-0.5">
            {day.beneficial > 0 && <MiniBar value={day.beneficial} max={maxBeneficial} type="beneficial" totalHeight={56} />}
            {day.harmful > 0 && <MiniBar value={day.harmful} max={maxHarmful} type="harmful" totalHeight={56} />}
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        {last14.map((day) => (
          <div key={day.date} className="flex-1 text-center text-[9px] text-muted-foreground">
            {new Date(day.date).toLocaleDateString("ru-RU", { weekday: "narrow" })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Heatmap (interactive) ───────────────────────────────────────────────────────────

type HeatmapMode =
  | { kind: "beneficial" }
  | { kind: "harmful" }
  | { kind: "habit"; habit: Habit };

function Heatmap({ habits }: { habits: Habit[] }) {
  const [mode, setMode] = useState<HeatmapMode>({ kind: "beneficial" });

  const today = new Date();

  const cells: { date: string; isWeekend: boolean }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay(); // 0=вс, 6=сб
    cells.push({
      date: d.toISOString().split("T")[0],
      isWeekend: dow === 0 || dow === 6,
    });
  }

  const boolLogs = getAllLogs();
  const counterLogs = getAllCounterLogs();
  const habitMap = new Map(habits.map((h) => [h.id, h]));

  const activeDatesByType = (type: "beneficial" | "harmful"): Set<string> => {
    const s = new Set<string>();
    for (const l of boolLogs) {
      if (habitMap.get(l.habitId)?.type === type) s.add(l.date);
    }
    for (const cl of counterLogs) {
      if (cl.count > 0 && habitMap.get(cl.habitId)?.type === type) s.add(cl.date);
    }
    return s;
  };

  const activeDatesForHabit = (habitId: string): Set<string> => {
    const h = habitMap.get(habitId);
    if (!h) return new Set();
    const s = new Set<string>();
    if (getTrackingType(h) === "counter") {
      for (const cl of counterLogs) {
        if (cl.habitId === habitId && cl.count > 0) s.add(cl.date);
      }
    } else {
      for (const l of boolLogs) {
        if (l.habitId === habitId) s.add(l.date);
      }
    }
    return s;
  };

  let activeDates: Set<string>;
  let activeColor: string;
  let selectedHabit: Habit | null = null;

  if (mode.kind === "habit") {
    activeDates = activeDatesForHabit(mode.habit.id);
    activeColor = mode.habit.type === "beneficial"
      ? "bg-green-500 dark:bg-green-400"
      : "bg-red-400 dark:bg-red-500";
    selectedHabit = mode.habit;
  } else {
    activeDates = activeDatesByType(mode.kind);
    activeColor = mode.kind === "beneficial"
      ? "bg-green-500 dark:bg-green-400"
      : "bg-red-400 dark:bg-red-500";
  }

  const weeks: { date: string; isWeekend: boolean }[][] = [];
  for (let w = 0; w < 12; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));

  const beneficialHabits = habits.filter((h) => h.type === "beneficial");
  const harmfulHabits = habits.filter((h) => h.type === "harmful");

  const btnBase = "rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap";
  const btnCls = (isActive: boolean, color: "green" | "red") => {
    if (!isActive) return `${btnBase} border-border text-muted-foreground hover:text-foreground`;
    if (color === "green") return `${btnBase} border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400`;
    return `${btnBase} border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
  };

  return (
    <div className="space-y-3">
      {/* Фильтры */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setMode({ kind: "beneficial" })} className={btnCls(mode.kind === "beneficial", "green")}>
          🟢 Полезные
        </button>
        <button onClick={() => setMode({ kind: "harmful" })} className={btnCls(mode.kind === "harmful", "red")}>
          🔴 Вредные
        </button>
        {(beneficialHabits.length > 0 || harmfulHabits.length > 0) && (
          <span className="self-center text-border mx-0.5">|</span>
        )}
        {[...beneficialHabits, ...harmfulHabits].map((h) => {
          const isSelected = mode.kind === "habit" && (mode as { kind: string; habit: Habit }).habit.id === h.id;
          const color = h.type === "beneficial" ? "green" : "red";
          return (
            <button
              key={h.id}
              onClick={() => setMode(isSelected ? { kind: h.type } : { kind: "habit", habit: h })}
              className={btnCls(isSelected, color)}
              title={h.name}
            >
              {h.icon}
            </button>
          );
        })}
      </div>

      {/* Сетка */}
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((cell) => {
              const isActive = activeDates.has(cell.date);
              // Неактивная выходная: чуть темнее чем обычные будние — еле заметно
              const idleCls = cell.isWeekend
                ? "bg-muted/70 ring-1 ring-inset ring-border/60"
                : "bg-muted";
              return (
                <div
                  key={cell.date}
                  title={cell.date}
                  className={`rounded-[3px] aspect-square flex items-center justify-center overflow-hidden ${
                    isActive ? activeColor : idleCls
                  }`}
                >
                  {isActive && selectedHabit && (
                    <span className="text-[9px] leading-none select-none" role="img">
                      {selectedHabit.icon}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-sm inline-block ${activeColor}`} />
          {mode.kind === "habit" ? selectedHabit!.name : "Есть запись"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-muted inline-block" />
          Нет данных
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-muted/70 ring-1 ring-inset ring-border/60 inline-block" />
          Сб/Вс
        </span>
      </div>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
      <div className="rounded-full bg-muted p-2 mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Per-habit row ─────────────────────────────────────────────────────────────

function HabitStatRow({ stat }: { stat: HabitStat }) {
  const { habit, total, lastWeek, streak } = stat;
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-testid={`stat-row-${habit.id}`}>
      <span className="text-2xl w-8 text-center shrink-0">{habit.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{habit.name}</p>
        <p className={`text-xs ${ habit.type === "beneficial" ? "text-green-600 dark:text-green-400" : "text-red-500" }`}>
          {habit.type === "beneficial" ? "Полезная" : "Вредная"}
          {getTrackingType(habit) === "counter" && <span className="ml-1 text-muted-foreground">· счётчик</span>}
        </p>
      </div>
      <div className="flex gap-4 text-right shrink-0">
        <div>
          <p className="text-sm font-bold">{lastWeek}</p>
          <p className="text-[10px] text-muted-foreground">за нед.</p>
        </div>
        <div>
          <p className="text-sm font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">всего</p>
        </div>
        <div>
          <p className="text-sm font-bold flex items-center gap-0.5">
            {streak > 0 && <span className="text-orange-400">🔥</span>}
            {streak}
          </p>
          <p className="text-[10px] text-muted-foreground">серия</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Statistics() {
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [habitStats, setHabitStats] = useState<HabitStat[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeDays, setActiveDays] = useState(0);
  const [bestDay, setBestDay] = useState<{ date: string; count: number } | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ beneficial: 0, harmful: 0, streak: 0 });

  useEffect(() => {
    setDailyStats(getDailyStats(84));
    setHabitStats(getHabitStats());
    setHabits(getAllHabits());
    setActiveDays(getActiveDaysCount());
    setBestDay(getBestDay());
    setWeeklyStats(getWeeklyStats());
  }, []);

  const beneficial = habitStats.filter((s) => s.habit.type === "beneficial");
  const harmful = habitStats.filter((s) => s.habit.type === "harmful");
  const hasAnyData = activeDays > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-md px-4 py-4 flex items-center gap-3">
          <Link href="/">
            <button className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-back" aria-label="Назад">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <h1 className="text-base font-bold">Статистика</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-8">
        {!hasAnyData ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📊</p>
            <p className="font-medium">Пока нет данных</p>
            <p className="text-sm text-muted-foreground mt-1">Начни отмечать привычки — статистика появится здесь</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Общий итог</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<Flame size={15} className="text-orange-400" />} label="Серия (дни)" value={weeklyStats.streak} sub="полезных подряд" />
                <StatCard icon={<Calendar size={15} className="text-blue-400" />} label="Активных дней" value={activeDays} sub="за всё время" />
                <StatCard icon={<TrendingUp size={15} className="text-green-500" />} label="Полезных за неделю" value={weeklyStats.beneficial} />
                <StatCard
                  icon={<Award size={15} className="text-purple-400" />}
                  label="Лучший день"
                  value={bestDay ? bestDay.count : "—"}
                  sub={bestDay ? new Date(bestDay.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : undefined}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Активность за 14 дней</h2>
              <div className="rounded-2xl border border-border bg-card p-4">
                <ActivityChart data={dailyStats} />
                <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Полезные</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />Вредные</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Тепловая карта (12 недель)</h2>
              <div className="rounded-2xl border border-border bg-card p-4">
                <Heatmap habits={habits} />
              </div>
            </section>

            {beneficial.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Полезные привычки</h2>
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {beneficial.map((s) => <HabitStatRow key={s.habit.id} stat={s} />)}
                </div>
              </section>
            )}

            {harmful.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Вредные привычки</h2>
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {harmful.map((s) => <HabitStatRow key={s.habit.id} stat={s} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
