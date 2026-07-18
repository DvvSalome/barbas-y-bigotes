-- 0032 — Foto del barbero en los correos de confirmación y recordatorio.
-- Las vistas ganan barbero_foto (foto_url del barbero, ruta relativa del sitio)
-- COMO ÚLTIMA COLUMNA: los nodos de n8n referencian columnas por nombre, pero el
-- orden se conserva por prolijidad (patrón de 0017 con cliente_ref).
create or replace view public.v_confirmaciones_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref, b.foto_url as barbero_foto
from public.reservas r
join public.clientes c on c.id = r.cliente_ref
left join public.barberos b on b.id = r.barbero_id
left join public.servicios s on s.id = r.servicio_id
where r.estado in ('pendiente','confirmada')
  and r.confirm_sent = false
  and c.email is not null and c.email <> ''
  and r.creado_en >= now() - interval '2 days';
revoke all on public.v_confirmaciones_pendientes from anon, authenticated;
grant select on public.v_confirmaciones_pendientes to service_role;

create or replace view public.v_recordatorios_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref, b.foto_url as barbero_foto
from public.reservas r
join public.clientes c on c.id = r.cliente_ref
left join public.barberos b on b.id = r.barbero_id
left join public.servicios s on s.id = r.servicio_id
where r.estado in ('confirmada','pendiente')
  and r.reminder_sent = false
  and c.email is not null and c.email <> ''
  and r.inicio >= now() + interval '18 hours'
  and r.inicio <= now() + interval '30 hours';
revoke all on public.v_recordatorios_pendientes from anon, authenticated;
grant select on public.v_recordatorios_pendientes to service_role;
