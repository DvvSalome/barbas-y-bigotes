import type { Metadata } from "next";
import Link from "next/link";
import { getConfigTarjeta, getServiciosCatalogoAdmin } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { TarjetaAdmin } from "@/components/admin/TarjetaAdmin";

export const metadata: Metadata = { title: "Tarjeta de cortes · Admin" };

// La regla de fidelidad, editable (0064). Antes vivía quemada en el código: para
// mover el regalo del 5º corte al 4º había que tocar tarjeta.ts y desplegar.

export default async function TarjetaPage() {
  const [cfg, servicios] = await Promise.all([getConfigTarjeta(), getServiciosCatalogoAdmin()]);
  // Qué suma sello hoy: solo cortes y combos entran al conteo, y de esos, los que
  // no estén marcados como excluidos.
  const candidatos = servicios.filter((s) => s.categoria === "cortes" || s.categoria === "combos");
  const suman = candidatos.filter((s) => s.cuentaCorte !== false);
  const noSuman = candidatos.filter((s) => s.cuentaCorte === false);

  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Marketing"
        title="Tarjeta de cortes"
        description="Cuántos cortes tiene la tarjeta y qué se lleva el cliente en cada premio. Se aplica solo al cobrar."
      />

      <div className="mt-5">
        <TarjetaAdmin inicial={cfg} />
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-display text-lg text-ink">Qué suma sello</h2>
        <p className="mt-1 text-[13px] text-muted">
          Solo los servicios de <b className="text-ink">cortes</b> y <b className="text-ink">combos</b> pueden sumar; la
          barba y los cerquillos no cuentan salvo que los marques. Un cobro suma{" "}
          <b className="text-ink">un sello</b>, aunque incluya varios servicios.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-ok">Suman ({suman.length})</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              {suman.length ? suman.map((s) => s.nombre).join(" · ") : "Ninguno: la tarjeta no se llenaría nunca."}
            </p>
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted">No suman ({noSuman.length})</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              {noSuman.length ? noSuman.map((s) => s.nombre).join(" · ") : "Todos los cortes y combos suman."}
            </p>
          </div>
        </div>

        <Link
          href="/admin/precios"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-[13px] font-semibold text-muted transition hover:border-ink/25 hover:text-ink"
        >
          Cambiarlo en el catálogo →
        </Link>
      </section>
    </div>
  );
}
