import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import { SyntheticStepsSchema } from "@watchdog/shared-types";
import type { Agent, AgentWithKey, Monitor, SyntheticStep } from "@watchdog/shared-types";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ─── Agent helpers ────────────────────────────────────────────────────────────

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
        <p className="text-xs text-muted-foreground">watchdog-agent.config.json</p>
        <button onClick={() => { navigator.clipboard.writeText(config); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-background border border-border rounded-lg p-3 text-xs text-foreground font-mono overflow-x-auto leading-relaxed">
        {placeholder ? config.replace(agentKey, "wdg_<your-key>") : config}
      </pre>
      {placeholder && (
        <p className="text-xs text-muted-foreground/60 mt-1.5">Replace <code className="text-muted-foreground">wdg_&lt;your-key&gt;</code> with the key you copied when this agent was created.</p>
      )}
    </div>
  );
}

function AgentRow({ agent, allMonitors, onRevoke }: { agent: Agent; allMonitors: Monitor[]; onRevoke: (id: string) => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [region, setRegion] = useState(agent.region ?? "");
  const online = isOnline(agent.lastSeenAt);
  const assignedIds = new Set(agent.monitors.map((m) => m.id));
  const unassigned = allMonitors.filter((m) => !assignedIds.has(m.id));

  const assignMutation = useMutation({
    mutationFn: (monitorId: string) => api.monitors.assignAgent(monitorId, agent.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["monitors"] }); },
  });
  const unassignMutation = useMutation({
    mutationFn: (monitorId: string) => api.monitors.unassignAgent(monitorId, agent.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["monitors"] }); },
  });
  const updateRegionMutation = useMutation({
    mutationFn: (region: string) => api.agents.update(agent.id, { region: region || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["monitors"] }); },
  });

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-up shadow-[0_0_6px_#3FB950]" : "bg-muted-foreground/40"}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{agent.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last seen: {timeSince(agent.lastSeenAt)}
              {agent.region && <span className="ml-2 text-muted-foreground/60">· {agent.region}</span>}
              {agent.monitors.length > 0 && <span className="ml-2 text-muted-foreground/60">· {agent.monitors.length} monitor{agent.monitors.length !== 1 ? "s" : ""}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${online ? "text-up border-up/30 bg-up/10" : "text-muted-foreground border-border bg-muted"}`}>
            {online ? "Online" : "Offline"}
          </span>
          <svg className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 border-t border-border/60 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Region</p>
                <input
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                  placeholder="e.g. us-east, eu-west"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  onBlur={() => { if (region !== (agent.region ?? "")) updateRegionMutation.mutate(region); }}
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assigned monitors</p>
                {agent.monitors.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">No monitors assigned yet.</p>
                ) : (
                  <div className="space-y-1">
                    {agent.monitors.map((m) => (
                      <div key={m.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.url}</p>
                        </div>
                        <button onClick={() => unassignMutation.mutate(m.id)} disabled={unassignMutation.isPending}
                          className="text-xs text-muted-foreground hover:text-down ml-3 flex-shrink-0 disabled:opacity-50 transition-colors">
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {unassigned.length > 0 && (
                  <div className="mt-2">
                    <select className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                      defaultValue="" onChange={(e) => { if (e.target.value) { assignMutation.mutate(e.target.value); e.target.value = ""; } }} disabled={assignMutation.isPending}>
                      <option value="" disabled>Assign a monitor…</option>
                      {unassigned.map((m) => <option key={m.id} value={m.id}>{m.name} - {m.url}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Config file</p>
                <ConfigSnippet agentKey="wdg_<your-key>" monitors={agent.monitors} placeholder />
              </div>

              <div className="flex items-center gap-2 pt-1">
                {confirmRevoke ? (
                  <>
                    <span className="text-xs text-muted-foreground">Revoke this agent? Its key will stop working.</span>
                    <button onClick={() => { onRevoke(agent.id); setConfirmRevoke(false); }}
                      className="text-xs text-down hover:text-down px-3 py-1.5 rounded-lg hover:bg-down/10 transition-colors font-medium">Revoke</button>
                    <button onClick={() => setConfirmRevoke(false)}
                      className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmRevoke(true)}
                    className="text-xs text-muted-foreground hover:text-down px-3 py-1.5 rounded-lg hover:bg-accent transition-colors">
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
    <div id="agents" className="bg-card rounded-xl border border-border p-6 mb-6 scroll-mt-8 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Agents</h2>
        <p className="text-xs text-muted-foreground mt-1">Run an agent on your own server to monitor localhost or internal URLs. Create one here, then pick it under "Agent" above.</p>
      </div>

      {/* New agent key banner */}
      <AnimatePresence>
        {newAgent && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-up/10 border border-up/20 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-semibold text-up">Agent created - copy your key now</p>
                <p className="text-xs text-muted-foreground mt-0.5">This key will not be shown again.</p>
              </div>
              <button onClick={() => setNewAgent(null)} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">×</button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-xs text-foreground font-mono break-all">{newAgent.key}</code>
              <button onClick={() => { navigator.clipboard.writeText(newAgent.key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }}
                className="flex-shrink-0 bg-up text-up-foreground hover:bg-up/90 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors">
                {copiedKey ? "Copied!" : "Copy key"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Download the runner and start it on your server:
            </p>
            <pre className="bg-background border border-border rounded-lg p-3 text-xs text-foreground font-mono overflow-x-auto">
{`curl -o agent-runner.js ${import.meta.env.VITE_API_URL ?? ""}/api/agents/runner
node agent-runner.js watchdog-agent.config.json`}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name }); }}>
        <input
          className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
          placeholder="Agent name (e.g. prod-server)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" disabled={createMutation.isPending}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm shadow-primary/20 whitespace-nowrap">
          {createMutation.isPending ? "Creating…" : "New agent"}
        </button>
      </form>

      {/* Agent list */}
      {isLoading ? (
        <div className="border border-border rounded-xl p-4 animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-1/4" />
        </div>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 py-2">No agents yet.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} allMonitors={monitors} onRevoke={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

interface AgentSetupInfo {
  monitorId: string;
  url: string;
  intervalMinutes: number;
  agentName: string;
}

function AgentSetupBanner({ info, onDismiss }: { info: AgentSetupInfo; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const config = JSON.stringify({
    agentKey: "wdg_<your-key-from-settings>",
    watchdogUrl: BACKEND_URL,
    monitors: [{ monitorId: info.monitorId, url: info.url, intervalMinutes: info.intervalMinutes }],
  }, null, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mb-6 bg-primary/10 border border-primary/20 rounded-xl p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Agent monitor created - finish setup</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agent: <span className="text-foreground font-medium">{info.agentName}</span> · Run the agent runner on your server to start receiving checks.
          </p>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none flex-shrink-0">×</button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-foreground font-medium mb-1.5">1. Get your agent key from the <a href="#agents" className="text-primary underline hover:text-primary/80">Agents section</a> below</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-foreground font-medium">2. Create watchdog-agent.config.json</p>
            <button
              onClick={() => { navigator.clipboard.writeText(config); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-background border border-border rounded-lg p-3 text-xs text-foreground font-mono overflow-x-auto leading-relaxed">
            {config}
          </pre>
        </div>

        <div>
          <p className="text-xs text-foreground font-medium mb-1.5">3. Download the runner and start it</p>
          <pre className="bg-background border border-border rounded-lg p-3 text-xs text-foreground font-mono overflow-x-auto">
{`curl -o agent-runner.js ${import.meta.env.VITE_API_URL ?? ""}/api/agents/runner
node agent-runner.js watchdog-agent.config.json`}
          </pre>
        </div>
      </div>
    </motion.div>
  );
}

const INTERVALS = [
  { label: "Every 1 min", value: 1 },
  { label: "Every 5 min", value: 5 },
  { label: "Every 15 min", value: 15 },
  { label: "Every 30 min", value: 30 },
  { label: "Every 60 min", value: 60 },
];

const SYNTHETIC_INTERVALS = INTERVALS.filter((i) => i.value >= 5);

const SYNTHETIC_STEPS_EXAMPLE: SyntheticStep[] = [
  { action: "navigate", url: "https://example.com/login" },
  { action: "fill", selector: "#username", value: "demo@example.com" },
  { action: "fill", selector: "#password", value: "password123" },
  { action: "click", selector: "#login-button" },
  { action: "assert_text", selector: "h1", text: "Dashboard" },
];

function intervalLabel(minutes: number) {
  if (minutes === 1) return "every 1m";
  if (minutes < 60) return `every ${minutes}m`;
  return "every 60m";
}

interface EditForm {
  name: string;
  url: string;
  intervalMinutes: number;
}

function MonitorRow({ monitor, onDelete }: { monitor: Monitor; onDelete: (id: string) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: monitor.name,
    url: monitor.url,
    intervalMinutes: monitor.intervalMinutes,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<EditForm> & { isActive?: boolean }) =>
      api.monitors.update(monitor.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(false);
    },
  });

  const isPaused = !monitor.isActive;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`border-b border-border last:border-0 transition-colors ${isPaused ? "opacity-50" : ""}`}
    >
      {editing ? (
        <form
          className="px-5 py-4 space-y-3"
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(editForm); }}
        >
          <div className="flex gap-3">
            <input
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              placeholder="Name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
            <select
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              value={editForm.intervalMinutes}
              onChange={(e) => setEditForm((f) => ({ ...f, intervalMinutes: Number(e.target.value) }))}
            >
              {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <input
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            placeholder="https://example.com"
            value={editForm.url}
            onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
            required
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={updateMutation.isPending}
              className="bg-primary text-foreground px-4 py-1.5 rounded-lg hover:bg-primary disabled:opacity-50 text-sm font-medium transition-colors">
              {updateMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button"
              onClick={() => { setEditing(false); setEditForm({ name: monitor.name, url: monitor.url, intervalMinutes: monitor.intervalMinutes }); }}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors">
              Cancel
            </button>
            {updateMutation.isError && <span className="text-xs text-down">Failed to save.</span>}
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors group">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/monitors/${monitor.id}`}
                className="font-medium text-sm text-foreground hover:text-primary transition-colors">
                {monitor.name}
              </Link>
              {isPaused && (
                <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">Paused</span>
              )}
              {monitor.agents.map((a) => (
                <span key={a.id} className="text-xs text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                  {a.region ?? a.name}
                </span>
              ))}
              <span className="text-xs text-muted-foreground/60">{intervalLabel(monitor.intervalMinutes)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{monitor.url}</p>
          </div>

          <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors" title="Edit">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={() => updateMutation.mutate({ isActive: isPaused })} disabled={updateMutation.isPending}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-50" title={isPaused ? "Resume" : "Pause"}>
              {isPaused ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button onClick={() => onDelete(monitor.id)}
                  className="text-xs text-down hover:text-down px-2 py-1 rounded hover:bg-down/10 transition-colors font-medium">
                  Confirm
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-muted-foreground hover:text-down rounded-lg hover:bg-accent transition-colors" title="Delete">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function MonitorsPage() {
  const qc = useQueryClient();
  const [monitoringType, setMonitoringType] = useState<"cloud" | "agent" | "synthetic">("cloud");
  const [form, setForm] = useState({ name: "", url: "", intervalMinutes: 5, agentId: "" });
  const [agentSetup, setAgentSetup] = useState<AgentSetupInfo | null>(null);
  const [syntheticStepsText, setSyntheticStepsText] = useState("");
  const [syntheticStepsError, setSyntheticStepsError] = useState<string | null>(null);

  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: api.agents.list,
  });

  const createMutation = useMutation({
    mutationFn: (syntheticSteps?: SyntheticStep[]) =>
      api.monitors.create({
        name: form.name,
        url: form.url,
        intervalMinutes: form.intervalMinutes,
        ...(monitoringType === "agent" && form.agentId ? { agentId: form.agentId } : {}),
        ...(monitoringType === "synthetic" ? { type: "synthetic" as const, syntheticSteps } : {}),
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (monitoringType === "agent" && form.agentId) {
        const agent = agents.find((a) => a.id === form.agentId);
        setAgentSetup({
          monitorId: created.id,
          url: created.url,
          intervalMinutes: created.intervalMinutes,
          agentName: agent?.name ?? "your agent",
        });
      }
      setForm({ name: "", url: "", intervalMinutes: 5, agentId: "" });
      setSyntheticStepsText("");
      setSyntheticStepsError(null);
      setMonitoringType("cloud");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (monitoringType === "synthetic") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(syntheticStepsText);
      } catch {
        setSyntheticStepsError("Steps must be valid JSON");
        return;
      }
      const result = SyntheticStepsSchema.safeParse(parsed);
      if (!result.success) {
        setSyntheticStepsError(result.error.issues[0]?.message ?? "Invalid steps");
        return;
      }
      setSyntheticStepsError(null);
      createMutation.mutate(result.data);
      return;
    }
    createMutation.mutate(undefined);
  }

  const deleteMutation = useMutation({
    mutationFn: api.monitors.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const active = monitors.filter((m) => m.isActive);
  const paused = monitors.filter((m) => !m.isActive);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Monitors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {monitors.length > 0
            ? `${active.length} active${paused.length > 0 ? `, ${paused.length} paused` : ""}`
            : "Manage the URLs Watchdog checks on a schedule"}
        </p>
      </div>

      {/* Agent setup banner */}
      <AnimatePresence>
        {agentSetup && <AgentSetupBanner info={agentSetup} onDismiss={() => setAgentSetup(null)} />}
      </AnimatePresence>

      {/* Add monitor form */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Add a monitor</h2>

        {/* Monitoring type toggle */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setMonitoringType("cloud")}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              monitoringType === "cloud"
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-muted/50 hover:border-border"
            }`}
          >
            <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${monitoringType === "cloud" ? "text-primary" : "text-muted-foreground"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <div>
              <p className={`text-xs font-semibold ${monitoringType === "cloud" ? "text-primary" : "text-foreground"}`}>Cloud</p>
              <p className="text-xs text-muted-foreground mt-0.5">Watchdog checks from our servers</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMonitoringType("agent")}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              monitoringType === "agent"
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-muted/50 hover:border-border"
            }`}
          >
            <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${monitoringType === "agent" ? "text-primary" : "text-muted-foreground"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 002 2h2a2 2 0 002-2M9 3h6" />
            </svg>
            <div>
              <p className={`text-xs font-semibold ${monitoringType === "agent" ? "text-primary" : "text-foreground"}`}>Agent</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your own server checks it — good for internal or local services</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMonitoringType("synthetic");
              if (form.intervalMinutes < 5) setForm((f) => ({ ...f, intervalMinutes: 5 }));
            }}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              monitoringType === "synthetic"
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-muted/50 hover:border-border"
            }`}
          >
            <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${monitoringType === "synthetic" ? "text-primary" : "text-muted-foreground"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <p className={`text-xs font-semibold ${monitoringType === "synthetic" ? "text-primary" : "text-foreground"}`}>Automated User Test</p>
              <p className="text-xs text-muted-foreground mt-0.5">Simulate a real user flow (login, checkout, form submit, etc.)</p>
            </div>
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={handleSubmit}
        >
          <div className="flex gap-3">
            <input
              className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              placeholder="Name (e.g. My Blog)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <select
              className="bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              value={form.intervalMinutes}
              onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: Number(e.target.value) }))}
            >
              {(monitoringType === "synthetic" ? SYNTHETIC_INTERVALS : INTERVALS).map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>

          <input
            className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
            placeholder={monitoringType === "agent" ? "http://localhost:3000" : "https://example.com"}
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            required
          />

          {monitoringType === "agent" && (
            <div>
              {agents.length === 0 ? (
                <p className="text-xs text-degraded bg-degraded/10 border border-degraded/20 rounded-lg px-3 py-2.5">
                  No agents set up yet.{" "}
                  <a href="#agents" className="underline hover:text-degraded">Create one below</a> first, then run the agent runner on your machine.
                </p>
              ) : (
                <select
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                  value={form.agentId}
                  onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
                  required
                >
                  <option value="">Select an agent…</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {monitoringType === "synthetic" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-foreground">Transaction steps (JSON)</p>
                <button
                  type="button"
                  onClick={() => { setSyntheticStepsText(JSON.stringify(SYNTHETIC_STEPS_EXAMPLE, null, 2)); setSyntheticStepsError(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors"
                >
                  Load example
                </button>
              </div>
              <textarea
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                rows={10}
                placeholder={JSON.stringify(SYNTHETIC_STEPS_EXAMPLE, null, 2)}
                value={syntheticStepsText}
                onChange={(e) => { setSyntheticStepsText(e.target.value); setSyntheticStepsError(null); }}
                required
              />
              <p className="text-xs text-muted-foreground/60 mt-1.5">
                A list of steps: navigate, fill, click, assert_text, assert_status. The first step must be a "navigate".
              </p>
              {syntheticStepsError && <p className="text-xs text-down mt-1.5">{syntheticStepsError}</p>}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={createMutation.isPending || (monitoringType === "agent" && agents.length === 0)}
              className="bg-primary text-foreground px-5 py-2.5 rounded-lg hover:bg-primary disabled:opacity-50 text-sm font-medium transition-colors shadow-lg shadow-primary/20"
            >
              {createMutation.isPending ? "Adding…" : "Add monitor"}
            </button>
            {createMutation.isError && <p className="text-down text-sm">Failed to add monitor.</p>}
          </div>
        </form>
      </div>

      {/* Agents - create/manage agents that power "Agent" monitors above */}
      <AgentsSection />

      {/* Monitor list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : monitors.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No monitors yet. Add one above.</p>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <AnimatePresence initial={false}>
            {monitors.map((m) => (
              <MonitorRow key={m.id} monitor={m} onDelete={(id) => deleteMutation.mutate(id)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
