"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminNav";
import { seccionFiltraPorSede, seccionExigeSede } from "@/components/admin/nav-mapa";
import { PerfilMenu } from "@/components/staff/PerfilMenu";
import { TemaBoton } from "@/components/staff/TemaBoton";
import { SearchIcon, PinIcon } from "@/components/icons";
import type { Sede } from "@/lib/data/types";

// Cabecera del admin en DOS filas, iguales en todas las secciones (tanda 1 de la
// propuesta de diseño, 9-sep): fila 1 = marca · sede · buscar · perfil (56 px y
// nunca envuelve); fila 2 = pestañas (44 px). El contenido arranca a ~110 px en
// el celular; antes la cabecera tenía tres formas según la sección y llegaba a
// 368 px, y en Agenda el avatar se caía a una tercera fila.
//
// Lo que salió de acá y a dónde fue: el chip/franja de caja → tarjeta ámbar
// dentro de Hoy y Caja (AvisoCaja); la leyenda "Esta sección muestra las dos
// sedes" → el selector no se dibuja donde no filtra; las sub-pestañas → dentro
// del contenido (AdminSubTabs, montado por el layout).

// Sede: en el celular un chip desplegable (select nativo: teclado y lector de
// pantalla gratis, y cabe en una fila); en escritorio el segmentado de siempre.
// Solo se dibuja en las secciones que filtran por sede.
function SedeSelector({ sedes }: { sedes: Sede[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const filtra = seccionFiltraPorSede(pathname);
  const exigeSede = seccionExigeSede(pathname);
  if (!filtra) return null;
  // La agenda no tiene "Ambas": sin ?sede= ya muestra la primera sede.
  const actual = search.get("sede") ?? (exigeSede ? (sedes[0]?.id ?? "") : "");
  const opciones = [
    ...(exigeSede ? [] : [{ id: "", nombre: "Ambas sedes" }]),
    ...sedes.map((s) => ({ id: s.id as string, nombre: s.nombre })),
  ];

  function ir(id: string) {
    const qs = new URLSearchParams(search.toString());
    if (id) qs.set("sede", id);
    else qs.delete("sede");
    const q = qs.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <>
      <label className="relative flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-panel pl-3 pr-8 text-[13px] font-semibold text-ink sm:hidden">
        <PinIcon className="h-4 w-4 shrink-0 text-muted" />
        <span className="truncate">{opciones.find((o) => o.id === actual)?.nombre ?? "Sede"}</span>
        <span aria-hidden className="pointer-events-none absolute right-3 text-muted">
          ▾
        </span>
        <select
          aria-label="Sede"
          value={actual}
          onChange={(e) => ir(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
      <div role="group" aria-label="Sede" className="hidden gap-0.5 rounded-full border border-line bg-panel p-[3px] sm:flex">
        {opciones.map((o) => {
          const activo = actual === o.id;
          return (
            <button
              key={o.nombre}
              type="button"
              aria-pressed={activo}
              onClick={() => ir(o.id)}
              className={`min-h-11 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition ${
                activo ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {o.nombre}
            </button>
          );
        })}
      </div>
    </>
  );
}

function abrirBuscador() {
  window.dispatchEvent(new CustomEvent("bb:cmdk"));
}

export function AdminTopbar({ email, sedes }: { email: string; sedes: Sede[] }) {
  const name = email.split("@")[0] || "Staff";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-5 sm:py-2">
        <Link
          href="/admin"
          aria-label="Barbas & Bigotes · Hoy"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-panel sm:min-h-11 sm:w-auto sm:rounded-none sm:hover:bg-transparent"
        >
          <Image src="/brand/logo-face-transparent.png" alt="" width={190} height={230} className="logo-staff h-8 w-auto sm:hidden" />
          <Image
            src="/brand/logo-lockup.png"
            alt="Barbas & Bigotes"
            width={1024}
            height={348}
            className="logo-staff hidden h-8 w-auto sm:block"
          />
        </Link>

        <Suspense fallback={<div className="min-h-11 flex-1" />}>
          <SedeSelector sedes={sedes} />
        </Suspense>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label="Buscar o hacer algo (Ctrl K)"
            onClick={abrirBuscador}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-panel text-ink transition hover:border-ink/25 sm:hidden"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label="Buscar o hacer algo (Ctrl K)"
            onClick={abrirBuscador}
            className="hidden min-h-11 w-[320px] items-center gap-2 rounded-full border border-line bg-panel px-4 text-[13px] text-muted transition hover:border-ink/25 hover:text-ink/80 sm:flex"
          >
            <SearchIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Buscar o hacer algo…</span>
            <kbd className="ml-auto rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[12px] font-semibold">Ctrl K</kbd>
          </button>
          {/* Accesibilidad: claro/oscuro a un toque. De día entra sol al local
              y el tema oscuro se lava; quien lo necesita lo necesita ahora, no
              después de entrar a Ajustes. */}
          <TemaBoton />
          <PerfilMenu nombre={name} detalle={email} salidaHref="/login" />
        </div>
      </div>

      {/* Segunda fila SOLO en escritorio (AdminTabs ya se esconde sola en el
          celular): ahí las secciones viven en la barra de abajo, donde entran
          las cinco sin scroll. Con esto la cabecera del celular pasa de dos
          filas a una y el cromo cae a la mitad. */}
      <Suspense fallback={null}>
        <AdminTabs />
      </Suspense>
    </header>
  );
}
