const faqs = [
  {
    q: "Is it really free to start?",
    a: "Yes — no credit card, unlimited monitors. Create an account and your first check is running in under a minute.",
  },
  {
    q: "How fast does it detect downtime?",
    a: "Checks run every minute, so an outage is detected in under 60 seconds and the incident clock starts immediately.",
  },
  {
    q: "Can it watch services behind my firewall?",
    a: "Yes. Run the lightweight agent on your own infrastructure and it pushes check results to Watchdog — internal services never need to be exposed.",
  },
  {
    q: "How do alerts work?",
    a: "Email and webhook, fired the moment an incident opens. Cooldowns guarantee one alert per monitor per incident, so a flapping service never spams you.",
  },
  {
    q: "What about SSL certificates?",
    a: "Every certificate is checked hourly, and you're warned 14 days before one expires — long before your users see a browser warning.",
  },
  {
    q: "Which security headers are checked?",
    a: "X-Frame-Options, Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy — audited every six hours.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-border border-y border-border">
      {faqs.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-medium">
            {f.q}
            <span className="font-mono text-primary text-lg transition-transform group-open:rotate-45 flex-shrink-0">
              +
            </span>
          </summary>
          <p className="pb-5 text-sm text-muted-foreground leading-relaxed max-w-2xl">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
