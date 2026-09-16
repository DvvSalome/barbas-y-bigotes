"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarCajaSede } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { sfxExito, sfxAlerta } from "@/lib/sfx";
import { cop, horaBogota, fechaCortaBogota, diasDesde } from "@/lib/format";
import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { Campo } from "@/components/ui/Campo";
import { botonClases } from "@/components/ui/Boton";
import type { CajaSedeEstado, CajaDesglose } from "@/lib/data/queries";

/*
  La caja de la sede, en tres piezas (paso 6 de la tanda 2).

  Antes esto era UN bloque de 271 líneas que mostraba a la vez la caja, el
  desglose de los tres barberos, los totales y —al tocar un botón— el formulario
  de cierre desplegado ahí mismo. Todo en la pestaña Cierre, que además tenía
  debajo los cobros pendientes, qué se llevó cada cliente, el consumo y los
  gastos: una pantalla que no se acababa.

  Ahora la pestaña es un HUB (CierreHub) y esto son sus piezas:
    TarjetaCaja        lo único que se ve siempre: cuánto hay y el botón
    HojaCerrarCaja     el formulario, en LA hoja, con el pie pegado
    DesgloseBarberos   quién produjo qué, detrás de una fila del hub
*/

// Avatar del barbero en el desglose: foto de la ficha si existe; si no, iniciales
// sobre un tono cálido derivado del nombre (mismos tonos del prototipo que la
// agenda). Son decorativos y estables por nombre; no hay token para ellos, por
// eso van en crudo.
const AVI_TONOS = ["#a3907c", "#e8675c", "#c9b18a", "#8f7a60", "#d9a066"];
const aviTono = (n: string) => AVI_TONOS[(n?.trim().length ?? 0) % AVI_TONOS.length];
const iniciales = (n: string) => {
  const parts = (n || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
};

/** Lo que el cierre le devuelve al hub para pintar el resumen. */
export type CierreHecho = { total: number; diferencia: number };

// ── La tarjeta de arriba ────────────────────────────────────────────────────

export function TarjetaCaja({
  caja,
  desglose,
  hecho,
  onCerrarCaja,
}: {
  caja: CajaSedeEstado;
  desglose: CajaDesglose;
  hecho: CierreHecho | null;
  onCerrarCaja: () => void;
}) {
  // Ya se cerró en esta misma pantalla: el veredicto del día, sin más.
  if (hecho) {
    const cuadra = hecho.diferencia === 0;
    return (
      <section className="bb-relieve overflow-hidden rounded-2xl border border-line bg-panel">
        <span aria-hidden className="bb-poste block h-1 w-full" />
        <div className="px-4 py-4 sm:px-5">
          <p className="eyebrow">Caja cerrada</p>
          <div className="bb-monto mt-1.5 font-display text-[34px] font-extrabold leading-none tabular-nums text-ok">
            {cop(hecho.total)}
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            total del día ·{" "}
            {cuadra ? (
              <span className="font-semibold text-ok">cuadra exacto</span>
            ) : (
              <span className="font-semibold text-warn">
                diferencia {hecho.diferencia > 0 ? "+" : ""}
                {cop(hecho.diferencia)}
              </span>
            )}
          </p>
        </div>
      </section>
    );
  }

  // La caja se abre sola con la primera venta: si no hay, no hay nada que cerrar.
  if (!caja) {
    return (
      <section className="rounded-2xl border border-line bg-panel px-4 py-5 text-center sm:px-5">
        <p className="text-[13px] text-muted">La caja se abre sola con la primera venta del día.</p>
      </section>
    );
  }

  // La caja se abre sola con la 1ra venta y nada la cierra de noche: puede llevar
  // días abierta y el "efectivo esperado" acumula todo ese tiempo, no solo hoy.
  const dias = diasDesde(caja.abiertaEn);
  const aperturaHoy = dias === 0;

  return (
    <section className="bb-relieve overflow-hidden rounded-2xl border border-line bg-panel">
      <span aria-hidden className="bb-poste block h-1 w-full" />
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Caja de la sede</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ok">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
            {aperturaHoy
              ? `Abierta ${horaBogota(caja.abiertaEn)}`
              : `Abierta el ${fechaCortaBogota(caja.abiertaEn)}`}
          </span>
        </div>

        <div className="bb-monto mt-2 font-display text-[36px] font-extrabold leading-none tabular-nums text-ink">
          {cop(caja.esperadoEfectivo)}
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          efectivo esperado
          {desglose && (
            <>
              {" · "}digital <span className="bb-monto font-semibold text-ink">{cop(desglose.digital)}</span>
            </>
          )}
        </p>

        {!aperturaHoy && (
          <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] font-semibold leading-relaxed text-warn">
            Ojo: esta caja lleva {dias} {dias === 1 ? "día" : "días"} sin cerrar. El número de arriba suma TODO
            desde el {fechaCortaBogota(caja.abiertaEn)}, no solo lo de hoy.
          </p>
        )}

        <button onClick={onCerrarCaja} className={`mt-4 w-full ${botonClases("primario", "md")} min-h-12`}>
          Cerrar caja de la sede
        </button>
      </div>
    </section>
  );
}

