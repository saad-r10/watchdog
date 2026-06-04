import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    api.auth.verifyEmail(token)
      .then(() => {
        if (user) setUser({ ...user, emailVerified: true });
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative bg-slate-900 rounded-2xl border border-slate-800 p-8 w-full max-w-sm shadow-2xl shadow-black/40 text-center"
      >
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="font-bold text-white">Watchdog</span>
        </div>

        {status === "loading" && (
          <p className="text-slate-400 text-sm">Verifying your email…</p>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Email verified</h1>
            <p className="text-sm text-slate-400 mb-6">Your email has been confirmed. You're all set.</p>
            <Link
              to="/dashboard"
              className="inline-block bg-violet-600 text-white px-6 py-2.5 rounded-lg hover:bg-violet-700 font-medium transition-colors text-sm"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Link invalid or expired</h1>
            <p className="text-sm text-slate-400 mb-6">This verification link has already been used or has expired.</p>
            <Link to="/dashboard" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
              Back to dashboard
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
