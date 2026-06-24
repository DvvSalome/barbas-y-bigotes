"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarGasto, registrarAdelanto } from "@/lib/actions";
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

  const [aBarbero, setABarbero] = useState("");
  const [aMonto, setAMonto] = useState("");
  const [aNota, setANota] = useState("");
  const [aSaving, setASaving] = useState(false);

  async function submitGasto(e: React.FormEvent) {
    e.preventDefault();
    setGSaving(true);
    const res = await registrarGasto({ sede: gSede, categoria: gCat || "Otro", monto: Number(gMonto) || 0, descripcion: gDesc });
    setGSaving(false);
    if (res.ok) {
      setGCat("");
      setGMonto("");
      setGDesc("");
      router.refresh();
    } else alert(res.error);
  }

  async function submitAdelanto(e: React.FormEvent) {
    e.preventDefault();
    if (!aBarbero) {
      alert("Elegí el barbero");
      return;
    }
    setASaving(true);
    const res = await registrarAdelanto({ barberoId: aBarbero, monto: Number(aMonto) || 0, nota: aNota });
    setASaving(false);
    if (res.ok) {
      setAMonto("");
      setANota("");
      router.refresh();
    } else alert(res.error);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form onSubmit={submitGasto} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="font-display text-xl">Registrar gasto</h3>
        <select value={gSede} onChange={(e) => setGSede(e.target.value as typeof gSede)} className={fld}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        <input value={gCat} onChange={(e) => setGCat(e.target.value)} placeholder="Categoría (ej. papelería, insumos)" className={fld} />
        <input type="number" value={gMonto} onChange={(e) => setGMonto(e.target.value)} placeholder="Monto" className={fld} />
        <input value={gDesc} onChange={(e) => setGDesc(e.target.value)} placeholder="Descripción (opcional)" className={fld} />
        <button disabled={gSaving} className={btn}>{gSaving ? "Guardando…" : "Agregar gasto"}</button>
      </form>

      <form onSubmit={submitAdelanto} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="font-display text-xl">Registrar adelanto</h3>
        <select value={aBarbero} onChange={(e) => setABarbero(e.target.value)} className={fld}>
          <option value="">Barbero…</option>
          {barberos.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
        <input type="number" value={aMonto} onChange={(e) => setAMonto(e.target.value)} placeholder="Monto del adelanto" className={fld} />
        <input value={aNota} onChange={(e) => setANota(e.target.value)} placeholder="Nota (opcional)" className={fld} />
        <button disabled={aSaving} className={btn}>{aSaving ? "Guardando…" : "Agregar adelanto"}</button>
      </form>
    </div>
  );
}
