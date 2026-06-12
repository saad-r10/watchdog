import { Link } from "react-router-dom";
import { WatchdogMark } from "@/components/WatchdogMark";

const anchors = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function PillNav() {
  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4">
      <nav className="flex items-center gap-1 rounded-full border border-border bg-card/80 backdrop-blur-md pl-3 pr-1.5 py-1.5 shadow-lg shadow-black/30">
        <Link to="/" className="flex items-center gap-2 pr-2">
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
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary px-3 py-1.5 rounded-full transition-colors"
            >
              {a.label}
            </a>
          ))}
        </div>
        <Link
          to="/login"
          className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="rounded-full bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wider px-4 py-2 hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Get started
        </Link>
      </nav>
    </header>
  );
}
