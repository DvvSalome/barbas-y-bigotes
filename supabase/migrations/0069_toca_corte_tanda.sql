-- 0069 · "Te toca corte": tandas de 8 por corrida (antes 40).
--
-- El proveedor de envío tiene tope DIARIO en el plan gratis (Resend 100, Brevo
-- 300). El cron corre cada hora entre 9 am y 9 pm = 12 corridas: 12 × 8 = 96
-- correos al día, debajo de los dos topes. Es de sobra para el ritmo real de la
-- barbería (unos 500 clientes con cadencia de 21 días ≈ 24 avisos por día) y
-- evita el peor caso del patrón toma-y-marca: si el proveedor rechazara por
-- cuota, esos avisos ya marcados se perderían. El primer día con atraso
-- acumulado simplemente se drena en varios días (la regla de 30 días impide
-- repetir a nadie).
create or replace function public.tomar_avisos_corte()
returns table (
  aviso_id     uuid,
  cliente_ref  uuid,
  cliente      text,
  email        text,
  dias         integer,
  sede_id      text,
  sede         text,
  barbero_id   uuid,
  barbero      text,
  barbero_foto text,
  servicio_id  text,
  servicio     text,
  baja_token   uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activo boolean;
begin
  select a.corte_activo into v_activo from public.ajustes_avisos a where a.id = 1;
  if not coalesce(v_activo, false) then
    return;
  end if;
  if (now() at time zone 'America/Bogota')::time not between '09:00' and '21:00' then
    return;
  end if;

  return query
  with elegibles as (
    select e.cliente_ref, e.cliente, e.email, e.dias, e.marketing_token
      from public.v_toca_corte_elegibles e
     order by e.ultima_visita
     limit 8
  ),
  habitual as (
    select e.cliente_ref,
           coalesce(r.sede_id, v.sede_id)       as sede_id,
           coalesce(r.barbero_id, v.barbero_id) as barbero_id,
           r.servicio_id
      from elegibles e
      left join lateral (
        select r.sede_id, r.barbero_id, r.servicio_id
          from public.reservas r
         where r.cliente_ref = e.cliente_ref and r.estado = 'completada'
         order by r.inicio desc limit 1
      ) r on true
      left join lateral (
        select v.sede_id, v.barbero_id
          from public.ventas v
         where v.cliente_ref = e.cliente_ref
         order by v.creado_en desc limit 1
      ) v on true
  ),
  marcadas as (
    insert into public.avisos_marketing as am (cliente_ref, tipo, sede_id, barbero_id, servicio_id)
    select h.cliente_ref, 'toca_corte', h.sede_id, h.barbero_id, h.servicio_id from habitual h
    returning am.id, am.cliente_ref, am.sede_id, am.barbero_id, am.servicio_id
  )
  select m.id,
         m.cliente_ref,
         e.cliente,
         e.email,
         e.dias,
         m.sede_id,
         sd.nombre,
         m.barbero_id,
         b.nombre,
         b.foto_url,
         m.servicio_id,
         s.nombre,
         e.marketing_token
    from marcadas m
    join elegibles e on e.cliente_ref = m.cliente_ref
    left join public.sedes sd on sd.id = m.sede_id
    left join public.barberos b on b.id = m.barbero_id
    left join public.servicios s on s.id = m.servicio_id;
end;
$$;

revoke all on function public.tomar_avisos_corte() from public, anon, authenticated;
grant execute on function public.tomar_avisos_corte() to service_role;

notify pgrst, 'reload schema';
