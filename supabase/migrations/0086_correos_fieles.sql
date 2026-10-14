-- 0086 · Correos que dicen la verdad (14-oct).
--
-- Tres correos automáticos decían algo que no pasaba:
--
--   1. RESEÑA: la tarjeta de cortes se contaba con una copia vieja de la regla
--      ('% 10' fijo, cerquillos excluidos a mano, ventas ANULADAS contadas) y el
--      texto prometía "al llegar a 10, el corte va por la casa". La tarjeta real
--      (ajustes_tarjeta, la edita el dueño en /admin/tarjeta) da regalo al 5º y
--      50 % al 10º. Ahora se cuenta con la MISMA regla que el cobro y el portal
--      (src/lib/tarjeta.ts + contarCortesCliente en src/lib/data/queries.ts) y
--      el RPC devuelve además `proximo_premio`, la frase lista para el correo.
--
--   2. "TE VEMOS MAÑANA": 0057 le quitó el aviso del día antes a quien reservó
--      HOY para mañana (lo vio el dueño en el piloto: le llegaba a los minutos de
--      la confirmación), pero lo puso en tomar_recordatorios_pendientes, que ya
--      no llama nadie. El workflow que corre (x8B5l6NbG2supIbH) llama a
--      tomar_avisos_pendientes: el filtro va acá. Lo demás de la función queda
--      igual a la definición vigente en producción (0038).
--
--   3. CUPO LIBRE: el trigger avisaba a la lista de espera también al marcar un
--      no_show, que se marca cuando la hora YA pasó: el correo "¡Se liberó un
--      cupo!" anunciaba un turno que no existía. Ahora solo si la cita es futura.
--
-- Idempotente.

-- 1 · La tarjeta en SQL, espejo de textoProximoPremio() ------------------------
--
-- ESPEJO de src/lib/tarjeta.ts (estadoTarjeta + textoProximoPremio). Si cambia
-- una, cambiar la otra: scripts/check-tarjeta.ts fija los textos.
--   sellos         = cortes % tamaño (lo que se pinta en la barra)
--   meta           = tamaño de la tarjeta
--   proximo_premio = "Te faltan N cortes para tu regalo" /
--                    "Te faltan N cortes para tu 50 % de descuento" /
--                    "¡Tu próximo corte tiene premio!" (cuando falta 1)
-- Si la fila de ajustes no está o quedó rara, la tarjeta de siempre (lo mismo que
-- TARJETA_DEFECTO): un correo sin regla es peor que uno con la de fábrica.

