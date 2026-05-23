import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { SslCard } from "../components/SslCard";
import { HeadersCard } from "../components/HeadersCard";
import type { ResponseTimeRange } from "@watchdog/shared-types";

function formatDuration(start: string, end?: string | null) {
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

const RANGES: { label: string; value: ResponseTimeRange }[] = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

function formatBucket(iso: string, range: ResponseTimeRange) {
  const d = new Date(iso);
  if (range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "7d") return d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function makeChartTooltip(range: ResponseTimeRange) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function ChartTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs shadow-xl space-y-1">
        <p className="text-slate-400">{formatBucket(d.bucket, range)}</p>
        {d.avgMs != null ? (
          <>
            <p className="text-violet-400 font-semibold">{d.avgMs}ms avg</p>
            {d.minMs != null && d.maxMs != null && d.minMs !== d.maxMs && (
              <p className="text-slate-500">{d.minMs}–{d.maxMs}ms range</p>
            )}
          </>
        ) : (
          <p className="text-red-400 font-semibold">Down</p>
        )}
        {d.hasDown && d.avgMs != null && <p className="text-red-400">⚠ Downtime in this period</p>}
      </div>
    );
  };
}

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

  const deleteMutation = useMutation({
    mutationFn: () => api.monitors.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      navigate("/monitors");
    },
  });

  const downDots = responseTimes
    .filter((r) => r.hasDown && r.avgMs == null)
    .map((r) => r.bucket);

  if (!monitor) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">
          Monitor not found.{" "}
          <a href="/dashboard" className="text-violet-400 hover:underline">
            Back to dashboard
          </a>
        </p>
      </div>
    );
  }

  const isDown = stats?.lastStatus === "down";

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{monitor.name}</h1>
            <StatusBadge status={stats?.lastStatus ?? null} />
          </div>
          <a
            href={monitor.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-400 hover:text-violet-400 transition-colors"
          >
            {monitor.url} ↗
          </a>
        </div>
        <button
          onClick={() => {
            if (confirm("Delete this monitor and all its data?")) deleteMutation.mutate();
          }}
          className="text-xs text-slate-600 hover:text-red-400 transition-colors mt-1"
        >
          Delete monitor
        </button>
      </motion.div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Uptime (7d)",
            value: stats?.uptimePercent != null ? `${stats.uptimePercent}%` : "—",
            color: isDown ? "text-red-400" : "text-emerald-400",
          },
          {
            label: "Avg response",
            value: stats?.avgResponseTime != null ? `${stats.avgResponseTime}ms` : "—",
            color: "text-white",
          },
          {
            label: "Checks (7d)",
            value: stats?.totalChecks ?? "—",
            color: "text-violet-400",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-slate-900 rounded-xl border border-slate-800 px-6 py-5"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Response time chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900 rounded-xl border border-slate-800 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Response time</p>
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  range === r.value
                    ? "bg-violet-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {responseTimes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">No data for this period yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={responseTimes} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="bucket"
                stroke="#334155"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tickFormatter={(v) => formatBucket(v, range)}
              />
              <YAxis
                stroke="#334155"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                unit="ms"
                width={52}
              />
              <Tooltip content={makeChartTooltip(range)} />
              <Line
                type="monotone"
                dataKey="avgMs"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                connectNulls={false}
              />
              {downDots.map((bucket) => (
                <ReferenceDot
                  key={bucket}
                  x={bucket}
                  y={0}
                  r={4}
                  fill="#f87171"
                  stroke="none"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* SSL + Headers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SslCard monitorId={monitor.id} />
        <HeadersCard monitorId={monitor.id} />
      </div>

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-sm font-semibold text-white">Incidents</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {incidents.map((inc) => (
              <div key={inc.id} className="px-6 py-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${inc.isResolved ? "bg-slate-600" : "bg-red-500"}`}
                  />
                  <span className={inc.isResolved ? "text-slate-400" : "text-red-400"}>
                    {inc.isResolved ? "Downtime" : "Ongoing downtime"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{new Date(inc.startedAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {inc.isResolved
                      ? `Resolved after ${formatDuration(inc.startedAt, inc.resolvedAt)}`
                      : `Ongoing — ${formatDuration(inc.startedAt)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent checks */}
      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Recent checks</h3>
        </div>
        {checks.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">
            No checks yet — the worker runs every minute.
          </p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {checks.map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold tracking-wide ${
                      c.status === "up" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                  {c.statusCode && (
                    <span className="text-xs text-slate-600 font-mono">HTTP {c.statusCode}</span>
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs text-slate-500">
                  {c.responseTime != null && (
                    <span className="font-mono text-slate-400">{c.responseTime}ms</span>
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
