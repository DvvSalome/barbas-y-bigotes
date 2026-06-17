import type { Metadata } from "next";
import Link from "next/link";
import { getResumen } from "@/lib/data/queries";
import { cop } from "@/lib/format";

export const metadata: Metadata = { title: "Resumen · Admin" };

const accesos = [
  { href: "/admin/cuadre", title: "Cuadre de caja", desc: "Ingresos, gastos y neto del día por sede." },
  { href: "/admin/precios", title: "Precios por sede", desc: "Actualizá precios de ambas sedes." },
  { href: "/admin/inventario", title: "Inventario", desc: "Stock por sede con alerta de mínimo." },
  { href: "/admin/comisiones", title: "Comisiones", desc: "Porcentaje o arriendo por barbero." },
];

export default async function AdminHome() {
  const r = await getResumen();
  const kpis = [
    { label: "Ingresos hoy", value: cop(r.ingresosHoy), hint: `${cop(r.efectivo)} efectivo · ${cop(r.datafono)} datáfono` },
    { label: "Atenciones hoy", value: String(r.citasHoy), hint: "cobradas, ambas sedes" },
    { label: "Productos bajo mínimo", value: String(r.bajoMinimo), hint: "alerta de stock" },
    { label: "Adelantos del mes", value: cop(r.adelantosMes), hint: "por barbero" },
  ];

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Resumen</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Números reales de hoy, en vivo desde Supabase.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-panel p-6">
            <div className="text-xs uppercase tracking-wide text-muted">{k.label}</div>
            <div className="mt-2 font-display text-4xl text-accent-soft">{k.value}</div>
            <div className="mt-1 text-xs text-muted/70">{k.hint}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-2xl italic">Accesos rápidos</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-2xl border border-line bg-panel p-6 transition hover:border-accent/50"
          >
            <div className="font-display text-xl">{a.title}</div>
            <p className="mt-2 text-sm text-muted">{a.desc}</p>
            <span className="mt-4 inline-block text-sm text-accent-soft transition group-hover:translate-x-1">Abrir →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
