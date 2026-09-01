import { useNavigate } from "react-router-dom";

interface Props {
  // Where to send the user if there's no in-app history to go back to —
  // e.g. they opened this page directly from a bookmark, a shared link, or
  // a fresh tab. react-router's history stamps `{ idx }` into
  // `window.history.state` on every push (true for plain <BrowserRouter>,
  // not just the data router), so `idx > 0` reliably means "there's a
  // previous entry in this SPA session to return to."
  fallback: string;
  label?: string;
  className?: string;
}

export function BackButton({ fallback, label = "Back", className = "" }: Props) {
  const navigate = useNavigate();

  function handleClick() {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate(fallback);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand-700 ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
