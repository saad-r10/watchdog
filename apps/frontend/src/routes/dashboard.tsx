import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";
import { MonitorCard } from "../components/MonitorCard";
import { isOnboardingDone } from "./onboarding";
import type { DashboardIncident } from "@watchdog/shared-types";

function formatDuration(startedAt: string, resolvedAt: string | null): string {
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  const ms = end.getTime() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const INCIDENT_LABELS: Record<string, string> = {
  downtime: "Downtime",
  ssl_expiry: "SSL expiry",
  header_missing: "Missing headers",
};

function IncidentRow({ incident }: { incident: DashboardIncident }) {
  return (
    <Link
      to={`/monitors/${incident.monitorId}`}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/50 transition-colors group"
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          incident.isResolved ? "bg-emerald-500" : "bg-red-500 animate-pulse"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white truncate">{incident.monitorName}</span>
          <span className="text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-800">
            {INCIDENT_LABELS[incident.type] ?? incident.type}
          </span>
          {incident.isResolved ? (
            <span className="text-xs text-emerald-500 font-medium">Resolved</span>
          ) : (
            <span className="text-xs text-red-400 font-medium">Active</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{incident.monitorUrl}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-slate-400">{timeAgo(incident.startedAt)}</p>
        <p className="text-xs text-slate-600 mt-0.5">
          {incident.isResolved && incident.resolvedAt
            ? `lasted ${formatDuration(incident.startedAt, incident.resolvedAt)}`
            : `ongoing ${formatDuration(incident.startedAt, null)}`}
        </p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard.get,
    refetchInterval: 30_000,
  });

  const { data: monitors = [], isLoading: monitorsLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
    refetchInterval: 30_000,
  });

  const isLoading = overviewLoading || monitorsLoading;
  const summary = overview?.summary;
  const recentIncidents = overview?.recentIncidents ?? [];

  const allOperational = summary ? summary.down === 0 && summary.activeIncidents === 0 : true;

  // Sort: down monitors first
  const sortedMonitors = [...monitors].sort((a, b) => {
    const aDown = recentIncidents.some((i) => i.monitorId === a.id && !i.isResolved);
    const bDown = recentIncidents.some((i) => i.monitorId === b.id && !i.isResolved);
    if (aDown && !bDown) return -1;
    if (!aDown && bDown) return 1;
    return 0;
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Auto-refreshes every 30 seconds</p>
        </div>
        <Link
          to="/monitors"
          className="flex items-center gap-2 bg-violet-600 text-white text-sm px-3 sm:px-4 py-2.5 rounded-lg hover:bg-violet-700 transition-colors font-medium shadow-lg shadow-violet-500/20 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Add monitor</span>
        </Link>
      </div>

      {/* Status banner */}
      {!isLoading && summary && summary.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border px-6 py-4 mb-6 flex items-center gap-3 ${
            allOperational
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-red-500/10 border-red-500/30"
          }`}
        >
          <span
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              allOperational ? "bg-emerald-500" : "bg-red-500 animate-pulse"
            }`}
          />
          <p className={`font-semibold ${allOperational ? "text-emerald-400" : "text-red-400"}`}>
            {allOperational
              ? "All systems operational"
              : `${summary.down} monitor${summary.down !== 1 ? "s" : ""} down`}
          </p>
          {!allOperational && summary.activeIncidents > 0 && (
            <span className="ml-auto text-sm text-red-400">
              {summary.activeIncidents} active incident{summary.activeIncidents !== 1 ? "s" : ""}
            </span>
          )}
        </motion.div>
      )}

      {/* Stat tiles */}
      {!isLoading && summary && summary.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Monitored", value: summary.total, color: "text-white" },
            {
              label: "Online",
              value: summary.up,
              color: summary.up === summary.total ? "text-emerald-400" : "text-emerald-400",
              sub: summary.unknown > 0 ? `${summary.unknown} unknown` : undefined,
            },
            {
              label: "Down",
              value: summary.down,
              color: summary.down > 0 ? "text-red-400" : "text-slate-500",
            },
            {
              label: "Avg uptime (7d)",
              value: summary.avgUptime != null ? `${summary.avgUptime}%` : "—",
              color:
                summary.avgUptime == null
                  ? "text-slate-500"
                  : summary.avgUptime >= 99
                  ? "text-emerald-400"
                  : summary.avgUptime >= 95
                  ? "text-yellow-400"
                  : "text-red-400",
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 rounded-xl border border-slate-800 px-6 py-5"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              {stat.sub && <p className="text-xs text-slate-600 mt-1">{stat.sub}</p>}
            </motion.div>
          ))}
        </div>
      )}

      {/* Active incidents */}
      {!isLoading && summary && summary.down > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            Active incidents
          </h2>
          <div className="bg-slate-900 rounded-xl border border-red-500/20 divide-y divide-slate-800 overflow-hidden">
            {recentIncidents
              .filter((i) => !i.isResolved)
              .map((incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
          </div>
        </motion.div>
      )}

      {/* Monitor grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-5 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-800 rounded w-2/3" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                </div>
                <div className="h-6 bg-slate-800 rounded-full w-20 ml-3" />
              </div>
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <div className="h-3 bg-slate-800 rounded w-12" />
                  <div className="h-6 bg-slate-800 rounded w-16" />
                </div>
                <div className="h-9 bg-slate-800 rounded w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedMonitors.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-xl border border-slate-800 px-8 py-16 text-center max-w-lg mx-auto"
        >
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No monitors yet</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Add a URL and Watchdog will check it every minute — alerting you the moment it goes down.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isOnboardingDone() && (
              <button
                onClick={() => navigate("/onboarding")}
                className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
              >
                Start setup guide
              </button>
            )}
            <Link
              to="/monitors"
              className={`px-5 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                isOnboardingDone()
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              Add monitor manually
            </Link>
          </div>
        </motion.div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            All monitors
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedMonitors.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <MonitorCard monitor={m} />
              </motion.div>
            ))}
          </div>

          {/* Recent incident history */}
          {recentIncidents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10"
            >
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Recent incidents
              </h2>
              <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
                {recentIncidents.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} />
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
