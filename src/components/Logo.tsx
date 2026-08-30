export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="1" y="1" width="34" height="34" rx="10" fill="#f0faf4" stroke="#1f7a4c" strokeWidth="1.5" />
      <path
        d="M9 18.5L18 10l9 8.5"
        stroke="#1f7a4c"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M11.5 17v8.5a1 1 0 0 0 1 1H23.5a1 1 0 0 0 1-1V17" stroke="#1f7a4c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M15 22.2l2 2 3.6-4" stroke="#1f7a4c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ className = "", markClassName = "h-9 w-9" }: { className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      <span className="font-serif text-lg font-semibold leading-tight text-ink-900">
        The Perfect
        <br />
        Tennant
      </span>
    </span>
  );
}