create or replace function public.tarjeta_proximo_premio(p_cortes integer)
returns table (sellos integer, meta integer, proximo_premio text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tamano integer;
  v_hitos  jsonb;
  v_total  integer := greatest(coalesce(p_cortes, 0), 0);
  v_sellos integer;
  v_pos    integer;
  v_tipo   text;
  v_valor  integer;
  v_faltan integer;
begin
  select a.tamano, a.hitos into v_tamano, v_hitos
    from public.ajustes_tarjeta a
   where a.id = 1;

  if v_tamano is null or v_tamano < 3 or v_tamano > 20
     or v_hitos is null or jsonb_typeof(v_hitos) <> 'array' or jsonb_array_length(v_hitos) = 0 then
    v_tamano := 10;
    v_hitos := '[{"posicion":5,"tipo":"regalo","valor":0},{"posicion":10,"tipo":"porcentaje","valor":50}]'::jsonb;
  end if;

  v_sellos := v_total % v_tamano;

  -- El próximo premio por delante; si ya pasaron todos, el primero del ciclo que viene.
  select (h ->> 'posicion')::int, h ->> 'tipo', coalesce((h ->> 'valor')::int, 0)
    into v_pos, v_tipo, v_valor
    from jsonb_array_elements(v_hitos) h
   where (h ->> 'posicion')::int > v_sellos
   order by (h ->> 'posicion')::int
   limit 1;
  if v_pos is null then
    select (h ->> 'posicion')::int, h ->> 'tipo', coalesce((h ->> 'valor')::int, 0)
      into v_pos, v_tipo, v_valor
      from jsonb_array_elements(v_hitos) h
     order by (h ->> 'posicion')::int
     limit 1;
  end if;

  sellos := v_sellos;
  meta := v_tamano;
  if v_pos is null then
    proximo_premio := null;
  else
    v_faltan := case when v_pos > v_sellos then v_pos - v_sellos else v_tamano - v_sellos + v_pos end;
    proximo_premio := case
      when v_faltan = 1 then '¡Tu próximo corte tiene premio!'
      when v_tipo = 'regalo' then 'Te faltan ' || v_faltan || ' cortes para tu regalo'
      else 'Te faltan ' || v_faltan || ' cortes para tu ' || v_valor || ' % de descuento'
    end;
  end if;
  return next;
end $$;

revoke all on function public.tarjeta_proximo_premio(integer) from public, anon, authenticated;
grant execute on function public.tarjeta_proximo_premio(integer) to service_role;

-- 2 · tomar_resenas_pendientes con la regla de la app ---------------------------
--
-- Igual a 0082 (elegibles, toma-y-marca, horario de silencio), salvo la tarjeta:
--   · cuenta las ventas NO anuladas con algún servicio que suma sello: categoría
--     cortes/combos y cuenta_corte distinto de false (lo que el dueño prende y
--     apaga en /admin/precios) — sin lista de ids escrita a mano;
--   · `cortes` = sellos de la tarjeta actual, `meta` = su tamaño;
--   · columna nueva al final: `proximo_premio`.
-- Cambia el tipo de retorno → hay que soltarla y crearla de nuevo (n8n la llama
-- por nombre; en la misma transacción no queda ningún instante sin función).

drop function if exists public.tomar_resenas_pendientes();

create function public.tomar_resenas_pendientes()
returns table (
  venta_id uuid,
  cliente text,
  email text,
  sede_id text,
  sede text,
  resena_url text,
  barbero text,
  barbero_foto text,
  servicio text,
  cortes integer,
  meta integer,
  resena_token uuid,
  proximo_premio text
)
language plpgsql
security definer
set search_path = ''
as $$
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
    tp.sellos,
    tp.meta,
    m.resena_token,
    tp.proximo_premio
  from marcadas m
  join public.clientes c on c.id = m.cliente_ref
  join public.sedes sd on sd.id = m.sede_id
  left join public.barberos b on b.id = m.barbero_id
  left join public.reservas r on r.id = m.reserva_id
  left join public.servicios sv on sv.id = r.servicio_id
  -- ESPEJO de contarCortesCliente + getCorteIds (src/lib/data/queries.ts).
  cross join lateral public.tarjeta_proximo_premio((
    select count(distinct vi.venta_id)::int
      from public.venta_items vi
      join public.ventas vv on vv.id = vi.venta_id
     where vv.cliente_ref = m.cliente_ref
       and vv.anulada_en is null
       and vi.tipo = 'servicio'
       and vi.ref_id in (
         select s.id from public.servicios s
          where s.categoria in ('cortes', 'combos')
            and s.cuenta_corte is distinct from false
       )
  )) tp;
end $$;

revoke all on function public.tomar_resenas_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_resenas_pendientes() to service_role;

-- 3 · "Te vemos mañana" no le llega a quien reservó hoy ------------------------
--
-- Definición vigente en producción (pg_get_functiondef, 14-oct = 0038) con UNA
-- línea nueva en la rama 'manana'. Mismo tipo de retorno: create or replace.

create or replace function public.tomar_avisos_pendientes()
returns table (
  reserva_id uuid,
  tipo text,
  cuando_titulo text,
  cuando_label text,
  inicio timestamptz,
  cliente text,
  email text,
  barbero text,
  servicio text,
  sede_id text,
  cliente_ref uuid,
  barbero_foto text,
  confirm_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
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
      -- 0057, ahora en la función que sí corre: quien reservó HOY (día Bogotá)
      -- acaba de recibir la confirmación; "te vemos mañana" a los minutos es ruido.
      and (r.creado_en at time zone 'America/Bogota')::date
          < (now() at time zone 'America/Bogota')::date

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

-- Los privilegios de una función reemplazada se conservan; se repiten igual para
-- que la migración deje el estado explícito (solo service_role, como en prod).
revoke all on function public.tomar_avisos_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_avisos_pendientes() to service_role;

-- 4 · Cupo libre: solo si el turno que se liberó es FUTURO ----------------------
--
-- Definición vigente en producción (14-oct = 0033) con una condición más:
-- NEW.inicio > now(). Un no_show (o una cancelación tardía de una cita que ya
-- pasó) no tiene cupo que ofrecer.

create or replace function public.notificar_cola_al_cancelar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.estado in ('cancelada', 'no_show')
     and OLD.estado is distinct from NEW.estado
     and NEW.inicio > now() then
    update public.lista_espera
      set estado = 'notificado',
          cupo_inicio = NEW.inicio,
          cupo_barbero_id = NEW.barbero_id
      where sede_id = NEW.sede_id and estado = 'esperando';
  end if;
  return NEW;
end $$;

notify pgrst, 'reload schema';
