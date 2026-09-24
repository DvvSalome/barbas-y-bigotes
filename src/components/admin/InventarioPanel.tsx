"use client";

import { useState } from "react";
import { cop } from "@/lib/format";
import { ChevronRightIcon } from "@/components/icons";
import { Grupo } from "@/components/ui/ListaAgrupada";
import { Hoja } from "@/components/ui/Hoja";
import { PrecioEditable } from "@/components/admin/PrecioEditable";
import { ComisionEditable } from "@/components/admin/ComisionEditable";
import { UpsellToggle } from "@/components/admin/UpsellToggle";
import { StockControl } from "@/components/admin/StockControl";
import { actualizarCostoProducto } from "@/lib/actions";
import { AddProductForm } from "@/components/admin/AddProductForm";
import { FotoProducto } from "@/components/staff/FotoProducto";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import type { Producto, Sede } from "@/lib/data/types";

/*
  La estantería, en filas (paso 19 de la tanda 2).

  ANTES: una tarjeta por producto con TODO adentro — foto, precio, comisión,
  "+ Entró", "Corregir" y el interruptor del upsell. Medido a 390 px: 4.568 px de
  alto y 104 controles, o sea cinco pantallas y media de scroll para mirar quince
  productos. Y la pregunta que trae uno a esta pantalla casi siempre es "¿qué me
  queda?", que es un número, no seis botones.

  AHORA: una fila de 72 px por producto (foto, nombre, precio y lo que queda) y
  todo lo que se EDITA vive en la hoja que abre esa fila. La lista completa cabe
  de un vistazo; editar cuesta un toque más, que es el negocio correcto: mirar
  pasa quince veces por cada vez que se edita.

  La sede la manda el selector de ARRIBA (?sede=), igual que en Clientes.
*/
export function InventarioPanel({
  productos,
  sedes,
  sedeActiva,
  costos = {},
}: {
  productos: Producto[];
  sedes: Sede[];
  /** null = las dos sedes, agrupadas. */
  sedeActiva: string | null;
  /** Lo que le cuesta al local cada producto (0077). Viaja APARTE del producto
   *  porque `Producto` también lo leen pantallas públicas y el margen no es
   *  dato público. Sin costo = no suma a ganancia ni a plata invertida. */
  costos?: Record<string, number>;
}) {
  const [altaAbierta, setAltaAbierta] = useState(false);
  // Se guarda el ID, NO el producto: cada acción de la hoja hace router.refresh()
  // y el objeto que hubiéramos copiado al estado quedaría con el stock viejo.
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = productos.find((p) => p.id === abiertoId) ?? null;

  const grupos = (sedeActiva ? sedes.filter((s) => s.id === sedeActiva) : sedes).map((s) => {
    // Lo que hay que reponer va primero: si no, había que cazarlo leyendo todo.
    const lista = productos
      .filter((p) => p.sede === s.id)
      .sort((a, b) => Number(b.stock <= b.stockMinimo) - Number(a.stock <= a.stockMinimo));
    const conCosto = lista.filter((p) => costos[p.id] !== undefined);
    return {
      sede: s,
      lista,
      bajos: lista.filter((p) => p.stock <= p.stockMinimo),
      valor: lista.reduce((a, p) => a + p.precio * p.stock, 0),
      // La "PLATA INVERTIDA" del Excel del dueño: lo que costó lo que hay en la
      // estantería. Solo suma lo que tiene costo cargado — mejor un total corto
      // y cierto que uno completo con costos inventados.
      invertido: conCosto.reduce((a, p) => a + costos[p.id] * p.stock, 0),
      conCosto: conCosto.length,
    };
  });
  const total = grupos.reduce((a, g) => a + g.lista.length, 0);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted tabular-nums">
          {total} {total === 1 ? "producto" : "productos"}
          {sedeActiva ? "" : " en las dos sedes"}
        </p>
        <button
          type="button"
          onClick={() => setAltaAbierta(true)}
          className="min-h-11 rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-5 text-[13px] font-bold uppercase tracking-wide text-on-accent transition hover:brightness-105"
        >
          + Nuevo producto
        </button>
      </div>

      {grupos.map((g) => (
        <section key={g.sede.id} className="mt-6" aria-label={g.sede.nombre}>
          <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-accent-soft">{g.sede.nombre}</span>
            <span className="text-[12.5px] text-muted tabular-nums">
              {g.lista.length} {g.lista.length === 1 ? "producto" : "productos"} · {cop(g.valor)} en bodega
              {g.conCosto > 0 && (
                <>
                  {" · "}
                  <b className="font-semibold text-ink">{cop(g.invertido)}</b> invertidos
                  {g.conCosto < g.lista.length && ` (${g.lista.length - g.conCosto} sin costo)`}
                </>
              )}
            </span>
          </h2>

          {/* Lo urgente arriba y en una línea, no repartido por la lista */}
          {g.bajos.length > 0 && (
            <p className="mb-3 rounded-xl border border-warn/40 bg-warn/[0.08] px-3.5 py-2.5 text-[13px] text-warn">
              <b>
                {g.bajos.length === 1 ? "1 producto está por acabarse" : `${g.bajos.length} productos están por acabarse`}
              </b>
              : {g.bajos.map((p) => p.nombre).join(" · ")}
            </p>
          )}

          {g.lista.length === 0 ? (
            <div className="rounded-2xl border border-line bg-panel px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-ink">Todavía no hay productos en {g.sede.nombre}</p>
              <p className="mt-1 text-[12.5px] text-muted">Agrega el primero con “+ Nuevo producto”.</p>
            </div>
          ) : (
            <Grupo>
              {g.lista.map((p) => (
                <FilaProducto key={p.id} p={p} onAbrir={() => setAbiertoId(p.id)} />
              ))}
            </Grupo>
          )}
        </section>
      ))}

      {abierto && <HojaProducto p={abierto} costo={costos[abierto.id] ?? null} onCerrar={() => setAbiertoId(null)} />}

      {altaAbierta && (
        <Hoja titulo="Nuevo producto" onCerrar={() => setAltaAbierta(false)}>
          <AddProductForm
            sedes={sedes}
            sedeInicial={sedeActiva ?? sedes[0]?.id}
            onListo={() => setAltaAbierta(false)}
          />
        </Hoja>
      )}
    </div>
  );
}

