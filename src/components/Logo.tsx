// Real brand assets (public/logo-horizontal.png, public/app-icon-*.png) —
// see index.html for the favicon/apple-touch-icon/manifest wiring of the
// square icon. LogoMark renders the icon alone (e.g. for compact contexts);
// Logo renders the full "Perfect10ant" wordmark lockup used in both navbars.

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return <img src="/app-icon-192.png" alt="The Perfect10ant" className={`${className} rounded-xl object-contain`} />;
}

export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  return <img src="/logo-horizontal.png" alt="The Perfect10ant — Verified. Trusted. Ready to Rent." className={`${className} object-contain`} />;
}

// For a brand self-reference sitting inline in a sentence or heading (e.g.
// "The [logo] helps you build...") — same asset as Logo, sized/aligned to
// sit on the text baseline instead of as a standalone block element.
export function InlineLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src="/logo-horizontal.png" alt="Perfect10ant" className={`inline-block ${className} align-text-bottom`} />;
}
