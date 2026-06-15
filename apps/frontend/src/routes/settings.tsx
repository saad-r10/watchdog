import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../services/api";

// ─── Settings page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });

  const [alertEmail, setAlertEmail] = useState("");
  const [alertDowntime, setAlertDowntime] = useState(true);
  const [alertSslExpiry, setAlertSslExpiry] = useState(true);
  const [alertCertTransparency, setAlertCertTransparency] = useState(true);
  const [alertBlocklist, setAlertBlocklist] = useState(true);
  const [alertContentChange, setAlertContentChange] = useState(true);
  const [alertSyntheticFailure, setAlertSyntheticFailure] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "ok" | "error">("idle");

  useEffect(() => {
    if (data) {
      setAlertEmail(data.alertEmail ?? "");
      setAlertDowntime(data.alertDowntime);
      setAlertSslExpiry(data.alertSslExpiry);
      setAlertCertTransparency(data.alertCertTransparency);
      setAlertBlocklist(data.alertBlocklist);
      setAlertContentChange(data.alertContentChange);
      setAlertSyntheticFailure(data.alertSyntheticFailure);
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
    mutationFn: () => api.settings.update({ alertEmail: alertEmail.trim() || null, alertDowntime, alertSslExpiry, alertCertTransparency, alertBlocklist, alertContentChange, alertSyntheticFailure, webhookUrl: webhookUrl.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  return (
    <div className="p-4 sm:p-8 max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your alert preferences</p>
      </div>

      {/* Alert settings */}
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-6 animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-10 bg-muted rounded" />
        </div>
      ) : (
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>

          <div className="bg-card rounded-xl border border-border p-6">
            <label className="block text-sm font-semibold text-foreground mb-1">Alert email address</label>
            <p className="text-xs text-muted-foreground mb-4">Leave blank to use your account email.</p>
            <input type="email"
              className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              placeholder="alerts@yourdomain.com" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <p className="text-sm font-semibold text-foreground">Notify me when…</p>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertDowntime((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertDowntime ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertDowntime ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Site is down</p>
                <p className="text-xs text-muted-foreground mt-0.5">One email per incident, no repeat spam.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertSslExpiry((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertSslExpiry ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertSslExpiry ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">SSL certificate expiring soon</p>
                <p className="text-xs text-muted-foreground mt-0.5">Triggered when fewer than 14 days remain.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertCertTransparency((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertCertTransparency ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertCertTransparency ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">New certificate detected</p>
                <p className="text-xs text-muted-foreground mt-0.5">A Certificate Transparency log shows a new cert for your domain — possible compromise or shadow IT.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertBlocklist((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertBlocklist ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertBlocklist ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Domain appears on a blocklist</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your domain shows up on URLhaus or Spamhaus DBL — often a sign of compromise or malware injection.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertContentChange((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertContentChange ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertContentChange ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Page content changes unexpectedly</p>
                <p className="text-xs text-muted-foreground mt-0.5">For monitors with defacement detection enabled — alerts when the page content hash changes.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertSyntheticFailure((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertSyntheticFailure ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertSyntheticFailure ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Scripted transaction fails</p>
                <p className="text-xs text-muted-foreground mt-0.5">For synthetic monitors — alerts when a step in the scripted browser flow fails (e.g. broken login).</p>
              </div>
            </label>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <label className="block text-sm font-semibold text-foreground mb-1">Webhook URL</label>
            <p className="text-xs text-muted-foreground mb-4">Watchdog POSTs a JSON payload on every incident — works with Slack, Discord, and any custom endpoint.</p>
            <div className="flex gap-2">
              <input type="url"
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                placeholder="https://hooks.slack.com/services/…" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              <button type="button" onClick={handleTestWebhook} disabled={!webhookUrl.trim() || testState === "sending"}
                className="flex-shrink-0 bg-muted border border-border text-foreground hover:text-foreground hover:border-border disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {testState === "sending" ? "Sending…" : testState === "ok" ? "Sent ✓" : testState === "error" ? "Failed ✗" : "Test"}
              </button>
            </div>
            <div className="mt-3 bg-muted rounded-lg px-4 py-3 text-xs text-muted-foreground font-mono leading-relaxed">
              {"{ \"event\": \"downtime\", \"monitorName\": \"…\", \"monitorUrl\": \"…\", \"startedAt\": \"…\" }"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={mutation.isPending}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm shadow-primary/20">
              {mutation.isPending ? "Saving…" : "Save settings"}
            </button>
            {saved && (
              <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-up font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </motion.span>
            )}
            {mutation.isError && <p className="text-sm text-down">Failed to save.</p>}
          </div>
        </motion.form>
      )}
    </div>
  );
}
