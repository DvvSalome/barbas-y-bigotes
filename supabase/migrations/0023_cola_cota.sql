-- 0023 — Cota temporal en la vista de "se liberó un cupo" (v_avisos_cola_pendientes).
-- Problema: la vista de 0014 NO tenía cota temporal. Un aviso viejo con email
-- inválido se reintentaba indefinidamente cada vez que n8n pollea → bounce loop
-- contra la Gmail de FourG. v_confirmaciones/v_recordatorios (0017) sí acotan a
-- ~2 días; acá igualamos el patrón usando le.creado_en (el único timestamp de la
-- fila; no hay "notificado_en"). Las esperas son del día, así que 2 días sobra.
-- NO ejecutar acá: solo se versiona el .sql (lo aplica el proceso de migración).

create or replace view public.v_avisos_cola_pendientes
  with (security_invoker = on) as
  select le.id as espera_id,
         c.nombre as cliente,
         c.email,
         le.sede_id,
         coalesce(s.nombre, 'cualquier servicio') as servicio,
         coalesce(b.nombre, 'cualquier barbero') as barbero
  from public.lista_espera le
  join public.clientes c on c.id = le.cliente_ref
  left join public.servicios s on s.id = le.servicio_id
  left join public.barberos b on b.id = le.barbero_id
  where le.estado = 'notificado'
    and coalesce(le.aviso_sent, false) = false
    and c.email is not null and c.email <> ''
    and le.creado_en >= now() - interval '2 days';

revoke all on public.v_avisos_cola_pendientes from anon, authenticated;
grant select on public.v_avisos_cola_pendientes to service_role;
