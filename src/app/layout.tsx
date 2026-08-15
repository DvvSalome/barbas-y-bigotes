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
  "Barbería en Barranquilla con dos sedes: Parque Venezuela y Plaza de la Paz. Cortes, barba, faciales, keratina y combos. Reserva tu cita online.";

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
      // El script inline del <head> agrega la clase `js-reveal` a <html> ANTES
      // de que React hidrate (anti-flash de la aparición al scrollear). Eso hace
      // que el className del servidor y el del DOM difieran y React tira un aviso
      // rojo de hidratación en toda ruta pública. suppressHydrationWarning
      // silencia ESE aviso puntual del nodo raíz — patrón canónico, el mismo que
      // usan los theme-switchers — sin tapar mismatches reales de otros nodos.
      suppressHydrationWarning
      className={`${barlow.variable} ${inter.variable} antialiased`}
    >
      <head>
        {/* Aparición al scrollear. Va inline y ANTES del bundle a propósito:
            (1) marca <html> con .js-reveal antes del primer pintado, así no hay
            parpadeo de contenido que se ve y desaparece; (2) el revelado espera a
            que React hidrate (ver más abajo) para no ensuciar la consola con un
            aviso de hidratación, con un tope de 4 s por si la hidratación nunca
            llega —en un Android de gama media con datos flojos ese tope es la
            diferencia entre ver la página y ver un vacío—; (3) si el JS está
            apagado, la clase nunca se agrega y todo queda visible (los estilos
            que ocultan cuelgan de .js-reveal). */}
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
var correr=function(){try{
mirar();
/* mirar() corría UNA vez: lo que entraba al DOM después (una sección que
   streamea tarde, un componente cliente que monta al final) nunca quedaba
   observado y se quedaba en opacity:0 PARA SIEMPRE — fondo negro sin texto.
   Se vuelve a mirar ante cualquier cambio del DOM. */
if("MutationObserver"in window){
var pedido=0;
new MutationObserver(function(){if(pedido)return;pedido=requestAnimationFrame(function(){pedido=0;try{mirar()}catch(e){}})})
.observe(document.body,{childList:true,subtree:true});}
/* Red de seguridad: a los 6 s, todo lo que siga escondido Y esté en pantalla se
   muestra sí o sí. Si a esa altura algo no apareció es un error nuestro, y el
   visitante no tiene por qué pagarlo mirando un hueco negro. */
setTimeout(function(){try{
var n=document.querySelectorAll("[data-reveal]:not(.reveal-visible)"),h=window.innerHeight||0;
for(var i=0;i<n.length;i++){var r=n[i].getBoundingClientRect();if(r.top<h&&r.bottom>0)n[i].classList.add("reveal-visible")}
}catch(e){d.classList.remove("js-reveal")}},6000);
}catch(e){d.classList.remove("js-reveal")}};
/* Marcar los [data-reveal] (setAttribute + reveal-visible) DESPUÉS de que React
   hidrate. Si el DOM se muta antes, su className/atributos dejan de matchear el
   vdom y React tira un aviso rojo de hidratación en TODA ruta pública. Ningún
   proxy temporal sirve —DOMContentLoaded/load/rAF/idle caen ANTES de la
   hidratación en dev (webpack) y en gama baja—, así que detectamos el hecho
   directo: React cuelga sus claves internas (__reactFiber$…/__reactProps$…) en
   cada nodo al hidratarlo. La hidratación es top-down, con lo que si el ÚLTIMO
   [data-reveal] ya las tiene, todos los anteriores también. Fallback por timeout
   para no dejar nada oculto si la detección fallara. El anti-flash NO se pierde:
   js-reveal ya se agregó arriba (sincrónico); esto solo pospone el revelado. */
var hidratado=function(){
var n=document.querySelectorAll("[data-reveal]"),el=n.length?n[n.length-1]:document.body;
if(!el)return false;
for(var k in el){if(k.lastIndexOf("__react",0)===0)return true}
return false;};
var t0=Date.now();
var esperar=function(){if(hidratado()||Date.now()-t0>4000){correr()}else{requestAnimationFrame(esperar)}};
requestAnimationFrame(esperar);
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
