import type { Metadata } from "next";
import { getProductos, getSedes } from "@/lib/data/queries";
import { AddProductForm } from "@/components/admin/AddProductForm";
import { cop } from "@/lib/format";

export const metadata: Metadata = { title: "Inventario · Admin" };

export default async function InventarioPage() {
  const [productos, sedes] = await Promise.all([getProductos(), getSedes()]);

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl font-semibold">Inventario</h1>
      <p className="mt-2 text-sm text-muted">
        Stock por sede con alerta de mínimo. Agregá productos y se guardan en Supabase.
      </p>

      <div className="mt-5">
        <AddProductForm sedes={sedes} />
      </div>

      {sedes.map((s) => {
        const list = productos.filter((p) => p.sede === s.id);
        if (!list.length) return null;
        return (
          <section key={s.id} className="mt-8">
            <h2 className="mb-4 font-display text-2xl italic">{s.nombre}</h2>
            <div className="overflow-hidden rounded-2xl border border-line">
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
                      <tr key={p.id} className={i % 2 ? "bg-panel" : "bg-panel/40"}>
                        <td className="px-4 py-3">{p.nombre}</td>
                        <td className="px-4 py-3 text-right">{cop(p.precio)}</td>
                        <td className="px-4 py-3 text-right">{p.stock}</td>
                        <td className="px-4 py-3 text-right text-muted">{p.stockMinimo}</td>
                        <td className="px-4 py-3 text-right">
                          {low ? (
                            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs text-red-300">
                              Bajo mínimo
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
