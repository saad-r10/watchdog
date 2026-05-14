import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";

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
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Monitors</h1>
        <p className="text-sm text-slate-500 mt-1">Manage the URLs Watchdog checks every minute</p>
      </div>

      {/* Add monitor form */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Add a monitor</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            placeholder="Name (e.g. My Blog)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            placeholder="https://example.com"
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            required
          />
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
            >
              {createMutation.isPending ? "Adding…" : "Add monitor"}
            </button>
            {createMutation.isError && (
              <p className="text-red-400 text-sm">Failed to add monitor.</p>
            )}
          </div>
        </form>
      </div>

      {/* Monitor list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : monitors.length === 0 ? (
        <p className="text-center text-slate-500 py-12">No monitors yet. Add one above.</p>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
          {monitors.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="min-w-0">
                <Link
                  to={`/monitors/${m.id}`}
                  className="font-medium text-sm text-white hover:text-violet-400 transition-colors"
                >
                  {m.name}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{m.url}</p>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <Link
                  to={`/monitors/${m.id}`}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  View →
                </Link>
                <button
                  onClick={() => deleteMutation.mutate(m.id)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-slate-600 hover:text-red-400 disabled:opacity-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
