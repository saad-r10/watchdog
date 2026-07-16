import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { usePushNotifications } from "../hooks/usePushNotifications";

// ─── Settings page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });

  // MFA state machine: idle → setup (show QR) → enable (verify code) | disable
  const [mfaState, setMfaState] = useState<"idle" | "setup" | "disable">("idle");
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  async function handleMfaSetup() {
    setMfaLoading(true);
    setMfaError("");
    try {
      const data = await api.auth.mfaSetup();
      setMfaSetup({ secret: data.secret, qrCode: data.qrCode });
      setMfaState("setup");
    } catch (err: any) {
      setMfaError(err?.response?.data?.error ?? "Failed to start MFA setup.");
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleMfaEnable() {
    setMfaLoading(true);
    setMfaError("");
    try {
      await api.auth.mfaEnable(mfaCode);
      setUser(user ? { ...user, mfaEnabled: true } : user);
      setMfaState("idle");
      setMfaSetup(null);
      setMfaCode("");
    } catch {
      setMfaError("Invalid code. Please try again.");
      setMfaCode("");
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleMfaDisable() {
    setMfaLoading(true);
    setMfaError("");
    try {
      await api.auth.mfaDisable(mfaCode);
      setUser(user ? { ...user, mfaEnabled: false } : user);
      setMfaState("idle");
      setMfaCode("");
    } catch {
      setMfaError("Invalid code. Please try again.");
      setMfaCode("");
    } finally {
      setMfaLoading(false);
    }
  }

  const [alertEmail, setAlertEmail] = useState("");
  const [alertDowntime, setAlertDowntime] = useState(true);
  const [alertSslExpiry, setAlertSslExpiry] = useState(true);
  const [alertCertTransparency, setAlertCertTransparency] = useState(true);
  const [alertBlocklist, setAlertBlocklist] = useState(true);
  const [alertContentChange, setAlertContentChange] = useState(true);
  const [alertSyntheticFailure, setAlertSyntheticFailure] = useState(true);
  const [alertPerformanceDegraded, setAlertPerformanceDegraded] = useState(true);
  const [alertLighthouseBudget, setAlertLighthouseBudget] = useState(true);
  const [alertWebPush, setAlertWebPush] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [testSlackState, setTestSlackState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [testDiscordState, setTestDiscordState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [testTelegramState, setTestTelegramState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [testPushState, setTestPushState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const push = usePushNotifications();

  useEffect(() => {
    if (data) {
      setAlertEmail(data.alertEmail ?? "");
      setAlertDowntime(data.alertDowntime);
      setAlertSslExpiry(data.alertSslExpiry);
      setAlertCertTransparency(data.alertCertTransparency);
      setAlertBlocklist(data.alertBlocklist);
      setAlertContentChange(data.alertContentChange);
      setAlertSyntheticFailure(data.alertSyntheticFailure);
      setAlertPerformanceDegraded(data.alertPerformanceDegraded);
      setAlertLighthouseBudget(data.alertLighthouseBudget);
      setAlertWebPush(data.alertWebPush);
      setWebhookUrl(data.webhookUrl ?? "");
      setSlackWebhookUrl(data.slackWebhookUrl ?? "");
      setDiscordWebhookUrl(data.discordWebhookUrl ?? "");
      setTelegramBotToken(data.telegramBotToken ?? "");
      setTelegramChatId(data.telegramChatId ?? "");
    }
  }, [data]);

  async function handleTestWebhook() {
    setTestState("sending");
    try { await api.settings.testWebhook(); setTestState("ok"); }
    catch { setTestState("error"); }
    finally { setTimeout(() => setTestState("idle"), 3000); }
  }

  async function handleTestSlack() {
    setTestSlackState("sending");
    try { await api.settings.testSlack(); setTestSlackState("ok"); }
    catch { setTestSlackState("error"); }
    finally { setTimeout(() => setTestSlackState("idle"), 3000); }
  }

  async function handleTestDiscord() {
    setTestDiscordState("sending");
    try { await api.settings.testDiscord(); setTestDiscordState("ok"); }
    catch { setTestDiscordState("error"); }
    finally { setTimeout(() => setTestDiscordState("idle"), 3000); }
  }

  async function handleTestTelegram() {
    setTestTelegramState("sending");
    try { await api.settings.testTelegram(); setTestTelegramState("ok"); }
    catch { setTestTelegramState("error"); }
    finally { setTimeout(() => setTestTelegramState("idle"), 3000); }
  }

  async function handleTestPush() {
    setTestPushState("sending");
    try { await api.settings.testPush(); setTestPushState("ok"); }
    catch { setTestPushState("error"); }
    finally { setTimeout(() => setTestPushState("idle"), 3000); }
  }

  const mutation = useMutation({
    mutationFn: () => api.settings.update({ alertEmail: alertEmail.trim() || null, alertDowntime, alertSslExpiry, alertCertTransparency, alertBlocklist, alertContentChange, alertSyntheticFailure, alertPerformanceDegraded, alertLighthouseBudget, alertWebPush, webhookUrl: webhookUrl.trim() || null, slackWebhookUrl: slackWebhookUrl.trim() || null, discordWebhookUrl: discordWebhookUrl.trim() || null, telegramBotToken: telegramBotToken.trim() || null, telegramChatId: telegramChatId.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  return (
    <div className="p-4 sm:p-8 max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your alert preferences</p>
      </div>

      {/* MFA */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {user?.mfaEnabled ? (
              <ShieldCheck className="w-4 h-4 text-up" />
            ) : (
              <ShieldOff className="w-4 h-4 text-muted-foreground" />
            )}
            <p className="text-sm font-semibold text-foreground">Two-factor authentication</p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user?.mfaEnabled ? "bg-up/10 text-up" : "bg-muted text-muted-foreground"}`}>
            {user?.mfaEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {mfaState === "idle" && !user?.mfaEnabled && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Use an authenticator app (like Google Authenticator or 1Password) to require a time-based code at login.
            </p>
            <button type="button" onClick={handleMfaSetup} disabled={mfaLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {mfaLoading ? "Loading…" : "Set up authenticator"}
            </button>
            {mfaError && <p className="text-xs text-down">{mfaError}</p>}
          </div>
        )}

        {mfaState === "setup" && mfaSetup && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            <img src={mfaSetup.qrCode} alt="MFA QR code" className="w-40 h-40 rounded-lg border border-border" />
            <p className="text-xs text-muted-foreground font-mono break-all">
              Manual key: <span className="text-foreground">{mfaSetup.secret}</span>
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                className="w-32 text-center bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring tracking-widest"
              />
              <button type="button" onClick={handleMfaEnable} disabled={mfaLoading || mfaCode.length !== 6}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {mfaLoading ? "Verifying…" : "Enable"}
              </button>
              <button type="button" onClick={() => { setMfaState("idle"); setMfaCode(""); setMfaError(""); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
            {mfaError && <p className="text-xs text-down">{mfaError}</p>}
          </div>
        )}

        {mfaState === "idle" && user?.mfaEnabled && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Your account is protected. To disable, enter your current authenticator code.
            </p>
            <button type="button" onClick={() => setMfaState("disable")}
              className="bg-muted border border-border text-foreground hover:border-ring px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Disable authenticator
            </button>
          </div>
        )}

        {mfaState === "disable" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Enter your authenticator code to confirm.</p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                className="w-32 text-center bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring tracking-widest"
              />
              <button type="button" onClick={handleMfaDisable} disabled={mfaLoading || mfaCode.length !== 6}
                className="bg-down/90 text-white hover:bg-down disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {mfaLoading ? "Disabling…" : "Disable MFA"}
              </button>
              <button type="button" onClick={() => { setMfaState("idle"); setMfaCode(""); setMfaError(""); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
            {mfaError && <p className="text-xs text-down">{mfaError}</p>}
          </div>
        )}
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
                <p className="text-xs text-muted-foreground mt-0.5">A new security certificate was issued for your domain without your knowledge - may indicate unauthorized access.</p>
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
                <p className="text-xs text-muted-foreground mt-0.5">Your domain appears on a spam or malware blocklist - often a sign that your site has been compromised.</p>
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
                <p className="text-xs text-muted-foreground mt-0.5">For monitors with content change detection enabled - alerts when your page content changes unexpectedly.</p>
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
                <p className="text-sm font-medium text-foreground">Automated workflow test fails</p>
                <p className="text-xs text-muted-foreground mt-0.5">For monitors that simulate user actions - alerts when a step fails (e.g. login form breaks).</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertPerformanceDegraded((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertPerformanceDegraded ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertPerformanceDegraded ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Response times are abnormally slow</p>
                <p className="text-xs text-muted-foreground mt-0.5">Alerts when a monitor's response time is a statistical outlier vs. its recent baseline.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5">
                <div onClick={() => setAlertLighthouseBudget((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertLighthouseBudget ? "bg-primary" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertLighthouseBudget ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Website quality scores drop below target</p>
                <p className="text-xs text-muted-foreground mt-0.5">For monitors with quality checks enabled - alerts when performance, accessibility, best practices, or SEO scores drop too low.</p>
              </div>
            </label>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <label className="block text-sm font-semibold text-foreground mb-1">Webhook URL</label>
            <p className="text-xs text-muted-foreground mb-4">Watchdog sends an HTTP notification to your URL on every incident - works with Zapier, Make, or any custom endpoint.</p>
            <div className="flex gap-2">
              <input type="url"
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                placeholder="https://example.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              <button type="button" onClick={handleTestWebhook} disabled={!webhookUrl.trim() || testState === "sending"}
                className="flex-shrink-0 bg-muted border border-border text-foreground hover:text-foreground hover:border-border disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {testState === "sending" ? "Sending…" : testState === "ok" ? "Sent ✓" : testState === "error" ? "Failed ✗" : "Test"}
              </button>
            </div>
            <div className="mt-3 bg-muted rounded-lg px-4 py-3 text-xs text-muted-foreground font-mono leading-relaxed">
              {"{ \"event\": \"downtime\", \"monitorName\": \"…\", \"monitorUrl\": \"…\", \"startedAt\": \"…\" }"}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <label className="block text-sm font-semibold text-foreground mb-1">Slack</label>
            <p className="text-xs text-muted-foreground mb-4">Paste an <span className="font-medium text-foreground">Incoming Webhook URL</span> from your Slack app (Settings → Integrations → Incoming Webhooks) to receive alerts in a channel.</p>
            <div className="flex gap-2">
              <input type="url"
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                placeholder="https://hooks.slack.com/services/…" value={slackWebhookUrl} onChange={(e) => setSlackWebhookUrl(e.target.value)} />
              <button type="button" onClick={handleTestSlack} disabled={!slackWebhookUrl.trim() || testSlackState === "sending"}
                className="flex-shrink-0 bg-muted border border-border text-foreground hover:text-foreground hover:border-border disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {testSlackState === "sending" ? "Sending…" : testSlackState === "ok" ? "Sent ✓" : testSlackState === "error" ? "Failed ✗" : "Test"}
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <label className="block text-sm font-semibold text-foreground mb-1">Discord</label>
            <p className="text-xs text-muted-foreground mb-4">Paste a <span className="font-medium text-foreground">webhook URL</span> from your Discord channel settings → Integrations → Webhooks to receive alerts in a channel.</p>
            <div className="flex gap-2">
              <input type="url"
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                placeholder="https://discord.com/api/webhooks/…" value={discordWebhookUrl} onChange={(e) => setDiscordWebhookUrl(e.target.value)} />
              <button type="button" onClick={handleTestDiscord} disabled={!discordWebhookUrl.trim() || testDiscordState === "sending"}
                className="flex-shrink-0 bg-muted border border-border text-foreground hover:text-foreground hover:border-border disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {testDiscordState === "sending" ? "Sending…" : testDiscordState === "ok" ? "Sent ✓" : testDiscordState === "error" ? "Failed ✗" : "Test"}
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <label className="block text-sm font-semibold text-foreground mb-1">Telegram</label>
            <p className="text-xs text-muted-foreground mb-4">Create a Telegram bot via <span className="font-medium text-foreground">@BotFather</span> on Telegram, then paste the bot token and the chat or group ID where alerts should be sent.</p>
            <div className="space-y-3">
              <input type="text"
                className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                placeholder="Bot token (e.g. 123456:ABC-DEF…)" value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)} />
              <div className="flex gap-2">
                <input type="text"
                  className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                  placeholder="Chat ID (e.g. -1001234567890)" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} />
                <button type="button" onClick={handleTestTelegram} disabled={!telegramBotToken.trim() || !telegramChatId.trim() || testTelegramState === "sending"}
                  className="flex-shrink-0 bg-muted border border-border text-foreground hover:text-foreground hover:border-border disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  {testTelegramState === "sending" ? "Sending…" : testTelegramState === "ok" ? "Sent ✓" : testTelegramState === "error" ? "Failed ✗" : "Test"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <label className="block text-sm font-semibold text-foreground mb-1">Browser Push Notifications</label>
            <p className="text-xs text-muted-foreground mb-4">
              Get real-time alerts directly in your browser, even when this tab is closed. No extra apps needed.
            </p>
            {push.state === "unsupported" ? (
              <p className="text-xs text-muted-foreground">Your browser does not support Web Push notifications.</p>
            ) : push.state === "denied" ? (
              <p className="text-xs text-down">Notifications are blocked. Allow them in your browser settings and reload the page.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {push.state === "subscribed" ? (
                    <button type="button" onClick={push.unsubscribe}
                      className="bg-muted border border-border text-foreground hover:border-ring px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Unsubscribe this browser
                    </button>
                  ) : (
                    <button type="button" onClick={push.subscribe} disabled={push.state === "loading"}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      {push.state === "loading" ? "Connecting…" : "Subscribe this browser"}
                    </button>
                  )}
                  {push.state === "subscribed" && (
                    <button type="button" onClick={handleTestPush} disabled={testPushState === "sending"}
                      className="bg-muted border border-border text-foreground hover:border-ring disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      {testPushState === "sending" ? "Sending…" : testPushState === "ok" ? "Sent ✓" : testPushState === "error" ? "Failed ✗" : "Send test"}
                    </button>
                  )}
                </div>
                {push.state === "subscribed" && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setAlertWebPush((v) => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${alertWebPush ? "bg-primary" : "bg-muted"}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertWebPush ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                    <span className="text-sm text-foreground">Enable push alerts for this account</span>
                  </label>
                )}
              </div>
            )}
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
