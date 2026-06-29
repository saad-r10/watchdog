import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface Props {
  monitorId: string;
}

const SNOOZE_OPTIONS: { label: string; hours: number }[] = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

export function ContentChangeCard({ monitorId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-content-change", monitorId],
    queryFn: () => api.monitors.contentChange(monitorId),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.monitors.update(monitorId, { contentChangeEnabled: enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitor-content-change", monitorId] });
      qc.invalidateQueries({ queryKey: ["monitor", monitorId] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: (hours: number) => api.monitors.snoozeContentChange(monitorId, hours),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitor-content-change", monitorId] }),
  });

  const enabled = data?.enabled ?? false;
  const snoozedUntil = data?.snoozedUntil ? new Date(data.snoozedUntil) : null;
  const isSnoozed = !!snoozedUntil && snoozedUntil > new Date();

  const badge = !enabled
    ? "bg-muted text-muted-foreground border-border"
    : isSnoozed
      ? "bg-degraded/10 text-degraded border-degraded/20"
      : "bg-up/10 text-up border-up/20";

  const label = !enabled ? "Disabled" : isSnoozed ? "Snoozed" : "Monitoring";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content Change Detection</h3>
        </div>
        {!isLoading && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge}`}>
            {label}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => toggleMutation.mutate(!enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${enabled ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-sm text-foreground">Alert me if the page content changes unexpectedly</span>
          </label>

          {enabled && (
            <div className="space-y-2 text-xs text-muted-foreground">
              {data?.lastHash && (
                <p>Page snapshot: <span className="font-mono text-foreground">{data.lastHash.slice(0, 12)}…</span></p>
              )}
              {data?.lastCheckedAt && (
                <p>Checked {new Date(data.lastCheckedAt).toLocaleString()}</p>
              )}
              {data?.lastChangedAt ? (
                <p className="text-degraded">Last change detected {new Date(data.lastChangedAt).toLocaleString()}</p>
              ) : (
                <p>No content changes detected yet.</p>
              )}
              {isSnoozed && snoozedUntil && (
                <p className="text-degraded">Snoozed until {snoozedUntil.toLocaleString()}</p>
              )}
            </div>
          )}

          {enabled && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Snooze:</span>
              {SNOOZE_OPTIONS.map((opt) => (
                <button key={opt.hours} type="button" onClick={() => snoozeMutation.mutate(opt.hours)}
                  disabled={snoozeMutation.isPending}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-border bg-muted text-foreground hover:border-primary/40 disabled:opacity-50 transition-colors">
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