// ── La hoja del cierre ──────────────────────────────────────────────────────

export function HojaCerrarCaja({
  caja,
  onCerrar,
  onHecho,
}: {
  caja: NonNullable<CajaSedeEstado>;
  onCerrar: () => void;
  onHecho: (h: CierreHecho) => void;
}) {
  const router = useRouter();
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armado, setArmado] = useState(false);

  const esperado = caja.esperadoEfectivo;
  // OJO: `Number("")` es 0, no NaN. Con el parseo anterior, confirmar el cierre
  // con el campo VACÍO grababa "conté $0" y dejaba asentado un faltante por
  // todo lo esperado, sin aviso y sin forma de deshacerlo. sanearCop distingue
  // "no escribió nada" (null) de "contó cero" (0).
  const contadoNum = sanearCop(contado);
  const sinContar = contadoNum === null;
  const diferencia = sinContar ? 0 : contadoNum - esperado;

  async function confirmar() {
    if (contadoNum === null) {
      setError("Cuenta el efectivo antes de cerrar. Si la caja quedó en cero, escribe 0.");
      return;
    }
    // Un cierre descuadrado queda asentado en la contabilidad y no se deshace.
    // Antes esto era un window.confirm() con el número dentro; ahora el número
    // ya está EN el botón y en el renglón de diferencia, así que el segundo
    // toque confirma algo que se está viendo, no algo que dice una ventana del
    // sistema encima de la pantalla.
    if (diferencia !== 0 && !armado) {
      setArmado(true);
      setError(null);
      return;
    }
    setArmado(false);
    setError(null);
    setSaving(true);
    const res = await cerrarCajaSede({ efectivoContado: contadoNum, nota });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo cerrar la caja.");
      return;
    }
    // El veredicto del día SUENA: cuadró = éxito, descuadró = alerta.
    if ((res.diferencia ?? 0) === 0) sfxExito();
    else sfxAlerta();
    onHecho({ total: res.total ?? 0, diferencia: res.diferencia ?? 0 });
    router.refresh();
  }

  const etiquetaBoton = saving
    ? "Cerrando…"
    : armado
      ? `¿Seguro? Cerrar con ${diferencia > 0 ? "+" : "−"}${cop(Math.abs(diferencia))}`
      : diferencia !== 0 && !sinContar
        ? `Cerrar con diferencia ${diferencia > 0 ? "+" : "−"}${cop(Math.abs(diferencia))}`
        : "Cerrar la caja";

  return (
    <Hoja
      titulo="Cerrar caja"
      onCerrar={onCerrar}
      ancho="max-w-md"
      pie={
        <PieHoja onCancelar={onCerrar}>
          <button
            type="button"
            disabled={saving || sinContar}
            onClick={confirmar}
            onBlur={() => setArmado(false)}
            className={
              armado ? `${primarioDeHoja} !bg-none bg-warn text-[#0c0b0a] hover:brightness-105` : primarioDeHoja
            }
          >
            {etiquetaBoton}
          </button>
        </PieHoja>
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3.5 py-3">
        <span className="text-[13.5px] text-muted">Esperado en efectivo</span>
        <span className="bb-monto shrink-0 font-display text-[18px] font-bold tabular-nums text-ink">
          {cop(esperado)}
        </span>
      </div>

      <Campo
        id="efectivo-contado"
        etiqueta="¿Cuánto contaste en efectivo?"
        obligatorio
        type="number"
        inputMode="numeric"
        min={0}
        value={contado}
        onChange={(e) => {
          setContado(e.target.value);
          setArmado(false);
        }}
        autoFocus
        className="mt-3"
      />

      {/* La diferencia EN VIVO, mientras escribe. Es el dato que decide si esto
          se cierra o si hay que volver a contar. */}
      <p className="mt-3 text-[14px] tabular-nums">
        Diferencia:{" "}
        {sinContar ? (
          <span className="text-muted">cuenta el efectivo para verla</span>
        ) : (
          <>
            <span className={`bb-monto font-semibold ${diferencia === 0 ? "text-ok" : "text-warn"}`}>
              {diferencia > 0 ? "+" : ""}
              {cop(diferencia)}
            </span>
            {diferencia !== 0 && <span className="text-muted"> · {diferencia > 0 ? "sobra" : "falta"}</span>}
            {diferencia === 0 && <span className="text-muted"> · cuadra exacto</span>}
          </>
        )}
      </p>

      <Campo
        id="nota-cierre"
        etiqueta="Nota del cierre (opcional)"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="mt-3"
      />

      {error && (
        <p className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-[13px] text-accent-soft">
          {error}
        </p>
      )}
      <div aria-hidden className="h-2" />
    </Hoja>
  );
}

