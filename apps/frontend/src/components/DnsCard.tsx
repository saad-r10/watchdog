import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface Props {
  monitorId: string;
}

export function DnsCard({ monitorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-dns", monitorId],
    queryFn: () => api.monitors.dns(monitorId),
    refetchInterval: 6 * 60 * 60 * 1000,
  });

  const findings = data?.dnsFindings;
  const status = data?.status;

  const issues = findings
    ? [findings.spf.issue, findings.dmarc.issue, findings.danglingCname.issue].filter(
        (issue): issue is string => !!issue
      )
    : [];

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
      ? `${issues.length} issue${issues.length === 1 ? "" : "s"}`
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18" />
          </svg>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Security</h3>
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
        <p className="text-sm text-muted-foreground">Email security check runs every 6 hours - check back soon.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-mono text-foreground">SPF (sender allowlist)</span>
            {findings.spf.present ? (
              <span className="text-xs text-up font-semibold">✓</span>
            ) : (
              <span className="text-xs text-down font-medium">missing</span>
            )}
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-mono text-foreground">DMARC (email policy)</span>
            {findings.dmarc.present && !findings.dmarc.issue ? (
              <span className="text-xs text-up font-semibold">✓</span>
            ) : findings.dmarc.present ? (
              <span className="text-xs text-degraded font-medium">weak ({findings.dmarc.policy ?? "none"})</span>
            ) : (
              <span className="text-xs text-down font-medium">missing</span>
            )}
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-mono text-foreground">DKIM (email signature)</span>
            {findings.dkim.present ? (
              <span className="text-xs text-up font-semibold">✓ ({findings.dkim.selectors.join(", ")})</span>
            ) : (
              <span className="text-xs text-muted-foreground/60">not found</span>
            )}
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-mono text-foreground">Domain alias (CNAME)</span>
            {!findings.danglingCname.present ? (
              <span className="text-xs text-muted-foreground/60">none</span>
            ) : findings.danglingCname.dangling ? (
              <span className="text-xs text-down font-medium">broken — hijack risk</span>
            ) : (
              <span className="text-xs text-up font-semibold">✓</span>
            )}
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="text-xs text-down/80 mt-4 space-y-1 leading-relaxed list-disc list-inside">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
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
