import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const activeCount = monitors.filter((m) => m.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Watchdog</h1>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <Link
            to="/monitors"
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Monitors
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Welcome back, {user?.name}
          </h2>
          <p className="text-sm text-gray-500">Here's what's being monitored.</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total</p>
            <p className="text-3xl font-bold text-gray-900">{monitors.length}</p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active</p>
            <p className="text-3xl font-bold text-green-600">{activeCount}</p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Paused</p>
            <p className="text-3xl font-bold text-gray-400">{monitors.length - activeCount}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading monitors...</p>
        ) : monitors.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border">
            <p className="text-gray-400 mb-4">No monitors yet.</p>
            <Link
              to="/monitors"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Add your first monitor
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {monitors.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-400">{m.url}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    m.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {m.isActive ? "Active" : "Paused"}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
