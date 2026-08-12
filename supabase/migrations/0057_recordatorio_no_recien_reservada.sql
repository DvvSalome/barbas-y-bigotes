-- 0057 — El recordatorio ya no persigue a quien ACABA de reservar.
--
-- Reservar hoy-para-mañana disparaba el "Te vemos mañana" a los minutos de la
-- confirmación (el cron corre varias veces al día y la cita ya calificaba como
-- "de mañana"): dos correos casi seguidos para la misma cita. Visto en vivo por
-- el dueño en el piloto (ago/2026).
--
-- Regla nueva: el recordatorio es para reservas hechas CON anticipación — solo
-- se recuerda lo creado ANTES de hoy (día civil Bogotá). Quien reserva hoy para
-- mañana ya tiene la confirmación fresca en el buzón; un segundo correo no
-- evita ningún no-show, solo hace ruido.
-- Contrapartida asumida: esa reserva de último día no recibe recordatorio nunca
-- (mañana su cita ya es "hoy"). Es lo correcto: reservó hace <24h.

create or replace function public.tomar_recordatorios_pendientes()
returns table (
  reserva_id   uuid,
  inicio       timestamptz,
  cliente      text,
  email        text,
  barbero      text,
  servicio     text,
  sede_id      text,
  cliente_ref  uuid,
  barbero_foto text,
  confirm_token uuid
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with elegibles as (
    select r.id
    from public.reservas r
    join public.clientes c on c.id = r.cliente_ref
    where r.estado in ('pendiente', 'confirmada')
      and coalesce(r.reminder_sent, false) = false
      and c.email is not null and c.email <> ''
      -- MAÑANA como día civil en Bogotá, no como ventana de horas.
      and (r.inicio at time zone 'America/Bogota')::date
          = ((now() at time zone 'America/Bogota') + interval '1 day')::date
      -- 0057: creada ANTES de hoy — la recién reservada ya tiene su confirmación.
      and (r.creado_en at time zone 'America/Bogota')::date
          < (now() at time zone 'America/Bogota')::date
  ),
  marcadas as (
    update public.reservas r
       set reminder_sent = true
     where r.id in (select e.id from elegibles e)
    returning r.id, r.inicio, r.cliente_ref, r.sede_id, r.barbero_id, r.servicio_id, r.confirm_token
  )
  select m.id, m.inicio, c.nombre, c.email, b.nombre, s.nombre, m.sede_id,
         c.id, b.foto_url, m.confirm_token
  from marcadas m
  join public.clientes c on c.id = m.cliente_ref
  left join public.barberos b on b.id = m.barbero_id
  left join public.servicios s on s.id = m.servicio_id;
end $$;

revoke all on function public.tomar_recordatorios_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_recordatorios_pendientes() to service_role;

-- La vista espejo (solo-lectura, no la consume el workflow) con el mismo criterio.
create or replace view public.v_recordatorios_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref, b.foto_url as barbero_foto, r.confirm_token
from public.reservas r
join public.clientes c on c.id = r.cliente_ref
left join public.barberos b on b.id = r.barbero_id
left join public.servicios s on s.id = r.servicio_id
where r.estado in ('pendiente', 'confirmada')
  and coalesce(r.reminder_sent, false) = false
  and c.email is not null and c.email <> ''
  and (r.inicio at time zone 'America/Bogota')::date
      = ((now() at time zone 'America/Bogota') + interval '1 day')::date
  and (r.creado_en at time zone 'America/Bogota')::date
      < (now() at time zone 'America/Bogota')::date;
revoke all on public.v_recordatorios_pendientes from anon, authenticated;
grant select on public.v_recordatorios_pendientes to service_role;

notify pgrst, 'reload schema';