/** Una fila de 72 px: la foto, el nombre, el precio y lo que queda. Nada que editar. */
function FilaProducto({ p, onAbrir }: { p: Producto; onAbrir: () => void }) {
  const bajo = p.stock <= p.stockMinimo;
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`${p.nombre}, ${p.stock} en bodega`}
      className="flex min-h-[72px] w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-elevated/60"
    >
      <ProductoThumb nombre={p.nombre} fotoUrl={p.fotoUrl} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{p.nombre}</span>
        {/* Cuando se está acabando, la comisión se cae de la línea: a 390 px las
            tres cosas no caben y lo que se truncaba era justo el aviso. */}
        <span className={`mt-0.5 block truncate text-[13px] ${bajo ? "font-semibold text-warn" : "text-muted"}`}>
          {bajo ? `Se está acabando · ${cop(p.precio)}` : cop(p.precio)}
          {!bajo && p.comisionPct > 0 ? ` · ${p.comisionPct}% al barbero` : ""}
        </span>
      </span>
      {/* El número solo: en una columna de quince, "12" al lado de una foto de
          producto no se lee como otra cosa que lo que queda. El ámbar es el que
          hace el trabajo — dice cuál hay que reponer sin leer nada. */}
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums ${
          bajo ? "bg-warn/15 text-warn" : "bg-elevated text-ink"
        }`}
      >
        {p.stock}
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}

/*
  La hoja del producto: todo lo que se cambia, en el orden en que se cambia.
  Primero el stock (es a lo que uno entra: llegó mercancía), después la plata y
  de último si se ofrece al reservar, que se toca una vez en la vida.

  Cada control guarda solo (ya lo hacían en la tarjeta): por eso la hoja no
  lleva pie con "Guardar" — no habría nada que guardar y el botón mentiría.
*/
function HojaProducto({ p, costo, onCerrar }: { p: Producto; costo: number | null; onCerrar: () => void }) {
  const bajo = p.stock <= p.stockMinimo;
  // Las tres columnas del Excel del dueño que salen del costo.
  const ganancia = costo === null ? null : p.precio - costo;
  const margen = costo === null || p.precio === 0 ? null : Math.round(((p.precio - costo) / p.precio) * 100);
  return (
    <Hoja titulo={p.nombre} onCerrar={onCerrar} ancho="max-w-lg">
      <div className="flex items-center gap-4 pb-1">
        <FotoProducto productoId={p.id} nombre={p.nombre} fotoUrl={p.fotoUrl} size={64} />
        <div className="min-w-0">
          <p className={`font-display text-[28px] font-extrabold leading-none tabular-nums ${bajo ? "text-warn" : "text-ink"}`}>
            {p.stock}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            en bodega · {cop(p.precio * p.stock)} a precio de venta
          </p>
        </div>
      </div>

      <Bloque titulo="Entró mercancía, se corrige o cambia el aviso">
        <StockControl productoId={p.id} stock={p.stock} stockMinimo={p.stockMinimo} />
        {/* El umbral ya lo dice —y lo cambia— el propio botón "Avisarme bajo N".
            Acá solo queda el aviso cuando de verdad se está acabando. */}
        {bajo && (
          <p className="mt-2 text-[12.5px] font-semibold text-warn">
            Se está acabando: quedan {p.stock} y el aviso salta en {p.stockMinimo}.
          </p>
        )}
      </Bloque>

      <Bloque titulo="Plata">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[12px] text-muted">Se vende a</p>
            <span className="font-display text-[22px] font-extrabold tabular-nums text-ink">
              <PrecioEditable productoId={p.id} precio={p.precio} />
            </span>
          </div>
          <div>
            <p className="text-[12px] text-muted">Le cuesta al local</p>
            <span className="font-display text-[22px] font-extrabold tabular-nums text-ink">
              <PrecioEditable
                productoId={p.id}
                precio={costo}
                minimo={0}
                vacio="Poner costo"
                que="costo"
                onGuardar={(n) => actualizarCostoProducto(p.id, n)}
              />
            </span>
          </div>
        </div>

        {/* Lo que el dueño saca a mano en el Excel (GANANCIA y PLATA INVERTIDA),
            hecho acá. Sin costo no se inventa: se dice que falta. */}
        {ganancia === null ? (
          <p className="mt-3 text-[12.5px] text-muted">
            Pon el costo para ver cuánto le ganas a cada unidad y cuánta plata tienes metida en este producto.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-panel px-3.5 py-3">
            <div>
              <p className="text-[12px] text-muted">Ganas por unidad</p>
              <p className={`font-display text-[17px] font-bold tabular-nums ${ganancia < 0 ? "text-warn" : "text-ok"}`}>
                {cop(ganancia)}
                {margen !== null && <span className="ml-1.5 text-[12.5px] font-semibold text-muted">{margen}%</span>}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-muted">Plata invertida</p>
              <p className="font-display text-[17px] font-bold tabular-nums text-ink">{cop((costo ?? 0) * p.stock)}</p>
              <p className="text-[12px] text-muted">
                {p.stock} × {cop(costo ?? 0)}
              </p>
            </div>
            {ganancia < 0 && (
              <p className="col-span-2 text-[12.5px] font-semibold text-warn">
                Se está vendiendo por debajo de lo que cuesta.
              </p>
            )}
          </div>
        )}

        <div className="mt-3">
          <ComisionEditable productoId={p.id} pct={p.comisionPct} />
        </div>
      </Bloque>

      <Bloque titulo="En la reserva del cliente">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink">
            Ofrecer al reservar
            <span className="block text-[12px] text-muted">Aparece al final de la reserva del cliente</span>
          </span>
          <UpsellToggle productoId={p.id} enUpsell={p.enUpsell} />
        </div>
      </Bloque>
    </Hoja>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line/60 pt-4">
      <p className="eyebrow mb-2.5">{titulo}</p>
      {children}
    </section>
  );
}
