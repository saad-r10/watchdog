import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WatchdogMark } from "@/components/WatchdogMark";
import { StatusDot } from "@/components/StatusDot";
import { UptimeBars } from "@/components/UptimeBars";
import type { DailyBar } from "@watchdog/shared-types";
import { ArrowRight, Check, Terminal, Bell } from "lucide-react";

/* ── Demo data for the hero console ── */
function makeBars(downDays: number[] = []): DailyBar[] {
  return Array.from({ length: 90 }, (_, i) => {
    const date = new Date(Date.now() - (89 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const uptimePercent = downDays.includes(i) ? 86 + (i % 5) : 100;
    return { date, uptimePercent };
  });
}

const demoMonitors = [
  { name: "api.acme.com", url: "https://api.acme.com/health", status: "up" as const, uptime: "99.99%", ms: 84, bars: makeBars() },
  { name: "Marketing site", url: "https://acme.com", status: "up" as const, uptime: "100%", ms: 142, bars: makeBars() },
  { name: "checkout-service", url: "https://pay.acme.com", status: "degraded" as const, uptime: "98.7%", ms: 612, bars: makeBars([71, 72]) },
  { name: "status-internal", url: "10.0.2.14:8080", status: "up" as const, uptime: "99.95%", ms: 23, bars: makeBars([40]) },
];

function HeroConsole() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/40">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-background/50">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
        </div>
        <div className="flex items-center gap-1.5 ml-2 text-xs text-muted-foreground">
          <WatchdogMark className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-foreground/80">Watchdog</span>
          <span className="text-muted-foreground/60">/ monitors</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-up">
          <StatusDot status="up" />
          Live
        </div>
      </div>
      {/* rows */}
      <div className="divide-y divide-border">
        {demoMonitors.map((m) => (
          <div key={m.name} className="flex items-center gap-4 px-4 py-3">
            <StatusDot status={m.status} className="flex-shrink-0" />
            <div className="min-w-0 w-40 sm:w-48">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-xs text-muted-foreground truncate font-mono">{m.url}</p>
            </div>
            <div className="hidden md:block flex-1">
              <UptimeBars bars={m.bars.slice(-40)} height="h-5" />
            </div>
            <div className="ml-auto text-right flex-shrink-0">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  m.status === "degraded" ? "text-degraded" : "text-foreground"
                )}
              >
                {m.uptime}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{m.ms}ms</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Bento micro-visuals ── */
function BentoUptime() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold">Uptime monitoring</h3>
        <span className="text-xs font-medium text-up tabular-nums">99.98%</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        HTTP checks every minute from our global probes. Incidents detected in under 60 seconds.
      </p>
      <div className="mt-auto">
        <UptimeBars bars={makeBars([60, 61, 84]).slice(-60)} height="h-7" />
        <div className="flex justify-between text-[11px] text-muted-foreground/60 mt-1.5">
          <span>60 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

function BentoSsl() {
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold mb-1">SSL expiry</h3>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        Warned 14 days before any certificate lapses.
      </p>
      <div className="mt-auto rounded-lg border border-border bg-background/60 p-3">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-mono text-muted-foreground">*.acme.com</span>
          <span className="text-up font-medium">valid</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[78%] bg-up rounded-full" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Renews in 71 days</p>
      </div>
    </div>
  );
}

function BentoHeaders() {
  const headers = [
    { name: "Strict-Transport-Security", ok: true },
    { name: "Content-Security-Policy", ok: true },
    { name: "X-Frame-Options", ok: true },
    { name: "Permissions-Policy", ok: false },
  ];
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold mb-1">Security headers</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Continuous audits of the headers that matter.
      </p>
      <ul className="mt-auto space-y-1.5">
        {headers.map((h) => (
          <li key={h.name} className="flex items-center gap-2 text-xs font-mono">
            {h.ok ? (
              <Check className="w-3.5 h-3.5 text-up flex-shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 flex items-center justify-center text-degraded flex-shrink-0">!</span>
            )}
            <span className={h.ok ? "text-muted-foreground" : "text-degraded"}>{h.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BentoAlerts() {
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold mb-1">Instant alerts</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Email &amp; webhook, with cooldowns so you never get spammed.
      </p>
      <div className="mt-auto rounded-lg border border-down/20 bg-down/5 p-3 flex gap-2.5">
        <Bell className="w-4 h-4 text-down flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-down">checkout-service is down</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            503 · detected 4s ago
          </p>
        </div>
      </div>
    </div>
  );
}

function BentoAgents() {
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold mb-1">Private agents</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Monitor services behind your firewall.
      </p>
      <div className="mt-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
          <Terminal className="w-3 h-3" />
          <span>agent.sh</span>
        </div>
        <p className="text-foreground/90">
          <span className="text-primary">$</span> watchdog agent --key wdg_•••
        </p>
        <p className="text-up">✓ reporting 6 checks</p>
      </div>
    </div>
  );
}

const bento = [
  { span: "lg:col-span-2", node: <BentoUptime /> },
  { span: "", node: <BentoSsl /> },
  { span: "", node: <BentoHeaders /> },
  { span: "", node: <BentoAlerts /> },
  { span: "", node: <BentoAgents /> },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <WatchdogMark className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Watchdog</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              to="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground hover:text-foreground")}
            >
              Sign in
            </Link>
            <Link to="/register" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-12 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-7">
            <StatusDot status="up" />
            Watching your stack, around the clock
          </div>
          <h1 className="text-4xl sm:text-[3.5rem] font-bold tracking-tight leading-[1.05] mb-6 text-balance">
            Your sites have a guard dog now.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto mb-9 text-balance">
            Watchdog watches your uptime, SSL certificates, and security headers —
            and barks the second something breaks, so you hear about it before your users do.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/register" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
              Start monitoring free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            No credit card · unlimited monitors · ready in 60 seconds
          </p>
        </div>

        {/* Live console */}
        <div className="mx-auto max-w-4xl mt-16">
          <HeroConsole />
        </div>
      </section>

      {/* Bento features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-xl mb-10">
            <h2 className="text-2xl font-bold tracking-tight mb-3">
              Everything you need to sleep through the night
            </h2>
            <p className="text-muted-foreground">
              One dashboard for uptime, certificates, security posture, and alerts —
              public or behind your firewall.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bento.map((cell, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl border border-border bg-card p-5 hover:border-border/80 hover:bg-card/70 transition-colors",
                  cell.span
                )}
              >
                {cell.node}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold tracking-tight mb-12">Live in three steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              { n: "01", t: "Point it at a URL", d: "Paste an endpoint and name it. Checks start immediately — no agent required." },
              { n: "02", t: "Choose how to hear about it", d: "Wire up email or a webhook. Set quiet hours and cooldowns on your terms." },
              { n: "03", t: "Get back to building", d: "Watchdog keeps watch. You only hear from it when something actually needs you." },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="text-xs font-mono text-primary mb-4">{s.n}</div>
                <h3 className="font-semibold mb-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 border-t border-border">
        <div className="mx-auto max-w-2xl text-center">
          <div className="w-12 h-12 rounded-xl bg-primary mx-auto flex items-center justify-center mb-6">
            <WatchdogMark className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4 text-balance">
            Put Watchdog on duty tonight.
          </h2>
          <p className="text-muted-foreground mb-8">
            Free to start. Unlimited monitors. Set up your first check in under a minute.
          </p>
          <Link to="/register" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
            Create your free account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
              <WatchdogMark className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">Watchdog</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Watchdog</p>
        </div>
      </footer>
    </div>
  );
}
