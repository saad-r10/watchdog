import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { UpdateMonitorInput } from "@watchdog/shared-types";

interface Props {
  monitorId: string;
}

const CATEGORIES: { key: "performance" | "accessibility" | "bestPractices" | "seo"; label: string; budgetField: keyof UpdateMonitorInput }[] = [
  { key: "performance", label: "Performance", budgetField: "lighthousePerformanceBudget" },
  { key: "accessibility", label: "Accessibility", budgetField: "lighthouseAccessibilityBudget" },
  { key: "bestPractices", label: "Best Practices", budgetField: "lighthouseBestPracticesBudget" },
  { key: "seo", label: "SEO", budgetField: "lighthouseSeoBudget" },
];

export function LighthouseCard({ monitorId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-lighthouse", monitorId],
    queryFn: () => api.monitors.lighthouse(monitorId),
  });

  const [budgets, setBudgets] = useState({ performance: 80, accessibility: 80, bestPractices: 80, seo: 80 });

  useEffect(() => {
    if (data?.budgets) setBudgets(data.budgets);
  }, [data?.budgets]);

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.monitors.update(monitorId, { lighthouseEnabled: enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitor-lighthouse", monitorId] });
      qc.invalidateQueries({ queryKey: ["monitor", monitorId] });
    },
  });

  const budgetMutation = useMutation({
    mutationFn: (input: UpdateMonitorInput) => api.monitors.update(monitorId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitor-lighthouse", monitorId] }),
  });

  const enabled = data?.enabled ?? false;
  const latest = data?.latest ?? null;
  const overBudget =
    !!latest &&
    latest.success &&
    CATEGORIES.some(({ key }) => {
      const score = latest[key];
      return score != null && score < budgets[key];
    });

  const badge = !enabled
    ? "bg-muted text-muted-foreground border-border"
    : latest && !latest.success
      ? "bg-degraded/10 text-degraded border-degraded/20"
      : overBudget
        ? "bg-down/10 text-down border-down/20"
        : "bg-up/10 text-up border-up/20";

  const label = !enabled ? "Disabled" : latest && !latest.success ? "Audit Failed" : overBudget ? "Budget Exceeded" : "Passing";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lighthouse</h3>
        </div>
        {!isLoading && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge}`}>
            {label}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => toggleMutation.mutate(!enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${enabled ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-sm text-foreground">Run daily Lighthouse audit</span>
          </label>

          {enabled && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ key, label, budgetField }) => {
                  const score = latest?.success ? latest[key] : null;
                  const failing = score != null && score < budgets[key];
                  return (
                    <div key={key} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        {score != null && (
                          <span className={`text-sm font-semibold ${failing ? "text-down" : "text-up"}`}>
                            {score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Budget</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={budgets[key]}
                          onChange={(e) => setBudgets((b) => ({ ...b, [key]: Number(e.target.value) }))}
                          onBlur={(e) => budgetMutation.mutate({ [budgetField]: Number(e.target.value) })}
                          className="w-14 bg-muted border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-muted-foreground">
                {latest ? (
                  latest.success ? (
                    <p>Last audit: {new Date(latest.checkedAt).toLocaleString()}</p>
                  ) : (
                    <p className="text-degraded">Last audit failed{latest.error ? `: ${latest.error}` : ""} ({new Date(latest.checkedAt).toLocaleString()})</p>
                  )
                ) : (
                  <p>No audit run yet — runs once daily.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
