import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/StatusDot";

/* Framed section: stacked sections share the md:border-x rails, forming a
   continuous hairline frame down the page. */
export function SectionShell({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className="border-t border-border scroll-mt-24">
      <div
        className={cn(
          "mx-auto max-w-5xl md:border-x border-border px-6 sm:px-10 py-24 sm:py-32",
          className
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function BracketLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-5">
      [ {children} ]
    </p>
  );
}

export function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-balance",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function MonoChip({
  children,
  status,
  className,
}: {
  children: ReactNode;
  status?: "up" | "degraded" | "down";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      {status && <StatusDot status={status} />}
      {children}
    </span>
  );
}
