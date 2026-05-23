import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { DailyBar } from "@watchdog/shared-types";

function UptimeBars({ bars }: { bars: DailyBar[] }) {
  return (
    <div className="flex gap-px mt-3">
      {bars.map((bar) => {
        const color =
          bar.uptimePercent === null
            ? "bg-slate-700"
            : bar.uptimePercent >= 99
              ? "bg-emerald-500"
              : bar.uptimePercent >= 90
                ? "bg-yellow-500"
                : "bg-red-500";
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
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  degraded: {
    label: "Partial outage",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    dot: "bg-yellow-400",
    text: "text-yellow-400",
  },
  outage: {
    label: "Major outage",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-400",
    text: "text-red-400",
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-2">Page not found</p>
          <p className="text-slate-500 text-sm">This status page doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const cfg = overallConfig[data.overall];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-4">
            <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-violet-400 font-medium">Watchdog</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-6">{data.page.title}</h1>

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
          <p className="text-slate-500 text-center py-16">No monitors on this page yet.</p>
        ) : (
          <div className="space-y-4">
            {data.monitors.map((m) => {
              const isUp = m.status === "up";
              const isDown = m.status === "down";
              return (
                <div
                  key={m.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          isUp
                            ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                            : isDown
                              ? "bg-red-400 shadow-[0_0_6px_#f87171]"
                              : "bg-slate-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{m.name}</p>
                        <p className="text-xs text-slate-500 truncate">{m.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      {m.uptimePercent !== null && (
                        <div className="text-right">
                          <p className="text-xs text-slate-500">90-day uptime</p>
                          <p
                            className={`text-sm font-semibold ${
                              m.uptimePercent >= 99
                                ? "text-emerald-400"
                                : m.uptimePercent >= 90
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            }`}
                          >
                            {m.uptimePercent}%
                          </p>
                        </div>
                      )}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                          isUp
                            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            : isDown
                              ? "text-red-400 border-red-500/30 bg-red-500/10"
                              : "text-slate-500 border-slate-700 bg-slate-800"
                        }`}
                      >
                        {isUp ? "Operational" : isDown ? "Down" : "Unknown"}
                      </span>
                    </div>
                  </div>
                  <UptimeBars bars={m.dailyBars} />
                  <div className="flex justify-between text-xs text-slate-600 mt-1.5">
                    <span>90 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-700 mt-12">
          Powered by{" "}
          <span className="text-violet-500">Watchdog</span>
          {" · "}Updated {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
