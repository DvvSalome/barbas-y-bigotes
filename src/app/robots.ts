import type { MetadataRoute } from "next";

// robots.txt generado: el sitio público se indexa; los paneles y gateways de
// sesión no tienen nada que hacer en un buscador.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/barbero", "/cuenta", "/entrar", "/login"],
    },
    sitemap: "https://barbasybigotes.com/sitemap.xml",
  };
}
