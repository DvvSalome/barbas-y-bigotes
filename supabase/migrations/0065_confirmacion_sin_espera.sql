-- 0065 · La confirmación sale apenas se reserva, sin los 2 minutos de espera.
--
-- Los 2 minutos los puso 0041 como "ventana para deshacer": el wizard creaba la
-- cita de una y, si el cliente se había equivocado de dato, alcanzaba a tocar
-- "cancelar esta reserva" antes de que le llegara el correo.
--
-- Esa razón ya no existe. Desde ago-2026 el wizard NO reserva al tocar Confirmar:
-- abre una hoja con el resumen y una cuenta atrás de 5 segundos (patrón DiDi), con
-- botón de Editar. El "me equivoqué de dato" se caza AHÍ, antes de crear nada.
--
-- Además la espera nunca cumplió lo que prometía: el deshacer de la pantalla
-- "¡Listo!" vale 60 MINUTOS (DESHACER_MIN en cliente-actions.ts), así que entre el
-- minuto 2 y el 60 el cliente igual podía deshacer después de recibir el correo.
-- Retener 2 minutos no evitaba ese caso; solo hacía esperar a TODOS.
--
-- Con esto la confirmación llega en el minuto siguiente a reservar (el cron corre
-- cada minuto), que es cuando el cliente todavía está mirando la pantalla.
--
-- Contrapartida asumida: quien deshaga en los primeros segundos puede haber
-- recibido ya la confirmación de una cita que canceló. Es raro y es como funciona
-- cualquier app de reservas; hacer esperar a todo el mundo por ese caso salía más
-- caro. La cota de 30 minutos de 0061 (el techo anti-reenvío) NO se toca.

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
     -- Techo anti-reenvío (0061): si algo falla, la fila deja de ofrecerse a la
     -- media hora en vez de reintentarse durante dos días.
     and r.creado_en >= now() - interval '30 minutes';

revoke all on public.v_confirmaciones_pendientes from anon, authenticated;
grant select on public.v_confirmaciones_pendientes to service_role;

notify pgrst, 'reload schema';
