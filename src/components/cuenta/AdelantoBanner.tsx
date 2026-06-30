"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { responderPropuestaAdelanto } from "@/lib/cliente-actions";

type AdelantoBannerProps = {
  reservaId: string;
  inicioPropuesto: string;
  finPropuesto: string;
};

export function AdelantoBanner({ reservaId, inicioPropuesto, finPropuesto }: AdelantoBannerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; error?: string } | null>(null);

  const start = new Date(inicioPropuesto);
  const timeStr = start.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

  async function handleResponse(resp: "aceptar" | "rechazar") {
    setLoading(true);
    setStatus(null);
    try {
      const res = await responderPropuestaAdelanto(reservaId, resp);
      if (res.ok) {
        setStatus({ success: true });
        router.refresh();
      } else {
        setStatus({ error: res.error || "Ocurrió un error." });
      }
    } catch (err: any) {
      setStatus({ error: err.message || "Error al procesar la respuesta." });
    } finally {
      setLoading(false);
    }
  }

  if (status?.success) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-400">
        ¡Excelente! Tu turno ha sido adelantado exitosamente. La página se actualizará pronto.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-accent-soft">¡Turno Adelantado Disponible!</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Se liberó un espacio más temprano hoy con tu barbero a las <strong className="text-white">{timeStr}</strong>. ¿Te gustaría adelantar tu cita?
        </p>
        {status?.error && <p className="text-xs text-accent mt-1">{status.error}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => handleResponse("aceptar")}
          disabled={loading}
          className="rounded-lg bg-accent hover:bg-accent-soft text-on-accent text-xs font-semibold uppercase px-4 py-2 transition disabled:opacity-50"
        >
          {loading ? "Procesando..." : "Sí, Adelantar"}
        </button>
        <button
          onClick={() => handleResponse("rechazar")}
          disabled={loading}
          className="rounded-lg border border-line hover:border-accent/40 text-muted hover:text-white text-xs font-semibold uppercase px-4 py-2 transition disabled:opacity-50"
        >
          Mantener Horario
        </button>
      </div>
    </div>
  );
}
