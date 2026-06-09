import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import type { AppNotification } from "@watchdog/shared-types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "notifications_last_read_at";

function getLastReadAt(): number {
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
}

function setLastReadAt() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  downtime: "Downtime detected",
  ssl_expiry: "SSL expiry warning",
  header_missing: "Missing security headers",
};

function NotificationItem({ n }: { n: AppNotification }) {
  const isRecovery = n.alertType === "recovery";
  const Icon = isRecovery ? CheckCircle2 : n.type === "downtime" ? XCircle : AlertTriangle;
  const tone = isRecovery
    ? "bg-up/15 text-up"
    : n.type === "downtime"
      ? "bg-down/15 text-down"
      : "bg-degraded/15 text-degraded";

  return (
    <Link
      to={`/monitors/${n.monitorId}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors"
    >
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", tone)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground truncate">{n.monitorName}</p>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(n.sentAt)}</span>
        </div>
        <p className={cn("text-xs mt-0.5", isRecovery ? "text-up" : "text-muted-foreground")}>
          {isRecovery ? "Site recovered" : (INCIDENT_TYPE_LABEL[n.type] ?? n.type)}
        </p>
      </div>
    </Link>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lastReadAt, setLastReadAtState] = useState(getLastReadAt);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications.list,
    refetchInterval: 30_000,
  });

  const unreadCount = notifications.filter(
    (n) => new Date(n.sentAt).getTime() > lastReadAt
  ).length;

  function handleMarkAllRead() {
    setLastReadAt();
    setLastReadAtState(Date.now());
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-down rounded-full text-[9px] font-bold text-down-foreground flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-9 left-0 w-80 bg-popover border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell className="w-5 h-5 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">No alerts yet</p>
                  <p className="text-[11px] text-muted-foreground/60">You'll hear from us when something breaks.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={new Date(n.sentAt).getTime() > lastReadAt ? "bg-accent/40" : ""}
                    onClick={() => setOpen(false)}
                  >
                    <NotificationItem n={n} />
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
