import { useState } from "react";
import { WatchdogMark } from "@/components/WatchdogMark";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative bg-slate-900 rounded-2xl border border-slate-800 p-8 w-full max-w-sm shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <WatchdogMark className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="font-bold text-white">Watchdog</span>
        </div>

        {sent ? (
          <div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
            <p className="text-sm text-slate-400 mb-6">
              If <span className="text-white">{email}</span> has an account, we've sent a reset link. It expires in 1 hour.
            </p>
            <Link to="/login" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-1">Forgot password?</h1>
            <p className="text-sm text-slate-500 mb-7">Enter your email and we'll send a reset link.</p>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 text-white py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 font-medium transition-colors text-sm"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-sm text-slate-500 text-center">
              <Link to="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
