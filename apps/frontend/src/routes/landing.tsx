import { useEffect } from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WatchdogMark } from "@/components/WatchdogMark";
import { ArrowRight } from "lucide-react";
import { PillNav } from "@/components/landing/PillNav";
import { HeroWall } from "@/components/landing/HeroWall";
import { Ticker } from "@/components/landing/Ticker";
import { SectionShell, BracketLabel, SectionHeading, MonoChip } from "@/components/landing/Section";
import { Faq } from "@/components/landing/Faq";
import {
  demoMonitors,
  PreviewMonitor,
  PreviewSsl,
  PreviewHeaders,
  PreviewAlert,
  PreviewSparkline,
  PreviewAgent,
} from "@/components/landing/previews";

const features = [
  {
    title: "Uptime monitoring",
    copy: "HTTP checks every minute from our global probes. Incidents detected in under 60 seconds.",
    chips: ["60s checks", "global probes"],
    visual: <PreviewMonitor {...demoMonitors[0]} className="w-full" />,
  },
  {
    title: "Response times",
    copy: "Every check records a full timing breakdown — DNS, TCP, TLS, TTFB — so slow is as visible as down.",
    chips: ["per-phase timing", "24h / 7d / 30d"],
    visual: <PreviewSparkline className="w-full" />,
  },
  {
    title: "SSL expiry",
    copy: "Certificates checked hourly. Warned 14 days before any certificate lapses.",
    chips: ["14-day warning"],
    visual: <PreviewSsl className="w-full" />,
  },
  {
    title: "Security headers",
    copy: "Continuous audits of the headers that matter, every six hours.",
    chips: ["6 headers"],
    visual: <PreviewHeaders className="w-full" />,
  },
  {
    title: "Instant alerts",
    copy: "Email & webhook, with cooldowns so you never get spammed.",
    chips: ["email", "webhook", "cooldowns"],
    visual: <PreviewAlert className="w-full" />,
  },
  {
    title: "Private agents",
    copy: "Monitor services behind your firewall — the agent pushes results out, nothing comes in.",
    chips: ["behind firewall", "one binary"],
    visual: <PreviewAgent className="w-full" />,
  },
];

const steps = [
  { n: "01", t: "Point it at a URL", d: "Paste an endpoint and name it. Checks start immediately — no agent required." },
  { n: "02", t: "Choose how to hear about it", d: "Wire up email or a webhook. Set quiet hours and cooldowns on your terms." },
  { n: "03", t: "Get back to building", d: "Watchdog keeps watch. You only hear from it when something actually needs you." },
];

export default function LandingPage() {
  // Smooth anchor scrolling, scoped to the landing page — the document
  // scroller is <html>, so the class can't live on this component's root.
  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    return () => document.documentElement.classList.remove("scroll-smooth");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PillNav />

      {/* Hero — preview wall with floating panel */}
      <section className="relative min-h-[600px] h-[78vh] max-h-[820px] flex items-center justify-center px-4 pt-24">
        <HeroWall />
        <div className="relative z-10 mx-auto max-w-2xl text-center rounded-2xl border border-border bg-background/85 backdrop-blur-md px-6 py-10 sm:px-12 sm:py-14 shadow-2xl shadow-black/50">
          <MonoChip status="up" className="mb-7">
            On watch — 24/7
          </MonoChip>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.02] mb-6 text-balance">
            Your sites have a <span className="text-primary">guard dog</span> now.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto mb-9 text-balance">
            Watchdog watches your uptime, SSL certificates, and security headers —
            and barks the second something breaks, so you hear about it before your users do.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <Link to="/register" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
              Start monitoring free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors whitespace-nowrap inline-flex items-center min-h-11"
            >
              Sign in →
            </Link>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mt-6">
            No credit card · unlimited monitors · ready in 60 seconds
          </p>
        </div>
      </section>

      <Ticker />

      {/* Features — shared-border grid */}
      <SectionShell id="features">
        <BracketLabel>On duty</BracketLabel>
        <SectionHeading className="mb-4">
          Everything it watches <span className="text-primary">while you sleep</span>.
        </SectionHeading>
        <p className="text-muted-foreground max-w-xl mb-14">
          One dashboard for uptime, certificates, security posture, and alerts —
          public or behind your firewall.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
          {features.map((f) => (
            <div key={f.title} className="bg-background p-6 sm:p-8 flex flex-col gap-4">
              <div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.copy}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.chips.map((c) => (
                  <MonoChip key={c}>{c}</MonoChip>
                ))}
              </div>
              <div className="mt-auto">{f.visual}</div>
            </div>
          ))}
        </div>
      </SectionShell>

      {/* How it works — hairline step strip */}
      <SectionShell id="how">
        <BracketLabel>How it works</BracketLabel>
        <SectionHeading className="mb-14">
          On duty in <span className="text-primary">three steps</span>.
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border-y border-border">
          {steps.map((s) => (
            <div key={s.n} className="p-6 sm:p-8">
              <div className="font-mono text-xs text-primary mb-4">{s.n}</div>
              <h3 className="font-semibold mb-2">{s.t}</h3>
              <p className="text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      {/* FAQ */}
      <SectionShell id="faq">
        <BracketLabel>Questions</BracketLabel>
        <SectionHeading className="mb-14">
          Answers, <span className="text-primary">before you bark</span>.
        </SectionHeading>
        <Faq />
      </SectionShell>

      {/* CTA */}
      <SectionShell className="text-center">
        <WatchdogMark className="w-10 h-10 text-primary mx-auto mb-6" />
        <BracketLabel>Free to start</BracketLabel>
        <SectionHeading className="mb-4">
          Put Watchdog <span className="text-primary">on duty</span> tonight.
        </SectionHeading>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Free to start. Unlimited monitors. Set up your first check in under a minute.
        </p>
        <Link to="/register" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
          Create your free account
          <ArrowRight className="w-4 h-4" />
        </Link>
      </SectionShell>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl md:border-x border-border px-6 sm:px-10 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WatchdogMark className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] font-medium">
              Watchdog
            </span>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            © {new Date().getFullYear()} — Always watching
          </p>
        </div>
      </footer>
    </div>
  );
}
