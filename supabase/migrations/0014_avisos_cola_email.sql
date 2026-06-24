-- 0014 — Notificación "se liberó un cupo": cuando una reserva se cancela / no_show,
-- se avisa por email al siguiente de la lista de espera (la "notificación alternativa").
-- Mismo patrón que el recordatorio: trigger marca 'notificado' → vista pendientes → n8n
-- pollea y manda Gmail → marca aviso_sent.

alter table public.lista_espera add column if not exists aviso_sent boolean default false;

-- Al cancelar/no-show una reserva, promover al siguiente en espera de esa sede.
create or replace function public.notificar_cola_al_cancelar()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.estado in ('cancelada', 'no_show') and OLD.estado is distinct from NEW.estado then
    update public.lista_espera
      set estado = 'notificado'
      where id = (
        select id from public.lista_espera
        where sede_id = NEW.sede_id and estado = 'esperando'
        order by creado_en asc
        limit 1
      );
  end if;
  return NEW;
end $$;

drop trigger if exists trg_notificar_cola on public.reservas;
create trigger trg_notificar_cola
  after update of estado on public.reservas
  for each row execute function public.notificar_cola_al_cancelar();

-- Vista de avisos pendientes (la consume n8n con service_role). security_invoker + grant
-- solo a service_role → no expone emails de clientes vía la REST pública.
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
    and c.email is not null and c.email <> '';

revoke all on public.v_avisos_cola_pendientes from anon, authenticated;
grant select on public.v_avisos_cola_pendientes to service_role;
