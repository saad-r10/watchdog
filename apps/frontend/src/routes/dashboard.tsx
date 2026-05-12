import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Watchdog</h1>
        <Link to="/monitors" className="text-sm text-blue-600 hover:underline">
          Manage Monitors
        </Link>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Total Monitors</p>
            <p className="text-3xl font-bold">{monitors.length}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-3xl font-bold text-green-600">
              {monitors.filter((m) => m.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="text-3xl font-bold text-gray-400">
              {monitors.filter((m) => !m.isActive).length}
            </p>
          </div>
        </div>
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : monitors.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No monitors yet.</p>
            <Link
              to="/monitors"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add your first monitor
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => (
              <div key={m.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-gray-500">{m.url}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${m.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
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
