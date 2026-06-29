const faqs = [
  {
    q: "Is it really free to start?",
    a: "Yes - no credit card, unlimited monitors. Create an account and your first check is running in under a minute.",
  },
  {
    q: "How fast does it detect downtime?",
    a: "Checks run every minute, so an outage is detected in under 60 seconds and the incident clock starts immediately.",
  },
  {
    q: "Can it watch services behind my firewall?",
    a: "Yes. Run the lightweight agent on your own server and it reports results to Watchdog - your internal services never need to be publicly accessible.",
  },
  {
    q: "How do alerts work?",
    a: "Email and webhook notifications fire the moment an incident opens. You get one alert per incident, so an unstable service that keeps flipping up and down won't flood your inbox.",
  },
  {
    q: "What about SSL certificates?",
    a: "Every security certificate is checked hourly, and you're warned 14 days before one expires - long before your visitors see a browser warning.",
  },
  {
    q: "Which security settings are checked?",
    a: "Six key browser security settings are audited every six hours: clickjacking protection, content security policy, HTTPS enforcement, file type protection, referrer policy, and browser permissions policy.",
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
          <p className="pb-5 text-muted-foreground leading-relaxed max-w-2xl">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
