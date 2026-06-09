import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import type { Monitor } from "@watchdog/shared-types";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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
      className="mb-6 bg-primary border border-primary rounded-xl p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-primary">Agent monitor created — finish setup</p>
          <p className="text-xs text-primary mt-0.5">
            Agent: <span className="text-primary">{info.agentName}</span> · Run the agent runner on your server to start receiving checks.
          </p>
        </div>
        <button onClick={onDismiss} className="text-primary hover:text-primary transition-colors text-xl leading-none flex-shrink-0">×</button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-primary font-medium mb-1.5">1. Get your agent key from <Link to="/settings" className="underline hover:text-primary">Settings → Agents</Link></p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-primary font-medium">2. Create watchdog-agent.config.json</p>
            <button
              onClick={() => { navigator.clipboard.writeText(config); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="text-xs text-primary hover:text-foreground px-2 py-0.5 rounded hover:bg-primary transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-background border border-primary/50 rounded-lg p-3 text-xs text-foreground font-mono overflow-x-auto leading-relaxed">
            {config}
          </pre>
        </div>

        <div>
          <p className="text-xs text-primary font-medium mb-1.5">3. Download the runner and start it</p>
          <pre className="bg-background border border-primary/50 rounded-lg p-3 text-xs text-foreground font-mono overflow-x-auto">
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
              {monitor.agentId && (
                <span className="text-xs text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">Agent</span>
              )}
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
  const [monitoringType, setMonitoringType] = useState<"cloud" | "agent">("cloud");
  const [form, setForm] = useState({ name: "", url: "", intervalMinutes: 5, agentId: "" });
  const [agentSetup, setAgentSetup] = useState<AgentSetupInfo | null>(null);

  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: api.agents.list,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.monitors.create({
        name: form.name,
        url: form.url,
        intervalMinutes: form.intervalMinutes,
        ...(monitoringType === "agent" && form.agentId ? { agentId: form.agentId } : {}),
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
      setMonitoringType("cloud");
    },
  });

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
        <div className="grid grid-cols-2 gap-3 mb-5">
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
              <p className="text-xs text-muted-foreground mt-0.5">Your machine checks it (localhost, internal)</p>
            </div>
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
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
              {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
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
                  <Link to="/settings" className="underline hover:text-degraded">Create one in Settings</Link> first, then run the agent runner on your machine.
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
