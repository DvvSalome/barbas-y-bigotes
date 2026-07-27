import { TARJETA_SIZE, HITO_50, HITO_GRATIS } from "@/lib/tarjeta";

/*
  Réplica de la tarjeta física (layout 2A del proyecto de Claude Design
  "Tarjeta de fidelidad Barbas y Bigotes"). Misma composición, textos y logo que
  la que el cliente lleva en la billetera: si son iguales, no hay que explicarle
  nada — reconoce la suya.

  Server component: no hay estado ni interacción. Los sellos NO se tocan acá, se
  derivan de las ventas reales (contarCortesCliente). En el prototipo eran
  clickeables porque era una maqueta para probar la idea; en el portal del
  cliente dejar marcar sellos a mano sería regalar cortes.

  El sello vacío muestra una cara peluda; al llenarse pasa una tijera, cae el
  pelo y queda la cara afeitada. Toda la animación es CSS (globals.css,
  bloque .bb-tarjeta), así que no cuesta JS.

  Medidas: el original mide 820x496. Acá todo va en `cqw` (container query
  units) sobre un contenedor con aspect-ratio 820/496, así la tarjeta escala
  entera y proporcional en cualquier ancho sin recalcular nada.
*/

const BASE = 820; // ancho del diseño original; 1cqw = 8.2px a tamaño natural
/** px del diseño → cqw, para no sembrar números mágicos. */
const u = (px: number) => `${((px / BASE) * 100).toFixed(3)}cqw`;

