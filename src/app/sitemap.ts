import type { MetadataRoute } from "next";

const BASE = "https://barbasybigotes.com";

// Solo las páginas públicas del sitio (los paneles van excluidos en robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/nosotros`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/barberos`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/reservar`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terminos`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
