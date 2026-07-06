-- 0020_caja_auto.sql — Barbas & Bigotes
-- Caja manos-libres: la caja se abre sola con la primera venta del día
-- (auto_abierta) y la cierra el barbero de la sede (cerrada_por). El dueño solo
-- MIRA; recibe el resumen del cierre por email (patrón n8n, como 0014/0017).
--
-- Columnas verificadas contra 0004 (caja_sesiones): cerrada_en/total_efectivo/
-- total_datafono/totales/total_gastos/citas/efectivo_contado/diferencia/nota ya
-- existen; acá solo se agrega quién cerró + los flags de origen/aviso.

-- Quién cerró (barbero o admin) + flag de aviso al dueño + si la abrió una venta.
alter table public.caja_sesiones add column if not exists cerrada_por uuid references public.profiles(id);
alter table public.caja_sesiones add column if not exists auto_abierta boolean not null default false;
alter table public.caja_sesiones add column if not exists aviso_sent boolean not null default false;

-- Aviso de cierre al dueño por email (patrón n8n, como 0014/0017):
-- security_invoker + solo service_role puede leerla (el cron de n8n usa service_role).
create or replace view public.v_cierres_caja_pendientes
with (security_invoker = true) as
select c.id as sesion_id, c.sede_id, s.nombre as sede, c.cerrada_en,
       c.total_efectivo, c.total_datafono, (c.totales) as totales,
       c.total_gastos, c.citas, c.efectivo_contado, c.diferencia, c.nota,
       coalesce(p.email, 'staff') as cerrada_por_email
from public.caja_sesiones c
join public.sedes s on s.id = c.sede_id
left join public.profiles p on p.id = c.cerrada_por
where c.estado = 'cerrada'
  and c.aviso_sent = false
  and c.cerrada_en is not null
  and c.cerrada_en >= now() - interval '2 days';
revoke all on public.v_cierres_caja_pendientes from anon, authenticated;
grant select on public.v_cierres_caja_pendientes to service_role;
