import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { WALL_COLUMNS } from "./previews";

/* Per-column tuning: visibility breakpoint, vertical stagger, drift speed/direction,
   and stepped opacity so outer columns recede without any gradient. */
const COLUMNS = [
  { visibility: "hidden lg:flex", offset: "-mt-10", duration: "66s", down: false, dim: "opacity-40" },
  { visibility: "hidden md:flex", offset: "-mt-28", duration: "55s", down: true, dim: "opacity-70" },
  { visibility: "flex", offset: "-mt-16", duration: "48s", down: false, dim: "" },
  { visibility: "flex", offset: "-mt-36", duration: "62s", down: true, dim: "" },
  { visibility: "hidden sm:flex", offset: "-mt-6", duration: "58s", down: false, dim: "opacity-70" },
  { visibility: "hidden lg:flex", offset: "-mt-24", duration: "70s", down: true, dim: "opacity-40" },
];

export function HeroWall() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none select-none [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_85%,transparent)]"
    >
      <div className="flex justify-center gap-4 h-full">
        {COLUMNS.map((col, i) => (
          <div
            key={i}
            className={cn("flex-col w-60 sm:w-64 shrink-0", col.visibility, col.offset, col.dim)}
          >
            {/* reduced-motion handling lives in the keyframe utilities (index.css) */}
            <div
              className={cn(
                "flex flex-col will-change-transform",
                col.down ? "animate-wall-down" : "animate-wall-up"
              )}
              style={{ "--wall-duration": col.duration } as CSSProperties}
            >
              {/* content rendered twice so the -50% keyframe loops seamlessly */}
              <div className="flex flex-col gap-4 pb-4">{WALL_COLUMNS[i]}</div>
              <div className="flex flex-col gap-4 pb-4">{WALL_COLUMNS[i]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
