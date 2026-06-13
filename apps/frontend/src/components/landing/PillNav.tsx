import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { WatchdogMark } from "@/components/WatchdogMark";

const anchors = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function PillNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-[max(1rem,env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center px-4">
      <div className="relative">
        <nav className="flex items-center gap-1 rounded-full border border-border bg-card/80 backdrop-blur-md pl-2 pr-1.5 py-1 shadow-lg shadow-black/30">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="md:hidden flex items-center justify-center min-w-11 min-h-11 -ml-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <Link to="/" className="flex items-center justify-center gap-2 min-h-11 min-w-11 px-2">
            <WatchdogMark className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] font-medium hidden min-[360px]:inline">
              Watchdog
            </span>
          </Link>
          <div className="hidden md:flex items-center">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center min-h-11 px-3 rounded-full transition-colors"
              >
                {a.label}
              </a>
            ))}
          </div>
          <Link
            to="/login"
            className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center min-h-11 px-3 rounded-full transition-colors whitespace-nowrap"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wider flex items-center min-h-11 px-4 hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            Get started
          </Link>
        </nav>
        {open && (
          <div className="md:hidden absolute top-full inset-x-0 mt-2 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg shadow-black/30 p-1.5">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center min-h-11 px-4 rounded-xl transition-colors"
              >
                {a.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
