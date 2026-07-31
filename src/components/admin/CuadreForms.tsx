"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarGasto, registrarAdelanto } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { TagIcon, PercentIcon } from "@/components/icons";
import type { Sede, Barbero } from "@/lib/data/types";

const fld =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btn =
  "rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50";

export function CuadreForms({ sedes, barberos }: { sedes: Sede[]; barberos: Barbero[] }) {
  const router = useRouter();

  const [gSede, setGSede] = useState(sedes[0]?.id ?? "");
  const [gCat, setGCat] = useState("");
  const [gMonto, setGMonto] = useState("");
  const [gDesc, setGDesc] = useState("");
  const [gSaving, setGSaving] = useState(false);
  const [gError, setGError] = useState("");

  const [aBarbero, setABarbero] = useState("");
  const [aMonto, setAMonto] = useState("");
  const [aNota, setANota] = useState("");
  const [aSaving, setASaving] = useState(false);
  const [aError, setAError] = useState("");

  async function submitGasto(e: React.FormEvent) {
    e.preventDefault();
    // El monto tiene que ser un entero en pesos > 0: vacío o negativo guardaba
    // un gasto de $0 (o restaba plata) sin avisar. sanearCop ya rechaza vacío,
    // negativo, decimal y no-numérico; acá sólo falta exigir > 0.
    const monto = sanearCop(gMonto);
    if (monto === null || monto <= 0) {
      setGError("Poné un monto válido en pesos (mayor a $0, sin decimales).");
      return;
    }
    setGError("");
    setGSaving(true);
    const res = await registrarGasto({ sede: gSede, categoria: gCat || "Otro", monto, descripcion: gDesc });
    setGSaving(false);
    if (res.ok) {
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
      setAError("Poné un monto válido en pesos (mayor a $0, sin decimales).");
      return;
    }
    setAError("");
    setASaving(true);
    const res = await registrarAdelanto({ barberoId: aBarbero, monto, nota: aNota });
    setASaving(false);
    if (res.ok) {
      setAMonto("");
      setANota("");
      router.refresh();
    } else setAError(res.error ?? "No se pudo guardar el adelanto.");
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form onSubmit={submitGasto} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="flex items-center gap-2 font-display text-xl">
          <TagIcon className="h-4 w-4 text-accent" /> Registrar gasto
        </h3>
        <select value={gSede} onChange={(e) => setGSede(e.target.value as typeof gSede)} className={fld}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        <input value={gCat} onChange={(e) => setGCat(e.target.value)} placeholder="Categoría (ej. papelería, insumos)" className={fld} />
        <input type="number" inputMode="numeric" min={1} step={1} value={gMonto} onChange={(e) => { setGMonto(e.target.value); if (gError) setGError(""); }} placeholder="Monto" className={fld} />
        <input value={gDesc} onChange={(e) => setGDesc(e.target.value)} placeholder="Descripción (opcional)" className={fld} />
        {gError && <p className="text-xs text-red-500">{gError}</p>}
        <button disabled={gSaving} className={btn}>{gSaving ? "Guardando…" : "Agregar gasto"}</button>
      </form>

      <form onSubmit={submitAdelanto} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="flex items-center gap-2 font-display text-xl">
          <PercentIcon className="h-4 w-4 text-accent" /> Registrar adelanto
        </h3>
        <select value={aBarbero} onChange={(e) => setABarbero(e.target.value)} className={fld}>
          <option value="">Barbero…</option>
          {barberos.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
        <input type="number" inputMode="numeric" min={1} step={1} value={aMonto} onChange={(e) => { setAMonto(e.target.value); if (aError) setAError(""); }} placeholder="Monto del adelanto" className={fld} />
        <input value={aNota} onChange={(e) => setANota(e.target.value)} placeholder="Nota (opcional)" className={fld} />
        {aError && <p className="text-xs text-red-500">{aError}</p>}
        <button disabled={aSaving} className={btn}>{aSaving ? "Guardando…" : "Agregar adelanto"}</button>
      </form>
    </div>
  );
}
