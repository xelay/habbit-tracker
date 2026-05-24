import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Bell, BellOff, Pencil, Sun, Moon, Monitor, RefreshCw, Copy, Check, ClipboardPaste, FileText } from "lucide-react";
import {
  PRESET_HABITS,
  ICON_CATALOG,
  getCustomHabits,
  addCustomHabit,
  updateCustomHabit,
  deleteCustomHabit,
  getSelectedPresetIds,
  setSelectedPresetIds,
  type Habit,
  type HabitType,
} from "@/lib/habits";
import {
  requestPushPermission,
  isPushEnabled,
} from "@/lib/push";
import { getSavedTheme, saveTheme, applyTheme, type ThemeMode } from "@/lib/theme";
import { getSyncGuid, syncWithGyxi, changeGuidAsync, getLastSyncTime, markThemeUpdated } from "@/lib/sync";
import { logKeyChange } from "@/lib/syncLog";

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Switch({
  checked,
  onChange,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ─── Habit form (add & edit) ──────────────────────────────────────────────────

function HabitForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Habit;
  onSave: (data: { name: string; icon: string; type: HabitType }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🎯");
  const [type, setType] = useState<HabitType>(initial?.type ?? "beneficial");

  const isEdit = !!initial;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-3 space-y-4">
      {isEdit && (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Редактирование
        </p>
      )}

      {/* Name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Название
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Медитация"
          data-testid="input-habit-name"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          maxLength={30}
          autoFocus
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Тип
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setType("beneficial")}
            data-testid="btn-type-beneficial"
            className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-colors ${
              type === "beneficial"
                ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "border-border text-muted-foreground"
            }`}
          >
            Полезная
          </button>
          <button
            onClick={() => setType("harmful")}
            data-testid="btn-type-harmful"
            className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-colors ${
              type === "harmful"
                ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "border-border text-muted-foreground"
            }`}
          >
            Вредная
          </button>
        </div>
      </div>

      {/* Icon picker */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Иконка
        </label>
        <div className="grid grid-cols-8 gap-1.5">
          {ICON_CATALOG.map(({ icon: ic }) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              data-testid={`icon-${ic}`}
              className={`aspect-square rounded-xl text-xl flex items-center justify-center transition-colors ${
                icon === ic
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
              title={ic}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={() => onSave({ name: name.trim(), icon, type })}
          disabled={!name.trim()}
          data-testid="btn-save-habit"
          className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isEdit ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </div>
  );
}

// ─── Main settings page ───────────────────────────────────────────────────────

export default function Settings() {
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [customHabits, setCustomHabits] = useState<Habit[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("system");
  // Form state: null = hidden, "new" = add, Habit = edit mode
  const [formTarget, setFormTarget] = useState<null | "new" | Habit>(null);

  // ── Sync state ────────────────────────────────────────────────────────────
  const [syncGuid, setSyncGuidState] = useState("");
  const [guidInput, setGuidInput] = useState("");
  const [guidEditing, setGuidEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "ok" | "err">("idle");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    setSelectedPresets(getSelectedPresetIds());
    setCustomHabits(getCustomHabits());
    setPushEnabled(isPushEnabled());
    setTheme(getSavedTheme());
    const g = getSyncGuid();
    setSyncGuidState(g);
    setGuidInput(g);
    setLastSync(getLastSyncTime());
  }, []);

  const handleSync = () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus("idle");
    syncWithGyxi();
    // syncWithGyxi is fire-and-forget — show spinner for 6s then clear
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      setSyncing(false);
      setLastSync(getLastSyncTime());
      setSyncStatus("idle");
    }, 6000);
  };

  // Общая логика применения нового GUID — сразу обновляет UI, сеть — в фоне
  const applyNewGuid = (newGuid: string) => {
    // Оптимистично: обновляем UI до сетевого запроса
    setSyncGuidState(newGuid);
    setGuidInput(newGuid);
    setGuidEditing(false);
    setSyncing(true);
    setSyncStatus("idle");
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    // Фоновая синхра — после завершения гасим спиннер и обновляем lastSync
    changeGuidAsync(newGuid, () => {
      setSyncing(false);
      setLastSync(getLastSyncTime());
      reload();
    });
    // Страховочный таймер: если сервер завис — снимаем спиннер через 14с не жда callback
    syncTimerRef.current = setTimeout(() => {
      setSyncing(false);
      setLastSync(getLastSyncTime());
    }, 14000);
  };

  const handleApplyGuid = () => {
    const newGuid = guidInput.trim();
    if (!newGuid || newGuid === syncGuid) {
      setGuidEditing(false);
      return;
    }
    logKeyChange(syncGuid, newGuid);
    applyNewGuid(newGuid);
  };

  const handleGenerateGuid = () => {
    const newGuid = crypto.randomUUID();
    logKeyChange(syncGuid, newGuid);
    applyNewGuid(newGuid);
  };

  const handleCopyGuid = () => {
    navigator.clipboard.writeText(syncGuid).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    reload();
  }, [reload]);

  // Перечитываем при обновлении данных через синхронизацию
  useEffect(() => {
    const onSyncUpdated = () => reload();
    window.addEventListener("sync:updated", onSyncUpdated);
    return () => window.removeEventListener("sync:updated", onSyncUpdated);
  }, [reload]);

  const handlePresetToggle = (id: string, enabled: boolean) => {
    const updated = enabled
      ? [...selectedPresets, id]
      : selectedPresets.filter((p) => p !== id);
    setSelectedPresets(updated);
    setSelectedPresetIds(updated);
    // Track explicit deselections so sync doesn't re-enable from remote
    try {
      const deselected: string[] = JSON.parse(localStorage.getItem("habit_tracker_deselected_presets") || "[]");
      if (!enabled && !deselected.includes(id)) {
        deselected.push(id);
        localStorage.setItem("habit_tracker_deselected_presets", JSON.stringify(deselected));
      } else if (enabled) {
        const filtered = deselected.filter((d) => d !== id);
        localStorage.setItem("habit_tracker_deselected_presets", JSON.stringify(filtered));
      }
    } catch { /* ignore */ }
    syncWithGyxi();
  };

  const handleSave = (data: { name: string; icon: string; type: HabitType }) => {
    if (!data.name) return;
    if (formTarget === "new") {
      addCustomHabit({ id: `custom_${Date.now()}`, ...data });
    } else if (formTarget && formTarget !== "new") {
      // Edit mode — ID сохраняется, логи не теряются
      updateCustomHabit(formTarget.id, data);
    }
    setCustomHabits(getCustomHabits());
    setFormTarget(null);
    syncWithGyxi();
  };

  const handleDelete = (id: string) => {
    deleteCustomHabit(id);
    setCustomHabits(getCustomHabits());
    // Если редактируем именно эту привычку — закрываем форму
    if (formTarget && formTarget !== "new" && formTarget.id === id) {
      setFormTarget(null);
    }
    syncWithGyxi();
  };

  const handleEdit = (habit: Habit) => {
    // Открыть форму для этой привычки (или закрыть если уже открыта)
    setFormTarget((prev) =>
      prev && prev !== "new" && (prev as Habit).id === habit.id ? null : habit
    );
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode);
    saveTheme(mode);
    markThemeUpdated();
    applyTheme(mode);
  };

  const handlePushToggle = async () => {
    if (!pushEnabled) {
      const granted = await requestPushPermission();
      setPushEnabled(granted);
    } else {
      localStorage.removeItem("habit_tracker_push");
      setPushEnabled(false);
    }
  };

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
          <h1 className="text-base font-bold">Настройки</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-8">

        {/* Theme */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Тема оформления
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {([
              { mode: "light" as ThemeMode, label: "Светлая", icon: <Sun size={16} /> },
              { mode: "dark"  as ThemeMode, label: "Тёмная",  icon: <Moon size={16} /> },
              { mode: "system" as ThemeMode, label: "Системная", icon: <Monitor size={16} /> },
            ]).map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => handleThemeChange(mode)}
                data-testid={`btn-theme-${mode}`}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 text-xs font-medium transition-colors ${
                  theme === mode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Push notifications */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Уведомления
          </h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">

            {/* Weekly summary */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-muted p-2">
                  {pushEnabled ? (
                    <Bell size={15} className="text-foreground" />
                  ) : (
                    <BellOff size={15} className="text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Еженедельные итоги</p>
                  <p className="text-xs text-muted-foreground">
                    Сводка раз в 7 дней
                  </p>
                </div>
              </div>
              <Switch checked={pushEnabled} onChange={handlePushToggle} testId="toggle-push" />
            </div>

          </div>
        </section>

        {/* ── Синхронизация ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Синхронизация
            </h2>
            <Link href="/log">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-open-log">
                <FileText size={13} />
                Журнал
              </button>
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">

            {/* GUID display row */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Ключ синхронизации</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopyGuid}
                    className="rounded-full p-1.5 hover:bg-muted transition-colors"
                    title="Скопировать ключ"
                    data-testid="btn-copy-guid"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-muted-foreground" />}
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="rounded-full p-1.5 hover:bg-muted transition-colors disabled:opacity-50"
                    title="Синхронизировать сейчас"
                    data-testid="btn-sync-now"
                  >
                    <RefreshCw size={14} className={`text-muted-foreground ${syncing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* GUID value or input */}
              {!guidEditing ? (
                <button
                  onClick={() => setGuidEditing(true)}
                  className="w-full text-left text-xs font-mono text-muted-foreground bg-muted rounded-xl px-3 py-2 hover:bg-muted/70 transition-colors break-all"
                  data-testid="btn-edit-guid"
                >
                  {syncGuid || "Генерируется..."}
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={guidInput}
                    onChange={(e) => setGuidInput(e.target.value)}
                    className="flex-1 text-xs font-mono bg-muted rounded-xl px-3 py-2 border border-input focus:outline-none focus:ring-2 focus:ring-ring break-all"
                    placeholder="Введите GUID..."
                    data-testid="input-guid"
                    autoFocus
                  />
                  <button
                    onClick={handleApplyGuid}
                    className="rounded-xl bg-foreground text-background text-xs px-3 py-1 font-medium"
                    data-testid="btn-apply-guid"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => { setGuidInput(syncGuid); setGuidEditing(false); }}
                    className="rounded-xl border border-border text-xs px-3 py-1"
                    data-testid="btn-cancel-guid"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Status + last sync */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {lastSync
                    ? `Синхр. ${new Date(lastSync).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                    : "Ещё не синхронизировалось"}
                </p>
                {syncStatus === "ok" && <span className="text-xs text-green-500">✓ Готово</span>}
                {syncStatus === "err" && <span className="text-xs text-red-500">✗ Ошибка</span>}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Установи одинаковый ключ на нескольких устройствах для шаринга данных.
                Нажми на ключ чтобы изменить.
              </p>
            </div>

            {/* Generate new GUID */}
            <button
              onClick={handleGenerateGuid}
              disabled={syncing}
              className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
              data-testid="btn-generate-guid"
            >
              <div className="rounded-full bg-muted p-2">
                <RefreshCw size={15} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Сгенерировать новый ключ</p>
                <p className="text-xs text-muted-foreground">Создаст новый GUID и перенесёт данные</p>
              </div>
            </button>

          </div>
        </section>

        {/* Preset habits */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Базовые привычки
          </h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {PRESET_HABITS.map((habit) => (
              <div key={habit.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{habit.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{habit.name}</p>
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
                </div>
                <Switch
                  checked={selectedPresets.includes(habit.id)}
                  onChange={(v) => handlePresetToggle(habit.id, v)}
                  testId={`toggle-preset-${habit.id}`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Custom habits */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Мои привычки
            </h2>
            <button
              onClick={() =>
                setFormTarget((prev) => (prev === "new" ? null : "new"))
              }
              data-testid="btn-add-habit"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
            >
              <Plus size={14} />
              Добавить
            </button>
          </div>

          {/* Add form */}
          {formTarget === "new" && (
            <HabitForm
              onSave={handleSave}
              onCancel={() => setFormTarget(null)}
            />
          )}

          {customHabits.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {customHabits.map((habit) => {
                const isEditing =
                  formTarget !== null &&
                  formTarget !== "new" &&
                  (formTarget as Habit).id === habit.id;

                return (
                  <div key={habit.id}>
                    {/* Row */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">{habit.icon}</span>
                        <div className="min-w-0">
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
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {/* Edit button */}
                        <button
                          onClick={() => handleEdit(habit)}
                          data-testid={`btn-edit-${habit.id}`}
                          aria-label={`Редактировать ${habit.name}`}
                          className={`rounded-lg p-1.5 transition-colors ${
                            isEditing
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Pencil size={15} />
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDelete(habit.id)}
                          data-testid={`btn-delete-${habit.id}`}
                          aria-label={`Удалить ${habit.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {isEditing && (
                      <div className="px-4 pb-4">
                        <HabitForm
                          initial={habit}
                          onSave={handleSave}
                          onCancel={() => setFormTarget(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            formTarget !== "new" && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Нет кастомных привычек
              </p>
            )
          )}
        </section>
      </main>
    </div>
  );
}
