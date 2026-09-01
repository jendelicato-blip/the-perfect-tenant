// Small outline icon set used only on the Perfect10ant Passport™ card, so
// its stat/verification rows read as icons (closer to a real ID-card look)
// instead of emoji, which render inconsistently across platforms/print.
// Hand-drawn (no icon library dependency) — simple stroke shapes, not meant
// to be pixel-perfect to any specific icon set.

import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function IdCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2" />
      <path d="M14.5 10h3M14.5 13h3M6 16.5h5" />
    </Icon>
  );
}

export function DollarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M14.5 9.5c0-1.1-1.1-2-2.5-2s-2.5.9-2.5 2 1.1 1.8 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2-2.5-.9-2.5-2" />
    </Icon>
  );
}

export function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </Icon>
  );
}

export function HouseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  );
}

export function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-5" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    </Icon>
  );
}

export function ShieldCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="M9 12.5l2 2 4-4.5" />
    </Icon>
  );
}

export function ScaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3v16M7 20h10M12 5 5 8l3.5 6a3.2 3.2 0 0 0 4 0L16 8l-4-3Z" />
      <path d="M5 8h5M15 8h4" />
    </Icon>
  );
}

export function PeopleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="9" r="2.5" />
      <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <circle cx="17" cy="8" r="2" />
      <path d="M15.2 14.3c2 .3 3.8 2 3.8 4.7" />
    </Icon>
  );
}

export function MedalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 3 5 9M16 3l3 6" />
      <circle cx="12" cy="14" r="6" />
      <path d="M12 11.5 13 14l2 .2-1.5 1.3.5 2-2-1.1-2 1.1.5-2L9 14.2l2-.2Z" />
    </Icon>
  );
}

export function CalendarCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8.5 15l2 2 4-4.5" />
    </Icon>
  );
}
