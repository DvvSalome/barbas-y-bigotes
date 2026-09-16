"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
// El ding vivía acá; ahora es parte de la familia de SFX (src/lib/sfx.ts).
import { sfxNuevaReserva as ding } from "@/lib/sfx";

export type RtSub = { table: string; filter?: string };

// Escucha postgres_changes (RLS-filtrado por la sesión) y dispara router.refresh()
// debounced. Refresh-only: NUNCA usa el payload → la data siempre viene del fetch
// del server (RLS-correcto, con joins). Señal de "algo cambió", no sync de estado.
// dingOnInsertTable: suena un ding cuando entra un INSERT de esa tabla (ej. una
// reserva nueva en la agenda del barbero); updates/deletes solo refrescan.
export function RealtimeRefresh({
  subscriptions,
  dingOnInsertTable,
}: {
  subscriptions: RtSub[];
  dingOnInsertTable?: string;
}) {
  const router = useRouter();
  const key = subscriptions.map((s) => `${s.table}:${s.filter ?? ""}`).join("|");

  useEffect(() => {
    const sb = supabaseBrowser();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof sb.channel> | null = null;

    const bump = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, 400);
    };

    // El token expira (~1h) y la agenda vive abierta todo el día: refresca el JWT del
    // socket en cada cambio de sesión para que Realtime no deje de emitir en silencio.
    const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) sb.realtime.setAuth(session.access_token);
    });

    (async () => {
      // Realtime usa el JWT del usuario → la RLS DE TABLA (reservas/ventas scoped) decide
      // qué eventos recibe. El `filter` del front es conveniencia, no el control de seguridad.
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      const ch = sb.channel(`live:${key}`);
      for (const s of subscriptions) {
        ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
          (payload: { eventType: string; table: string }) => {
            if (dingOnInsertTable && payload.eventType === "INSERT" && payload.table === dingOnInsertTable) ding();
            bump();
          },
        );
      }
      ch.subscribe();
      channel = ch;
    })();

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      if (timer) clearTimeout(timer);
      if (channel) sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
