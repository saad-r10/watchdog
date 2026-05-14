import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";
import { MonitorCard } from "../components/MonitorCard";

export default function DashboardPage() {
  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.monitors.list,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Infrastructure Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Auto-refreshes every 30 seconds</p>
        </div>
        <Link
          to="/monitors"
          className="flex items-center gap-2 bg-violet-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-violet-700 transition-colors font-medium shadow-lg shadow-violet-500/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add monitor
        </Link>
      </div>

      {/* Summary strip */}
      {monitors.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Sites monitored", value: monitors.length, color: "text-white" },
            { label: "Checks / day", value: monitors.length * 1440, color: "text-violet-400" },
            { label: "Check interval", value: "60s", color: "text-emerald-400" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 rounded-xl border border-slate-800 px-6 py-5"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Monitor grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-5 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-800 rounded w-2/3" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                </div>
                <div className="h-6 bg-slate-800 rounded-full w-20 ml-3" />
              </div>
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <div className="h-3 bg-slate-800 rounded w-12" />
                  <div className="h-6 bg-slate-800 rounded w-16" />
                </div>
                <div className="h-9 bg-slate-800 rounded w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : monitors.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24 bg-slate-900 rounded-xl border border-slate-800"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-1">No monitors yet</p>
          <p className="text-slate-500 text-sm mb-6">Start watching your first site in seconds</p>
          <Link
            to="/monitors"
            className="bg-violet-600 text-white px-5 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
          >
            Add your first monitor
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {monitors.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <MonitorCard monitor={m} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
