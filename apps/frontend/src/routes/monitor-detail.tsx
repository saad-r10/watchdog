import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { StatusBadge } from "../components/StatusBadge";
import { Sparkline } from "../components/Sparkline";
import { SslCard } from "../components/SslCard";
import { HeadersCard } from "../components/HeadersCard";

function formatDuration(start: string, end?: string | null) {
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: monitors = [] } = useQuery({ queryKey: ["monitors"], queryFn: api.monitors.list });
  const monitor = monitors.find((m) => m.id === id);

  const { data: stats } = useQuery({
    queryKey: ["monitor-stats", id],
    queryFn: () => api.monitors.stats(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ["monitor-checks", id, 50],
    queryFn: () => api.monitors.checks(id!, 50),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["monitor-incidents", id],
    queryFn: () => api.monitors.incidents(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.monitors.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      navigate("/monitors");
    },
  });

  const sparklineData = [...checks].reverse().map((c) => c.responseTime ?? null);

  function handleLogout() { logout(); navigate("/login"); }

  if (!monitor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Monitor not found. <Link to="/dashboard" className="text-blue-600">Back to dashboard</Link></p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Watchdog</h1>
          <span className="text-gray-300">|</span>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{monitor.name}</h2>
              <StatusBadge status={stats?.lastStatus ?? null} />
            </div>
            <a href={monitor.url} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline">
              {monitor.url}
            </a>
          </div>
          <button
            onClick={() => {
              if (confirm("Delete this monitor and all its data?")) deleteMutation.mutate();
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Uptime (7d)</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.uptimePercent != null ? `${stats.uptimePercent}%` : "—"}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Avg response</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.avgResponseTime != null ? `${stats.avgResponseTime}ms` : "—"}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Checks (7d)</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalChecks ?? "—"}</p>
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData.length > 1 && (
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 mb-3">Response time — last {checks.length} checks</p>
            <Sparkline
              values={sparklineData}
              width={700}
              height={60}
              color={stats?.lastStatus === "down" ? "#ef4444" : "#3b82f6"}
            />
          </div>
        )}

        {/* Security checks */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SslCard monitorId={monitor.id} />
          <HeadersCard monitorId={monitor.id} />
        </div>

        {/* Incidents */}
        {incidents.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-gray-800">Incidents</h3>
            </div>
            <div className="divide-y">
              {incidents.map((inc) => (
                <div key={inc.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${inc.isResolved ? "bg-gray-300" : "bg-red-500"}`} />
                    <span className="text-gray-700">{inc.isResolved ? "Downtime" : "Ongoing downtime"}</span>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>{new Date(inc.startedAt).toLocaleString()}</p>
                    <p>{inc.isResolved ? `Resolved after ${formatDuration(inc.startedAt, inc.resolvedAt)}` : `Ongoing — ${formatDuration(inc.startedAt)}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent checks */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-800">Recent checks</h3>
          </div>
          {checks.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No checks yet — the worker runs every minute.</p>
          ) : (
            <div className="divide-y">
              {checks.map((c) => (
                <div key={c.id} className="px-4 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${c.status === "up" ? "text-green-600" : "text-red-600"}`}>
                      {c.status.toUpperCase()}
                    </span>
                    {c.statusCode && <span className="text-gray-400">HTTP {c.statusCode}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-gray-400">
                    {c.responseTime != null && <span>{c.responseTime}ms</span>}
                    <span>{new Date(c.checkedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
