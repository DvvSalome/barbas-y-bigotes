-- 0017 — Notificaciones (Bloque 3): email de confirmación de reserva + versionado
-- de la vista de recordatorios que hoy vive solo en la nube.
-- Mismo patrón que 0014: security_invoker + grants solo a service_role (estas
-- vistas exponen email/PII de clientes; nada para anon/authenticated vía la REST
-- pública). Ambas exponen cliente_ref al FINAL (create or replace view solo
-- acepta columnas nuevas al final) para que n8n dispare el push equivalente
-- (POST /api/push) después de mandar cada email.

-- Confirmación de reserva por email (n8n cron ~5 min).
alter table public.reservas add column if not exists confirm_sent boolean not null default false;

create or replace view public.v_confirmaciones_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref
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

-- Versiona la vista de recordatorios que hoy vive solo en la nube (misma
-- definición verificada 2026-07-05 + hardening de grants + cliente_ref al final
-- para el nodo push del workflow de n8n).
create or replace view public.v_recordatorios_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref
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
