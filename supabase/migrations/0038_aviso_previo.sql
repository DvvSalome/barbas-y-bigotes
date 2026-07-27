-- 0038 — Aviso "tu cita es en un rato", con la antelación configurable por el dueño.
--
-- Por qué: el 69% de los clientes reserva con MENOS de 3h de anticipación (medido
-- jul/2026), así que el recordatorio del día antes le sirve a una minoría. Un aviso
-- unas horas antes sí le llega a todo el que reservó con algo de tiempo, y es el que
-- de verdad baja el no-show (a esa hora la persona todavía puede organizarse).
--
-- Se unifica con el recordatorio de mañana en UN SOLO motor: un RPC, un workflow,
-- una plantilla. Antes había un cron por tipo de aviso y eso se multiplica cada vez
-- que se agrega uno. Cada tipo lleva su propio flag, así una cita puede recibir el
-- de mañana Y el de un rato antes sin pisarse.

-- Flag propio: reminder_sent es el del aviso de mañana.
alter table public.reservas add column if not exists aviso_previo_sent boolean default false;

-- Ajustes editables desde /admin/avisos. Singleton (id fijo en 1): es una política
-- del negocio, no algo por sede. Si algún día se quiere por sede, se migra.
create table if not exists public.ajustes_avisos (
  id             int primary key default 1,
  previo_horas   numeric(3,1) not null default 2,
  previo_activo  boolean not null default true,
  actualizado_en timestamptz not null default now(),
  constraint ajustes_avisos_singleton check (id = 1),
  -- Menos de 30 min no le sirve a nadie (ya va en camino); más de 12h se pisa con
  -- el aviso de mañana.
  constraint previo_horas_razonable check (previo_horas >= 0.5 and previo_horas <= 12)
);
insert into public.ajustes_avisos (id) values (1) on conflict (id) do nothing;

alter table public.ajustes_avisos enable row level security;
-- Lectura para staff (la pantalla de admin la muestra), escritura solo admin.
drop policy if exists ajustes_avisos_sel on public.ajustes_avisos;
create policy ajustes_avisos_sel on public.ajustes_avisos for select using (public.is_staff());
drop policy if exists ajustes_avisos_admin on public.ajustes_avisos;
create policy ajustes_avisos_admin on public.ajustes_avisos
  for all using (public.is_admin()) with check (public.is_admin());
grant select on public.ajustes_avisos to authenticated;
grant all on public.ajustes_avisos to service_role;

-- Motor único de avisos de cita. Toma-y-marca en la misma transacción (patrón de
-- 0035/0037): si la fila salió de acá, ya quedó marcada, así que no hay forma de
-- reenviar aunque el cron corra seguido. Reemplaza a tomar_recordatorios_pendientes.
create or replace function public.tomar_avisos_pendientes()
returns table (
  reserva_id     uuid,
  tipo           text,   -- 'manana' | 'previo'
  cuando_titulo  text,   -- encabezado del correo
  cuando_label   text,   -- etiqueta sobre la hora grande
  inicio         timestamptz,
  cliente        text,
  email          text,
  barbero        text,
  servicio       text,
  sede_id        text,
  cliente_ref    uuid,
  barbero_foto   text,
  confirm_token  uuid
)
language plpgsql security definer set search_path = '' as $$
declare
  v_horas  numeric;
  v_activo boolean;
begin
  -- Horario de silencio: nadie quiere un correo de la barbería a las 3am. El aviso
  -- que no sale ahora sale en la próxima corrida, y la ventana aguanta.
  if (now() at time zone 'America/Bogota')::time not between '07:00' and '21:00' then
    return;
  end if;

  select a.previo_horas, a.previo_activo into v_horas, v_activo
  from public.ajustes_avisos a where a.id = 1;
  v_horas := coalesce(v_horas, 2);
  v_activo := coalesce(v_activo, true);

  return query
  with elegibles as (
    -- (1) Aviso de MAÑANA: día civil en Bogotá, no ventana de horas (ver 0037).
    select r.id, 'manana'::text as tipo
    from public.reservas r
    join public.clientes c on c.id = r.cliente_ref
    where r.estado in ('pendiente', 'confirmada')
      and coalesce(r.reminder_sent, false) = false
      and c.email is not null and c.email <> ''
      and (r.inicio at time zone 'America/Bogota')::date
          = ((now() at time zone 'America/Bogota') + interval '1 day')::date

    union all

    -- (2) Aviso PREVIO: la cita arranca dentro de las próximas v_horas.
    select r.id, 'previo'::text
    from public.reservas r
    join public.clientes c on c.id = r.cliente_ref
    where v_activo
      and r.estado in ('pendiente', 'confirmada')
      and coalesce(r.aviso_previo_sent, false) = false
      and c.email is not null and c.email <> ''
      and r.inicio > now()
      and r.inicio <= now() + (v_horas || ' hours')::interval
      -- Solo a quien reservó con MÁS antelación que la propia ventana: si reservó
      -- hace 20 minutos para dentro de una hora, avisarle es ruido.
      and r.inicio - r.creado_en > (v_horas || ' hours')::interval
  ),
  marcadas as (
    update public.reservas r
       set reminder_sent     = case when e.tipo = 'manana' then true else r.reminder_sent end,
           aviso_previo_sent = case when e.tipo = 'previo' then true else r.aviso_previo_sent end
      from elegibles e
     where r.id = e.id
    returning r.id, e.tipo, r.inicio, r.cliente_ref, r.sede_id, r.barbero_id,
              r.servicio_id, r.confirm_token
  )
  select m.id, m.tipo,
         case when m.tipo = 'manana' then 'Te vemos mañana' else 'Te esperamos en un rato' end,
         case when m.tipo = 'manana' then 'Mañana' else 'Hoy' end,
         m.inicio, c.nombre, c.email, b.nombre, s.nombre, m.sede_id,
         c.id, b.foto_url, m.confirm_token
  from marcadas m
  join public.clientes c on c.id = m.cliente_ref
  left join public.barberos b on b.id = m.barbero_id
  left join public.servicios s on s.id = m.servicio_id;
end $$;

revoke all on function public.tomar_avisos_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_avisos_pendientes() to service_role;
