type IconProps = { className?: string };

export function FaceIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 110"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M27 40 C24 18 38 8 50 8 C62 8 76 18 73 40" />
      <path d="M30 38 C30 38 26 64 50 80 C74 64 70 38 70 38" />
      <line x1="34" y1="40" x2="44" y2="40" />
      <line x1="56" y1="40" x2="66" y2="40" />
      <path d="M44 52 C47 56 53 56 56 52" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function CamIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M3 8h4l1.5-2h7L17 8h4v11H3z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
