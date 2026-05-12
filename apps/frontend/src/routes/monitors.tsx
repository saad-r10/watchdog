import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Nav } from "../components/Nav";

export default function MonitorsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", url: "" });

  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });

  const createMutation = useMutation({
    mutationFn: api.monitors.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      setForm({ name: "", url: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.monitors.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav current="monitors" />
      <main className="max-w-2xl mx-auto p-6">
        <form
          className="bg-white rounded-lg border p-5 mb-6 space-y-3"
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
        >
          <h2 className="font-semibold text-gray-800">Add Monitor</h2>
          <input
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name (e.g. My Blog)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com"
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            required
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {createMutation.isPending ? "Adding..." : "Add Monitor"}
            </button>
            {createMutation.isError && <p className="text-red-600 text-sm">Failed to add monitor.</p>}
          </div>
        </form>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : monitors.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No monitors yet. Add one above.</p>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {monitors.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <Link to={`/monitors/${m.id}`} className="font-medium text-sm text-gray-900 hover:text-blue-600">
                    {m.name}
                  </Link>
                  <p className="text-xs text-gray-400">{m.url}</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(m.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
