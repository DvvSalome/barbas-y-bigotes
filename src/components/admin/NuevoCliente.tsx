"use client";

import { botonClases } from "@/components/ui/Boton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarClienteManual } from "@/lib/actions";

// Alta manual desde el CRM: "ayer llegó uno y se olvidó registrarlo". Usa el
// mismo dedup por teléfono de las reservas, así que si la ficha ya existía no se
// duplica — se avisa y listo.
export function NuevoCliente() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const fld =
    "w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";

  async function guardar() {
    if (!nombre.trim() || !telefono.trim()) {
      setError("Pon el nombre y el teléfono.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await registrarClienteManual({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim() || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar.");
      return;
    }
    setHecho(res.aviso ?? `${nombre.trim()} quedó registrado ✓`);
    setNombre("");
    setTelefono("");
    setEmail("");
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          setHecho(null);
        }}
        className={botonClases("primario")}
      >
        + Registrar cliente
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-accent/40 bg-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink">Registrar un cliente</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-muted hover:text-ink">
          Cerrar
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className={fld} />
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Teléfono (WhatsApp)"
          className={fld}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo (opcional)"
          className={fld}
        />
      </div>
      {error && <p className="text-[12px] font-semibold text-warn">{error}</p>}
      {hecho && <p className="text-[12px] text-muted">{hecho}</p>}
      <button
        type="button"
        onClick={guardar}
        disabled={saving}
        className={botonClases("primario")}
      >
        {saving ? "Guardando…" : "Guardar cliente"}
      </button>
    </div>
  );
}
