-- 0066 · Aviso al barbero por correo cuando le cae una cita nueva.
--
-- El dueño lo pidió así: "que se le notifique a los barberos a su correo cuando
-- llega un cliente; dejar que el admin ponga los correos de cada barbero". El
-- push ya existía (pushABarbero), pero solo le llega a quien tenga la app
-- suscrita; el correo llega siempre.
--
-- Mismo patrón que reseñas (0035) / recordatorios (0037) / cambios (0059):
-- columna de estado + vista de pendientes + RPC toma-y-marca que entrega y marca
-- EN LA MISMA transacción. Nunca "mandar y después marcar": ese es el bug que ya
-- costó tres suspensiones del buzón (ver 0061).

-- El correo de cada barbero vive APARTE de `barberos`: esa tabla la lee el sitio
-- público (0040) y una columna nueva ahí quedaría expuesta por ?select=email.
create table if not exists public.barbero_contacto (
  barbero_id uuid primary key references public.barberos(id) on delete cascade,
  email text not null,
  actualizado_en timestamptz not null default now()
);
alter table public.barbero_contacto enable row level security;
revoke all on public.barbero_contacto from anon, authenticated;
-- Sin policies a propósito: solo service_role. Las escrituras pasan por la
-- action de admin (guardarEmailBarbero) y las lecturas por la vista/RPC de n8n.

-- Estado del aviso en la reserva. Lo que ya existe nace "avisado" para no
-- inundar de correos viejos al aplicar esto.
alter table public.reservas add column if not exists aviso_barbero_sent boolean not null default false;
update public.reservas set aviso_barbero_sent = true where aviso_barbero_sent = false;

create or replace view public.v_avisos_barbero_pendientes
  with (security_invoker = on) as
  select r.id as reserva_id,
         r.inicio,
         coalesce(c.nombre, 'Un cliente') as cliente,
         coalesce(s.nombre, 'Servicio') as servicio,
         b.nombre as barbero,
         bc.email as barbero_email,
         coalesce(se.nombre, r.sede_id) as sede
    from public.reservas r
    join public.barbero_contacto bc on bc.barbero_id = r.barbero_id
    join public.barberos b on b.id = r.barbero_id
    left join public.clientes c on c.id = r.cliente_ref
    left join public.servicios s on s.id = r.servicio_id
    left join public.sedes se on se.id = r.sede_id
   where r.estado in ('pendiente', 'confirmada')
     and r.aviso_barbero_sent = false
     -- Solo citas a futuro: un corte que el mostrador registra DESPUÉS de hecho
     -- (la cita de ayer que se olvidó anotar) no necesita aviso de nada.
     and r.inicio > now()
     -- Techo anti-reenvío (0061): si algo falla, la fila deja de ofrecerse a la
     -- media hora en vez de reintentarse para siempre.
     and r.creado_en >= now() - interval '30 minutes';

revoke all on public.v_avisos_barbero_pendientes from anon, authenticated;
grant select on public.v_avisos_barbero_pendientes to service_role;

create or replace function public.tomar_avisos_barbero()
returns table (
  reserva_id uuid,
  inicio timestamptz,
  cliente text,
  servicio text,
  barbero text,
  barbero_email text,
  sede text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with tomadas as (
    update public.reservas r
       set aviso_barbero_sent = true
     where r.id in (select v.reserva_id from public.v_avisos_barbero_pendientes v)
    returning r.id, r.inicio, r.cliente_ref, r.barbero_id, r.servicio_id, r.sede_id
  )
  select t.id,
         t.inicio,
         coalesce(c.nombre, 'Un cliente'),
         coalesce(s.nombre, 'Servicio'),
         b.nombre,
         bc.email,
         coalesce(se.nombre, t.sede_id)
    from tomadas t
    join public.barbero_contacto bc on bc.barbero_id = t.barbero_id
    join public.barberos b on b.id = t.barbero_id
    left join public.clientes c on c.id = t.cliente_ref
    left join public.servicios s on s.id = t.servicio_id
    left join public.sedes se on se.id = t.sede_id;
end;
$$;

revoke all on function public.tomar_avisos_barbero() from public, anon, authenticated;
grant execute on function public.tomar_avisos_barbero() to service_role;

notify pgrst, 'reload schema';
