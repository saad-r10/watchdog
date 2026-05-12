import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { Link } from "react-router-dom";

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
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Monitors</h1>
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">Dashboard</Link>
      </header>
      <main className="max-w-2xl mx-auto p-6">
        <form
          className="bg-white rounded-lg border p-4 mb-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <h2 className="font-semibold">Add Monitor</h2>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="https://example.com"
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            required
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {createMutation.isPending ? "Adding..." : "Add Monitor"}
          </button>
          {createMutation.isError && (
            <p className="text-red-600 text-sm">Failed to add monitor.</p>
          )}
        </form>

        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => (
              <div key={m.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-gray-500">{m.url}</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(m.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
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
