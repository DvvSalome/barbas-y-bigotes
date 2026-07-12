import Image from "next/image";
import Link from "next/link";

/*
  Footer del prototipo (spec §1.7 móvil + §5 desktop), centrado:
  logo + tagline + redes redondas + divisor "Sedes" + cards de sede +
  pill de horario + nota de cancelación + copyright. En desktop suma el
  CTA final "¿Listo para tu mejor versión?" y la fila de links.
*/

const SEDES_FOOTER = [
  {
    nombre: "Parque Venezuela",
    direccion: "Calle 88 #44 - 10, Local 4",
    tel: "+57 300 409 7624",
    telHref: "tel:+573004097624",
  },
  {
    nombre: "Plaza de la Paz",
    direccion: "Cra. 45 #50-168, frente a la plaza",
    tel: "+57 300 673 4799",
    telHref: "tel:+573006734799",
  },
];

const WA_URL =
  "https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20quisiera%20saber%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20y%20reservas.";

export function SiteFooter({ conCtaMovil = false }: { conCtaMovil?: boolean }) {
  return (
    <footer className="mt-3.5 border-t border-[rgba(242,237,228,0.08)] bg-[linear-gradient(180deg,#0a0908,#050403)] md:border-[rgba(242,237,228,0.1)]">
      {/* CTA final (solo desktop, §5) */}
      <div className="hidden text-center md:block">
        <div className="mx-auto max-w-[900px] px-10 pt-[52px]">
          <h2 className="font-display text-[42px] font-extrabold uppercase leading-tight">
            ¿Listo para tu <span className="text-accent-soft">mejor versión</span>?
          </h2>
          <p className="mt-2 text-sm text-muted">
            Reservá en menos de un minuto · confirmación directa a tu correo.
          </p>
          <Link
            href="/reservar"
            className="mt-6 inline-block rounded-full bg-[linear-gradient(180deg,var(--accent-soft),var(--accent))] px-10 py-4 font-display text-lg font-bold uppercase text-on-accent shadow-[0_16px_40px_-12px_rgba(210,63,52,0.7)] transition hover:brightness-105"
          >
            Reservar cita
          </Link>
          <div className="mt-[52px] border-t border-[rgba(242,237,228,0.08)]" />
        </div>
      </div>

      <div
        className={`mx-auto max-w-[900px] px-[22px] pt-9 text-center md:px-10 md:pb-[52px] ${
          conCtaMovil ? "pb-[104px]" : "pb-12"
        }`}
      >
        <Image
          src="/brand/logo-lockup.png"
          alt="Barbas & Bigotes Barbershop"
          width={1024}
          height={348}
          className="mx-auto h-[52px] w-auto opacity-95 md:h-[54px]"
        />
        <p className="mx-auto mt-4 max-w-[30ch] text-[12.5px] leading-[1.7] text-muted">
          El ritual clásico de la barbería en Barranquilla. Tradición, estilo y excelencia en cada
          detalle.
        </p>

        {/* Redes: círculos de 46px */}
        <div className="mt-6 flex items-center justify-center gap-2.5">
          <a
            href="https://instagram.com/barbasybigotes.baq"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de Barbas & Bigotes"
            className="grid h-[46px] w-[46px] place-items-center rounded-full border border-[rgba(242,237,228,0.14)] text-ink transition hover:border-accent-soft hover:text-accent-soft"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp de Barbas & Bigotes"
            className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#25D366] text-white transition hover:brightness-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
              <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
            </svg>
          </a>
        </div>

        {/* Divisor "Sedes" (desktop: "Nuestras sedes") */}
        <div className="mt-8 flex items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(242,237,228,0.16)]" />
          <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.24em] text-accent">
            <span className="md:hidden">Sedes</span>
            <span className="hidden md:inline">Nuestras sedes</span>
          </span>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(242,237,228,0.16)]" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 md:gap-3.5">
          {SEDES_FOOTER.map((s) => (
            <div
              key={s.nombre}
              className="rounded-[14px] border border-[rgba(242,237,228,0.08)] bg-[rgba(21,19,17,0.5)] px-4 py-3.5"
            >
              <div className="font-display text-base font-bold uppercase">{s.nombre}</div>
              <div className="mt-0.5 text-xs text-muted">{s.direccion}</div>
              <a href={s.telHref} className="mt-1 inline-block text-[12.5px] font-bold text-accent-soft">
                {s.tel}
              </a>
            </div>
          ))}
        </div>

        {/* Fila de links (solo desktop, §5) */}
        <nav className="mt-6 hidden items-center justify-center gap-3 text-[13px] text-muted md:flex">
          <Link href="/barberos" className="transition hover:text-accent-soft">
            Barberos
          </Link>
          <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-muted/60" />
          <Link href="/nosotros" className="transition hover:text-accent-soft">
            Nosotros
          </Link>
          <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-muted/60" />
          <Link href="/cuenta" className="transition hover:text-accent-soft">
            Mi cuenta
          </Link>
          <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-muted/60" />
          <Link href="/reservar" className="font-bold text-accent-soft transition hover:text-accent">
            Reservar cita →
          </Link>
        </nav>

        {/* Pill de horario */}
        <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-[rgba(242,237,228,0.1)] bg-[rgba(21,19,17,0.5)] px-5 py-[11px] text-[12.5px]">
          <span className="text-muted">Lun – Sáb</span>
          <span className="font-extrabold tabular-nums">9am – 8pm</span>
          <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-muted/60" />
          <span className="font-bold text-accent-soft">Dom cerrado</span>
        </div>

        <p className="mt-3.5 text-[11.5px] text-muted">
          Cancelaciones online hasta 2 horas antes de tu cita.
        </p>

        <div className="mt-7 border-t border-[rgba(242,237,228,0.07)] pt-5 text-[11px] leading-relaxed text-[rgba(156,149,138,0.55)]">
          <span className="md:hidden">© 2026 Barbas &amp; Bigotes Barbershop</span>
          <span className="hidden md:inline">
            © 2026 Barbas &amp; Bigotes Barbershop · Todos los derechos reservados
          </span>
          <br />
          Tradición y estilo · Barranquilla, CO
        </div>
      </div>
    </footer>
  );
}
