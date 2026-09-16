"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { darDeBajaPorToken, reactivarAvisosPorToken } from "@/lib/marketing-actions";

export function BajaControles({ token, estado }: { token: string; estado: "activo" | "baja" }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar() {
    setSaving(true);
    setError(null);
    const res = await (estado === "activo" ? darDeBajaPorToken(token) : reactivarAvisosPorToken(token)).catch(() => null);
    setSaving(false);
    if (!res || res.estado === "invalido") {
      setError("No se pudo guardar. Prueba de nuevo en un momento.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8 w-full">
      <button
        type="button"
        onClick={cambiar}
        disabled={saving}
        className={`w-full rounded-full px-7 py-3.5 text-sm font-semibold uppercase tracking-wide transition disabled:opacity-50 ${
          estado === "activo"
            ? "border border-line text-ink hover:border-ink/40"
            : "bg-accent text-on-accent hover:bg-accent-soft"
        }`}
      >
        {saving ? "Guardando…" : estado === "activo" ? "No quiero más avisos" : "Volver a recibir avisos"}
      </button>
      {error && <p className="mt-3 text-sm text-accent-soft">{error}</p>}
    </div>
  );
}
