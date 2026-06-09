import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface Props {
  monitorId: string;
}

export function SslCard({ monitorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-ssl", monitorId],
    queryFn: () => api.monitors.ssl(monitorId),
    refetchInterval: 60_000,
  });

  const daysLeft = data?.sslDaysLeft;
  const status = data?.status;

  const badge =
    status === "valid"
      ? "bg-up/10 text-up border-up/20"
      : status === "expiring_soon"
        ? "bg-degraded/10 text-degraded border-degraded/20"
        : status === "expired"
          ? "bg-down/10 text-down border-down/20"
          : "bg-muted text-muted-foreground border-border";

  const label =
    status === "valid"
      ? "Valid"
      : status === "expiring_soon"
        ? "Expiring soon"
        : status === "expired"
          ? "Expired"
          : status === "error"
            ? "Check failed"
            : "Not checked yet";

  const daysColor =
    status === "valid"
      ? "text-foreground"
      : status === "expiring_soon"
        ? "text-degraded"
        : status === "expired"
          ? "text-down"
          : "text-muted-foreground";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SSL Certificate</h3>
      </div>

      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-20 mb-2" />
          <div className="h-3 bg-muted rounded w-28" />
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">SSL check runs hourly — check back soon.</p>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-3xl font-bold ${daysColor}`}>
              {daysLeft != null ? `${daysLeft}d` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">days remaining</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge}`}>
            {label}
          </span>
        </div>
      )}

      {data?.checkedAt && (
        <p className="text-xs text-muted-foreground/60 mt-4">
          Checked {new Date(data.checkedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
