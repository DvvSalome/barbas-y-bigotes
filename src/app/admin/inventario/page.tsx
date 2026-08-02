import type { Metadata } from "next";
import { getProductos, getSedes } from "@/lib/data/queries";
import { AddProductForm } from "@/components/admin/AddProductForm";
import { UpsellToggle } from "@/components/admin/UpsellToggle";
import { PrecioEditable } from "@/components/admin/PrecioEditable";
import { FotoProducto } from "@/components/staff/FotoProducto";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Stat } from "@/components/admin/Stat";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Productos y stock · Admin" };

export default async function InventarioPage() {
  const [productos, sedes] = await Promise.all([getProductos(), getSedes()]);

  return (
    <div className="max-w-4xl">
      <SectionHeader
        eyebrow="Stock"
        title="Productos y stock"
        description="Lo que se vende en el mostrador: cuánto queda, cuánto cuesta y qué se está acabando. El precio se edita tocándolo."
      />

      <div className="mt-5">
        <AddProductForm sedes={sedes} />
      </div>

      {sedes.map((s) => {
        // Lo que hay que reponer, primero: antes había que cazar el "Bajo mínimo"
        // leyendo toda la lista. El sort es estable, así que dentro de cada
        // grupo se conserva el orden de la consulta y la lista no baila sola.
        const list = productos
          .filter((p) => p.sede === s.id)
          .sort((a, b) => Number(b.stock <= b.stockMinimo) - Number(a.stock <= a.stockMinimo));
        if (!list.length) return null;
        const bajos = list.filter((p) => p.stock <= p.stockMinimo).length;
        return (
          <section key={s.id} className="mt-8">
            <h2 className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent">
              {s.nombre}
              {bajos > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] tracking-normal text-red-300">
                  <AlertIcon className="h-3 w-3" /> {bajos} bajo mínimo
                </span>
              )}
            </h2>

            {/* Mobile: cards */}
            <div className="space-y-2 sm:hidden">
              {list.map((p) => {
                const low = p.stock <= p.stockMinimo;
                return (
                  <div key={p.id} className={`rounded-xl border p-4 ${low ? "border-red-500/30 bg-red-500/[0.04]" : "border-line bg-panel"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <FotoProducto productoId={p.id} nombre={p.nombre} fotoUrl={p.fotoUrl} />
                        <span className="min-w-0 truncate font-medium">{p.nombre}</span>
                      </div>
                      {low ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs text-red-300">
                          <AlertIcon className="h-3 w-3" /> Bajo mínimo
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-muted">OK</span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Stat label="Precio" value={<PrecioEditable productoId={p.id} precio={p.precio} />} />
                      <Stat label="Stock" value={p.stock} className={low ? "font-semibold text-red-300" : ""} />
                      <Stat label="Mínimo" value={p.stockMinimo} className="text-muted" />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <UpsellToggle productoId={p.id} enUpsell={p.enUpsell} />
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
                    <th className="px-4 py-3 text-right font-medium">Reserva</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p, i) => {
                    const low = p.stock <= p.stockMinimo;
                    return (
                      <tr key={p.id} className={`transition hover:bg-elevated/50 ${low ? "bg-red-500/[0.04]" : i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <FotoProducto productoId={p.id} nombre={p.nombre} fotoUrl={p.fotoUrl} size={36} />
                            <span>{p.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PrecioEditable productoId={p.id} precio={p.precio} />
                        </td>
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
                        <td className="px-4 py-3 text-right">
                          <UpsellToggle productoId={p.id} enUpsell={p.enUpsell} />
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
