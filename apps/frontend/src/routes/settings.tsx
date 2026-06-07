import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import type { Agent, AgentWithKey, Monitor } from "@watchdog/shared-types";

// ─── Agent helpers ────────────────────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

function buildConfig(key: string, monitors: { id: string; url: string }[], watchdogUrl: string) {
  return JSON.stringify({ agentKey: key, watchdogUrl, monitors: monitors.map((m) => ({ monitorId: m.id, url: m.url, intervalMinutes: 1 })) }, null, 2);
}

function ConfigSnippet({ agentKey, monitors, placeholder }: { agentKey: string; monitors: { id: string; url: string }[]; placeholder?: boolean }) {
  const [copied, setCopied] = useState(false);
  const config = buildConfig(agentKey, monitors, BACKEND_URL);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-slate-500">watchdog-agent.config.json</p>
        <button onClick={() => { navigator.clipboard.writeText(config); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-700 transition-colors">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">
        {placeholder ? config.replace(agentKey, "wdg_<your-key>") : config}
      </pre>
      {placeholder && (
        <p className="text-xs text-slate-600 mt-1.5">Replace <code className="text-slate-500">wdg_&lt;your-key&gt;</code> with the key you copied when this agent was created.</p>
      )}
    </div>
  );
}

function AgentRow({ agent, allMonitors, onRevoke }: { agent: Agent; allMonitors: Monitor[]; onRevoke: (id: string) => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const online = isOnline(agent.lastSeenAt);
  const assignedIds = new Set(agent.monitors.map((m) => m.id));
  const unassigned = allMonitors.filter((m) => !assignedIds.has(m.id));

  const assignMutation = useMutation({
    mutationFn: (monitorId: string) => api.monitors.update(monitorId, { agentId: agent.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["monitors"] }); },
  });
  const unassignMutation = useMutation({
    mutationFn: (monitorId: string) => api.monitors.update(monitorId, { agentId: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["monitors"] }); },
  });

  return (
    <div className="border-b border-slate-800 last:border-0">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/30 transition-colors" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-slate-600"}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{agent.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Last seen: {timeSince(agent.lastSeenAt)}
              {agent.monitors.length > 0 && <span className="ml-2 text-slate-600">· {agent.monitors.length} monitor{agent.monitors.length !== 1 ? "s" : ""}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${online ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-slate-500 border-slate-700 bg-slate-800"}`}>
            {online ? "Online" : "Offline"}
          </span>
          <svg className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 border-t border-slate-800/60 space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Assigned monitors</p>
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
                        <button onClick={() => unassignMutation.mutate(m.id)} disabled={unassignMutation.isPending}
                          className="text-xs text-slate-500 hover:text-red-400 ml-3 flex-shrink-0 disabled:opacity-50 transition-colors">
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {unassigned.length > 0 && (
                  <div className="mt-2">
                    <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      defaultValue="" onChange={(e) => { if (e.target.value) { assignMutation.mutate(e.target.value); e.target.value = ""; } }} disabled={assignMutation.isPending}>
                      <option value="" disabled>Assign a monitor…</option>
                      {unassigned.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.url}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Config file</p>
                <ConfigSnippet agentKey="wdg_<your-key>" monitors={agent.monitors} placeholder />
              </div>

              <div className="flex items-center gap-2 pt-1">
                {confirmRevoke ? (
                  <>
                    <span className="text-xs text-slate-400">Revoke this agent? Its key will stop working.</span>
                    <button onClick={() => { onRevoke(agent.id); setConfirmRevoke(false); }}
                      className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors font-medium">Revoke</button>
                    <button onClick={() => setConfirmRevoke(false)}
                      className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmRevoke(true)}
                    className="text-xs text-slate-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
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

function AgentsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [newAgent, setNewAgent] = useState<AgentWithKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents"], queryFn: api.agents.list, refetchInterval: 30_000 });
  const { data: monitors = [] } = useQuery({ queryKey: ["monitors"], queryFn: api.monitors.list });

  const createMutation = useMutation({
    mutationFn: api.agents.create,
    onSuccess: (agent) => { qc.invalidateQueries({ queryKey: ["agents"] }); setName(""); setNewAgent(agent); },
  });
  const deleteMutation = useMutation({
    mutationFn: api.agents.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  return (
    <div id="agents" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Agents</h2>
        <p className="text-xs text-slate-500 mt-1">Run an agent on your own server to monitor localhost or internal URLs.</p>
      </div>

      {/* New agent key banner */}
      <AnimatePresence>
        {newAgent && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-emerald-950 border border-emerald-700 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-semibold text-emerald-400">Agent created — copy your key now</p>
                <p className="text-xs text-emerald-700 mt-0.5">This key will not be shown again.</p>
              </div>
              <button onClick={() => setNewAgent(null)} className="text-emerald-700 hover:text-emerald-400 transition-colors text-xl leading-none">×</button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-xs text-emerald-300 font-mono break-all">{newAgent.key}</code>
              <button onClick={() => { navigator.clipboard.writeText(newAgent.key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }}
                className="flex-shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-xs font-medium transition-colors">
                {copiedKey ? "Copied!" : "Copy key"}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-1">
              Download the runner and start it on your server:
            </p>
            <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 font-mono overflow-x-auto">
{`curl -o agent-runner.js ${import.meta.env.VITE_API_URL ?? ""}/api/agents/runner
node agent-runner.js watchdog-agent.config.json`}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name }); }}>
          <input
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            placeholder="Agent name (e.g. prod-server)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" disabled={createMutation.isPending}
            className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-lg shadow-violet-500/20 whitespace-nowrap">
            {createMutation.isPending ? "Creating…" : "New agent"}
          </button>
        </form>
      </div>

      {/* Agent list */}
      {isLoading ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 animate-pulse space-y-2">
          <div className="h-4 bg-slate-800 rounded w-1/3" />
          <div className="h-3 bg-slate-800 rounded w-1/4" />
        </div>
      ) : agents.length === 0 ? (
        <p className="text-sm text-slate-600 py-4">No agents yet.</p>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} allMonitors={monitors} onRevoke={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });

  const [alertEmail, setAlertEmail] = useState("");
  const [alertDowntime, setAlertDowntime] = useState(true);
  const [alertSslExpiry, setAlertSslExpiry] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "ok" | "error">("idle");

  useEffect(() => {
    if (data) {
      setAlertEmail(data.alertEmail ?? "");
      setAlertDowntime(data.alertDowntime);
      setAlertSslExpiry(data.alertSslExpiry);
      setWebhookUrl(data.webhookUrl ?? "");
    }
  }, [data]);

  async function handleTestWebhook() {
    setTestState("sending");
    try { await api.settings.testWebhook(); setTestState("ok"); }
    catch { setTestState("error"); }
    finally { setTimeout(() => setTestState("idle"), 3000); }
  }

  const mutation = useMutation({
    mutationFn: () => api.settings.update({ alertEmail: alertEmail.trim() || null, alertDowntime, alertSslExpiry, webhookUrl: webhookUrl.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  return (
    <div className="p-4 sm:p-8 max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure alerts and manage your agents</p>
      </div>

      {/* Alert settings */}
      {isLoading ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 animate-pulse space-y-4">
          <div className="h-4 bg-slate-800 rounded w-1/3" />
          <div className="h-10 bg-slate-800 rounded" />
        </div>
      ) : (
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <label className="block text-sm font-semibold text-white mb-1">Alert email address</label>
            <p className="text-xs text-slate-500 mb-4">Leave blank to use your account email.</p>
            <input type="email"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              placeholder="alerts@yourdomain.com" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5">
            <p className="text-sm font-semibold text-white">Notify me when…</p>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertDowntime((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertDowntime ? "bg-violet-600" : "bg-slate-700"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertDowntime ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Site is down</p>
                <p className="text-xs text-slate-500 mt-0.5">One email per incident, no repeat spam.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertSslExpiry((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertSslExpiry ? "bg-violet-600" : "bg-slate-700"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertSslExpiry ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white">SSL certificate expiring soon</p>
                <p className="text-xs text-slate-500 mt-0.5">Triggered when fewer than 14 days remain.</p>
              </div>
            </label>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <label className="block text-sm font-semibold text-white mb-1">Webhook URL</label>
            <p className="text-xs text-slate-500 mb-4">Watchdog POSTs a JSON payload on every incident — works with Slack, Discord, and any custom endpoint.</p>
            <div className="flex gap-2">
              <input type="url"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                placeholder="https://hooks.slack.com/services/…" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              <button type="button" onClick={handleTestWebhook} disabled={!webhookUrl.trim() || testState === "sending"}
                className="flex-shrink-0 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {testState === "sending" ? "Sending…" : testState === "ok" ? "Sent ✓" : testState === "error" ? "Failed ✗" : "Test"}
              </button>
            </div>
            <div className="mt-3 bg-slate-800 rounded-lg px-4 py-3 text-xs text-slate-500 font-mono leading-relaxed">
              {"{ \"event\": \"downtime\", \"monitorName\": \"…\", \"monitorUrl\": \"…\", \"startedAt\": \"…\" }"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={mutation.isPending}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-lg shadow-violet-500/20">
              {mutation.isPending ? "Saving…" : "Save settings"}
            </button>
            {saved && (
              <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </motion.span>
            )}
            {mutation.isError && <p className="text-sm text-red-400">Failed to save.</p>}
          </div>
        </motion.form>
      )}

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Agents section */}
      <AgentsSection />
    </div>
  );
}
