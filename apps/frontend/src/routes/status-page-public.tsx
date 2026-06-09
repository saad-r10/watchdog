import { useParams } from "react-router-dom";
import { WatchdogMark } from "@/components/WatchdogMark";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { DailyBar } from "@watchdog/shared-types";

function UptimeBars({ bars }: { bars: DailyBar[] }) {
  return (
    <div className="flex gap-px mt-3">
      {bars.map((bar) => {
        const color =
          bar.uptimePercent === null
            ? "bg-muted"
            : bar.uptimePercent >= 99
              ? "bg-up"
              : bar.uptimePercent >= 90
                ? "bg-degraded"
                : "bg-down";
        const label =
          bar.uptimePercent === null
            ? "No data"
            : `${bar.uptimePercent}% uptime`;
        return (
          <div
            key={bar.date}
            title={`${bar.date}: ${label}`}
            className={`flex-1 h-7 rounded-sm ${color} opacity-90 hover:opacity-100 transition-opacity cursor-default`}
          />
        );
      })}
    </div>
  );
}

const overallConfig = {
  operational: {
    label: "All systems operational",
    bg: "bg-up/10",
    border: "border-up/30",
    dot: "bg-up",
    text: "text-up",
  },
  degraded: {
    label: "Partial outage",
    bg: "bg-degraded/10",
    border: "border-degraded/30",
    dot: "bg-degraded",
    text: "text-degraded",
  },
  outage: {
    label: "Major outage",
    bg: "bg-down/10",
    border: "border-down/30",
    dot: "bg-down",
    text: "text-down",
  },
};

export default function StatusPagePublic() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-status", slug],
    queryFn: () => api.statusPages.getPublic(slug!),
    refetchInterval: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground mb-2">Page not found</p>
          <p className="text-muted-foreground text-sm">This status page doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const cfg = overallConfig[data.overall];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-4">
            <WatchdogMark className="w-4 h-4 text-primary" />
            <span className="text-primary font-medium">Watchdog</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-6">{data.page.title}</h1>

          {/* Overall status banner */}
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${cfg.bg} ${cfg.border}`}>
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot} shadow-[0_0_8px_currentColor]`} />
            <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
          </div>
        </div>
      </div>

      {/* Monitor list */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {data.monitors.length === 0 ? (
          <p className="text-muted-foreground text-center py-16">No monitors on this page yet.</p>
        ) : (
          <div className="space-y-4">
            {data.monitors.map((m) => {
              const isUp = m.status === "up";
              const isDown = m.status === "down";
              return (
                <div
                  key={m.id}
                  className="bg-card border border-border rounded-xl px-5 py-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          isUp
                            ? "bg-up shadow-[0_0_6px_#34d399]"
                            : isDown
                              ? "bg-down shadow-[0_0_6px_#f87171]"
                              : "bg-muted"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      {m.uptimePercent !== null && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">90-day uptime</p>
                          <p
                            className={`text-sm font-semibold ${
                              m.uptimePercent >= 99
                                ? "text-up"
                                : m.uptimePercent >= 90
                                  ? "text-degraded"
                                  : "text-down"
                            }`}
                          >
                            {m.uptimePercent}%
                          </p>
                        </div>
                      )}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                          isUp
                            ? "text-up border-up/30 bg-up/10"
                            : isDown
                              ? "text-down border-down/30 bg-down/10"
                              : "text-muted-foreground border-border bg-muted"
                        }`}
                      >
                        {isUp ? "Operational" : isDown ? "Down" : "Unknown"}
                      </span>
                    </div>
                  </div>
                  <UptimeBars bars={m.dailyBars} />
                  <div className="flex justify-between text-xs text-muted-foreground/60 mt-1.5">
                    <span>90 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-12">
          Powered by{" "}
          <span className="text-primary">Watchdog</span>
          {" · "}Updated {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
