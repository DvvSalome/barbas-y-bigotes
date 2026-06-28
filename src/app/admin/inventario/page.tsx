import type { Metadata } from "next";
import { getProductos, getSedes } from "@/lib/data/queries";
import { AddProductForm } from "@/components/admin/AddProductForm";
import { cop } from "@/lib/format";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Stat } from "@/components/admin/Stat";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Inventario · Admin" };

export default async function InventarioPage() {
  const [productos, sedes] = await Promise.all([getProductos(), getSedes()]);

  return (
    <div className="max-w-4xl">
      <SectionHeader
        eyebrow="Stock"
        title="Inventario"
        description="Stock por sede con alerta de mínimo. Agregá productos y se guardan en Supabase."
      />

      <div className="mt-5">
        <AddProductForm sedes={sedes} />
      </div>

      {sedes.map((s) => {
        const list = productos.filter((p) => p.sede === s.id);
        if (!list.length) return null;
        return (
          <section key={s.id} className="mt-8">
            <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-accent">{s.nombre}</h2>

            {/* Mobile: cards */}
            <div className="space-y-2 sm:hidden">
              {list.map((p) => {
                const low = p.stock <= p.stockMinimo;
                return (
                  <div key={p.id} className={`rounded-xl border p-4 ${low ? "border-red-500/30 bg-red-500/[0.04]" : "border-line bg-panel"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{p.nombre}</span>
                      {low ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs text-red-300">
                          <AlertIcon className="h-3 w-3" /> Bajo mínimo
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-muted">OK</span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Stat label="Precio" value={cop(p.precio)} />
                      <Stat label="Stock" value={p.stock} className={low ? "font-semibold text-red-300" : ""} />
                      <Stat label="Mínimo" value={p.stockMinimo} className="text-muted" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* sm+: tabla */}
            <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-right font-medium">Precio</th>
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
                    <th className="px-4 py-3 text-right font-medium">Mínimo</th>
                    <th className="px-4 py-3 text-right font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p, i) => {
                    const low = p.stock <= p.stockMinimo;
                    return (
                      <tr key={p.id} className={`transition hover:bg-elevated/50 ${low ? "bg-red-500/[0.04]" : i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                        <td className="px-4 py-3">{p.nombre}</td>
                        <td className="px-4 py-3 text-right">{cop(p.precio)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${low ? "text-red-300" : ""}`}>{p.stock}</td>
                        <td className="px-4 py-3 text-right text-muted">{p.stockMinimo}</td>
                        <td className="px-4 py-3 text-right">
                          {low ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs text-red-300">
                              <AlertIcon className="h-3 w-3" /> Bajo mínimo
                            </span>
                          ) : (
                            <span className="text-xs text-muted">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
