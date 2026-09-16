"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { eliminarMiCuenta } from "@/lib/cliente-actions";

// Eliminación definitiva desde el portal. Dos toques (casilla + botón) porque no
// hay vuelta atrás. Al terminar se cierra la sesión local: el usuario ya no existe
// en Auth, así que la cookie quedó muerta igual. No se hace router.refresh(): la
// página volvería al estado "anon" y se llevaría el mensaje de confirmación.
export function EliminarCuenta({ nombre }: { nombre?: string }) {
  const [confirma, setConfirma] = useState(false);
  const [estado, setEstado] = useState<"quieto" | "borrando" | "listo">("quieto");
  const [error, setError] = useState<string | null>(null);
  const [canceladas, setCanceladas] = useState(0);

  async function eliminar() {
    setEstado("borrando");
    setError(null);
    const res = await eliminarMiCuenta().catch(() => null);
    if (!res || !res.ok) {
      setEstado("quieto");
      setError(res && !res.ok ? res.error : "No se pudo completar. Revisá la conexión e intentá de nuevo.");
      return;
    }
    setCanceladas(res.citasCanceladas);
    await supabaseBrowser().auth.signOut().catch(() => null);
    setEstado("listo");
  }

  if (estado === "listo") {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6">
        <p className="font-display text-2xl font-extrabold uppercase leading-none text-ink">
          Listo{nombre ? `, ${nombre.split(" ")[0]}` : ""}. Tu cuenta fue eliminada.
        </p>
        <p className="mt-3 text-sm text-muted">
          {canceladas > 0 && `Cancelamos ${canceladas === 1 ? "la cita que tenías pendiente" : `las ${canceladas} citas que tenías pendientes`}. `}
          Tus datos personales ya no están en nuestro sistema. Si algún día vuelves, te recibimos como cliente nuevo.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full border border-line px-6 py-3 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-accent"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-warn/40 bg-panel p-5">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={confirma}
          onChange={(e) => setConfirma(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span>Entiendo que se borran mis datos y se cancelan mis citas pendientes, y que esto no se puede deshacer.</span>
      </label>
      <button
        type="button"
        onClick={eliminar}
        disabled={!confirma || estado === "borrando"}
        className="mt-4 min-h-11 w-full rounded-full bg-warn px-6 py-3 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:brightness-110 disabled:opacity-40"
      >
        {estado === "borrando" ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}
      </button>
      {error && <p className="mt-3 text-sm font-semibold text-warn">{error}</p>}
    </div>
  );
}
