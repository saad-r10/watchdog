import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/StatusDot";
import { UptimeBars } from "@/components/UptimeBars";
import { Sparkline } from "@/components/Sparkline";
import type { DailyBar } from "@watchdog/shared-types";
import { Check, Terminal, Bell } from "lucide-react";

/* ── Demo data ── */
function makeBars(downDays: number[] = []): DailyBar[] {
  return Array.from({ length: 90 }, (_, i) => {
    const date = new Date(Date.now() - (89 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const uptimePercent = downDays.includes(i) ? 86 + (i % 5) : 100;
    return { date, uptimePercent };
  });
}

export const demoMonitors = [
  { name: "api.acme.com", url: "https://api.acme.com/health", status: "up" as const, uptime: "99.99%", ms: 84, bars: makeBars() },
  { name: "Marketing site", url: "https://acme.com", status: "up" as const, uptime: "100%", ms: 142, bars: makeBars() },
  { name: "checkout-service", url: "https://pay.acme.com", status: "degraded" as const, uptime: "98.7%", ms: 612, bars: makeBars([71, 72]) },
  { name: "status-internal", url: "10.0.2.14:8080", status: "up" as const, uptime: "99.95%", ms: 23, bars: makeBars([40]) },
];

const demoLatency = [142, 138, 151, 144, 139, 162, 148, 141, 137, 158, 149, 143, 140, 155, 146, 142];

/* ── Shared card shell - fixed-width in the hero wall, fluid in the feature grid ── */
function PreviewCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {children}
    </div>
  );
}

/* ── Mini-mockups ── */
export function PreviewMonitor({
  name,
  url,
  status,
  uptime,
  bars,
  className,
}: {
  name: string;
  url: string;
  status: "up" | "degraded" | "down";
  uptime: string;
  bars: DailyBar[];
  className?: string;
}) {
  return (
    <PreviewCard className={className}>
      <div className="flex items-center gap-2.5 mb-3">
        <StatusDot status={status} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground truncate font-mono">{url}</p>
        </div>
        <p
          className={cn(
            "text-sm font-medium tabular-nums flex-shrink-0",
            status === "degraded" ? "text-degraded" : status === "down" ? "text-down" : "text-foreground"
          )}
        >
          {uptime}
        </p>
      </div>
      <UptimeBars bars={bars.slice(-30)} height="h-4" />
    </PreviewCard>
  );
}

export function PreviewSsl({ className }: { className?: string }) {
  return (
    <PreviewCard className={className}>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-mono text-muted-foreground">*.acme.com</span>
        <span className="text-up font-medium">valid</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-[78%] bg-up rounded-full" />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Renews in 71 days</p>
    </PreviewCard>
  );
}

export function PreviewHeaders({ className }: { className?: string }) {
  const headers = [
    { name: "Strict-Transport-Security", ok: true },
    { name: "Content-Security-Policy", ok: true },
    { name: "X-Frame-Options", ok: true },
    { name: "Permissions-Policy", ok: false },
  ];
  return (
    <PreviewCard className={className}>
      <ul className="space-y-1.5">
        {headers.map((h) => (
          <li key={h.name} className="flex items-center gap-2 text-[11px] font-mono">
            {h.ok ? (
              <Check className="w-3.5 h-3.5 text-up flex-shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 flex items-center justify-center text-degraded flex-shrink-0">!</span>
            )}
            <span className={cn("truncate", h.ok ? "text-muted-foreground" : "text-degraded")}>{h.name}</span>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

export function PreviewAlert({ className }: { className?: string }) {
  return (
    <PreviewCard className={cn("border-down/20 bg-down/5", className)}>
      <div className="flex gap-2.5">
        <Bell className="w-4 h-4 text-down flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-down">checkout-service is down</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">503 · detected 4s ago</p>
        </div>
      </div>
    </PreviewCard>
  );
}

export function PreviewIncident({ className }: { className?: string }) {
  const events = [
    { time: "03:12", label: "down detected", dot: "bg-down" },
    { time: "03:13", label: "alert sent", dot: "bg-degraded" },
    { time: "03:19", label: "recovered", dot: "bg-up" },
  ];
  return (
    <PreviewCard className={className}>
      <div className="border-l border-border pl-3 space-y-2">
        {events.map((e) => (
          <div key={e.time} className="relative flex items-center gap-2 text-[11px] font-mono">
            <span className={cn("absolute -left-[17px] w-1.5 h-1.5 rounded-full", e.dot)} />
            <span className="text-muted-foreground tabular-nums">{e.time}</span>
            <span className="text-foreground/80">{e.label}</span>
          </div>
        ))}
      </div>
    </PreviewCard>
  );
}

export function PreviewSparkline({ className }: { className?: string }) {
  return (
    <PreviewCard className={className}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-[11px] text-muted-foreground">response time</span>
        <span className="text-xs font-medium tabular-nums">142ms avg</span>
      </div>
      <Sparkline values={demoLatency} width={200} height={32} color="hsl(var(--primary))" />
    </PreviewCard>
  );
}

export function PreviewAgent({ className }: { className?: string }) {
  return (
    <PreviewCard className={cn("font-mono text-[11px] leading-relaxed", className)}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Terminal className="w-3 h-3" />
        <span>agent.sh</span>
      </div>
      <p className="text-foreground/90">
        <span className="text-primary">$</span> watchdog agent --key wdg_•••
      </p>
      <p className="text-up">✓ reporting 6 checks</p>
    </PreviewCard>
  );
}

/* ── Hero wall composition - 6 columns, varied so adjacent cards never repeat ── */
const wall = "w-60 sm:w-64";
const m = demoMonitors;

export const WALL_COLUMNS: ReactNode[][] = [
  [
    <PreviewMonitor key="c1a" {...m[0]} className={wall} />,
    <PreviewSsl key="c1b" className={wall} />,
    <PreviewIncident key="c1c" className={wall} />,
    <PreviewAgent key="c1d" className={wall} />,
  ],
  [
    <PreviewHeaders key="c2a" className={wall} />,
    <PreviewMonitor key="c2b" {...m[2]} className={wall} />,
    <PreviewSparkline key="c2c" className={wall} />,
    <PreviewAlert key="c2d" className={wall} />,
  ],
  [
    <PreviewMonitor key="c3a" {...m[1]} className={wall} />,
    <PreviewIncident key="c3b" className={wall} />,
    <PreviewAgent key="c3c" className={wall} />,
    <PreviewSsl key="c3d" className={wall} />,
    <PreviewMonitor key="c3e" {...m[3]} className={wall} />,
  ],
  [
    <PreviewAlert key="c4a" className={wall} />,
    <PreviewSparkline key="c4b" className={wall} />,
    <PreviewMonitor key="c4c" {...m[0]} className={wall} />,
    <PreviewHeaders key="c4d" className={wall} />,
  ],
  [
    <PreviewSsl key="c5a" className={wall} />,
    <PreviewMonitor key="c5b" {...m[3]} className={wall} />,
    <PreviewAlert key="c5c" className={wall} />,
    <PreviewIncident key="c5d" className={wall} />,
    <PreviewSparkline key="c5e" className={wall} />,
  ],
  [
    <PreviewAgent key="c6a" className={wall} />,
    <PreviewMonitor key="c6b" {...m[1]} className={wall} />,
    <PreviewHeaders key="c6c" className={wall} />,
    <PreviewMonitor key="c6d" {...m[2]} className={wall} />,
  ],
];
