import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DogIcon } from "@/components/DogIcon";
import {
  Activity,
  ShieldCheck,
  Globe,
  Bell,
  Server,
  LayoutDashboard,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Uptime checks every minute",
    description: "Ping every endpoint every minute and get alerted the instant anything goes down.",
  },
  {
    icon: ShieldCheck,
    title: "SSL expiry alerts",
    description: "Warned 14 days before any certificate expires. Never get blindsided again.",
  },
  {
    icon: Globe,
    title: "Security header audits",
    description: "CSP, HSTS, X-Frame-Options — know what's missing before attackers do.",
  },
  {
    icon: Bell,
    title: "Smart alerting",
    description: "Email and webhook notifications with cooldowns. No duplicate alerts.",
  },
  {
    icon: Server,
    title: "Private network agents",
    description: "Deploy agents behind your firewall to monitor services that aren't public.",
  },
  {
    icon: LayoutDashboard,
    title: "Status pages",
    description: "Public-facing status pages with 90-day uptime history. Build trust with customers.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <DogIcon className="w-4 h-4 text-primary-foreground" />
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
      <section className="pt-20 pb-16 px-6 border-b border-border">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-5">
              Uptime &amp; security monitoring
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.15] mb-5">
              Know when your site goes down —
              <br />
              before your users do.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Watchdog monitors uptime, SSL certificates, and security headers across
              all your services. Instant alerts so you can fix issues before they become incidents.
            </p>
            <div className="flex items-center gap-3">
              <Link to="/register" className={cn(buttonVariants(), "gap-2")}>
                Start for free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/login"
                className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
            {[
              { value: "1 min", label: "Check interval" },
              { value: "99.9%", label: "Platform uptime" },
              { value: "<10s", label: "Alert delivery" },
              { value: "90 days", label: "Uptime history" },
            ].map((stat) => (
              <div key={stat.label} className="py-8 px-6 first:pl-0">
                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 border-b border-border">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-10">
            What Watchdog monitors
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-background p-6"
                >
                  <Icon className="w-4 h-4 text-muted-foreground mb-4" />
                  <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 border-b border-border">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-10">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Add a monitor",
                desc: "Paste a URL. Give it a name. Watchdog starts pinging immediately.",
              },
              {
                step: "02",
                title: "Configure alerts",
                desc: "Add an email or webhook. Get notified on your terms.",
              },
              {
                step: "03",
                title: "Ship with confidence",
                desc: "Incidents detected in under a minute. You'll know before your users do.",
              },
            ].map((item) => (
              <div key={item.step}>
                <div className="text-xs font-mono text-muted-foreground mb-3">{item.step}</div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="py-16 px-6 border-b border-border">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-6">
                Included, free
              </p>
              <ul className="space-y-3">
                {[
                  "Unlimited monitors",
                  "1-minute check intervals",
                  "SSL certificate monitoring",
                  "Security header audits",
                  "Email &amp; webhook alerts",
                  "Public status pages",
                  "90-day uptime history",
                  "Maintenance windows",
                  "Private agent support",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
                  Ready in 60 seconds
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No agent to install, no credit card required. Add your first monitor and
                  Watchdog starts checking immediately.
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-border">
                <Link to="/register" className={cn(buttonVariants(), "gap-2")}>
                  Create free account
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
              <DogIcon className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">Watchdog</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Watchdog
          </p>
        </div>
      </footer>
    </div>
  );
}
