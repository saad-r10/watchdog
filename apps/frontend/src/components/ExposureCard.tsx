import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface Props {
  monitorId: string;
}

export function ExposureCard({ monitorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-exposure", monitorId],
    queryFn: () => api.monitors.exposure(monitorId),
    refetchInterval: 6 * 60 * 60 * 1000,
  });

  const findings = data?.exposureFindings;
  const status = data?.status;
  const exposedPaths = findings?.exposedPaths.filter((p) => p.exposed) ?? [];

  const badge =
    status === "fail"
      ? "bg-down/10 text-down border-down/20"
      : status === "pass"
        ? "bg-up/10 text-up border-up/20"
        : status === "error"
          ? "bg-degraded/10 text-degraded border-degraded/20"
          : "bg-muted text-muted-foreground border-border";

  const label =
    status === "fail"
      ? `${exposedPaths.length} exposed path${exposedPaths.length === 1 ? "" : "s"}`
      : status === "pass"
        ? "Healthy"
        : status === "error"
          ? "Check failed"
          : "Not checked yet";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v2" />
          </svg>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exposed Paths</h3>
        </div>
        {data && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge}`}>
            {label}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded" />
          ))}
        </div>
      ) : !data || !findings ? (
        <p className="text-sm text-muted-foreground">Exposure check runs every 6 hours - check back soon.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-mono text-foreground">security.txt</span>
            {findings.securityTxt.present ? (
              <span className="text-xs text-up font-semibold">✓</span>
            ) : (
              <span className="text-xs text-muted-foreground/60">not found</span>
            )}
          </div>
          {exposedPaths.length === 0 ? (
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-mono text-foreground">Common paths</span>
              <span className="text-xs text-up font-semibold">✓</span>
            </div>
          ) : (
            exposedPaths.map((p) => (
              <div key={p.path} className="flex items-center justify-between py-1">
                <span className="text-xs font-mono text-foreground">{p.path}</span>
                <span className="text-xs text-down font-medium">exposed ({p.statusCode})</span>
              </div>
            ))
          )}
        </div>
      )}

      {exposedPaths.length > 0 && (
        <p className="text-xs text-down/80 mt-4 leading-relaxed">
          {exposedPaths.length} sensitive path{exposedPaths.length === 1 ? "" : "s"} publicly accessible - review and restrict access.
        </p>
      )}

      {data?.checkedAt && (
        <p className="text-xs text-muted-foreground/60 mt-4">
          Checked {new Date(data.checkedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
