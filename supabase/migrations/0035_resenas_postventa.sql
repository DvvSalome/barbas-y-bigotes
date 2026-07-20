-- 0035 — Correo postventa que invita a dejar la reseña EN GOOGLE (no en la app).
-- Una reseña interna no mueve la ficha ni el mapa; la de Google sí, que es lo que
-- veníamos peleando con todo el SEO. Este correo sale ~2h después del cobro, cuando
-- el cliente ya se vio en el espejo y todavía se acuerda de la visita.
-- Es la plantilla §5 del prototipo (`.superpowers/design/correos.md`), la única de
-- las 5 que faltaba cablear.
--
-- OJO política de Google (actualizada abr/2026), esto NO es negociable:
--   · La invitación va a TODOS los clientes por igual. Filtrar por quién creemos que
--     va a hablar bien ("review gating") está prohibido y se castiga con borrado de
--     reseñas y, si se repite, un banner público de "reseñas falsas" en la ficha.
--   · NO se le puede pedir que mencione a un barbero específico. La plantilla dice
--     quién lo atendió como contexto ("Hoy Meyer te hizo un…"), pero nunca le pide
--     que lo nombre en la reseña.
-- Por eso acá no hay ningún filtro por calificación ni por ticket.

alter table public.ventas add column if not exists resena_sent boolean default false;

-- El "no repetir en 30 días" se apoya en este índice: la subconsulta corre en cada
-- poll del cron y ventas es la tabla que más rápido crece (una fila por corte).
create index if not exists ventas_resena_cliente_idx
  on public.ventas (cliente_ref, creado_en) where resena_sent;

-- Toma-y-marca en una sola transacción, en vez de "n8n lee la vista y después
-- marca". Motivo: el bug del cupo (jul/2026) fue justamente un nodo de marcado que
-- devolvía 2xx pero no marcaba porque el item pairing no sobrevivía al emailSend, y
-- el correo se reenvió cada 10 min al mismo cliente. Acá no hay nada que marcar
-- después: si la fila salió de esta función, ya quedó marcada.
-- Contrapartida asumida: si el SMTP falla, esa invitación se pierde en vez de
-- reintentarse. Perder una invitación es mucho más barato que spamear a un cliente.
create or replace function public.tomar_resenas_pendientes()
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
  meta         integer
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with elegibles as (
    -- Un cliente puede tener dos cobros en la ventana (volvió, o le cobraron aparte
    -- un producto). Solo el más reciente entra: una invitación, no dos.
    select distinct on (v.cliente_ref) v.id
    from public.ventas v
    join public.clientes c on c.id = v.cliente_ref
    join public.sedes sd on sd.id = v.sede_id
    where coalesce(v.resena_sent, false) = false
      and c.email is not null and c.email <> ''
      and sd.google_review_url is not null and sd.google_review_url <> ''
      -- Ventana: ya pasaron 2h del corte, pero no más de 2 días. El piso evita que
      -- al activar esto se dispare un correo a todo el historial de una.
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
    returning v.id, v.cliente_ref, v.sede_id, v.barbero_id, v.reserva_id
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
    -- Qué le hicieron: el servicio de la cita si vino con reserva; si fue walk-in,
    -- la línea de servicio más cara de la venta.
    coalesce(
      sv.nombre,
      (select vi.descripcion from public.venta_items vi
        where vi.venta_id = m.id and vi.tipo = 'servicio'
        order by vi.precio_unitario desc nulls last limit 1),
      'tu servicio'
    ),
    -- Sellos de la tarjeta en el ciclo actual (0..9), igual que estadoTarjeta().
    -- ponytail: la regla vive en src/lib/tarjeta.ts y acá está traducida a SQL.
    -- Si cambia el tamaño de la tarjeta o qué cuenta como corte, hay que tocar
    -- los dos lados. Se asume porque el correo lo manda n8n, no la app.
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
    10
  from marcadas m
  join public.clientes c on c.id = m.cliente_ref
  join public.sedes sd on sd.id = m.sede_id
  left join public.barberos b on b.id = m.barbero_id
  left join public.reservas r on r.id = m.reserva_id
  left join public.servicios sv on sv.id = r.servicio_id;
end $$;

-- Devuelve correos de clientes y además muta: solo el cron (service_role).
revoke all on function public.tomar_resenas_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_resenas_pendientes() to service_role;
