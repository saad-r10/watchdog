import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import type { AppNotification } from "@watchdog/shared-types";

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

  return (
    <Link
      to={`/monitors/${n.monitorId}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors"
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isRecovery
            ? "bg-emerald-500/15 text-emerald-400"
            : n.type === "downtime"
            ? "bg-red-500/15 text-red-400"
            : "bg-yellow-500/15 text-yellow-400"
        }`}
      >
        {isRecovery ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : n.type === "downtime" ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-white truncate">{n.monitorName}</p>
          <span className="text-xs text-slate-600 flex-shrink-0">{timeAgo(n.sentAt)}</span>
        </div>
        <p className={`text-xs mt-0.5 ${isRecovery ? "text-emerald-400" : "text-slate-400"}`}>
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

  function handleOpen() {
    setOpen((v) => !v);
  }

  function handleMarkAllRead() {
    setLastReadAt();
    setLastReadAtState(Date.now());
  }

  // Close on outside click
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
        onClick={handleOpen}
        className="relative w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none">
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
            className="absolute top-9 left-0 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <p className="text-xs font-semibold text-white">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No alerts yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={new Date(n.sentAt).getTime() > lastReadAt ? "bg-slate-800/30" : ""}
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
