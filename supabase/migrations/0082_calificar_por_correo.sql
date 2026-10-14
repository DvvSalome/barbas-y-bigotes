-- 0082 — Calificar la visita desde el correo, sin entrar a Mi cuenta (13-oct).
--
-- Hasta acá el cliente solo podía calificar desde /cuenta, y solo si había
-- entrado con Google y tenía una cita cerrada: en dos meses, cero
-- calificaciones. Ahora el correo de postventa trae cinco estrellas que llevan
-- a /calificar/<token>. El token es la credencial, como confirm_token (0036).
--
-- Y las estrellas de los barberos en la web dejan de ser inventadas (4,9 · 212
-- reseñas eran números de prueba): salen de estas calificaciones, y solo
-- cuando el barbero junta las suficientes para que el promedio diga algo.

-- 1 · La calificación también puede venir de una venta sin cita (walk-in).
--     reserva_id sigue único: si la venta vino de una cita, se guardan las dos
--     y calificar por un camino cierra el otro.
alter table public.resenas_servicio alter column reserva_id drop not null;
alter table public.resenas_servicio
  add column if not exists venta_id uuid unique references public.ventas (id) on delete cascade;
alter table public.resenas_servicio drop constraint if exists resenas_servicio_de_algo;
alter table public.resenas_servicio
  add constraint resenas_servicio_de_algo check (reserva_id is not null or venta_id is not null);

-- 2 · El token del enlace del correo. Default volátil = reescribe ventas, que
--     tiene decenas de filas: no pesa.
alter table public.ventas add column if not exists resena_token uuid not null default gen_random_uuid();
create unique index if not exists ventas_resena_token_key on public.ventas (resena_token);

-- 3 · El RPC del correo devuelve el token (columna nueva al final: cambia el
--     tipo de retorno, por eso drop + create). De paso:
--       · una venta ANULADA (0076) ya no pide reseña;
--       · quien se dio de baja de los correos (baja_en) tampoco la recibe.
drop function if exists public.tomar_resenas_pendientes();
create function public.tomar_resenas_pendientes()
returns table (
  venta_id     uuid,
  cliente      text,
  email        text,
  sede_id      text,
  sede         text,
  resena_url   text,
  barbero      text,
  barbero_foto text,
  servicio     text,
  cortes       integer,
  meta         integer,
  resena_token uuid
)
language plpgsql security definer set search_path = '' as $$
begin
  -- Horario de silencio 9am-9pm Bogotá (ver 0035).
  if (now() at time zone 'America/Bogota')::time not between '09:00' and '21:00' then
    return;
  end if;

  return query
  with elegibles as (
    select distinct on (v.cliente_ref) v.id
    from public.ventas v
    join public.clientes c on c.id = v.cliente_ref
    join public.sedes sd on sd.id = v.sede_id
    where coalesce(v.resena_sent, false) = false
      and v.anulada_en is null
      and c.email is not null and c.email <> ''
      and c.baja_en is null
      and sd.google_review_url is not null and sd.google_review_url <> ''
      and v.creado_en <= now() - interval '2 hours'
      and v.creado_en >= now() - interval '2 days'
      and not exists (
        select 1 from public.ventas v2
        where v2.cliente_ref = v.cliente_ref
          and v2.resena_sent
          and v2.creado_en >= now() - interval '30 days'
      )
    order by v.cliente_ref, v.creado_en desc
  ),
  marcadas as (
    update public.ventas v
       set resena_sent = true
     where v.id in (select e.id from elegibles e)
    returning v.id, v.cliente_ref, v.sede_id, v.barbero_id, v.reserva_id, v.resena_token
  )
  select
    m.id,
    c.nombre,
    c.email,
    m.sede_id,
    sd.nombre,
    sd.google_review_url,
    b.nombre,
    b.foto_url,
    coalesce(
      sv.nombre,
      (select vi.descripcion from public.venta_items vi
        where vi.venta_id = m.id and vi.tipo = 'servicio'
        order by vi.precio_unitario desc nulls last limit 1),
      'tu servicio'
    ),
    -- ponytail: la regla de la tarjeta vive en src/lib/tarjeta.ts y acá está
    -- traducida a SQL (ver 0035). Si cambia una, cambiar la otra.
    (
      select (count(distinct vi.venta_id) % 10)::int
      from public.venta_items vi
      join public.ventas vv on vv.id = vi.venta_id
      where vv.cliente_ref = m.cliente_ref
        and vi.tipo = 'servicio'
        and vi.ref_id in (
          select s.id from public.servicios s
          where s.categoria in ('cortes', 'combos')
            and coalesce(s.cuenta_corte, true)
            and s.id not in ('cerquillo', 'cerquillos', 'cerquillo-barba')
        )
    ),
    10,
    m.resena_token
  from marcadas m
  join public.clientes c on c.id = m.cliente_ref
  join public.sedes sd on sd.id = m.sede_id
  left join public.barberos b on b.id = m.barbero_id
  left join public.reservas r on r.id = m.reserva_id
  left join public.servicios sv on sv.id = r.servicio_id;
end $$;

revoke all on function public.tomar_resenas_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_resenas_pendientes() to service_role;

-- 4 · Estrellas públicas por barbero: solo el promedio y la cuenta, nunca las
--     filas (resenas_servicio sigue cerrada al público). Por debajo de 5
--     calificaciones no sale nada: un 5,0 de una sola persona no es un dato.
create or replace function public.calificacion_barberos()
returns table (barbero_id uuid, promedio numeric, total integer)
language sql stable security definer set search_path = '' as $$
  select r.barbero_id, round(avg(r.score)::numeric, 1), count(*)::int
  from public.resenas_servicio r
  join public.barberos b on b.id = r.barbero_id and b.activo
  group by r.barbero_id
  having count(*) >= 5;
$$;

revoke all on function public.calificacion_barberos() from public;
grant execute on function public.calificacion_barberos() to anon, authenticated, service_role;

-- 5 · Los números inventados fuera. La app ya no lee estas columnas; se vacían
--     para que nadie las vuelva a mostrar creyendo que son reales.
-- (resenas es not null default 0.)
update public.barberos set rating = null, resenas = 0
 where rating is not null or resenas <> 0;
