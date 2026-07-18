-- 0031 — Barrido nocturno (pg_cron): al cierre del día, las citas que nunca se
-- atendieron pasan solas a no_show y la lista de espera vieja se vence. Sin esto
-- quedaban "confirmada" para siempre (27 en el backlog al momento de crear esto)
-- y ensuciaban métricas/CRM. Corre DENTRO de Postgres: no depende de n8n ni de
-- que alguien abra la app.
create extension if not exists pg_cron;

-- ORDEN CRÍTICO dentro de la función: primero se vence la espera, después se
-- marcan los no_show. El trigger trg_notificar_cola (0014/0029) promueve a
-- 'notificado' (y dispara email de "cupo libre") a los 'esperando' de la sede
-- cada vez que una reserva pasa a no_show; si barremos las reservas primero,
-- el barrido nocturno mandaría avisos falsos de cupos que ya pasaron.
create or replace function public.barrer_dia()
  returns void language plpgsql security definer set search_path = '' as $$
begin
  -- 1) Lista de espera vieja (walk-ins son del mismo día): esperando/notificado
  --    con más de 2 horas → vencido. El margen deja vivo a alguien recién anotado.
  update public.lista_espera
    set estado = 'vencido'
    where estado in ('esperando', 'notificado')
      and creado_en < now() - interval '2 hours';

  -- 2) Citas que terminaron hace 30+ min y nadie marcó (ni llegó, ni no llegó,
  --    ni canceló) → no_show. No toca en_curso: una cita en la silla sin cobrar
  --    es plata sin registrar y el dueño DEBE verla, no esconderla.
  update public.reservas
    set estado = 'no_show'
    where estado in ('pendiente', 'confirmada')
      and fin < now() - interval '30 minutes';
end $$;

revoke all on function public.barrer_dia() from public, anon, authenticated;

-- Cron diario 01:30 UTC = 20:30 Bogotá (30 min después del cierre de las sedes).
-- Idempotente: si el job ya existe se reprograma, no se duplica.
do $$
begin
  perform cron.unschedule('barrido-nocturno');
exception when others then null;
end $$;
select cron.schedule('barrido-nocturno', '30 1 * * *', 'select public.barrer_dia()');
