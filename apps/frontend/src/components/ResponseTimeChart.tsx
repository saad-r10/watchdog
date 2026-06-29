import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import type { ResponseTimeBucket, ResponseTimeRange } from "@watchdog/shared-types";

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBucket(iso: string, range: ResponseTimeRange) {
  const d = new Date(iso);
  if (range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "7d") return d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const PHASES = [
  { key: "avgDnsMs", label: "DNS lookup", color: "hsl(var(--chart-dns))" },
  { key: "avgTcpMs", label: "Connection", color: "hsl(var(--chart-tcp))" },
  { key: "avgTlsMs", label: "Security handshake", color: "hsl(var(--chart-tls))" },
  { key: "avgTtfbMs", label: "Server response", color: "hsl(var(--chart-ttfb))" },
  { key: "avgDownloadMs", label: "Download", color: "hsl(var(--chart-download))" },
] as const;

function makeChartTooltip(range: ResponseTimeRange) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function ChartTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d: ResponseTimeBucket = payload[0].payload;
    const hasPhases = d.avgTtfbMs != null || d.avgTcpMs != null;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2.5 text-xs shadow-xl space-y-1">
        <p className="text-muted-foreground">{formatBucket(d.bucket, range)}</p>
        {d.avgMs != null ? (
          <>
            <p className="text-primary font-semibold">{d.avgMs}ms avg</p>
            {d.minMs != null && d.maxMs != null && d.minMs !== d.maxMs && (
              <p className="text-muted-foreground">{d.minMs}–{d.maxMs}ms range</p>
            )}
            {hasPhases && (
              <div className="pt-1 space-y-0.5">
                {PHASES.map(({ key, label, color }) =>
                  d[key] != null ? (
                    <p key={key} className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />
                      {label}: {d[key]}ms
                    </p>
                  ) : null
                )}
              </div>
            )}
            {d.avgSizeBytes != null && (
              <p className="text-muted-foreground pt-0.5">~{formatBytes(d.avgSizeBytes)} payload</p>
            )}
          </>
        ) : (
          <p className="text-down font-semibold">Down</p>
        )}
        {d.hasDown && d.avgMs != null && <p className="text-down">⚠ Downtime in this period</p>}
      </div>
    );
  };
}

// Lightweight visual aid: flags buckets whose average response time is a
// statistical outlier (mean + 3 stddev) within the currently-viewed range.
// The authoritative anomaly detection (incidents/alerts) runs server-side
// against raw per-check data over a rolling 7-day window - this is just
// context for whatever range the user happens to be looking at.
const ANOMALY_MIN_BUCKETS = 8;
const ANOMALY_SIGMA = 3;

function computeAnomalyThreshold(data: ResponseTimeBucket[]): number | null {
  const values = data.map((d) => d.avgMs).filter((v): v is number => v != null);
  if (values.length < ANOMALY_MIN_BUCKETS) return null;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return null;

  return mean + ANOMALY_SIGMA * stddev;
}

const axisProps = {
  stroke: "hsl(var(--border))",
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const;

interface ResponseTimeChartProps {
  data: ResponseTimeBucket[];
  range: ResponseTimeRange;
}

export function ResponseTimeChart({ data, range }: ResponseTimeChartProps) {
  const [view, setView] = useState<"breakdown" | "total">("breakdown");
  // No phase data in range (pre-feature history / old agents) → plain total line only
  const hasBreakdown = data.some((d) => d.avgTtfbMs != null || d.avgTcpMs != null);
  const showBreakdown = hasBreakdown && view === "breakdown";

  const downDots = data.filter((r) => r.hasDown && r.avgMs == null).map((r) => r.bucket);

  const anomalyThreshold = computeAnomalyThreshold(data);
  const anomalyPoints = anomalyThreshold != null
    ? data.filter((r) => r.avgMs != null && r.avgMs > anomalyThreshold)
    : [];

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">No data for this period yet.</p>;
  }

  const sharedChildren = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
      <XAxis
        dataKey="bucket"
        {...axisProps}
        interval="preserveStartEnd"
        tickFormatter={(v) => formatBucket(v, range)}
      />
      <YAxis {...axisProps} unit="ms" width={52} />
      <Tooltip content={makeChartTooltip(range)} />
      {downDots.map((bucket) => (
        <ReferenceDot key={bucket} x={bucket} y={0} r={4} fill="hsl(var(--down))" stroke="none" />
      ))}
      {anomalyThreshold != null && (
        <ReferenceLine
          y={anomalyThreshold}
          stroke="hsl(var(--down))"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          label={{ value: "anomaly threshold", position: "insideTopRight", fill: "hsl(var(--down))", fontSize: 11 }}
        />
      )}
      {anomalyPoints.map((p) => (
        <ReferenceDot key={`anomaly-${p.bucket}`} x={p.bucket} y={p.avgMs!} r={4} fill="hsl(var(--down))" stroke="none" />
      ))}
    </>
  );

  return (
    <div>
      {hasBreakdown && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(["breakdown", "total"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  view === v
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {showBreakdown && (
            <div className="hidden sm:flex items-center gap-3">
              {PHASES.map(({ key, label, color }) => (
                <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        {showBreakdown ? (
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            {sharedChildren}
            {PHASES.map(({ key, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="phases"
                stroke="none"
                fill={color}
                fillOpacity={0.9}
                connectNulls={false}
              />
            ))}
          </ComposedChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            {sharedChildren}
            <Line
              type="monotone"
              dataKey="avgMs"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
              connectNulls={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
