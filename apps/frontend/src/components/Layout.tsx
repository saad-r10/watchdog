import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../hooks/useAuth";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { api } from "../services/api";
import { Menu, AlertTriangle } from "lucide-react";
import { DogIcon } from "./DogIcon";

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 md:ml-60 min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-card border-b border-border flex-shrink-0 sticky top-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="h-8 w-8"
          >
            <Menu className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <DogIcon className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-sm">Watchdog</span>
          </div>

          <NotificationBell />
        </header>

        {/* Email verification banner */}
        {user && !user.emailVerified && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 flex-1 min-w-0">
              Please verify your email address. Check your inbox for a link.
            </p>
            {resent ? (
              <span className="text-xs text-emerald-400 flex-shrink-0">Sent!</span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {resending ? "…" : "Resend"}
              </button>
            )}
          </div>
        )}

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
