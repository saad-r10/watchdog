import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { SECURITY_HEADERS } from "@watchdog/shared-types";

interface Props { monitorId: string }

const HEADER_LABELS: Record<string, string> = {
  "x-frame-options": "X-Frame-Options",
  "content-security-policy": "Content-Security-Policy",
  "strict-transport-security": "Strict-Transport-Security",
  "x-content-type-options": "X-Content-Type-Options",
  "referrer-policy": "Referrer-Policy",
  "permissions-policy": "Permissions-Policy",
};

export function HeadersCard({ monitorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-headers", monitorId],
    queryFn: () => api.monitors.headers(monitorId),
    refetchInterval: 6 * 60 * 60 * 1000,
  });

  const present = data?.headers?.present ?? {};
  const missing = data?.headers?.missing ?? [];
  const passCount = Object.keys(present).length;
  const totalCount = SECURITY_HEADERS.length;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Security Headers</h3>
        {data && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            passCount === totalCount
              ? "bg-green-50 text-green-700"
              : passCount >= totalCount / 2
              ? "bg-yellow-50 text-yellow-700"
              : "bg-red-50 text-red-700"
          }`}>
            {passCount}/{totalCount} present
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !data ? (
        <p className="text-sm text-gray-400">Header check runs every 6 hours — check back soon.</p>
      ) : (
        <div className="space-y-1.5">
          {SECURITY_HEADERS.map((h) => {
            const isPresent = h in present;
            return (
              <div key={h} className="flex items-center justify-between text-xs">
                <span className={`font-mono ${isPresent ? "text-gray-700" : "text-gray-400 line-through"}`}>
                  {HEADER_LABELS[h] ?? h}
                </span>
                {isPresent ? (
                  <span className="text-green-600 font-medium">✓</span>
                ) : (
                  <span className="text-red-500 font-medium">✗ missing</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {missing.length > 0 && (
        <p className="text-xs text-red-500 mt-3">
          {missing.length} missing header{missing.length > 1 ? "s" : ""} — site may be vulnerable to clickjacking or XSS.
        </p>
      )}

      {data?.checkedAt && (
        <p className="text-xs text-gray-300 mt-3">
          Last checked {new Date(data.checkedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
