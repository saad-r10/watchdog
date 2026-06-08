interface DogIconProps {
  className?: string;
}

export function DogIcon({ className }: DogIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Ears */}
      <path d="M6 8 C5 5 3 4 3 6 C3 8 5 9 6 10" />
      <path d="M18 8 C19 5 21 4 21 6 C21 8 19 9 18 10" />
      {/* Head */}
      <ellipse cx="12" cy="12" rx="7" ry="6.5" />
      {/* Eyes */}
      <circle cx="9.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
      {/* Nose */}
      <path d="M10.5 14 C10.5 13 13.5 13 13.5 14 C13.5 15.2 12.5 15.5 12 15.5 C11.5 15.5 10.5 15.2 10.5 14Z" fill="currentColor" stroke="none" />
      {/* Mouth */}
      <path d="M10.5 15 Q12 16.5 13.5 15" />
    </svg>
  );
}
