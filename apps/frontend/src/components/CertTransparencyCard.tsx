import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface Props {
  monitorId: string;
}

export function CertTransparencyCard({ monitorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-certs", monitorId],
    queryFn: () => api.monitors.certTransparency(monitorId),
    refetchInterval: 4 * 60 * 60 * 1000,
  });

  const status = data?.status;
  const newCerts = data?.newCerts ?? [];

  const badge =
    status === "new_cert"
      ? "bg-down/10 text-down border-down/20"
      : status === "ok" || status === "baseline"
        ? "bg-up/10 text-up border-up/20"
        : status === "error"
          ? "bg-degraded/10 text-degraded border-degraded/20"
          : "bg-muted text-muted-foreground border-border";

  const label =
    status === "new_cert"
      ? `${newCerts.length} new cert${newCerts.length === 1 ? "" : "s"}`
      : status === "ok"
        ? "No new certs"
        : status === "baseline"
          ? "Baseline recorded"
          : status === "error"
            ? "Check failed"
            : "Not checked yet";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Certificate Alerts</h3>
        </div>
        {data && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge}`}>
            {label}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-6 bg-muted rounded" />
          <div className="h-6 bg-muted rounded" />
        </div>
      ) : !data || !data.status ? (
        <p className="text-sm text-muted-foreground">Certificate monitoring runs every 4 hours - check back soon.</p>
      ) : newCerts.length > 0 ? (
        <div className="space-y-3">
          {newCerts.slice(0, 5).map((c) => (
            <div key={c.id} className="text-xs">
              <p className="font-mono text-foreground truncate">{c.common_name}</p>
              <p className="text-muted-foreground/70 mt-0.5">
                {c.issuer_name} · {new Date(c.not_before).toLocaleDateString()} → {new Date(c.not_after).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tracking {data.totalCertificates} certificate{data.totalCertificates === 1 ? "" : "s"} for this domain.
        </p>
      )}

      {status === "new_cert" && (
        <p className="text-xs text-down/80 mt-4 leading-relaxed">
          Unrecognized certificate{newCerts.length > 1 ? "s" : ""} detected - verify this was issued by you or your hosting provider, not an unauthorized party.
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
