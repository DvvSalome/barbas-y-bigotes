-- 0080: aviso público "cambió la agenda de esta sede" (9-oct).
--
-- El público (sin sesión) no puede leer `reservas` —y no debe: tiene clientes—,
-- así que la suscripción realtime del asistente nunca le llegaba y la gente
-- veía el estado de los barberos congelado. Este trigger manda por un canal
-- PÚBLICO de Realtime solo "sede + barbero" cada vez que una reserva o una
-- ausencia cambia; el navegador, al recibirlo, vuelve a pedir la disponibilidad
-- por el camino de siempre (getDisponibilidad). Nada de clientes, horas ni
-- servicios viaja en el aviso.
--
-- Canal: 'disponibilidad:<sede_id>', evento 'cambio', payload {sede, barbero}.
--
-- SECURITY DEFINER con search_path vacío (convención del repo): quien modifica
-- reservas puede ser staff (authenticated), el sitio (service_role) o n8n, y no
-- todos tienen permiso sobre realtime.send. Y un fallo del aviso JAMÁS debe
-- tumbar la reserva: va envuelto en un bloque que se traga el error.

create or replace function public.avisar_disponibilidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede text;
  v_barbero uuid;
begin
  if tg_table_name = 'reservas' then
    -- Solo lo que cambia la ocupación: un recordatorio enviado o un token no
    -- le importan al público.
    if tg_op = 'UPDATE'
       and new.estado is not distinct from old.estado
       and new.inicio is not distinct from old.inicio
       and new.fin is not distinct from old.fin
       and new.barbero_id is not distinct from old.barbero_id
       and new.sede_id is not distinct from old.sede_id then
      return null;
    end if;
    begin
      if tg_op in ('INSERT', 'UPDATE') then
        perform realtime.send(
          jsonb_build_object('sede', new.sede_id, 'barbero', new.barbero_id),
          'cambio', 'disponibilidad:' || new.sede_id, false);
      end if;
      -- Si se movió de barbero o de sede (o se borró), también avisa a la vieja.
      if tg_op = 'DELETE'
         or (tg_op = 'UPDATE' and (new.sede_id is distinct from old.sede_id or new.barbero_id is distinct from old.barbero_id)) then
        perform realtime.send(
          jsonb_build_object('sede', old.sede_id, 'barbero', old.barbero_id),
          'cambio', 'disponibilidad:' || old.sede_id, false);
      end if;
    exception when others then
      null;
    end;
    return null;
  end if;

  -- barbero_ausencias: la sede es la del barbero.
  v_barbero := coalesce(new.barbero_id, old.barbero_id);
  begin
    select b.sede_id into v_sede from public.barberos b where b.id = v_barbero;
    if v_sede is not null then
      perform realtime.send(
        jsonb_build_object('sede', v_sede, 'barbero', v_barbero),
        'cambio', 'disponibilidad:' || v_sede, false);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function public.avisar_disponibilidad() from public, anon, authenticated;

drop trigger if exists trg_avisar_disponibilidad on public.reservas;
create trigger trg_avisar_disponibilidad
  after insert or update or delete on public.reservas
  for each row execute function public.avisar_disponibilidad();

drop trigger if exists trg_avisar_disponibilidad on public.barbero_ausencias;
create trigger trg_avisar_disponibilidad
  after insert or update or delete on public.barbero_ausencias
  for each row execute function public.avisar_disponibilidad();
