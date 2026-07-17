-- 0029 — Cupo libre: avisar a TODA la lista de espera de la sede, no solo al primero.
-- Antes (0014) el trigger promovía únicamente al más antiguo en 'esperando'. El dueño
-- quiere que se avise a todos: es por orden de llegada y el primero que reserva se queda
-- con el cupo (el copy del correo ya dice "asegurá el tuyo" / "el primero que reserve se
-- queda con el cupo"). Solo cambia el cuerpo de la función; el trigger sigue igual.
create or replace function public.notificar_cola_al_cancelar()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.estado in ('cancelada', 'no_show') and OLD.estado is distinct from NEW.estado then
    update public.lista_espera
      set estado = 'notificado'
      where sede_id = NEW.sede_id and estado = 'esperando';
  end if;
  return NEW;
end $$;
