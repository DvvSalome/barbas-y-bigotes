-- 0071 · El aviso al barbero con más datos (8-sep: "está muy básico").
--
-- El RPC tomar_avisos_barbero() devuelve ahora, además, lo que el barbero
-- necesita para prepararse: hasta qué hora (fin → duración), teléfono y nota del
-- cliente, cuántas veces ya pagó acá (visitas: 0 = cliente nuevo), la sede como id
-- (para el enlace a la agenda del día) y si la fila es una prueba de correo.
-- Cambia el tipo de retorno → hay que soltar la función y crearla de nuevo
-- (n8n la llama por nombre; PostgREST recarga el esquema solo).
-- La cola (vista v_avisos_barbero_pendientes) y las pruebas (0070) no cambian.

drop function if exists public.tomar_avisos_barbero();

create function public.tomar_avisos_barbero()
returns table (
  reserva_id uuid,
  inicio timestamptz,
  fin timestamptz,
  cliente text,
  telefono text,
  nota text,
  servicio text,
  barbero text,
  barbero_email text,
  sede text,
  sede_id text,
  canal text,
  visitas int,
  prueba boolean
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
    returning r.id, r.inicio, r.fin, r.cliente_ref, r.barbero_id, r.servicio_id, r.sede_id, r.nota, r.canal
  ),
  pruebas as (
    update public.barbero_correo_prueba p
       set tomado_en = now()
     where p.tomado_en is null
       and p.creado_en >= now() - interval '30 minutes'
    returning p.id, p.barbero_id, p.email
  )
  select t.id,
         t.inicio,
         t.fin,
         coalesce(c.nombre, 'Un cliente'),
         c.telefono,
         nullif(btrim(t.nota), ''),
         coalesce(s.nombre, 'Servicio'),
         b.nombre,
         bc.email,
         coalesce(se.nombre, t.sede_id),
         t.sede_id,
         t.canal::text,
         -- Veces que ya pagó acá: cada visita cobrada es una venta (cita o walk-in).
         (select count(*) from public.ventas v where v.cliente_ref = t.cliente_ref)::int,
         false
    from tomadas t
    join public.barbero_contacto bc on bc.barbero_id = t.barbero_id
    join public.barberos b on b.id = t.barbero_id
    left join public.clientes c on c.id = t.cliente_ref
    left join public.servicios s on s.id = t.servicio_id
    left join public.sedes se on se.id = t.sede_id
  union all
  -- La prueba (0070) viaja con la misma forma y dice lo que es.
  select p.id,
         date_trunc('hour', now() + interval '1 day'),
         date_trunc('hour', now() + interval '1 day') + interval '30 minutes',
         'Correo de prueba ✅'::text,
         null::text,
         'Así te van a llegar las citas. Esta no es real.'::text,
         'Corte de prueba'::text,
         b.nombre,
         p.email,
         coalesce(se.nombre, b.sede_id),
         b.sede_id,
         'prueba'::text,
         0,
         true
    from pruebas p
    join public.barberos b on b.id = p.barbero_id
    left join public.sedes se on se.id = b.sede_id;
end;
$$;

revoke all on function public.tomar_avisos_barbero() from public, anon, authenticated;
grant execute on function public.tomar_avisos_barbero() to service_role;
