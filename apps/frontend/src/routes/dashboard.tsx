import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { MonitorCard } from "../components/MonitorCard";
import { Nav } from "../components/Nav";

export default function DashboardPage() {
  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav current="dashboard" />
      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-400">Auto-refreshes every 30 seconds.</p>
          <Link
            to="/monitors"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Add monitor
          </Link>
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
          <div className="grid gap-4 sm:grid-cols-2">
            {monitors.map((m) => (
              <MonitorCard key={m.id} monitor={m} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
