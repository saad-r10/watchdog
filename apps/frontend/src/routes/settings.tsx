import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../services/api";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
  });

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
    try {
      await api.settings.testWebhook();
      setTestState("ok");
    } catch {
      setTestState("error");
    } finally {
      setTimeout(() => setTestState("idle"), 3000);
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.settings.update({
        alertEmail: alertEmail.trim() || null,
        alertDowntime,
        alertSslExpiry,
        webhookUrl: webhookUrl.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure how and when Watchdog alerts you</p>
      </div>

      {isLoading ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 animate-pulse space-y-4">
          <div className="h-4 bg-slate-800 rounded w-1/3" />
          <div className="h-10 bg-slate-800 rounded" />
          <div className="h-4 bg-slate-800 rounded w-1/4" />
        </div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {/* Alert email */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <label className="block text-sm font-semibold text-white mb-1">
              Alert email address
            </label>
            <p className="text-xs text-slate-500 mb-4">
              Leave blank to use your account email. Alerts are sent here when an incident is detected.
            </p>
            <input
              type="email"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              placeholder="alerts@yourdomain.com"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
            />
          </div>

          {/* Alert toggles */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5">
            <p className="text-sm font-semibold text-white">Notify me when…</p>

            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div
                  onClick={() => setAlertDowntime((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertDowntime ? "bg-violet-600" : "bg-slate-700"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertDowntime ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-slate-200">Site is down</p>
                <p className="text-xs text-slate-500 mt-0.5">One email per incident, no repeat spam.</p>
              </div>
            </label>

            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div
                  onClick={() => setAlertSslExpiry((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertSslExpiry ? "bg-violet-600" : "bg-slate-700"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertSslExpiry ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-slate-200">SSL certificate expiring soon</p>
                <p className="text-xs text-slate-500 mt-0.5">Triggered when fewer than 14 days remain.</p>
              </div>
            </label>
          </div>

          {/* Webhook */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <label className="block text-sm font-semibold text-white mb-1">
              Webhook URL
            </label>
            <p className="text-xs text-slate-500 mb-4">
              Watchdog will POST a JSON payload to this URL on every incident — works with Slack, Discord, and any custom endpoint.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                placeholder="https://hooks.slack.com/services/…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={!webhookUrl.trim() || testState === "sending"}
                className="flex-shrink-0 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {testState === "sending" ? "Sending…" : testState === "ok" ? "Sent ✓" : testState === "error" ? "Failed ✗" : "Test"}
              </button>
            </div>
            <div className="mt-3 bg-slate-800 rounded-lg px-4 py-3 text-xs text-slate-500 font-mono leading-relaxed">
              {"{ \"event\": \"downtime\", \"monitorName\": \"…\", \"monitorUrl\": \"…\", \"startedAt\": \"…\" }"}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
            >
              {mutation.isPending ? "Saving…" : "Save settings"}
            </button>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-emerald-400 font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </motion.span>
            )}
            {mutation.isError && (
              <p className="text-sm text-red-400">Failed to save.</p>
            )}
          </div>
        </motion.form>
      )}
    </div>
  );
}
