// Push notifications via Web Notifications API
// Проверки выполняются при открытии приложения — бэкенд не нужен.

const PUSH_KEY = "habit_tracker_push";
const LAST_WEEKLY_KEY = "habit_tracker_last_weekly";

// ─── Permission ───────────────────────────────────────────────────────────────

export function isPushEnabled(): boolean {
  return localStorage.getItem(PUSH_KEY) === "granted";
}

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    localStorage.setItem(PUSH_KEY, "granted");
    return true;
  }
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  if (result === "granted") {
    localStorage.setItem(PUSH_KEY, "granted");
    return true;
  }
  return false;
}

// ─── Weekly summary check ─────────────────────────────────────────────────────

export function checkAndSendWeeklyPush(
  beneficial: number,
  harmful: number,
  streak: number
): void {
  if (!isPushEnabled()) return;
  if (Notification.permission !== "granted") return;

  const lastStr = localStorage.getItem(LAST_WEEKLY_KEY);
  if (!lastStr) {
    localStorage.setItem(LAST_WEEKLY_KEY, new Date().toISOString());
    return;
  }

  const diffDays =
    (Date.now() - new Date(lastStr).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return;

  let body = "";
  if (beneficial > 0 && harmful === 0)
    body = `Отличная неделя! ${beneficial} полезных, ни одной вредной. Так держать!`;
  else if (beneficial > harmful)
    body = `Неплохо! Полезных: ${beneficial}, вредных: ${harmful}.`;
  else if (beneficial === 0 && harmful > 0)
    body = `Вредных за неделю: ${harmful}. Попробуем лучше?`;
  else if (beneficial > 0)
    body = `Полезных: ${beneficial}, вредных: ${harmful}.`;
  else
    body = `На этой неделе не было отмечено привычек. Не забывай про себя!`;

  if (streak > 0) body += ` Серия: ${streak} дн.`;

  new Notification("🎉 Итоги недели", {
    body,
    icon: "/habbit-tracker/icon-192.png",
    badge: "/habbit-tracker/icon-72.png",
    tag: "weekly-habit-summary",
  });

  localStorage.setItem(LAST_WEEKLY_KEY, new Date().toISOString());
}
