-- 0039 — Restaura la cota de 2 días en v_avisos_cola_pendientes.
-- 0023 la agregó (evita bounce-loop con emails inválidos viejos) y 0033 la
-- perdió al redefinir la vista para sumar el detalle del cupo. Desde 0031 el
-- barrido nocturno igual vence la espera de más de 2 horas, así que esto es
-- cinturón y tirantes: si el pg_cron falla una noche, la vista corta sola.
-- Misma definición de 0033 + la cota; el orden de columnas se conserva
-- (los nodos n8n referencian por nombre, patrón de 0017/0032).
create or replace view public.v_avisos_cola_pendientes
  with (security_invoker = on) as
  select le.id as espera_id,
         c.nombre as cliente,
         c.email,
         le.sede_id,
         coalesce(s.nombre, 'cualquier servicio') as servicio,
         coalesce(b.nombre, 'cualquier barbero') as barbero,
         le.cupo_inicio,
         cb.nombre as cupo_barbero
  from public.lista_espera le
  join public.clientes c on c.id = le.cliente_ref
  left join public.servicios s on s.id = le.servicio_id
  left join public.barberos b on b.id = le.barbero_id
  left join public.barberos cb on cb.id = le.cupo_barbero_id
  where le.estado = 'notificado'
    and coalesce(le.aviso_sent, false) = false
    and c.email is not null and c.email <> ''
    and le.creado_en >= now() - interval '2 days';

revoke all on public.v_avisos_cola_pendientes from anon, authenticated;
grant select on public.v_avisos_cola_pendientes to service_role;
