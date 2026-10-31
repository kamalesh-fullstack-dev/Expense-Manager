import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Manager",
    short_name: "Expenses",
    description: "Premium mobile-first expense tracker for daily spending and budgeting.",
    start_url: "/",
    display: "standalone",
    background_color: "#020d14",
    theme_color: "#0a1016",
    orientation: "portrait",
    prefer_related_applications: false,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
