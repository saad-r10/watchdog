import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import type { AgentWithKey } from "@watchdog/shared-types";

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60_000;
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<AgentWithKey | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: api.agents.list,
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: api.agents.create,
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setName("");
      setNewKey(agent);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.agents.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  function handleCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Agents run on your own infrastructure and report check results directly to Watchdog
        </p>
      </div>

      {/* New key banner */}
      <AnimatePresence>
        {newKey && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 bg-emerald-950 border border-emerald-700 rounded-xl p-5"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-semibold text-emerald-400">Agent created — copy your key now</p>
                <p className="text-xs text-emerald-600 mt-0.5">This key will not be shown again.</p>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="text-emerald-700 hover:text-emerald-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-xs text-emerald-300 font-mono break-all">
                {newKey.key}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-xs font-medium transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-xs text-emerald-700">
              Send results:{" "}
              <code className="text-emerald-500">
                POST /api/agents/checkin — X-Agent-Key: {newKey.key.slice(0, 20)}…
              </code>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Register an agent</h2>
        <form
          className="flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({ name });
          }}
        >
          <input
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            placeholder="Agent name (e.g. prod-server-1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-lg shadow-violet-500/20 whitespace-nowrap"
          >
            {createMutation.isPending ? "Creating…" : "Create agent"}
          </button>
        </form>
        {createMutation.isError && (
          <p className="text-red-400 text-sm mt-2">Failed to create agent.</p>
        )}
      </div>

      {/* Agent list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <p className="text-center text-slate-500 py-12">No agents yet. Create one above.</p>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
          {agents.map((agent, i) => {
            const online = isOnline(agent.lastSeenAt);
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      online ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-slate-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Last seen: {timeSince(agent.lastSeenAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      online
                        ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-slate-500 border-slate-700 bg-slate-800"
                    }`}
                  >
                    {online ? "Online" : "Offline"}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(agent.id)}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-slate-600 hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Usage docs */}
      <div className="mt-8 bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">How to use agents</h2>
        <div className="space-y-4 text-xs text-slate-400">
          <div>
            <p className="text-slate-300 font-medium mb-1">1. Create an agent and copy the key</p>
            <p>The key is shown only once. Store it securely on your server.</p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">2. Run checks from your server</p>
            <p>Make HTTP requests to your monitored URLs and collect results.</p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">3. POST results to Watchdog</p>
            <pre className="bg-slate-800 rounded-lg p-3 text-slate-300 overflow-x-auto mt-2 leading-relaxed">
{`POST /api/agents/checkin
X-Agent-Key: wdg_<your-key>
Content-Type: application/json

{
  "results": [
    {
      "monitorId": "<uuid>",
      "type": "uptime",
      "status": "up",
      "statusCode": 200,
      "responseTime": 142
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
