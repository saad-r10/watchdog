import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { api } from "../services/api";
import { StatusBadge } from "./StatusBadge";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";
import type { Monitor } from "@watchdog/shared-types";

export function MonitorCard({ monitor }: { monitor: Monitor }) {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["monitor-stats", monitor.id],
    queryFn: () => api.monitors.stats(monitor.id),
    refetchInterval: monitor.paused ? false : 30_000,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ["monitor-checks", monitor.id, 20],
    queryFn: () => api.monitors.checks(monitor.id, 20),
    refetchInterval: monitor.paused ? false : 30_000,
  });

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => api.monitors.update(monitor.id, { paused }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });

  const sparklineData = [...checks].reverse().map((c) => c.responseTime ?? null);
  const isDown = stats?.lastStatus === "down";

  return (
    <motion.div whileHover={{ y: -2, transition: { duration: 0.15 } }}>
      <Link
        to={`/monitors/${monitor.id}`}
        className={cn(
          "group block bg-card rounded-xl border p-5 transition-colors duration-200",
          isDown ? "border-down/30 hover:border-down/50" : "border-border hover:border-primary/40"
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold text-sm truncate", monitor.paused ? "text-muted-foreground" : "text-foreground")}>
              {monitor.name}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">{monitor.url}</p>
          </div>
          <div className="ml-3 flex-shrink-0 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                pauseMutation.mutate(!monitor.paused);
              }}
              disabled={pauseMutation.isPending}
              title={monitor.paused ? "Resume monitoring" : "Pause monitoring"}
              className="text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              {monitor.paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
            <StatusBadge status={stats?.lastStatus ?? null} paused={monitor.paused} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 min-w-0">
          <div className="flex gap-5 min-w-0 flex-shrink-0">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Uptime</p>
              <p className={cn("text-xl font-bold tabular-nums", isDown ? "text-down" : "text-foreground")}>
                {stats?.uptimePercent != null ? `${stats.uptimePercent}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Avg response</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {stats?.avgResponseTime != null ? `${stats.avgResponseTime}ms` : "—"}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-shrink-0">
            <Sparkline values={sparklineData} color={isDown ? "#F85149" : "#F5A623"} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
