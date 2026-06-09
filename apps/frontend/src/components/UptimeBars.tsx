import type { DailyBar } from "@watchdog/shared-types";
import { cn } from "@/lib/utils";

interface UptimeBarsProps {
  bars: DailyBar[];
  height?: string;
  className?: string;
}

function barColor(uptimePercent: number | null): string {
  if (uptimePercent === null) return "bg-muted";
  if (uptimePercent >= 99) return "bg-up";
  if (uptimePercent >= 90) return "bg-degraded";
  return "bg-down";
}

/**
 * Signature 90-day uptime timeline. Each bar is one day; color encodes
 * health. Hover reveals the day + uptime. The barber-pole spacing and
 * rounded caps give it the Watchdog "heartbeat" feel.
 */
export function UptimeBars({ bars, height = "h-8", className }: UptimeBarsProps) {
  return (
    <div className={cn("flex gap-[2px] items-stretch", className)}>
      {bars.map((bar) => {
        const label =
          bar.uptimePercent === null ? "No data" : `${bar.uptimePercent}% uptime`;
        return (
          <div
            key={bar.date}
            title={`${bar.date} · ${label}`}
            className={cn(
              "flex-1 rounded-[2px] transition-all duration-150",
              "opacity-80 hover:opacity-100 hover:scale-y-110 cursor-default",
              height,
              barColor(bar.uptimePercent)
            )}
          />
        );
      })}
    </div>
  );
}
