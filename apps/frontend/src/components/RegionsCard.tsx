import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { StatusDot, type DotStatus } from "./StatusDot";
import type { Monitor } from "@watchdog/shared-types";

interface Props {
  monitor: Monitor;
}

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RegionsCard({ monitor }: Props) {
  const qc = useQueryClient();

  const { data: regions = [], isLoading } = useQuery({
    queryKey: ["monitor-regions", monitor.id],
    queryFn: () => api.monitors.regions(monitor.id),
    refetchInterval: 30_000,
  });

  const thresholdMutation = useMutation({
    mutationFn: (regionDownThreshold: number) => api.monitors.update(monitor.id, { regionDownThreshold }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regions</h3>
        {monitor.agents.length >= 2 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Alert when down from</span>
            <select
              className="bg-muted border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              value={monitor.regionDownThreshold}
              onChange={(e) => thresholdMutation.mutate(Number(e.target.value))}
            >
              {Array.from({ length: monitor.agents.length }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>of {monitor.agents.length} regions</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {regions.map((r) => (
            <div key={r.agentId ?? "cloud"} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <StatusDot status={(r.status ?? "unknown") as DotStatus} />
                <span className="text-sm text-foreground truncate">{r.label}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                {r.responseTime != null && <span className="font-mono">{r.responseTime}ms</span>}
                <span>{timeSince(r.checkedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
