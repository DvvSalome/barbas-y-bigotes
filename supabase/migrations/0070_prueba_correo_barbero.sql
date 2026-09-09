-- 0070 · Probar el correo de un barbero ANTES de guardarlo.
--
-- El admin escribe un correo en /admin/equipo y toca "Probar": la app deja una
-- fila acá y n8n la manda por el MISMO camino del aviso real (tomar_avisos_barbero
-- → Hostinger, misma plantilla) sin tocar barbero_contacto. Así el dueño confirma
-- con el barbero que le llegó y recién ahí guarda.
--
-- Cola toma-y-marca como las demás: la fila se marca tomada en la misma
-- transacción en que se entrega, y a los 30 min deja de ofrecerse (techo de 0061).
-- n8n no cambia: la prueba sale con la forma de una cita y se presenta como prueba.

create table if not exists public.barbero_correo_prueba (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  email text not null,
  creado_en timestamptz not null default now(),
  tomado_en timestamptz
);
alter table public.barbero_correo_prueba enable row level security;
-- Sin políticas: nadie con sesión la lee ni escribe. La app escribe con service
-- role DESPUÉS del gate de admin (mismo esquema que barbero_contacto).
revoke all on public.barbero_correo_prueba from anon, authenticated;

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
    left join public.sedes se on se.id = t.sede_id
  union all
  -- La prueba viaja con la MISMA forma que una cita (misma plantilla en n8n),
  -- pero dice lo que es: el "cliente" y el "servicio" avisan que no es real.
  select p.id,
         date_trunc('hour', now() + interval '1 day'),
         'Correo de prueba ✅'::text,
         'Así te van a llegar las citas. Esta no es real.'::text,
         b.nombre,
         p.email,
         coalesce(se.nombre, b.sede_id)
    from pruebas p
    join public.barberos b on b.id = p.barbero_id
    left join public.sedes se on se.id = b.sede_id;
end;
$$;

revoke all on function public.tomar_avisos_barbero() from public, anon, authenticated;
grant execute on function public.tomar_avisos_barbero() to service_role;
