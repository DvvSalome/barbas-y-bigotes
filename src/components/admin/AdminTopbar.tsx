"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AdminTabs, seccionFiltraPorSede } from "@/components/admin/AdminNav";
import { PerfilMenu } from "@/components/staff/PerfilMenu";
import { SearchIcon } from "@/components/icons";
import type { Sede } from "@/lib/data/types";
import type { CajaChip } from "@/lib/data/queries";

// Barra de comando del admin (mockup): logo, selector de sede segmentado,
// buscador Ctrl-K, chip de caja (dato real) y la rueda de perfil (tema +
// cerrar sesión). Debajo, las tabs.

function horaBogota(iso: string) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .split(":")
    .map(Number);
  const ap = h < 12 ? "am" : "pm";
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${ap}`;
}

// Segmentado Ambas / sede A / sede B: navega con ?sede= (sin param = ambas).
// En las secciones que no filtran (Caja, Clientes, Inventario, Equipo, Comisiones,
// Cupones, Avisos) el selector igual se dejaba cambiar: se podía tener "Plaza de la
// Paz" marcado y estar leyendo las dos sedes sumadas. Ahí queda en gris, marcando
// "Ambas sedes" —que es lo que se está viendo— y con la aclaración al lado.
// El ?sede= elegido no se borra: vuelve a mandar al entrar a Hoy o Métricas.
function SedeSelector({ sedes }: { sedes: Sede[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const filtra = seccionFiltraPorSede(pathname);
  const actual = filtra ? search.get("sede") : null;
  const opciones: { id: string | null; nombre: string }[] = [
    { id: null, nombre: "Ambas sedes" },
    ...sedes.map((s) => ({ id: s.id as string, nombre: s.nombre })),
  ];

  function ir(id: string | null) {
    const qs = new URLSearchParams(search.toString());
    if (id) qs.set("sede", id);
    else qs.delete("sede");
    const q = qs.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div
        role="group"
        aria-label="Sede"
        aria-disabled={!filtra}
        title={filtra ? undefined : "Esta sección muestra las dos sedes"}
        className={`flex gap-0.5 rounded-[9px] border border-line bg-panel p-[3px] ${filtra ? "" : "opacity-60"}`}
      >
        {opciones.map((o) => {
          const activo = actual === o.id || (!actual && o.id === null);
          return (
            <button
              key={o.nombre}
              type="button"
              aria-pressed={activo}
              disabled={!filtra}
              onClick={() => ir(o.id)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed sm:px-3 ${
                activo
                  ? `bg-elevated shadow-[inset_0_0_0_1px_var(--line)] ${filtra ? "text-ink" : "text-muted"}`
                  : `text-muted ${filtra ? "hover:text-ink" : ""}`
              }`}
            >
              {o.nombre}
            </button>
          );
        })}
      </div>
      {!filtra && (
        <span className="text-[11px] font-medium leading-tight text-muted">Esta sección muestra las dos sedes</span>
      )}
    </div>
  );
}

export function AdminTopbar({ email, sedes, caja }: { email: string; sedes: Sede[]; caja: CajaChip }) {
  const name = email.split("@")[0] || "Staff";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5">
        <Link href="/admin" aria-label="Barbas & Bigotes" className="shrink-0 transition hover:opacity-95">
          <Image
            src="/brand/logo-lockup.png"
            alt="Barbas & Bigotes"
            width={1024}
            height={348}
            className="logo-staff h-8 w-auto"
          />
        </Link>

        <Suspense fallback={null}>
          <SedeSelector sedes={sedes} />
        </Suspense>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Buscar o hacer algo (Ctrl K)"
          onClick={() => window.dispatchEvent(new CustomEvent("bb:cmdk"))}
          className="flex min-w-24 flex-1 items-center gap-2 rounded-[9px] border border-line bg-panel px-3 py-1.5 text-[13px] text-muted transition hover:border-ink/25 hover:text-ink/80 sm:max-w-[380px]"
        >
          <SearchIcon className="h-3.5 w-3.5 shrink-0" />
          {/* En mobile era una píldora vacía (solo la lupa): al menos tiene que decir "Buscar". */}
          <span className="truncate">
            Buscar<span className="hidden sm:inline"> o hacer algo…</span>
          </span>
          <kbd className="ml-auto hidden rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold sm:block">
            Ctrl K
          </kbd>
        </button>

        <Link
          href="/admin/cuadre"
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
            caja.abierta ? "border-ok/35 text-ok" : "border-line text-muted hover:text-ink"
          }`}
        >
          <span className={`h-[7px] w-[7px] rounded-full ${caja.abierta ? "bg-ok" : "bg-muted"}`} />
          {caja.abierta
            ? caja.sedesCount > 1 && caja.abiertasCount < caja.sedesCount
              ? `Caja: ${caja.abiertasCount} de ${caja.sedesCount} abiertas`
              : `Caja abierta${caja.desde ? ` · ${horaBogota(caja.desde)}` : ""}`
            : "Caja cerrada"}
        </Link>

        <PerfilMenu nombre={name} detalle={email} salidaHref="/login" />
      </div>

      <Suspense fallback={null}>
        <AdminTabs />
      </Suspense>
    </header>
  );
}
