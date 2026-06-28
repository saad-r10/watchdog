import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { api } from "../services/api";
import { MonitorCard } from "../components/MonitorCard";
import { StatusDot } from "../components/StatusDot";
import { WatchdogMark } from "../components/WatchdogMark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
  synthetic_failure: "Transaction failure",
  performance_degraded: "Performance degraded",
};

function IncidentRow({ incident }: { incident: DashboardIncident }) {
  return (
    <Link
      to={`/monitors/${incident.monitorId}`}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors group"
    >
      <StatusDot
        status={incident.isResolved ? "up" : "down"}
        pulse={!incident.isResolved}
        className="flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{incident.monitorName}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {INCIDENT_LABELS[incident.type] ?? incident.type}
          </span>
          {incident.isResolved ? (
            <span className="text-xs text-up font-medium">Resolved</span>
          ) : (
            <span className="text-xs text-down font-medium">Active</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">{incident.monitorUrl}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-muted-foreground">{timeAgo(incident.startedAt)}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          {incident.isResolved && incident.resolvedAt
            ? `lasted ${formatDuration(incident.startedAt, incident.resolvedAt)}`
            : `ongoing ${formatDuration(incident.startedAt, null)}`}
        </p>
      </div>
    </Link>
  );
}

const SectionLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h2 className={cn("text-xs font-semibold text-muted-foreground tracking-wide mb-4", className)}>
    {children}
  </h2>
);

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <StatusDot status="up" size="sm" />
            Live · refreshes every 30s
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link to="/monitors">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add monitor</span>
          </Link>
        </Button>
      </div>

      {/* Status banner */}
      {!isLoading && summary && summary.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-xl border px-6 py-4 mb-6 flex items-center gap-3",
            allOperational ? "bg-up/10 border-up/25" : "bg-down/10 border-down/25"
          )}
        >
          <StatusDot status={allOperational ? "up" : "down"} pulse={!allOperational || true} size="md" />
          <p className={cn("font-semibold", allOperational ? "text-up" : "text-down")}>
            {allOperational
              ? "All systems operational"
              : `${summary.down} monitor${summary.down !== 1 ? "s" : ""} down`}
          </p>
          {!allOperational && summary.activeIncidents > 0 && (
            <span className="ml-auto text-sm text-down">
              {summary.activeIncidents} active incident{summary.activeIncidents !== 1 ? "s" : ""}
            </span>
          )}
        </motion.div>
      )}

      {/* Stat tiles */}
      {!isLoading && summary && summary.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Monitored", value: summary.total, color: "text-foreground" },
            {
              label: "Online",
              value: summary.up,
              color: "text-up",
              sub: summary.unknown > 0 ? `${summary.unknown} unknown` : undefined,
            },
            { label: "Down", value: summary.down, color: summary.down > 0 ? "text-down" : "text-muted-foreground" },
            {
              label: "Avg uptime · 7d",
              value: summary.avgUptime != null ? `${summary.avgUptime}%` : "-",
              color:
                summary.avgUptime == null
                  ? "text-muted-foreground"
                  : summary.avgUptime >= 99
                    ? "text-up"
                    : summary.avgUptime >= 95
                      ? "text-degraded"
                      : "text-down",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-xl border border-border px-5 py-4">
              <p className="text-xs text-muted-foreground mb-2">{stat.label}</p>
              <p className={cn("text-3xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
              {stat.sub && <p className="text-xs text-muted-foreground/60 mt-1">{stat.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Active incidents */}
      {!isLoading && summary && summary.down > 0 && (
        <div className="mb-8">
          <SectionLabel className="text-down flex items-center gap-2">
            <StatusDot status="down" /> Active incidents
          </SectionLabel>
          <div className="bg-card rounded-xl border border-down/20 divide-y divide-border overflow-hidden">
            {recentIncidents
              .filter((i) => !i.isResolved)
              .map((incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
          </div>
        </div>
      )}

      {/* Monitor grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5">
              <div className="flex justify-between mb-5">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full ml-3" />
              </div>
              <div className="flex justify-between items-end">
                <div className="flex gap-5">
                  <Skeleton className="h-9 w-14" />
                  <Skeleton className="h-9 w-14" />
                </div>
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedMonitors.length === 0 ? (
        <div className="bg-card rounded-xl border border-border px-8 py-16 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <WatchdogMark className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Nothing on watch yet</h2>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            Add a URL and Watchdog will check it every minute - barking the moment it goes down.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isOnboardingDone() && (
              <Button onClick={() => navigate("/onboarding")}>Start setup guide</Button>
            )}
            <Button asChild variant={isOnboardingDone() ? "default" : "outline"}>
              <Link to="/monitors">Add monitor manually</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SectionLabel>All monitors</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedMonitors.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3 }}
              >
                <MonitorCard monitor={m} />
              </motion.div>
            ))}
          </div>

          {recentIncidents.length > 0 && (
            <div className="mt-10">
              <SectionLabel>Recent incidents</SectionLabel>
              <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
                {recentIncidents.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
