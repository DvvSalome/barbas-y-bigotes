"use client";

import { botonClases } from "@/components/ui/Boton";
import { chipFiltroClases } from "@/components/ui/Chip";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarGasto, registrarAdelanto } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { TagIcon, PercentIcon } from "@/components/icons";
import { ElegirBarbero } from "@/components/staff/Elegir";
import type { Sede, Barbero } from "@/lib/data/types";

const fld =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btn = botonClases("primario");

// Categorías frecuentes del gasto: con texto libre cada quien escribía distinto
// ("papeleria"/"Papelería"/"aseo") y la lista quedaba inagrupable.
// Exportada: el mostrador registra gastos con las MISMAS categorías (GastoRapido).
export const CATS_GASTO = ["Insumos", "Aseo", "Papelería", "Servicios", "Comida", "Arreglos"];

export function CuadreForms({
  sedes,
  barberos,
  medios = [],
}: {
  sedes: Sede[];
  barberos: Barbero[];
  /** Medios de pago ACTIVOS (0067): con qué se pagó el gasto / el adelanto. */
  medios?: { slug: string; nombre: string }[];
}) {
  const router = useRouter();

  const [gSede, setGSede] = useState(sedes[0]?.id ?? "");
  const [gCat, setGCat] = useState("");
  const [gMonto, setGMonto] = useState("");
  const [gDesc, setGDesc] = useState("");
  const [gMedio, setGMedio] = useState("efectivo");
  const [gSaving, setGSaving] = useState(false);
  const [gError, setGError] = useState("");
  const [gOk, setGOk] = useState("");

  const [aBarbero, setABarbero] = useState("");
  const [aMonto, setAMonto] = useState("");
  const [aNota, setANota] = useState("");
  const [aMedio, setAMedio] = useState("efectivo");
  const [aSaving, setASaving] = useState(false);
  const [aError, setAError] = useState("");
  const [aOk, setAOk] = useState("");

  async function submitGasto(e: React.FormEvent) {
    e.preventDefault();
    // El monto tiene que ser un entero en pesos > 0: vacío o negativo guardaba
    // un gasto de $0 (o restaba plata) sin avisar. sanearCop ya rechaza vacío,
    // negativo, decimal y no-numérico; acá sólo falta exigir > 0.
    const monto = sanearCop(gMonto);
    if (monto === null || monto <= 0) {
      setGError("Pon un monto válido en pesos (mayor a $0, sin decimales).");
      return;
    }
    setGError("");
    setGOk("");
    setGSaving(true);
    const res = await registrarGasto({ sede: gSede, categoria: gCat || "Otro", monto, descripcion: gDesc, medio: gMedio });
    setGSaving(false);
    if (res.ok) {
      setGOk(`Gasto de ${gCat || "Otro"} guardado ✓ — aparece abajo en "Gastos de hoy".`);
      setGCat("");
      setGMonto("");
      setGDesc("");
      router.refresh();
    } else setGError(res.error ?? "No se pudo guardar el gasto.");
  }

  async function submitAdelanto(e: React.FormEvent) {
    e.preventDefault();
    if (!aBarbero) {
      setAError("Elige el barbero.");
      return;
    }
    const monto = sanearCop(aMonto);
    if (monto === null || monto <= 0) {
      setAError("Pon un monto válido en pesos (mayor a $0, sin decimales).");
      return;
    }
    setAError("");
    setAOk("");
    setASaving(true);
    const res = await registrarAdelanto({ barberoId: aBarbero, monto, nota: aNota, medio: aMedio });
    setASaving(false);
    if (res.ok) {
      const nombre = barberos.find((b) => b.id === aBarbero)?.nombre ?? "el barbero";
      setAOk(`Adelanto registrado ✓ para ${nombre} — queda abajo en "Adelantos de hoy".`);
      setAMonto("");
      setANota("");
      router.refresh();
    } else setAError(res.error ?? "No se pudo guardar el adelanto.");
  }

  return (
    // Apiladas: las formas viven en el panel derecho (angosto) del cuadre.
    <div className="grid gap-5">
      <form onSubmit={submitGasto} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="flex items-center gap-2 font-display text-xl">
          <TagIcon className="h-4 w-4 text-accent" /> Registrar gasto
        </h3>
        <select value={gSede} onChange={(e) => setGSede(e.target.value as typeof gSede)} className={fld}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        {/* Categorías con chips (un toque) + campo libre para lo que no encaje */}
        <div className="flex flex-wrap gap-1.5">
          {CATS_GASTO.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setGCat(gCat === c ? "" : c)}
              className={chipFiltroClases(gCat === c)}
            >
              {c}
            </button>
          ))}
        </div>
        <input value={gCat} onChange={(e) => setGCat(e.target.value)} placeholder="Otra categoría (o toca un chip)" className={fld} />
        <input type="number" inputMode="numeric" min={1} step={1} value={gMonto} onChange={(e) => { setGMonto(e.target.value); if (gError) setGError(""); }} placeholder="Monto" className={fld} />
        <input value={gDesc} onChange={(e) => setGDesc(e.target.value)} placeholder="Descripción (opcional)" className={fld} />
        {/* Con qué se pagó (0067): solo el efectivo descuenta del cajón. */}
        {medios.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {medios.map((m) => (
              <button key={m.slug} type="button" onClick={() => setGMedio(m.slug)} className={chipFiltroClases(gMedio === m.slug)}>
                {m.nombre}
              </button>
            ))}
          </div>
        )}
        {gError && <p className="text-xs text-red-500">{gError}</p>}
        {gOk && <p className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{gOk}</p>}
        <button disabled={gSaving} className={btn}>{gSaving ? "Guardando…" : "Agregar gasto"}</button>
      </form>

      <form onSubmit={submitAdelanto} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="flex items-center gap-2 font-display text-xl">
          <PercentIcon className="h-4 w-4 text-accent" /> Registrar adelanto
        </h3>
        {/* Con foto: el adelanto es plata que se le descuenta a una persona, y
            elegirla de una lista de nombres sueltos es fácil de errar. */}
        <ElegirBarbero
          barberos={barberos.map((b) => ({ id: b.id, nombre: b.nombre, fotoUrl: b.fotoUrl }))}
          value={aBarbero}
          onChange={setABarbero}
          placeholder="¿A quién se le adelanta?"
        />
        <input type="number" inputMode="numeric" min={1} step={1} value={aMonto} onChange={(e) => { setAMonto(e.target.value); if (aError) setAError(""); }} placeholder="Monto del adelanto" className={fld} />
        <input value={aNota} onChange={(e) => setANota(e.target.value)} placeholder="Nota (opcional)" className={fld} />
        {/* Cómo se le entregó la plata: queda en la bitácora del cuadre. */}
        {medios.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {medios.map((m) => (
              <button key={m.slug} type="button" onClick={() => setAMedio(m.slug)} className={chipFiltroClases(aMedio === m.slug)}>
                {m.nombre}
              </button>
            ))}
          </div>
        )}
        {aError && <p className="text-xs text-red-500">{aError}</p>}
        {aOk && <p className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{aOk}</p>}
        <button disabled={aSaving} className={btn}>{aSaving ? "Guardando…" : "Agregar adelanto"}</button>
      </form>
    </div>
  );
}
