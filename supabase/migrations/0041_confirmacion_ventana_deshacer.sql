-- 0041 — Ventana de "deshacer" en el correo de confirmación.
-- La pantalla de confirmación del wizard deja cancelar la reserva recién hecha
-- (por si el cliente puso un dato mal). Para que ese "deshacer" gane la carrera
-- al cron de confirmación (cada 1 min), la vista no expone la reserva hasta que
-- pasen 2 minutos: así el cliente alcanza a cancelar antes de que salga el
-- correo. La confirmación llega igual, solo ~2 min después (imperceptible).
-- Si se cancela, `estado='cancelada'` ya la saca de esta vista → no sale correo.
-- Misma definición viva + la sola línea nueva (creado_en < now()-2min).
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
    and r.creado_en >= now() - interval '2 days'
    and r.creado_en < now() - interval '2 minutes';

revoke all on public.v_confirmaciones_pendientes from anon, authenticated;
grant select on public.v_confirmaciones_pendientes to service_role;
