import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import type { Agent, AgentWithKey, Monitor } from "@watchdog/shared-types";

const WATCHDOG_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

type SetupMode = "service" | "foreground";

function buildSetupCommand(mode: SetupMode, agentKey: string, watchdogUrl: string) {
  if (mode === "service") {
    return `curl -fsSL ${watchdogUrl}/api/agents/install.sh | sh -s -- --key ${agentKey}`;
  }
  return [
    `curl -fsSL ${watchdogUrl}/api/agents/runner -o watchdog-agent.js`,
    `node watchdog-agent.js --key ${agentKey} --url ${watchdogUrl}`,
  ].join("\n");
}

function SetupCommand({ agentKey, placeholder }: { agentKey: string; placeholder?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<SetupMode>("service");
  const command = buildSetupCommand(mode, agentKey, WATCHDOG_URL);

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          {([
            ["service", "Install as a service"],
            ["foreground", "Run in foreground"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                mode === id
                  ? "text-white border-slate-500 bg-slate-700"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-700 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">
        {command}
      </pre>
      <p className="text-xs text-slate-600 mt-1.5">
        {mode === "service"
          ? "Installs to ~/.watchdog-agent and starts on boot (macOS launchd / Linux systemd). Requires Node.js 18+."
          : "Runs until you close the terminal — handy for watching logs. Requires Node.js 18+."}
      </p>
      {placeholder && (
        <p className="text-xs text-slate-600 mt-1.5">Replace <code className="text-slate-500">wdg_&lt;your-key&gt;</code> with the key you copied when this agent was created.</p>
      )}
    </div>
  );
}

function AgentRow({
  agent,
  allMonitors,
  onRevoke,
}: {
  agent: Agent;
  allMonitors: Monitor[];
  onRevoke: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const assignedIds = new Set(agent.monitors.map((m) => m.id));
  const unassigned = allMonitors.filter((m) => !assignedIds.has(m.id));
  const online = isOnline(agent.lastSeenAt);

  const assignMutation = useMutation({
    mutationFn: (monitorId: string) =>
      api.monitors.update(monitorId, { agentId: agent.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (monitorId: string) =>
      api.monitors.update(monitorId, { agentId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  return (
    <div className="border-b border-slate-800 last:border-0">
      {/* Header row */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              online ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-slate-600"
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{agent.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Last seen: {timeSince(agent.lastSeenAt)}
              {agent.monitors.length > 0 && (
                <span className="ml-2 text-slate-600">
                  · {agent.monitors.length} monitor{agent.monitors.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              online
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : "text-slate-500 border-slate-700 bg-slate-800"
            }`}
          >
            {online ? "Online" : "Offline"}
          </span>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-slate-800/60 space-y-5">

              {/* Assigned monitors */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Assigned monitors
                </p>
                {agent.monitors.length === 0 ? (
                  <p className="text-xs text-slate-600">No monitors assigned yet.</p>
                ) : (
                  <div className="space-y-1">
                    {agent.monitors.map((m) => (
                      <div key={m.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white">{m.name}</p>
                          <p className="text-xs text-slate-500 truncate">{m.url}</p>
                        </div>
                        <button
                          onClick={() => unassignMutation.mutate(m.id)}
                          disabled={unassignMutation.isPending}
                          className="text-xs text-slate-500 hover:text-red-400 ml-3 flex-shrink-0 disabled:opacity-50 transition-colors"
                        >
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assign unassigned monitors */}
                {unassigned.length > 0 && (
                  <div className="mt-2">
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          assignMutation.mutate(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      disabled={assignMutation.isPending}
                    >
                      <option value="" disabled>Assign a monitor…</option>
                      {unassigned.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} — {m.url}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Setup command */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Run this agent
                </p>
                <SetupCommand agentKey="wdg_<your-key>" placeholder />
              </div>

              {/* Revoke */}
              <div className="flex items-center gap-2 pt-1">
                {confirmRevoke ? (
                  <>
                    <span className="text-xs text-slate-400">Revoke this agent? Its key will stop working.</span>
                    <button
                      onClick={() => { onRevoke(agent.id); setConfirmRevoke(false); }}
                      className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors font-medium"
                    >
                      Revoke
                    </button>
                    <button
                      onClick={() => setConfirmRevoke(false)}
                      className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmRevoke(true)}
                    className="text-xs text-slate-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Revoke agent
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [newAgent, setNewAgent] = useState<AgentWithKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: api.agents.list,
    // Poll fast while the new-agent banner is waiting for its first check-in
    refetchInterval: (query) => {
      if (!newAgent) return 30_000;
      const created = query.state.data?.find((a) => a.id === newAgent.id);
      return created && isOnline(created.lastSeenAt) ? 30_000 : 5_000;
    },
  });

  const createdAgent = newAgent ? agents.find((a) => a.id === newAgent.id) : undefined;
  const newAgentOnline = createdAgent ? isOnline(createdAgent.lastSeenAt) : false;

  const { data: monitors = [] } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });

  const createMutation = useMutation({
    mutationFn: api.agents.create,
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setName("");
      setNewAgent(agent);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.agents.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  function handleCopyKey() {
    if (!newAgent) return;
    navigator.clipboard.writeText(newAgent.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Agents run on your own infrastructure and push check results to Watchdog
        </p>
      </div>

      {/* New agent banner */}
      <AnimatePresence>
        {newAgent && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 bg-emerald-950 border border-emerald-700 rounded-xl p-5"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-semibold text-emerald-400">Agent created — copy your key now</p>
                <p className="text-xs text-emerald-700 mt-0.5">This key will not be shown again.</p>
              </div>
              <button
                onClick={() => setNewAgent(null)}
                className="text-emerald-700 hover:text-emerald-400 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-xs text-emerald-300 font-mono break-all">
                {newAgent.key}
              </code>
              <button
                onClick={handleCopyKey}
                className="flex-shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-xs font-medium transition-colors"
              >
                {copiedKey ? "Copied!" : "Copy key"}
              </button>
            </div>
            <SetupCommand agentKey={newAgent.key} />
            <div className="flex items-center gap-2 mt-4">
              {newAgentOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] flex-shrink-0" />
                  <p className="text-xs text-emerald-400 font-medium">
                    Agent connected — assign monitors below and it picks them up within a minute.
                  </p>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <p className="text-xs text-slate-400">
                    Waiting for first check-in… paste the command above into a terminal on your server.
                  </p>
                </>
              )}
            </div>
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
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          {agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              allMonitors={monitors}
              onRevoke={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Usage docs */}
      <div className="mt-8 bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">How it works</h2>
        <ol className="space-y-3 text-xs text-slate-400 list-decimal list-inside">
          <li>Create an agent above — you get a ready-to-paste command with the key baked in (shown once only).</li>
          <li>Paste the command into a terminal on your server (requires Node.js 18+). The dot turns green when it connects. "Install as a service" survives reboots; remove it anytime by re-running the installer with <code className="text-slate-500">--uninstall</code>.</li>
          <li>Assign monitors using the expand panel above — the agent picks up changes within a minute, no restart needed.</li>
          <li>Monitoring something private (localhost, an internal network)? Create a monitor with the internal URL and assign it to this agent — Watchdog's cloud checker leaves agent-assigned monitors to the agent.</li>
        </ol>
      </div>
    </div>
  );
}
