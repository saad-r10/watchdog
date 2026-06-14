import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { SECURITY_HEADERS } from "@watchdog/shared-types";

interface Props {
  monitorId: string;
}

const HEADER_LABELS: Record<string, string> = {
  "x-frame-options": "X-Frame-Options",
  "content-security-policy": "CSP",
  "strict-transport-security": "HSTS",
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
  const cookies = data?.headers?.cookies ?? [];
  const mixedContent = data?.headers?.mixedContent ?? [];
  const cookieIssues = cookies.filter((c) => c.missingSecure || c.missingHttpOnly || c.missingSameSite);
  const passCount = Object.keys(present).length;
  const totalCount = SECURITY_HEADERS.length;
  const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const scoreBadge =
    passCount === totalCount
      ? "bg-up/10 text-up border-up/20"
      : passCount >= totalCount / 2
        ? "bg-degraded/10 text-degraded border-degraded/20"
        : "bg-down/10 text-down border-down/20";

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security Headers</h3>
        </div>
        {data && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${scoreBadge}`}>
            {score}% ({passCount}/{totalCount})
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Header check runs every 6 hours — check back soon.</p>
      ) : (
        <div className="space-y-2">
          {SECURITY_HEADERS.map((h) => {
            const isPresent = h in present;
            return (
              <div key={h} className="flex items-center justify-between py-1">
                <span className={`text-xs font-mono ${isPresent ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {HEADER_LABELS[h] ?? h}
                </span>
                {isPresent ? (
                  <span className="text-xs text-up font-semibold">✓</span>
                ) : (
                  <span className="text-xs text-down font-medium">missing</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {missing.length > 0 && (
        <p className="text-xs text-down/80 mt-4 leading-relaxed">
          {missing.length} missing header{missing.length > 1 ? "s" : ""} — may be vulnerable to clickjacking or XSS.
        </p>
      )}

      {data && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cookies</h4>
          {cookies.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cookies set</p>
          ) : (
            cookies.map((c) => {
              const issues = [
                c.missingSecure && "Secure",
                c.missingHttpOnly && "HttpOnly",
                c.missingSameSite && "SameSite",
              ].filter(Boolean) as string[];
              return (
                <div key={c.name} className="flex items-center justify-between py-1">
                  <span className="text-xs font-mono text-foreground">{c.name}</span>
                  {issues.length === 0 ? (
                    <span className="text-xs text-up font-semibold">✓</span>
                  ) : (
                    <span className="text-xs text-down font-medium">missing {issues.join(", ")}</span>
                  )}
                </div>
              );
            })
          )}
          {cookieIssues.length > 0 && (
            <p className="text-xs text-down/80 leading-relaxed">
              {cookieIssues.length} cookie{cookieIssues.length > 1 ? "s" : ""} missing security attributes — may be
              vulnerable to theft or CSRF.
            </p>
          )}
        </div>
      )}

      {data && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mixed Content</h4>
          {mixedContent.length === 0 ? (
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-mono text-foreground">HTTP resources on HTTPS page</span>
              <span className="text-xs text-up font-semibold">✓</span>
            </div>
          ) : (
            <>
              {mixedContent.map((m) => (
                <div key={m.url} className="flex items-center justify-between py-1 gap-2">
                  <span className="text-xs font-mono text-foreground truncate">{m.url}</span>
                  <span className="text-xs text-down font-medium shrink-0">mixed content</span>
                </div>
              ))}
              <p className="text-xs text-down/80 leading-relaxed">
                {mixedContent.length} insecure resource{mixedContent.length > 1 ? "s" : ""} loaded over HTTP —
                may trigger browser warnings or be tampered with.
              </p>
            </>
          )}
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
