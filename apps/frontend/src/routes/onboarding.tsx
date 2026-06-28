import { useState } from "react";
import { WatchdogMark } from "@/components/WatchdogMark";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";

const ONBOARDING_KEY = "onboarding_completed";
export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, "1");
}
export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}

const STEP_COUNT = 3;

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < step ? "w-6 bg-primary" : i === step ? "w-6 bg-primary" : "w-3 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

const variants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (isOnboardingDone()) {
    navigate("/dashboard", { replace: true });
    return null;
  }
  const [step, setStep] = useState(0);
  const [monitorName, setMonitorName] = useState("");
  const [monitorUrl, setMonitorUrl] = useState("");
  const [alertEmail, setAlertEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function skip() {
    markOnboardingDone();
    navigate("/dashboard");
  }

  async function handleAddMonitor(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.monitors.create({ name: monitorName.trim(), url: monitorUrl.trim(), intervalMinutes: 1 });
      setStep(2);
    } catch {
      setError("Couldn't add monitor. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAlerts(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (alertEmail.trim()) {
        await api.settings.update({ alertEmail: alertEmail.trim(), alertDowntime: true, alertSslExpiry: true, webhookUrl: null });
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
    markOnboardingDone();
    setStep(3);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <WatchdogMark className="w-[18px] h-[18px] text-foreground" />
          </div>
          <span className="font-bold text-foreground">Watchdog</span>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-2xl shadow-black/40 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div key="step0" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <ProgressDots step={0} />
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5">
                  <WatchdogMark className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
                </h1>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Watchdog monitors your websites and APIs around the clock - checking uptime, SSL certificates, and security headers. You'll get an email the moment something goes wrong.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    { icon: "⚡", text: "Uptime checks every minute" },
                    { icon: "🔒", text: "SSL expiry warnings" },
                    { icon: "📧", text: "Instant email alerts" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-3 text-sm text-foreground">
                      <span className="text-base">{icon}</span>
                      {text}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="w-full bg-primary text-foreground py-2.5 rounded-lg hover:bg-primary font-medium transition-colors text-sm"
                >
                  Get started →
                </button>
                <button onClick={skip} className="w-full mt-3 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                  Skip setup
                </button>
              </motion.div>
            )}

            {/* Step 1: Add monitor */}
            {step === 1 && (
              <motion.div key="step1" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <ProgressDots step={1} />
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Add your first monitor</h1>
                <p className="text-sm text-muted-foreground mb-6">Enter any URL - your website, API, or local service.</p>
                <form className="space-y-3" onSubmit={handleAddMonitor}>
                  <input
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                    placeholder="My Website"
                    value={monitorName}
                    onChange={(e) => setMonitorName(e.target.value)}
                    required
                  />
                  <input
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                    type="url"
                    placeholder="https://example.com"
                    value={monitorUrl}
                    onChange={(e) => setMonitorUrl(e.target.value)}
                    required
                  />
                  {error && (
                    <p className="text-down text-sm bg-down/10 border border-down/20 rounded-lg px-3 py-2">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-foreground py-2.5 rounded-lg hover:bg-primary disabled:opacity-50 font-medium transition-colors text-sm"
                  >
                    {loading ? "Adding…" : "Add monitor →"}
                  </button>
                </form>
                <button onClick={skip} className="w-full mt-3 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                  Skip for now
                </button>
              </motion.div>
            )}

            {/* Step 2: Alert email */}
            {step === 2 && (
              <motion.div key="step2" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <ProgressDots step={2} />
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Where should we send alerts?</h1>
                <p className="text-sm text-muted-foreground mb-6">You'll be notified immediately when your monitor goes down.</p>
                <form className="space-y-3" onSubmit={handleAlerts}>
                  <input
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                    type="email"
                    placeholder="Alert email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-foreground py-2.5 rounded-lg hover:bg-primary disabled:opacity-50 font-medium transition-colors text-sm"
                  >
                    {loading ? "Saving…" : "Save & continue →"}
                  </button>
                </form>
                <button onClick={skip} className="w-full mt-3 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                  Skip for now
                </button>
              </motion.div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <motion.div key="step3" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 rounded-full bg-up/15 flex items-center justify-center mx-auto mb-5"
                  >
                    <svg className="w-8 h-8 text-up" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">You're all set!</h1>
                  <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                    Watchdog is now monitoring your site. The first check runs within a minute - you'll be notified if anything goes wrong.
                  </p>
                  <button
                    onClick={() => { markOnboardingDone(); navigate("/dashboard"); }}
                    className="w-full bg-primary text-foreground py-2.5 rounded-lg hover:bg-primary font-medium transition-colors text-sm"
                  >
                    Go to dashboard
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
