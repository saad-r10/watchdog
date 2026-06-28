import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface Props {
  monitorId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  urlhaus: "URLhaus",
  spamhaus_dbl: "Spamhaus DBL",
};

export function BlocklistCard({ monitorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-blocklist", monitorId],
    queryFn: () => api.monitors.blocklist(monitorId),
    refetchInterval: 24 * 60 * 60 * 1000,
  });

  const findings = data?.blocklistFindings;
  const status = data?.status;
  const listed = findings?.sources.filter((s) => s.listed) ?? [];

  const badge =
    status === "listed"
      ? "bg-down/10 text-down border-down/20"
      : status === "clean"
        ? "bg-up/10 text-up border-up/20"
        : status === "error"
          ? "bg-degraded/10 text-degraded border-degraded/20"
          : "bg-muted text-muted-foreground border-border";

  const label =
    status === "listed"
      ? `${listed.length} blocklist${listed.length === 1 ? "" : "s"}`
      : status === "clean"
        ? "Healthy"
        : status === "error"
          ? "Check failed"
          : "Not checked yet";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain Reputation</h3>
        </div>
        {data && (
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
      ) : !data || !findings ? (
        <p className="text-sm text-muted-foreground">Blocklist check runs daily - check back soon.</p>
      ) : (
        <div className="space-y-2">
          {findings.sources.map((s) => (
            <div key={s.source} className="flex items-center justify-between py-1">
              <span className="text-xs font-mono text-foreground">{SOURCE_LABELS[s.source] ?? s.source}</span>
              {s.listed ? (
                <span className="text-xs text-down font-medium">listed</span>
              ) : (
                <span className="text-xs text-up font-semibold">✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {listed.length > 0 && (
        <ul className="text-xs text-down/80 mt-4 space-y-1 leading-relaxed list-disc list-inside">
          {listed.map((s) => (
            <li key={s.source}>{s.detail}</li>
          ))}
        </ul>
      )}

      {data?.checkedAt && (
        <p className="text-xs text-muted-foreground/60 mt-4">
          Checked {new Date(data.checkedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
