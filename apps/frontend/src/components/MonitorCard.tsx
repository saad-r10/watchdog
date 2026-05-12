import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { StatusBadge } from "./StatusBadge";
import { Sparkline } from "./Sparkline";
import type { Monitor } from "@watchdog/shared-types";

export function MonitorCard({ monitor }: { monitor: Monitor }) {
  const { data: stats } = useQuery({
    queryKey: ["monitor-stats", monitor.id],
    queryFn: () => api.monitors.stats(monitor.id),
    refetchInterval: 30_000,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ["monitor-checks", monitor.id, 20],
    queryFn: () => api.monitors.checks(monitor.id, 20),
    refetchInterval: 30_000,
  });

  const sparklineData = [...checks].reverse().map((c) => c.responseTime ?? null);

  return (
    <Link
      to={`/monitors/${monitor.id}`}
      className="block bg-white rounded-lg border p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{monitor.name}</p>
          <p className="text-xs text-gray-400 truncate">{monitor.url}</p>
        </div>
        <StatusBadge status={stats?.lastStatus ?? null} />
      </div>

      <div className="flex items-end justify-between">
        <div className="flex gap-4 text-xs text-gray-500">
          <div>
            <p className="text-gray-400">Uptime</p>
            <p className="font-semibold text-gray-800">
              {stats?.uptimePercent != null ? `${stats.uptimePercent}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Avg response</p>
            <p className="font-semibold text-gray-800">
              {stats?.avgResponseTime != null ? `${stats.avgResponseTime}ms` : "—"}
            </p>
          </div>
        </div>
        <Sparkline
          values={sparklineData}
          color={stats?.lastStatus === "down" ? "#ef4444" : "#3b82f6"}
        />
      </div>
    </Link>
  );
}
