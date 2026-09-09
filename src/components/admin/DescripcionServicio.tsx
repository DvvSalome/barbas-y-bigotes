"use client";

import { PencilIcon } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarDescripcionServicio } from "@/lib/actions";

// Descripción del servicio, editable donde se lee (una frase de qué incluye).
// Es lo que ve el CLIENTE bajo el nombre al reservar. Affordance visible: la
// fila sin descripción muestra "+ Agregar descripción", nada de hover.
export function DescripcionServicio({ servicioId, descripcion }: { servicioId: string; descripcion?: string | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(descripcion ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    setBusy(true);
    setErr(null);
    const res = await actualizarDescripcionServicio(servicioId, texto);
    setBusy(false);
    if (res.ok) {
      setEditando(false);
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar.");
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setTexto(descripcion ?? "");
          setErr(null);
          setEditando(true);
        }}
        className="block max-w-prose text-left text-[12px] leading-snug text-muted transition hover:text-ink"
        title="El cliente lee esto al reservar"
      >
        {descripcion ? (
          <>
            {descripcion} <PencilIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
          </>
        ) : (
          <span className="text-accent-soft">
            + Descripción<span className="hidden sm:inline"> (la ve el cliente al reservar)</span>
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="mt-1 max-w-prose space-y-1.5">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={200}
        rows={2}
        autoFocus
        placeholder="Ej: Corte a tijera y máquina con lavado y peinado incluidos."
        className="w-full rounded-lg border border-accent/60 bg-bg px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-muted focus:outline-none"
      />
      {err && <p className="text-[12px] text-accent-soft">{err}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={guardar}
          disabled={busy}
          className="rounded-full bg-accent px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="rounded-full border border-line px-4 py-2 text-[12px] text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
