-- 0012 — Habilitar Realtime (postgres_changes) en las tablas operativas.
-- SEGURIDAD: postgres_changes aplica la RLS DE TABLA al suscriptor autenticado, así que
-- un barbero solo recibe eventos de las filas que su RLS le deja leer (reservas/ventas ya
-- están scoped a su barbero_id). El control es ese RLS, NO el filtro del front (que es
-- conveniencia). El front además es refresh-only (re-fetchea con RLS, no renderiza payload).
-- Pendiente conocido: lista_espera/puntos_mov siguen is_staff (staff lee todo) — por eso la
-- suscripción a lista_espera del barbero va filtrada por su barbero_id en el front.
-- Idempotente: solo agrega la tabla a la publicación si no está.
do $$
declare t text;
begin
  foreach t in array array['reservas','lista_espera','ventas','gastos','caja_sesiones']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
