import { Pause } from "lucide-react";
import { StatusDot } from "./StatusDot";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "up" | "down" | "degraded" | null;
  paused?: boolean;
}

const base =
  "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border";

export function StatusBadge({ status, paused }: StatusBadgeProps) {
  if (paused)
    return (
      <span className={cn(base, "bg-muted text-muted-foreground border-border")}>
        <Pause className="w-2.5 h-2.5 fill-current" />
        Paused
      </span>
    );
  if (status === "up")
    return (
      <span className={cn(base, "bg-up/10 text-up border-up/20")}>
        <StatusDot status="up" />
        Operational
      </span>
    );
  if (status === "degraded")
    return (
      <span className={cn(base, "bg-degraded/10 text-degraded border-degraded/20")}>
        <StatusDot status="degraded" pulse={false} />
        Degraded
      </span>
    );
  if (status === "down")
    return (
      <span className={cn(base, "bg-down/10 text-down border-down/20")}>
        <StatusDot status="down" pulse={false} />
        Down
      </span>
    );
  return (
    <span className={cn(base, "bg-muted text-muted-foreground border-border")}>
      <StatusDot status="unknown" pulse={false} />
      No data
    </span>
  );
}
