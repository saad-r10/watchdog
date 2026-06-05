import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
  const isDown = stats?.lastStatus === "down";

  return (
    <motion.div whileHover={{ y: -2, transition: { duration: 0.15 } }}>
      <Link
        to={`/monitors/${monitor.id}`}
        className={`block bg-slate-900 rounded-xl border p-5 transition-colors duration-200 ${
          isDown
            ? "border-red-500/30 hover:border-red-500/50"
            : "border-slate-800 hover:border-violet-500/40"
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-white truncate">{monitor.name}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{monitor.url}</p>
          </div>
          <div className="ml-3 flex-shrink-0">
            <StatusBadge status={stats?.lastStatus ?? null} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 min-w-0">
          <div className="flex gap-5 min-w-0 flex-shrink-0">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Uptime</p>
              <p className={`text-xl font-bold ${isDown ? "text-red-400" : "text-white"}`}>
                {stats?.uptimePercent != null ? `${stats.uptimePercent}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Avg response</p>
              <p className="text-xl font-bold text-white">
                {stats?.avgResponseTime != null ? `${stats.avgResponseTime}ms` : "—"}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-shrink-0">
            <Sparkline values={sparklineData} color={isDown ? "#f87171" : "#8b5cf6"} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
