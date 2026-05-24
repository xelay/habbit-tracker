import { useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Statistics from "@/pages/Statistics";
import Log from "@/pages/Log";
import NotFound from "@/pages/not-found";
import { getWeeklyStats } from "@/lib/habits";
import { checkAndSendWeeklyPush } from "@/lib/push";
import { getSavedTheme, applyTheme } from "@/lib/theme";
import { syncWithGyxi } from "@/lib/sync";

function useTheme() {
  useEffect(() => {
    // Применяем сохранённую тему при запуске
    applyTheme(getSavedTheme());

    // Если тема "system" — следим за изменением системной
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getSavedTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);
}

function App() {
  useTheme();

  useEffect(() => {
    // Первый запуск
    const stats = getWeeklyStats();
    checkAndSendWeeklyPush(stats.beneficial, stats.harmful, stats.streak);
    syncWithGyxi();

    // Синхронизация при возврате из фона — только в PWA режиме
    const isPWA = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isPWA) {
      const onVisible = () => {
        if (document.visibilityState === "visible") {
          syncWithGyxi();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
  }, []);

  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/settings" component={Settings} />
        <Route path="/statistics" component={Statistics} />
        <Route path="/log" component={Log} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </Router>
  );
}

export default App;
