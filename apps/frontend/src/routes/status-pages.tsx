import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";

const BASE_URL = window.location.origin;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

export default function StatusPagesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ slug: "", title: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["status-pages"],
    queryFn: api.statusPages.list,
  });

  const { data: monitors = [] } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });

  const createMutation = useMutation({
    mutationFn: api.statusPages.create,
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: ["status-pages"] });
      setForm({ slug: "", title: "" });
      setExpandedId(page.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.statusPages.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-pages"] }),
  });

  const setMonitorsMutation = useMutation({
    mutationFn: ({ id, monitorIds }: { id: string; monitorIds: string[] }) =>
      api.statusPages.setMonitors(id, monitorIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-pages"] }),
  });

  function toggleMonitor(pageId: string, currentIds: string[], monitorId: string) {
    const next = currentIds.includes(monitorId)
      ? currentIds.filter((id) => id !== monitorId)
      : [...currentIds, monitorId];
    setMonitorsMutation.mutate({ id: pageId, monitorIds: next });
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Status Pages</h1>
        <p className="text-sm text-slate-500 mt-1">
          Share a public URL with your customers showing live uptime for your monitors
        </p>
      </div>

      {/* Create form */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Create a status page</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            placeholder="Page title (e.g. Acme Status)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 whitespace-nowrap">{BASE_URL}/status/</span>
            <input
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              placeholder="my-company"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              pattern="[a-z0-9-]+"
              minLength={2}
              required
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
            >
              {createMutation.isPending ? "Creating…" : "Create page"}
            </button>
            {createMutation.isError && (
              <p className="text-red-400 text-sm">
                {(createMutation.error as any)?.response?.status === 409
                  ? "That slug is already taken."
                  : "Failed to create page."}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Pages list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <p className="text-center text-slate-500 py-12">No status pages yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {pages.map((page, i) => {
            const pageMonitorIds = page.monitors.map((m) => m.monitorId);
            const isExpanded = expandedId === page.id;
            const publicUrl = `${BASE_URL}/status/${page.slug}`;

            return (
              <motion.div
                key={page.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden"
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{page.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 hover:text-violet-400 transition-colors truncate"
                      >
                        /status/{page.slug}
                      </a>
                      <CopyButton text={publicUrl} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : page.id)}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? "Done" : `Edit monitors (${pageMonitorIds.length})`}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(page.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-slate-600 hover:text-red-400 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Monitor picker */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-800 px-5 py-4"
                    >
                      <p className="text-xs text-slate-500 mb-3">
                        Select which monitors appear on this page:
                      </p>
                      {monitors.length === 0 ? (
                        <p className="text-xs text-slate-600">No monitors yet — add some first.</p>
                      ) : (
                        <div className="space-y-2">
                          {monitors.map((m) => {
                            const checked = pageMonitorIds.includes(m.id);
                            return (
                              <label
                                key={m.id}
                                className="flex items-center gap-3 cursor-pointer group"
                              >
                                <div
                                  onClick={() => toggleMonitor(page.id, pageMonitorIds, m.id)}
                                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                                    checked
                                      ? "bg-violet-600 border-violet-600"
                                      : "bg-slate-800 border-slate-600 group-hover:border-slate-500"
                                  }`}
                                >
                                  {checked && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm text-white group-hover:text-slate-200">{m.name}</p>
                                  <p className="text-xs text-slate-500">{m.url}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
