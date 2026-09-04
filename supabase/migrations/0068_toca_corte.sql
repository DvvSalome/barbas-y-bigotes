-- 0068 · "Te toca corte": aviso automático a quien lleva X días sin venir.
--
-- Pedido del dueño (4-sep-2026): "que la aplicación recuerde cada X días a la
-- gente que deja su correo que se tiene que peluquear". Es el primer correo
-- que NO nace de una cita: nace de la AUSENCIA de una. Por eso trae lo que los
-- otros no necesitaban: consentimiento, baja con un clic y un registro de qué
-- se mandó (para medir después).
--
-- El envío NO sale por reservas@ (Hostinger + MailChannels ya suspendieron ese
-- buzón tres veces por rebotes): n8n lee la cola y manda por Brevo. Acá solo
-- vive la regla de quién y cuándo. Mismo patrón toma-y-marca de 0035/0061.

-- ---------------------------------------------------------------------------
-- 1) Consentimiento y baja en la ficha del cliente
-- ---------------------------------------------------------------------------
-- acepta_marketing nace en true: el cliente dejó su correo en la barbería, que
-- es la relación que el aviso continúa. El wizard graba la marca explícita
-- (marketing_en) y cualquier correo trae el enlace de baja (marketing_token).
alter table public.clientes
  add column if not exists acepta_marketing boolean not null default true,
  add column if not exists marketing_en     timestamptz,
  add column if not exists baja_en          timestamptz,
  add column if not exists marketing_token  uuid not null default gen_random_uuid();
create unique index if not exists clientes_marketing_token_idx on public.clientes (marketing_token);

-- ---------------------------------------------------------------------------
-- 2) La regla, editable desde Marketing → Avisos (misma fila singleton de 0038)
-- ---------------------------------------------------------------------------
alter table public.ajustes_avisos
  add column if not exists corte_cada_dias integer not null default 21,
  add column if not exists corte_activo    boolean not null default false;
alter table public.ajustes_avisos drop constraint if exists ajustes_avisos_corte_cada_dias_check;
alter table public.ajustes_avisos
  add constraint ajustes_avisos_corte_cada_dias_check check (corte_cada_dias between 7 and 120);

-- ---------------------------------------------------------------------------
-- 3) Registro de avisos de marketing (qué se mandó, a quién, sugiriendo qué)
-- ---------------------------------------------------------------------------
create table if not exists public.avisos_marketing (
  id          uuid primary key default gen_random_uuid(),
  cliente_ref uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null default 'toca_corte',
  sede_id     text,
  barbero_id  uuid,
  servicio_id text,
  enviado_en  timestamptz not null default now()
);
create index if not exists avisos_marketing_cliente_idx on public.avisos_marketing (cliente_ref, enviado_en desc);
alter table public.avisos_marketing enable row level security;
revoke all on public.avisos_marketing from anon;
-- El staff lo lee (el panel muestra cuántos salieron); escribe solo el RPC.
drop policy if exists avisos_marketing_staff on public.avisos_marketing;
create policy avisos_marketing_staff on public.avisos_marketing
  for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- 4) A quién le toca HOY (la regla en un solo lugar; la lee el RPC y el panel)
-- ---------------------------------------------------------------------------
-- "Última visita" = lo más reciente entre un cobro (ventas) y una cita
-- completada. No mira corte_activo a propósito: el panel cuenta "hoy le
-- tocaría a N" aunque el aviso esté apagado; el RPC sí lo respeta.
create or replace view public.v_toca_corte_elegibles
  with (security_invoker = on) as
  with cfg as (
    select corte_cada_dias from public.ajustes_avisos where id = 1
  ),
  ultima as (
    select c.id as cliente_ref,
           greatest(
             (select max(v.creado_en) from public.ventas v where v.cliente_ref = c.id),
             (select max(r.inicio) from public.reservas r where r.cliente_ref = c.id and r.estado = 'completada')
           ) as ultima_visita
    from public.clientes c
  )
  select c.id as cliente_ref,
         c.nombre as cliente,
         c.email,
         c.marketing_token,
         u.ultima_visita,
         floor(extract(epoch from (now() - u.ultima_visita)) / 86400)::int as dias,
         cfg.corte_cada_dias
    from public.clientes c
    join ultima u on u.cliente_ref = c.id
    cross join cfg
   where c.email is not null and c.email <> ''
     and c.acepta_marketing
     and c.baja_en is null
     and u.ultima_visita is not null
     and u.ultima_visita <= now() - (cfg.corte_cada_dias * interval '1 day')
     -- A quien no viene hace medio año no se le dice "te toca": ese es otro
     -- correo (campaña de dormidos, fase 2), con otro tono.
     and u.ultima_visita >= now() - interval '180 days'
     -- Con cita a futuro no hace falta recordarle nada.
     and not exists (
       select 1 from public.reservas r
        where r.cliente_ref = c.id and r.inicio > now()
          and r.estado in ('pendiente', 'confirmada', 'en_curso')
     )
     -- Un aviso por cliente, y nunca más seguido que la cadencia (mínimo 30 días).
     and not exists (
       select 1 from public.avisos_marketing a
        where a.cliente_ref = c.id and a.tipo = 'toca_corte'
          and a.enviado_en >= now() - (greatest(30, cfg.corte_cada_dias) * interval '1 day')
     );

revoke all on public.v_toca_corte_elegibles from anon, authenticated;
grant select on public.v_toca_corte_elegibles to service_role;

-- ---------------------------------------------------------------------------
-- 5) Toma-y-marca: entrega la tanda y la deja registrada en la MISMA transacción
-- ---------------------------------------------------------------------------
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
  -- Horario de silencio: nada antes de las 9 ni después de las 9 de la noche
  -- (Bogotá). Fuera de eso la fila espera a la próxima corrida.
  if (now() at time zone 'America/Bogota')::time not between '09:00' and '21:00' then
    return;
  end if;

  return query
  with elegibles as (
    -- Tandas de 40 por corrida (cada 30 min): sin ráfagas hacia el proveedor.
    select e.cliente_ref, e.cliente, e.email, e.dias, e.marketing_token
      from public.v_toca_corte_elegibles e
     order by e.ultima_visita
     limit 40
  ),
  habitual as (
    -- "Igual que la última vez": la última cita completada da sede, barbero y
    -- servicio; si solo hubo cobros sin cita (walk-in), la última venta da
    -- sede y barbero.
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
