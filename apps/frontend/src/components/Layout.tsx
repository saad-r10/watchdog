import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);
    try {
      await api.auth.resendVerification();
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  const showBanner = user && !user.emailVerified;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <div className="flex-1 ml-60 min-h-screen flex flex-col">
        {showBanner && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-3">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-amber-300 flex-1">
              Please verify your email address. Check your inbox for a verification link.
            </p>
            {resent ? (
              <span className="text-xs text-emerald-400">Sent!</span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend email"}
              </button>
            )}
          </div>
        )}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