// ── El desglose, detrás de una fila del hub ─────────────────────────────────

export function DesgloseBarberos({
  desglose,
  miBarberoId,
}: {
  desglose: CajaDesglose;
  miBarberoId: string | null;
}) {
  if (!desglose || desglose.barberos.length === 0) {
    return <p className="text-[13px] text-muted">Todavía no hay ventas registradas en esta caja.</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
        {desglose.barberos.map((b) => {
          const esMi = b.barberoId === miBarberoId;
          return (
            <div key={b.barberoId} className="border-b border-line/60 last:border-b-0">
              <div className="flex items-center gap-2.5 px-3.5 py-3">
                {b.fotoUrl ? (
                  <span
                    className="h-[34px] w-[34px] shrink-0 rounded-full border border-line bg-elevated bg-cover bg-top"
                    style={{ backgroundImage: `url(${b.fotoUrl})` }}
                  />
                ) : (
                  <span
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-line font-display text-[12px] font-bold text-[#0c0b0a]"
                    style={{ background: aviTono(b.nombre) }}
                  >
                    {iniciales(b.nombre)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{b.nombre}</span>
                {esMi && (
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-soft">
                    tú
                  </span>
                )}
                <span className="bb-monto shrink-0 text-[14px] font-bold tabular-nums text-ink">{cop(b.ventas)}</span>
              </div>
              {/* Comisión resaltada SOLO en la fila del barbero logueado. Sin el
                  "50%" fijo: el monto ya sale del % REAL del contrato de cada uno
                  (puede ser otro, o arriendo), así que el rótulo no debe afirmarlo. */}
              {esMi && (
                <div className="flex items-center justify-between gap-2 border-t border-line/60 bg-ok/5 px-3.5 py-2">
                  <span className="min-w-0 text-[12.5px] font-semibold text-ok">Mi comisión (sobre mis ventas)</span>
                  <span className="bb-monto shrink-0 text-[14px] font-bold tabular-nums text-ok">{cop(b.comision)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-elevated">
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13.5px]">
          <span className="min-w-0 text-muted">Efectivo esperado</span>
          <span className="bb-monto shrink-0 font-bold tabular-nums text-ink">{cop(desglose.efectivo)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line/60 px-3.5 py-2.5 text-[13.5px]">
          <span className="min-w-0 text-muted">No efectivo (Nequi, datáfono, transf.)</span>
          <span className="bb-monto shrink-0 font-bold tabular-nums text-ink">{cop(desglose.digital)}</span>
        </div>
      </div>
    </>
  );
}
