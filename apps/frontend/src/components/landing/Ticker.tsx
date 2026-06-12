const PHRASE = "ALWAYS WATCHING · UPTIME · SSL EXPIRY · SECURITY HEADERS · INSTANT ALERTS · ";

function TickerRun() {
  return (
    <span
      aria-hidden="true"
      className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground/50 whitespace-nowrap"
    >
      {PHRASE.repeat(4)}
    </span>
  );
}

export function Ticker() {
  return (
    <div className="border-y border-border overflow-hidden py-3">
      <span className="sr-only">
        Always watching: uptime, SSL expiry, security headers, instant alerts.
      </span>
      <div className="flex w-max will-change-transform animate-ticker">
        {/* duplicated run so the -50% keyframe loops seamlessly */}
        <TickerRun />
        <TickerRun />
      </div>
    </div>
  );
}
