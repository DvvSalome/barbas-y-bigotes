import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import { siteGraph, jsonLd } from "@/lib/schema-org";

// El prototipo usa Barlow Condensed 500-800 como display; el 800 carga porque
// los títulos grandes (hero, H1) son font-extrabold.
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  // Fondo base del prototipo (§0): la status bar acompaña al carbón del sitio.
  themeColor: "#0c0b0a",
  // PWA iOS con status bar translúcida: el contenido se dibuja hasta el notch
  // y el header compensa con env(safe-area-inset-top).
  viewportFit: "cover",
};

const DESCRIPTION =
  "Barbería en Barranquilla con dos sedes: Parque Venezuela y Plaza de la Paz. Cortes, barba, faciales, keratina y combos. Reservá tu cita online.";

export const metadata: Metadata = {
  metadataBase: new URL("https://barbasybigotes.com"),
  title: {
    default: "Barbas & Bigotes Barbershop | Barbería en Barranquilla",
    template: "%s · Barbas & Bigotes",
  },
  description: DESCRIPTION,
  // "./" se resuelve contra el pathname de cada página (canonical self-referencing).
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "./",
    siteName: "Barbas & Bigotes Barbershop",
    title: "Barbas & Bigotes Barbershop | Barbería en Barranquilla",
    description: DESCRIPTION,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Barbas & Bigotes Barbershop, barbería en Barranquilla",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.jpg"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Barbas & Bigotes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${barlow.variable} ${inter.variable} antialiased`}
    >
      <head>
        {/* Aparición al scrollear. Va inline y ANTES del bundle a propósito:
            (1) marca <html> antes del primer pintado, así no hay parpadeo de
            contenido que se ve y desaparece; (2) el observer es vanilla, así que
            revela aunque React todavía no haya hidratado —en un Android de gama
            media con datos flojos eso es la diferencia entre ver la página y ver
            un vacío—; (3) si el JS está apagado, la clase nunca se agrega y todo
            queda visible (los estilos que ocultan cuelgan de .js-reveal). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
var d=document.documentElement;
try{
if((window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)||!("IntersectionObserver"in window))return;
d.classList.add("js-reveal");
var mostrar=function(el){el.classList.add("reveal-visible")};
var io=new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){if(es[i].isIntersecting){mostrar(es[i].target);io.unobserve(es[i].target)}}},
{rootMargin:"0px 0px -12% 0px",threshold:0.01});
var mirar=function(){
var n=document.querySelectorAll("[data-reveal]:not([data-reveal-listo])"),h=window.innerHeight||0;
for(var i=0;i<n.length;i++){var el=n[i];el.setAttribute("data-reveal-listo","");
/* Lo que ya está en pantalla al cargar se muestra sin animar: hacer esperar al
   visitante por lo que vino a leer es peor que no animar nada. */
if(el.getBoundingClientRect().top<h*0.9){mostrar(el)}else{io.observe(el)}}};
/* El script corre en el <head>, así que el <body> todavía no existe: hay que
   esperar al DOM. Si el armado falla, se quita la clase y TODO queda visible —
   nunca dejar contenido escondido por culpa de un adorno. */
var arrancar=function(){try{mirar()}catch(e){d.classList.remove("js-reveal")}};
if(document.readyState!=="loading"){arrancar()}else{document.addEventListener("DOMContentLoaded",arrancar)}
/* Navegación cliente (Next no recarga la página): revisa los nodos nuevos. */
window.addEventListener("load",arrancar);
}catch(e){d.classList.remove("js-reveal")}})();`,
          }}
        />
      </head>
      <body>
        {/* Grafo de entidad (Organization + WebSite + 2 sedes BarberShop):
            server-rendered para que los crawlers de IA lo vean sin ejecutar JS. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(siteGraph) }}
        />
        {children}
      </body>
    </html>
  );
}
