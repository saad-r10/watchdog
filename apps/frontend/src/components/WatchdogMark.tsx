interface WatchdogMarkProps {
  className?: string;
}

/**
 * Watchdog brand mark — a geometric alert guard-dog head in profile.
 * Single-color: fills with `currentColor`, the eye is cut out (evenodd)
 * so it reads on any background. Scales cleanly from 16px to hero size.
 */
export function WatchdogMark({ className }: WatchdogMarkProps) {
  return (
    <svg
      viewBox="0 0 34 34"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 14 C6 12.5 7.5 11 9 10.5 L11 2 L14.5 10 L16.5 6.5 L20 2 L22 10.5 C24 11.5 25.5 12.5 25.5 14 L24.7 16.2 L30.5 18 L30.5 19.8 L24.5 20.4 L23 23.5 L18 24.5 L16 31 L7.5 31 C6.5 27 6 22 6 18 Z M18.4 12.9 a1 1 0 1 0 0.01 0 Z"
      />
    </svg>
  );
}