export function TarjetaFidelidad({
  sellos,
  nombre,
  subtitulo = "Se llena sola con cada corte. Acá no tenés que presentar nada.",
  codigo,
}: {
  /** Sellos llenos, 0..9 (cortesTotales % 10). */
  sellos: number;
  nombre?: string;
  /**
   * Línea bajo el título. Por defecto NO se copia la de la tarjeta impresa
   * ("Válido hasta …, obligatorio presentar la tarjeta física"): en el portal
   * no hay nada que presentar —el barbero ve los sellos al cobrar— y el sistema
   * no maneja vencimiento. Decirlo igual sería mentirle al cliente.
   */
  subtitulo?: string;
  codigo?: string;
}) {
  const llenos = Math.max(0, Math.min(TARJETA_SIZE, sellos));

  return (
    <div className="bb-tarjeta" style={{ containerType: "inline-size" }}>
      <div
        className="bb-tarjeta__lienzo"
        style={{ borderRadius: u(14) }}
        // La tarjeta es decorativa; el estado real va en el texto de al lado.
        role="img"
        aria-label={`Tarjeta de fidelidad: ${llenos} de ${TARJETA_SIZE} cortes`}
      >
        {/* Fondo: dos capas de degradados radiales (cuero gastado + viñeta). */}
        <div className="bb-tarjeta__fondo" />
        <div className="bb-tarjeta__vineta" />

        {/* Marcas de agua: el logo real, rotado, como en la tarjeta impresa. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- decorativa, sin layout shift: va posicionada absoluta */}
        <img
          src="/brand/logo-lockup.png"
          alt=""
          aria-hidden
          className="bb-tarjeta__marca"
          style={{ left: u(6), top: u(296), width: u(230), opacity: 0.14 }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- ídem */}
        <img
          src="/brand/logo-lockup.png"
          alt=""
          aria-hidden
          className="bb-tarjeta__marca"
          style={{ right: u(-16), bottom: u(34), width: u(230), opacity: 0.13 }}
        />

        <div className="bb-tarjeta__cuerpo" style={{ padding: `${u(30)} ${u(46)} ${u(22)}` }}>
          <div className="bb-tarjeta__enc">
            <div className="bb-tarjeta__titulo" style={{ fontSize: u(56) }}>
              Tarjeta de fidelidad
            </div>
            {subtitulo && (
              <div
                className="bb-tarjeta__sub"
                style={{ fontSize: u(16), marginTop: u(10), maxWidth: u(580) }}
              >
                {subtitulo}
              </div>
            )}
          </div>

          <div
            className="bb-tarjeta__sellos"
            style={{
              gridTemplateColumns: `repeat(5, ${u(74)})`,
              gap: `${u(12)} ${u(14)}`,
            }}
          >
            {Array.from({ length: TARJETA_SIZE }).map((_, i) => {
              const n = i + 1;
              const hecho = n <= llenos;
              // Solo el último sello gana la animación del corte: es el que se
              // acaba de ganar. Animarlos todos convertiría la tarjeta en un
              // parpadeo cada vez que el cliente abre el portal.
              const recien = hecho && n === llenos;
              return (
                <div key={n} className="bb-tarjeta__casilla" style={{ width: u(74), height: u(74) }}>
                  {hecho ? (
                    <div className={`bb-sello bb-sello--hecho${recien ? " bb-sello--recien" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- decorativa dentro del sello */}
                      <img
                        src="/brand/clean-solid-dark.png"
                        alt=""
                        aria-hidden
                        className="bb-sello__cara"
                        style={{ height: u(54) }}
                      />
                      {recien && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- se recorta con clip-path al "cortar" */}
                          <img
                            src="/brand/hairy-dark.png"
                            alt=""
                            aria-hidden
                            className="bb-sello__pelo"
                            style={{ height: u(66), width: u(44) }}
                          />
                          <span className="bb-sello__pelito" style={{ left: u(14), bottom: u(10), width: u(7) }} />
                          <span className="bb-sello__pelito bb-sello__pelito--2" style={{ left: u(34), bottom: u(8), width: u(9) }} />
                          <span className="bb-sello__pelito bb-sello__pelito--3" style={{ left: u(52), bottom: u(12), width: u(6) }} />
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            className="bb-sello__tijera"
                            style={{ width: u(34), height: u(34), margin: `${u(-17)} 0 0 ${u(-17)}` }}
                            fill="none"
                            stroke="#14110f"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          >
                            <circle cx="5.2" cy="6" r="2.4" />
                            <circle cx="5.2" cy="18" r="2.4" />
                            <path d="M7.3 7.3 21 15.4" />
                            <path d="M7.3 16.7 21 8.6" />
                          </svg>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bb-sello bb-sello--vacio" style={{ borderWidth: u(5) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- la cara peluda del sello sin marcar */}
                      <img
                        src="/brand/hairy-light.png"
                        alt=""
                        aria-hidden
                        className="bb-sello__peludo"
                        style={{ height: u(64), width: u(46) }}
                      />
                      {/* Los premios llevan su marca. OJO: acá manda la regla real
                          del negocio (tarjeta.ts, la misma que aplica el cobro):
                          el 5º corte va al 50% y el 10º es GRATIS. */}
                      {n === HITO_50 && (
                        <span className="bb-sello__mitad" style={{ fontSize: u(26) }}>
                          50<span style={{ fontSize: u(15), verticalAlign: "super" }}>%</span>
                        </span>
                      )}
                      {n === HITO_GRATIS && (
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden
                          className="bb-sello__regalo"
                          style={{ width: u(34), height: u(34) }}
                          fill="none"
                          stroke="#f4f1ea"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        >
                          <path d="M3 11h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
                          <path d="M2 7.5h20V11H2z" />
                          <path d="M12 7.5V21" />
                          <path d="M12 7.5S9.8 7.4 8.4 6.6C7 5.8 7.2 4 8.6 3.6c1.5-.4 3.4 2.3 3.4 3.9z" />
                          <path d="M12 7.5s2.2-.1 3.6-.9c1.4-.8 1.2-2.6-.2-3c-1.5-.4-3.4 2.3-3.4 3.9z" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bb-tarjeta__pie" style={{ gap: u(8) }}>
            <div className="bb-tarjeta__contacto" style={{ gap: u(14) }}>
              <svg viewBox="0 0 24 24" aria-hidden style={{ width: u(27), height: u(27) }} fill="#f4f1ea">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m0 1.67c4.54 0 8.24 3.7 8.24 8.24s-3.7 8.24-8.24 8.24c-1.53 0-3.02-.42-4.32-1.22l-.31-.19-3.2.84.85-3.12-.2-.32a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.1 8.44-8.1m-3.6 4.1c-.17 0-.44.06-.67.31s-.88.86-.88 2.1c0 1.24.9 2.44 1.03 2.61.12.17 1.75 2.79 4.23 3.8 2.06.84 2.48.67 2.93.63.45-.04 1.45-.6 1.66-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.17-.48-.29-.25-.12-1.45-.72-1.68-.8-.23-.08-.39-.12-.56.12-.17.25-.64.83-.79 1-.14.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.25-.75-.67-1.25-1.5-1.4-1.75-.14-.25-.02-.39.11-.51.11-.11.29-.29.43-.45.14-.17.19-.29.29-.48.1-.19.05-.35-.02-.5-.06-.14-.53-1.33-.73-1.82-.2-.48-.4-.4-.56-.4z" />
              </svg>
              <span className="bb-tarjeta__dato" style={{ fontSize: u(27), letterSpacing: "0.06em" }}>
                Reservas 3006734799
              </span>
            </div>
            <div className="bb-tarjeta__contacto" style={{ gap: u(14) }}>
              <svg viewBox="0 0 24 24" aria-hidden style={{ width: u(27), height: u(27) }} fill="none" stroke="#f4f1ea" strokeWidth="1.8">
                <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" />
                <circle cx="12" cy="12" r="4.2" />
                <circle cx="17.4" cy="6.7" r="1.1" fill="#f4f1ea" stroke="none" />
              </svg>
              <span className="bb-tarjeta__dato" style={{ fontSize: u(27), letterSpacing: "0.04em" }}>
                @barbasybigotes.baq
              </span>
            </div>
          </div>
        </div>
      </div>

      {codigo && (
        <div className="mt-2 flex justify-between text-[11.5px] text-muted">
          <span>
            {nombre ? `${nombre} · ` : ""}Nº {codigo}
          </span>
          <span className="tabular-nums">
            {llenos}/{TARJETA_SIZE} sellos
          </span>
        </div>
      )}
    </div>
  );
}
