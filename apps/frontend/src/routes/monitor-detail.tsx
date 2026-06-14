import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { SslCard } from "../components/SslCard";
import { HeadersCard } from "../components/HeadersCard";
import { CertTransparencyCard } from "../components/CertTransparencyCard";
import { DnsCard } from "../components/DnsCard";
import { ExposureCard } from "../components/ExposureCard";
import { BlocklistCard } from "../components/BlocklistCard";
import { ResponseTimeChart, formatBytes } from "../components/ResponseTimeChart";
import type { ResponseTimeRange } from "@watchdog/shared-types";

function formatDuration(start: string, end?: string | null) {
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

const INCIDENT_LABELS: Record<string, { ongoing: string; resolved: string }> = {
  downtime: { ongoing: "Ongoing downtime", resolved: "Downtime" },
  ssl_expiry: { ongoing: "SSL certificate expiring", resolved: "SSL certificate expiry" },
  header_missing: { ongoing: "Missing security header", resolved: "Missing security header" },
  unexpected_cert: { ongoing: "New certificate detected", resolved: "New certificate detected" },
};

const RANGES: { label: string; value: ResponseTimeRange }[] = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [range, setRange] = useState<ResponseTimeRange>("24h");

  const { data: monitors = [] } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });
  const monitor = monitors.find((m) => m.id === id);

  const { data: stats } = useQuery({
    queryKey: ["monitor-stats", id],
    queryFn: () => api.monitors.stats(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ["monitor-checks", id, 50],
    queryFn: () => api.monitors.checks(id!, 50),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["monitor-incidents", id],
    queryFn: () => api.monitors.incidents(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: responseTimes = [] } = useQuery({
    queryKey: ["monitor-response-times", id, range],
    queryFn: () => api.monitors.responseTimes(id!, range),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const { data: maintenanceWindows = [] } = useQuery({
    queryKey: ["monitor-maintenance", id],
    queryFn: () => api.monitors.maintenance.list(id!),
    enabled: !!id,
  });

  const now = new Date();
  const isInMaintenance = maintenanceWindows.some(
    (w) => new Date(w.startsAt) <= now && new Date(w.endsAt) >= now
  );

  const [mForm, setMForm] = useState({ startsAt: "", endsAt: "", description: "" });

  const createMaintenanceMutation = useMutation({
    mutationFn: () => api.monitors.maintenance.create(id!, {
      startsAt: new Date(mForm.startsAt).toISOString(),
      endsAt: new Date(mForm.endsAt).toISOString(),
      description: mForm.description || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitor-maintenance", id] });
      setMForm({ startsAt: "", endsAt: "", description: "" });
    },
  });

  const deleteMaintenanceMutation = useMutation({
    mutationFn: (windowId: string) => api.monitors.maintenance.delete(id!, windowId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitor-maintenance", id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.monitors.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      navigate("/monitors");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => api.monitors.update(id!, { paused }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });

  if (!monitor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Monitor not found.{" "}
          <a href="/dashboard" className="text-primary hover:underline">
            Back to dashboard
          </a>
        </p>
      </div>
    );
  }

  const isDown = stats?.lastStatus === "down";

  return (
    <div className="p-4 sm:p-8 max-w-5xl space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{monitor.name}</h1>
            <StatusBadge status={stats?.lastStatus ?? null} paused={monitor.paused} />
            {isInMaintenance && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-degraded/10 border border-degraded/30 text-degraded font-medium">
                Maintenance
              </span>
            )}
          </div>
          <a
            href={monitor.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {monitor.url} ↗
          </a>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => pauseMutation.mutate(!monitor.paused)}
            disabled={pauseMutation.isPending}
            className={`text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 ${
              monitor.paused
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {monitor.paused ? (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                Pause
              </>
            )}
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this monitor and all its data?")) deleteMutation.mutate();
            }}
            className="text-xs text-muted-foreground/60 hover:text-down transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Uptime (7d)",
            value: stats?.uptimePercent != null ? `${stats.uptimePercent}%` : "—",
            color: isDown ? "text-down" : "text-up",
          },
          {
            label: "Avg response",
            value: stats?.avgResponseTime != null ? `${stats.avgResponseTime}ms` : "—",
            color: "text-foreground",
          },
          {
            label: "Checks (7d)",
            value: stats?.totalChecks ?? "—",
            color: "text-primary",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-card rounded-xl border border-border px-6 py-5"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Response time chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Response time</p>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  range === r.value
                    ? "bg-primary text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <ResponseTimeChart data={responseTimes} range={range} />
      </motion.div>

      {/* SSL + Headers + DNS + Exposure + Blocklist */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SslCard monitorId={monitor.id} />
        <HeadersCard monitorId={monitor.id} />
        <CertTransparencyCard monitorId={monitor.id} />
        <DnsCard monitorId={monitor.id} />
        <ExposureCard monitorId={monitor.id} />
        <BlocklistCard monitorId={monitor.id} />
      </div>

      {/* Maintenance windows */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">Maintenance windows</h3>
        </div>

        <div className="px-6 py-5 border-b border-border">
          <form
            className="grid grid-cols-2 gap-3"
            onSubmit={(e) => { e.preventDefault(); createMaintenanceMutation.mutate(); }}
          >
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Start</label>
              <input
                type="datetime-local"
                required
                value={mForm.startsAt}
                onChange={(e) => setMForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">End</label>
              <input
                type="datetime-local"
                required
                value={mForm.endsAt}
                onChange={(e) => setMForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              />
            </div>
            <div className="col-span-2 flex gap-3">
              <input
                type="text"
                placeholder="Description (optional)"
                value={mForm.description}
                onChange={(e) => setMForm((f) => ({ ...f, description: e.target.value }))}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              />
              <button
                type="submit"
                disabled={createMaintenanceMutation.isPending}
                className="bg-primary text-foreground px-4 py-2 rounded-lg hover:bg-primary disabled:opacity-50 text-sm font-medium transition-colors whitespace-nowrap"
              >
                {createMaintenanceMutation.isPending ? "Scheduling…" : "Schedule"}
              </button>
            </div>
            {createMaintenanceMutation.isError && (
              <p className="col-span-2 text-down text-xs">Failed — check that end is after start.</p>
            )}
          </form>
        </div>

        {maintenanceWindows.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">No upcoming maintenance windows.</p>
        ) : (
          <div className="divide-y divide-border">
            {maintenanceWindows.map((w) => {
              const active = new Date(w.startsAt) <= now && new Date(w.endsAt) >= now;
              return (
                <div key={w.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-degraded/10 border border-degraded/30 text-degraded flex-shrink-0">
                        Active
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{w.description ?? "Maintenance"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(w.startsAt).toLocaleString()} → {new Date(w.endsAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMaintenanceMutation.mutate(w.id)}
                    disabled={deleteMaintenanceMutation.isPending}
                    className="ml-4 text-xs text-muted-foreground/60 hover:text-down disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="bg-card rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">Incidents</h3>
          </div>
          <div className="divide-y divide-border">
            {incidents.map((inc) => {
              const labels = INCIDENT_LABELS[inc.type] ?? { ongoing: "Ongoing incident", resolved: "Incident" };
              return (
                <div key={inc.id} className="px-6 py-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${inc.isResolved ? "bg-muted" : "bg-down"}`}
                    />
                    <span className={inc.isResolved ? "text-muted-foreground" : "text-down"}>
                      {inc.isResolved ? labels.resolved : labels.ongoing}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{new Date(inc.startedAt).toLocaleString()}</p>
                    {(inc.type === "downtime" || inc.type === "ssl_expiry") && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {inc.isResolved
                          ? `Resolved after ${formatDuration(inc.startedAt, inc.resolvedAt)}`
                          : `Ongoing — ${formatDuration(inc.startedAt)}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metrics */}
      {checks.some((c) => c.type === "metric") && (
        <div className="bg-card rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">System metrics</h3>
          </div>
          {(() => {
            const metricNames = [...new Set(checks.filter((c) => c.type === "metric" && c.metricName).map((c) => c.metricName!))];
            return (
              <div className="divide-y divide-border">
                {metricNames.map((name) => {
                  const latest = checks.find((c) => c.type === "metric" && c.metricName === name);
                  const history = checks.filter((c) => c.type === "metric" && c.metricName === name).slice(0, 10).reverse();
                  const unit = name === "load" ? "" : "%";
                  const isHigh = latest?.status === "down";
                  return (
                    <div key={name} className="px-6 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground capitalize">{name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${isHigh ? "bg-down/10 text-down" : "bg-up/10 text-up"}`}>
                            {latest?.metricValue != null ? `${latest.metricValue}${unit}` : "—"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {latest ? new Date(latest.checkedAt).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <div className="flex items-end gap-1 h-8">
                        {history.map((c, i) => {
                          const pct = c.metricValue != null ? Math.min(c.metricValue, 100) : 0;
                          const bad = c.status === "down";
                          return (
                            <div
                              key={i}
                              title={`${c.metricValue}${unit} at ${new Date(c.checkedAt).toLocaleTimeString()}`}
                              style={{ height: `${Math.max(pct, 4)}%` }}
                              className={`flex-1 rounded-sm transition-colors ${bad ? "bg-down/60" : "bg-primary/60"}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Recent checks */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Recent checks</h3>
        </div>
        {checks.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No checks yet — the worker runs every minute.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {checks.filter((c) => c.type !== "metric").map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold tracking-wide ${
                      c.status === "up" ? "text-up" : "text-down"
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                  {c.statusCode && (
                    <span className="text-xs text-muted-foreground/60 font-mono">HTTP {c.statusCode}</span>
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs text-muted-foreground">
                  {c.sizeBytes != null && (
                    <span className="font-mono text-muted-foreground/60">{formatBytes(c.sizeBytes)}</span>
                  )}
                  {c.responseTime != null && (
                    <span className="font-mono text-muted-foreground">{c.responseTime}ms</span>
                  )}
                  <span>{new Date(c.checkedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
