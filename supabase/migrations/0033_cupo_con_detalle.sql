-- 0033 — El aviso de "cupo libre" dice QUÉ se liberó: hora y barbero de la cita
-- cancelada/no_show, no solo "se abrió un espacio". El trigger ya tenía el dato
-- (NEW.inicio / NEW.barbero_id) y lo descartaba; ahora lo estampa en la fila de
-- espera al promoverla y la vista lo expone para el correo de n8n.
alter table public.lista_espera
  add column if not exists cupo_inicio timestamptz,
  add column if not exists cupo_barbero_id uuid references public.barberos(id);

-- Mismo comportamiento de 0029 (avisar a TODOS los esperando de la sede) + el
-- detalle del cupo liberado estampado en cada fila promovida.
create or replace function public.notificar_cola_al_cancelar()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.estado in ('cancelada', 'no_show') and OLD.estado is distinct from NEW.estado then
    update public.lista_espera
      set estado = 'notificado',
          cupo_inicio = NEW.inicio,
          cupo_barbero_id = NEW.barbero_id
      where sede_id = NEW.sede_id and estado = 'esperando';
  end if;
  return NEW;
end $$;

-- Vista con el detalle del cupo AL FINAL (los nodos n8n referencian por nombre;
-- el orden previo se conserva, patrón de 0017/0032).
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
    and c.email is not null and c.email <> '';

revoke all on public.v_avisos_cola_pendientes from anon, authenticated;
grant select on public.v_avisos_cola_pendientes to service_role;
