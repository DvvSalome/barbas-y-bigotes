-- 0061 · El correo de confirmación no puede reintentarse para siempre.
--
-- Qué pasó: Hostinger suspendió el buzón reservas@ por "actividad sospechosa"
-- (18-ago-2026). Con la base recién reseteada nuestro volumen real era de un
-- puñado de correos, así que la causa está en otro lado — pero la revisión dejó
-- a la vista una bomba de tiempo que ya explotó TRES veces en este proyecto
-- (cupo, confirmación, recordatorio): el patrón "mandar y después marcar".
--
-- La confirmación es la única de las cinco que todavía lo usa: vista +
-- `emailSend` + PATCH `confirm_sent=true`. Si ese PATCH falla —y ya falló, es
-- el bug del cupo de julio— la fila sigue pendiente y el cron la vuelve a tomar
-- CADA MINUTO durante DOS DÍAS: hasta ~2.880 correos idénticos al mismo
-- destinatario. Eso es exactamente lo que un proveedor de correo llama spam.
--
-- Dos capas, porque cada una tapa algo distinto:
--
--   1. La vista deja de ofrecer la fila a la media hora. Es el techo: pase lo
--      que pase con n8n, el peor caso baja de ~2.880 correos a ~28. Se pierde
--      la confirmación que no se pudo mandar en 30 minutos, y está bien: el 69%
--      de las reservas son para dentro de menos de 3 horas, así que una
--      confirmación que llega 6 horas tarde ya no confirma nada.
--
--   2. `tomar_confirmaciones_pendientes()`: el mismo patrón toma-y-marca que ya
--      usan reseñas (0035), recordatorios (0037) y avisos de cambio (0059), que
--      se adoptó justamente para no repetir este bug. Marca y selecciona en la
--      MISMA transacción, así que el reenvío deja de ser posible en vez de estar
--      acotado. Queda listo para cuando se toque n8n; mientras tanto la capa 1
--      protege sola.
--
-- Para pasar el workflow "✅ confirmación de reserva" (JJiAjBoc9NBQbky1) al RPC:
--   · el nodo HTTP pasa de GET  /rest/v1/v_confirmaciones_pendientes
--                        a POST /rest/v1/rpc/tomar_confirmaciones_pendientes
--   · y se BORRA el nodo "Marcar enviado" (el RPC ya marcó al tomar).
-- Contrapartida asumida, igual que en los otros tres: si el SMTP falla, esa
-- confirmación se pierde en vez de reintentarse. Preferible a reenviarla mil
-- veces — el cliente igual tiene la cita, la ve en /cuenta y le llega el
-- recordatorio.

-- ---------------------------------------------------------------------------
-- 1) Techo de reintentos en la vista (0041 + ventana de 30 min)
-- ---------------------------------------------------------------------------
create or replace view public.v_confirmaciones_pendientes
  with (security_invoker = on) as
  select r.id as reserva_id,
         r.inicio,
         c.nombre as cliente,
         c.email,
         b.nombre as barbero,
         s.nombre as servicio,
         r.sede_id,
         c.id as cliente_ref,
         b.foto_url as barbero_foto,
         r.confirm_token
    from public.reservas r
    join public.clientes c on c.id = r.cliente_ref
    left join public.barberos b on b.id = r.barbero_id
    left join public.servicios s on s.id = r.servicio_id
   where r.estado in ('pendiente', 'confirmada')
     and r.confirm_sent = false
     and c.email is not null and c.email <> ''
     -- Antes: 2 días. Ahí vivía el bucle.
     and r.creado_en >= now() - interval '30 minutes'
     -- Ventana para deshacer (0041): no se le confirma al cliente una reserva
     -- que todavía puede cancelar de un toque.
     and r.creado_en < now() - interval '2 minutes';

revoke all on public.v_confirmaciones_pendientes from anon, authenticated;
grant select on public.v_confirmaciones_pendientes to service_role;

-- ---------------------------------------------------------------------------
-- 2) Toma-y-marca: el reenvío deja de ser posible
-- ---------------------------------------------------------------------------
create or replace function public.tomar_confirmaciones_pendientes()
returns table (
  reserva_id uuid,
  inicio timestamptz,
  cliente text,
  email text,
  barbero text,
  barbero_foto text,
  servicio text,
  sede_id text,
  cliente_ref uuid,
  confirm_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with tomadas as (
    update public.reservas r
       set confirm_sent = true
     where r.id in (select v.reserva_id from public.v_confirmaciones_pendientes v)
    returning r.id, r.inicio, r.cliente_ref, r.barbero_id, r.servicio_id,
              r.sede_id, r.confirm_token
  )
  select t.id,
         t.inicio,
         c.nombre,
         c.email,
         coalesce(b.nombre, 'tu barbero'),
         b.foto_url,
         coalesce(s.nombre, 'tu servicio'),
         t.sede_id,
         t.cliente_ref,
         t.confirm_token
    from tomadas t
    join public.clientes c on c.id = t.cliente_ref
    left join public.barberos b on b.id = t.barbero_id
    left join public.servicios s on s.id = t.servicio_id;
end;
$$;

revoke all on function public.tomar_confirmaciones_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_confirmaciones_pendientes() to service_role;
