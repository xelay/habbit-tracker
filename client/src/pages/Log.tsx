import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Key, WifiOff, RefreshCw } from "lucide-react";
import { getSyncLog, clearSyncErrors, SyncEvent } from "@/lib/syncLog";
import { getSyncGuid, getLastSyncTime } from "@/lib/sync";

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function maskGuid(guid: string): string {
  if (!guid || guid.length < 8) return guid;
  return guid.slice(0, 8) + "..." + guid.slice(-4);
}

export default function Log() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [guid, setGuid] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);

  function reload() {
    setEvents(getSyncLog());
    setGuid(getSyncGuid());
    setLastSync(getLastSyncTime());
  }

  useEffect(() => {
    reload();
  }, []);

  const keyChanges = events.filter((e) => e.type === "key_change");
  const syncErrors = events.filter((e) => e.type === "sync_error");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-3">
        <Link href="/settings">
          <button className="flex items-center justify-center rounded-full p-2 hover:bg-muted transition-colors" data-testid="btn-back-to-settings">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <h1 className="text-base font-semibold">Журнал синхронизации</h1>
        <button
          onClick={reload}
          className="ml-auto flex items-center justify-center rounded-full p-2 hover:bg-muted transition-colors"
          data-testid="btn-refresh-log"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Current GUID */}
        <div className="rounded-2xl border border-border bg-card px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Текущий ключ</p>
          <p className="text-sm font-mono break-all select-all" data-testid="text-current-guid">{guid || "—"}</p>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Последняя синхронизация: {new Date(lastSync).toLocaleString("ru-RU", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Key Changes */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Key size={13} />
            Смена ключа ({keyChanges.length})
          </h2>

          {keyChanges.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-4 text-center">
              <p className="text-sm text-muted-foreground">Ключ ещё не менялся</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {keyChanges.map((e) => (
                <div key={e.id} className="px-4 py-3 space-y-2" data-testid={`event-key-${e.id}`}>
                  <p className="text-xs text-muted-foreground">{formatTs(e.ts)}</p>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">Был</span>
                      <span className="text-xs font-mono text-muted-foreground break-all bg-muted px-2 py-0.5 rounded-lg">
                        {e.oldKey || "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">Стал</span>
                      <span className="text-xs font-mono break-all bg-muted px-2 py-0.5 rounded-lg">
                        {e.newKey || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sync Errors */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <WifiOff size={13} />
              Ошибки связи ({syncErrors.length} / последние 10)
            </h2>
            {syncErrors.length > 0 && (
              <button
                onClick={() => { clearSyncErrors(); reload(); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                data-testid="btn-clear-errors"
              >
                Очистить
              </button>
            )}
          </div>

          {syncErrors.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-4 text-center">
              <p className="text-sm text-muted-foreground">Ошибок нет</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {syncErrors.map((e) => (
                <div key={e.id} className="px-4 py-3 space-y-1" data-testid={`event-error-${e.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{formatTs(e.ts)}</p>
                    {e.status && (
                      <span className="text-xs font-mono bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                        HTTP {e.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{e.message}</p>
                  {e.endpoint && (
                    <p className="text-xs text-muted-foreground font-mono break-all">{e.endpoint}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
