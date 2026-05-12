import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface Props { monitorId: string }

export function SslCard({ monitorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-ssl", monitorId],
    queryFn: () => api.monitors.ssl(monitorId),
    refetchInterval: 60_000,
  });

  const daysLeft = data?.sslDaysLeft;
  const status = data?.status;

  const colour =
    status === "valid" ? "text-green-700 bg-green-50 border-green-200" :
    status === "expiring_soon" ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
    status === "expired" ? "text-red-700 bg-red-50 border-red-200" :
    "text-gray-500 bg-gray-50 border-gray-200";

  const label =
    status === "valid" ? "Valid" :
    status === "expiring_soon" ? "Expiring soon" :
    status === "expired" ? "Expired" :
    status === "error" ? "Check failed" :
    "Not checked yet";

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">SSL Certificate</h3>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !data ? (
        <p className="text-sm text-gray-400">SSL check runs hourly — check back soon.</p>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {daysLeft != null ? `${daysLeft}d` : "—"}
            </p>
            <p className="text-xs text-gray-400">days remaining</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colour}`}>
            {label}
          </span>
        </div>
      )}
      {data?.checkedAt && (
        <p className="text-xs text-gray-300 mt-3">
          Last checked {new Date(data.checkedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
