-- 0037 — El recordatorio nunca llegaba a las citas de la tarde.
--
-- La vista v_recordatorios_pendientes pedía `inicio between now()+18h and now()+30h`
-- y el cron corría UNA vez al día a las 9am. Esa ventana cubre de 3:00am a 3:00pm
-- del día siguiente, pero la barbería atiende de 9am a 8pm: las citas de 3pm en
-- adelante NUNCA entraban, reservaran con la anticipación que fuera.
-- Medido en prod (jul/2026): 26 de 72 citas son de las 3pm o después (36%), y solo
-- salieron 5 recordatorios en total. Un recordatorio que no sale es un no-show que
-- no se evitó, o sea plata.
--
-- Segundo hueco: quien reservaba hoy DESPUÉS de las 9am para mañana tampoco
-- alcanzaba la corrida del día. Se arregla subiendo la frecuencia del cron, que
-- ahora es seguro (ver abajo).
--
-- Regla nueva: "todas las citas de MAÑANA (día civil en Bogotá) que todavía no
-- tienen recordatorio". Es exactamente lo que promete el correo ("Te vemos
-- mañana"), cubre el día completo y no depende de a qué hora corra el cron.
--
-- Toma-y-marca en la misma transacción, igual que tomar_resenas_pendientes (0035),
-- en vez de vista + nodo "marcar enviado" en n8n. Motivo: ese nodo usa
-- `$('Separar reservas').item` después del emailSend, el MISMO patrón que en el
-- workflow de cupo devolvía 2xx sin marcar y reenviaba cada 10 min. Con el cron
-- pasando de 1 a varias corridas por día, ese riesgo se multiplicaba. Acá no hay
-- nada que marcar después: si la fila salió de esta función, ya quedó marcada.
-- Contrapartida asumida: si el SMTP falla, ese recordatorio se pierde en vez de
-- reintentarse. Perder un recordatorio es mucho más barato que spamear al cliente.

create or replace function public.tomar_recordatorios_pendientes()
returns table (
  reserva_id   uuid,
  inicio       timestamptz,
  cliente      text,
  email        text,
  barbero      text,
  servicio     text,
  sede_id      text,
  cliente_ref  uuid,
  barbero_foto text,
  confirm_token uuid
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with elegibles as (
    select r.id
    from public.reservas r
    join public.clientes c on c.id = r.cliente_ref
    where r.estado in ('pendiente', 'confirmada')
      and coalesce(r.reminder_sent, false) = false
      and c.email is not null and c.email <> ''
      -- MAÑANA como día civil en Bogotá, no como ventana de horas.
      and (r.inicio at time zone 'America/Bogota')::date
          = ((now() at time zone 'America/Bogota') + interval '1 day')::date
  ),
  marcadas as (
    update public.reservas r
       set reminder_sent = true
     where r.id in (select e.id from elegibles e)
    returning r.id, r.inicio, r.cliente_ref, r.sede_id, r.barbero_id, r.servicio_id, r.confirm_token
  )
  select m.id, m.inicio, c.nombre, c.email, b.nombre, s.nombre, m.sede_id,
         c.id, b.foto_url, m.confirm_token
  from marcadas m
  join public.clientes c on c.id = m.cliente_ref
  left join public.barberos b on b.id = m.barbero_id
  left join public.servicios s on s.id = m.servicio_id;
end $$;

-- Devuelve correos de clientes y además muta: solo el cron (service_role).
revoke all on function public.tomar_recordatorios_pendientes() from public, anon, authenticated;
grant execute on function public.tomar_recordatorios_pendientes() to service_role;

-- La vista queda para no romper nada que la lea, pero con la ventana corregida
-- (mismo criterio: las citas de mañana). Ya no la consume el workflow.
create or replace view public.v_recordatorios_pendientes
with (security_invoker = true) as
select r.id as reserva_id, r.inicio, c.nombre as cliente, c.email,
       b.nombre as barbero, s.nombre as servicio, r.sede_id,
       c.id as cliente_ref, b.foto_url as barbero_foto, r.confirm_token
from public.reservas r
join public.clientes c on c.id = r.cliente_ref
left join public.barberos b on b.id = r.barbero_id
left join public.servicios s on s.id = r.servicio_id
where r.estado in ('pendiente', 'confirmada')
  and coalesce(r.reminder_sent, false) = false
  and c.email is not null and c.email <> ''
  and (r.inicio at time zone 'America/Bogota')::date
      = ((now() at time zone 'America/Bogota') + interval '1 day')::date;
revoke all on public.v_recordatorios_pendientes from anon, authenticated;
grant select on public.v_recordatorios_pendientes to service_role;
