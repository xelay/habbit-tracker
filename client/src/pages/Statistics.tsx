import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Flame, Calendar, TrendingUp, Award } from "lucide-react";
import {
  getDailyStats,
  getHabitStats,
  getActiveDaysCount,
  getBestDay,
  getWeeklyStats,
  type DayStats,
  type HabitStat,
} from "@/lib/habits";

// ─── Micro bar chart (last 30 days) ─────────────────────────────────────────

function MiniBar({
  value,
  max,
  type,
  totalHeight,
}: {
  value: number;
  max: number;
  type: "beneficial" | "harmful";
  totalHeight: number; // px, высота всей зоны для масштабирования
}) {
  const pct = max === 0 ? 0 : value / max;
  const barPx = Math.max(Math.round(pct * totalHeight), 3); // мин 3px
  return (
    <div
      className={`w-full rounded-sm transition-all ${
        type === "beneficial"
          ? "bg-green-500 dark:bg-green-400"
          : "bg-red-400 dark:bg-red-500"
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
            {day.beneficial > 0 && (
              <MiniBar value={day.beneficial} max={maxBeneficial} type="beneficial" totalHeight={56} />
            )}
            {day.harmful > 0 && (
              <MiniBar value={day.harmful} max={maxHarmful} type="harmful" totalHeight={56} />
            )}
          </div>
        ))}
      </div>
      {/* Day labels */}
      <div className="flex gap-1 mt-1.5">
        {last14.map((day) => {
          const d = new Date(day.date);
          const label = d.toLocaleDateString("ru-RU", { weekday: "narrow" });
          return (
            <div key={day.date} className="flex-1 text-center text-[9px] text-muted-foreground">
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Heatmap (last 12 weeks) ─────────────────────────────────────────────────

function Heatmap({ data }: { data: DayStats[] }) {
  // build 12 weeks × 7 days grid
  const today = new Date();
  const cells: { date: string; score: number }[] = [];

  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const day = data.find((x) => x.date === ds);
    const score = day ? day.beneficial - day.harmful : 0;
    cells.push({ date: ds, score });
  }

  const maxScore = Math.max(...cells.map((c) => Math.abs(c.score)), 1);

  function cellColor(score: number) {
    if (score === 0) return "bg-muted";
    if (score > 0) {
      const intensity = Math.min(score / maxScore, 1);
      if (intensity > 0.66) return "bg-green-500 dark:bg-green-400";
      if (intensity > 0.33) return "bg-green-400 dark:bg-green-500 opacity-70";
      return "bg-green-300 dark:bg-green-600 opacity-50";
    }
    return "bg-red-400 dark:bg-red-500 opacity-60";
  }

  const weeks: typeof cells[] = [];
  for (let w = 0; w < 12; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  return (
    <div>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date}: ${cell.score > 0 ? "+" : ""}${cell.score}`}
                className={`rounded-[3px] aspect-square ${cellColor(cell.score)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
          Полезные
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />
          Вредные
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-muted inline-block" />
          Нет данных
        </span>
      </div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
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

// ─── Per-habit row ───────────────────────────────────────────────────────────

function HabitStatRow({ stat }: { stat: HabitStat }) {
  const { habit, total, lastWeek, streak, bestStreak } = stat;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      data-testid={`stat-row-${habit.id}`}
    >
      <span className="text-2xl w-8 text-center shrink-0">{habit.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{habit.name}</p>
        <p
          className={`text-xs ${
            habit.type === "beneficial"
              ? "text-green-600 dark:text-green-400"
              : "text-red-500"
          }`}
        >
          {habit.type === "beneficial" ? "Полезная" : "Вредная"}
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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Statistics() {
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [habitStats, setHabitStats] = useState<HabitStat[]>([]);
  const [activeDays, setActiveDays] = useState(0);
  const [bestDay, setBestDay] = useState<{ date: string; count: number } | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ beneficial: 0, harmful: 0, streak: 0 });

  useEffect(() => {
    setDailyStats(getDailyStats(84));
    setHabitStats(getHabitStats());
    setActiveDays(getActiveDaysCount());
    setBestDay(getBestDay());
    setWeeklyStats(getWeeklyStats());
  }, []);

  const beneficial = habitStats.filter((s) => s.habit.type === "beneficial");
  const harmful = habitStats.filter((s) => s.habit.type === "harmful");

  const hasAnyData = activeDays > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-md px-4 py-4 flex items-center gap-3">
          <Link href="/">
            <button
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="btn-back"
              aria-label="Назад"
            >
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
            <p className="text-sm text-muted-foreground mt-1">
              Начни отмечать привычки — статистика появится здесь
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Общий итог
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Flame size={15} className="text-orange-400" />}
                  label="Серия (дни)"
                  value={weeklyStats.streak}
                  sub="полезных подряд"
                />
                <StatCard
                  icon={<Calendar size={15} className="text-blue-400" />}
                  label="Активных дней"
                  value={activeDays}
                  sub="за всё время"
                />
                <StatCard
                  icon={<TrendingUp size={15} className="text-green-500" />}
                  label="Полезных за неделю"
                  value={weeklyStats.beneficial}
                />
                <StatCard
                  icon={<Award size={15} className="text-purple-400" />}
                  label="Лучший день"
                  value={bestDay ? bestDay.count : "—"}
                  sub={
                    bestDay
                      ? new Date(bestDay.date).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                        })
                      : undefined
                  }
                />
              </div>
            </section>

            {/* Bar chart: last 14 days */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Активность за 14 дней
              </h2>
              <div className="rounded-2xl border border-border bg-card p-4">
                <ActivityChart data={dailyStats} />
                <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />
                    Полезные
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />
                    Вредные
                  </span>
                </div>
              </div>
            </section>

            {/* Heatmap: last 12 weeks */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Тепловая карта (12 недель)
              </h2>
              <div className="rounded-2xl border border-border bg-card p-4">
                <Heatmap data={dailyStats} />
              </div>
            </section>

            {/* Per-habit breakdown */}
            {beneficial.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Полезные привычки
                </h2>
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {beneficial.map((s) => (
                    <HabitStatRow key={s.habit.id} stat={s} />
                  ))}
                </div>
              </section>
            )}

            {harmful.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Вредные привычки
                </h2>
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {harmful.map((s) => (
                    <HabitStatRow key={s.habit.id} stat={s} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
