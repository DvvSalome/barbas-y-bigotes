import type { Metadata } from "next";
import Link from "next/link";
import { getResumen } from "@/lib/data/queries";
import { cop } from "@/lib/format";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Kpi } from "@/components/admin/Kpi";
import { CashIcon, UsersIcon, BoxIcon, TagIcon, PercentIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Resumen · Admin" };

const accesos = [
  { href: "/admin/cuadre", title: "Cuadre de caja", desc: "Ingresos, gastos y neto del día por sede.", Icon: CashIcon },
  { href: "/admin/precios", title: "Precios por sede", desc: "Actualizá precios de ambas sedes.", Icon: TagIcon },
  { href: "/admin/inventario", title: "Inventario", desc: "Stock por sede con alerta de mínimo.", Icon: BoxIcon },
  { href: "/admin/comisiones", title: "Comisiones", desc: "Porcentaje o arriendo por barbero.", Icon: PercentIcon },
];

export default async function AdminHome() {
  const r = await getResumen();
  const kpis = [
    {
      label: "Ingresos hoy",
      value: cop(r.ingresosHoy),
      hint: `${cop(r.efectivo)} efectivo · ${cop(r.datafono)} datáfono${r.otros > 0 ? ` · ${cop(r.otros)} otros` : ""}`,
      Icon: CashIcon,
    },
    { label: "Atenciones hoy", value: String(r.citasHoy), hint: "cobradas, ambas sedes", Icon: UsersIcon },
    { label: "Productos bajo mínimo", value: String(r.bajoMinimo), hint: "alerta de stock", Icon: BoxIcon, accent: r.bajoMinimo > 0 },
    { label: "Adelantos del mes", value: cop(r.adelantosMes), hint: "por barbero", Icon: PercentIcon },
  ];

  return (
    <div>
      <SectionHeader
        eyebrow="Vista general"
        title="Resumen"
        description="Números reales de hoy, en vivo desde Supabase."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.label} label={k.label} value={k.value} hint={k.hint} Icon={k.Icon} accent={k.accent ?? true} />
        ))}
      </div>

      <h2 className="mt-12 text-xs uppercase tracking-[0.3em] text-accent">Accesos rápidos</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-6 transition hover:border-accent/50 hover:bg-elevated/60"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 text-accent">
              <a.Icon className="h-5 w-5" />
            </div>
            <div className="font-display text-xl">{a.title}</div>
            <p className="mt-2 text-sm text-muted">{a.desc}</p>
            <span className="mt-4 inline-block text-sm text-accent-soft transition group-hover:translate-x-1">Abrir →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
