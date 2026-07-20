-- 0036 — Confirmación de asistencia POR EL CLIENTE, de verdad.
-- Hasta ahora todo era teatro: las reservas nacen con estado 'confirmada'
-- (createReserva), así que ese estado no significaba nada; el botón del barbero
-- "El cliente confirmó" solo se dibujaba si estado='pendiente' (nunca pasaba); y
-- el botón "Confirmar asistencia" del correo de recordatorio apuntaba a /cuenta,
-- donde no había nada que confirmar. El cliente lo tocaba y no pasaba nada.
--
-- Regla nueva (como en el plan): confirma el CLIENTE, con un toque desde el correo,
-- sin login. Es una SEÑAL, no un candado: la reserva sigue siendo suya haya
-- confirmado o no. Nadie cancela nada solo. El mostrador solo usa la señal para
-- saber a quién conviene llamar.

-- Momento de la confirmación (null = todavía no confirmó). No se toca el 'estado':
-- ese sigue siendo el ciclo de vida de la cita (confirmada/en_curso/…).
alter table public.reservas add column if not exists confirmado_en timestamptz;

-- Token opaco para el link del correo. gen_random_uuid() rellena TODAS las filas
-- (viejas y nuevas) sin backfill. Separado del id de la reserva a propósito: el id
-- anda por logs y otras URLs; el token va solo en el correo del dueño de la cita.
alter table public.reservas add column if not exists confirm_token uuid not null default gen_random_uuid();

-- Búsqueda por token desde la ruta pública /confirmar/[token].
create unique index if not exists reservas_confirm_token_idx on public.reservas (confirm_token);

-- El correo (n8n) arma el link con este token. Se agrega como ÚLTIMA columna a las
-- dos vistas que ya lee, sin cambiar el orden del resto (los nodos referencian por
-- nombre, pero se mantiene la convención de 0032).
create or replace view public.v_recordatorios_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref, b.foto_url as barbero_foto, r.confirm_token
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

create or replace view public.v_confirmaciones_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref, b.foto_url as barbero_foto, r.confirm_token
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
