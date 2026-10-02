import type { MetadataRoute } from "next";

/** Lets staff "Add to Home Screen" and open Waypoint Hub like an app. Offline support comes in Phase 5. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Waypoint Hub",
    short_name: "Waypoint Hub",
    description: "Leads, referrals, partners and community for Waypoint Connect.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#0f766e",
    lang: "en-AU",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
