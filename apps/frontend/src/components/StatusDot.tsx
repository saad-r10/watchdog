import { cn } from "@/lib/utils";

export type DotStatus = "up" | "degraded" | "down" | "paused" | "unknown";

const colorMap: Record<DotStatus, string> = {
  up: "bg-up",
  degraded: "bg-degraded",
  down: "bg-down",
  paused: "bg-muted-foreground",
  unknown: "bg-muted-foreground/50",
};

interface StatusDotProps {
  status: DotStatus;
  /** Show the expanding radar pulse (use for "live/operational" states). */
  pulse?: boolean;
  className?: string;
  size?: "sm" | "md";
}

/**
 * The signature Watchdog "live" indicator — a status dot with an
 * expanding radar ring, evoking a sentry constantly scanning.
 */
export function StatusDot({ status, pulse, className, size = "sm" }: StatusDotProps) {
  const dim = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  const showPulse = pulse ?? status === "up";
  return (
    <span className={cn("relative inline-flex", dim, className)}>
      {showPulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full animate-watch-ping",
            colorMap[status]
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full h-full w-full",
          colorMap[status],
          showPulse && "animate-watch-breathe"
        )}
      />
    </span>
  );
}
