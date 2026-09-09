-- 0073 · Google Calendar: la agenda de cada barbero, en su Google Calendar.
--
-- Modelo: una cuenta de servicio de Google (proyecto barbas-y-bigotes, creada con
-- gcloud el 9-sep) es DUEÑA de un calendario por barbero y lo comparte con el
-- correo del barbero (barbero_contacto) y con los correos extra (el dueño). La app
-- escribe los eventos; nadie tiene que "conectar" nada con OAuth.
--
-- Cola toma-y-marca como las demás avisos: un trigger encola cada cambio
-- relevante de reservas (alta, hora, barbero, servicio, estado, cliente, nota,
-- borrado) y el procesador (/api/calendar/sync, lo dispara n8n) la vacía creando,
-- corrigiendo o borrando el evento. Así ningún camino de escritura (wizard, admin,
-- mostrador, portal del cliente, backfill) tiene que saber de Google.

create table if not exists public.barbero_calendar (
  barbero_id uuid primary key references public.barberos(id) on delete cascade,
  calendar_id text not null,
  -- Correo del barbero con el que se compartió (copia de barbero_contacto al momento).
  compartido_con text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table public.barbero_calendar enable row level security;
revoke all on public.barbero_calendar from anon, authenticated;

-- Correos extra que ven TODAS las agendas (el dueño, el mostrador).
create table if not exists public.calendar_compartidos (
  email text primary key,
  rol text not null default 'reader' check (rol in ('reader', 'writer')),
  creado_en timestamptz not null default now()
);
alter table public.calendar_compartidos enable row level security;
revoke all on public.calendar_compartidos from anon, authenticated;

-- Qué evento de Google corresponde a cada reserva. Sin FK a reservas a propósito:
-- si la reserva se borra hay que saber qué evento quitar.
create table if not exists public.reserva_calendar (
  reserva_id uuid primary key,
  calendar_id text not null,
  event_id text not null,
  actualizado_en timestamptz not null default now()
);
alter table public.reserva_calendar enable row level security;
revoke all on public.reserva_calendar from anon, authenticated;

create table if not exists public.calendar_cola (
  id bigserial primary key,
  reserva_id uuid not null,
  creado_en timestamptz not null default now(),
  tomado_en timestamptz,
  procesado_en timestamptz,
  intentos int not null default 0,
  error text
);
create index if not exists calendar_cola_pendientes_idx on public.calendar_cola (id) where procesado_en is null;
alter table public.calendar_cola enable row level security;
revoke all on public.calendar_cola from anon, authenticated;

-- Trigger: cualquier cambio que se vea en el calendario, a la cola. Una sola fila
-- pendiente y sin tomar por reserva (si ya la tomó el procesador, entra otra).
create or replace function public.encolar_calendar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(NEW.id, OLD.id);
begin
  if not exists (
    select 1 from public.calendar_cola c
     where c.reserva_id = v_id and c.procesado_en is null and c.tomado_en is null
  ) then
    insert into public.calendar_cola (reserva_id) values (v_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_encolar_calendar on public.reservas;
create trigger trg_encolar_calendar
  after insert or delete or update of inicio, fin, barbero_id, servicio_id, estado, cliente_ref, nota
  on public.reservas
  for each row execute function public.encolar_calendar();

-- Toma-y-marca: entrega hasta p_limite filas con todo lo que hace falta para armar
-- el evento. Una fila tomada que no se procesó (caída) se vuelve a ofrecer a los
-- 10 min; tras 6 intentos deja de ofrecerse y queda con su error a la vista.
create or replace function public.tomar_calendar_cola(p_limite int default 20)
returns table (
  cola_id bigint,
  reserva_id uuid,
  existe boolean,
  inicio timestamptz,
  fin timestamptz,
  estado text,
  barbero_id uuid,
  barbero text,
  sede_id text,
  sede text,
  direccion text,
  cliente text,
  telefono text,
  servicio text,
  nota text,
  canal text,
  calendar_id text,
  event_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with tomadas as (
    update public.calendar_cola c
       set tomado_en = now(), intentos = c.intentos + 1
     where c.id in (
       select x.id from public.calendar_cola x
        where x.procesado_en is null
          and (x.tomado_en is null or x.tomado_en < now() - interval '10 minutes')
          and x.intentos < 6
        order by x.id
        limit greatest(1, least(p_limite, 100))
        for update skip locked
     )
    returning c.id, c.reserva_id
  )
  select t.id,
         t.reserva_id,
         (r.id is not null),
         r.inicio,
         r.fin,
         r.estado::text,
         r.barbero_id,
         b.nombre,
         r.sede_id,
         se.nombre,
         se.direccion,
         coalesce(c.nombre, 'Cliente'),
         c.telefono,
         s.nombre,
         nullif(btrim(r.nota), ''),
         r.canal::text,
         rc.calendar_id,
         rc.event_id
    from tomadas t
    left join public.reservas r on r.id = t.reserva_id
    left join public.barberos b on b.id = r.barbero_id
    left join public.sedes se on se.id = r.sede_id
    left join public.clientes c on c.id = r.cliente_ref
    left join public.servicios s on s.id = r.servicio_id
    left join public.reserva_calendar rc on rc.reserva_id = t.reserva_id
   order by t.id;
end;
$$;

revoke all on function public.tomar_calendar_cola(int) from public, anon, authenticated;
grant execute on function public.tomar_calendar_cola(int) to service_role;
