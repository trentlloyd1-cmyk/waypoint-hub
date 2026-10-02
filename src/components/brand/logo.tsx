import { cn } from "@/lib/utils";

const LOGOS = {
  // Staff-facing app logo.
  hub: { light: "/brand/waypoint-hub-logo.svg", dark: "/brand/waypoint-hub-logo-dark.svg", alt: "Waypoint Hub", ratio: 1648 / 624 },
  // Public-facing company logo (referral form, event pages, emails, PDFs).
  connect: { light: "/brand/waypoint-connect-logo.svg", dark: "/brand/waypoint-connect-logo-dark.svg", alt: "Waypoint Connect", ratio: 2400 / 923 },
} as const;

/**
 * The logo, swapping to the lighter-teal version in dark mode so the wordmark keeps its contrast.
 * Plain <img> on purpose: SVGs don't benefit from next/image and this avoids layout shift via width/height.
 */
export function Logo({
  variant = "hub",
  height = 40,
  className,
  decorative = false,
}: {
  variant?: keyof typeof LOGOS;
  height?: number;
  className?: string;
  /** Set when a visible heading already names the page, so screen readers don't hear it twice. */
  decorative?: boolean;
}) {
  const logo = LOGOS[variant];
  const width = Math.round(height * logo.ratio);
  const alt = decorative ? "" : logo.alt;
  return (
    <span className={cn("inline-block shrink-0", className)} style={{ width, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.light} alt={alt} width={width} height={height} className="h-full w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.dark} alt={alt} width={width} height={height} className="hidden h-full w-full dark:block" />
    </span>
  );
}

/** Just the orange pin with the teal smile, for tight spaces (collapsed sidebar, mobile header). */
export function PinMark({ size = 32, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/pin-256.png" alt="" width={size} height={size} className={cn("shrink-0", className)} />;
}
