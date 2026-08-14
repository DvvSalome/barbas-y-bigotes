-- 0059 · Avisos al CLIENTE cuando la barbería mueve o cancela su cita.
--
-- Hueco que tapa: `moverCita` cambiaba hora y barbero sin avisarle a nadie, y la
-- cancelación desde el mostrador solo mandaba push (que solo llega a quien
-- instaló la app). En la práctica el cliente se enteraba llegando.
--
-- Diseño: una MARCA en la reserva que la app estampa al mover/cancelar, y un RPC
-- que toma-y-limpia en la misma transacción (mismo patrón que reseñas y avisos de
-- cita: sin nodo "marcar enviado" en n8n, que ya rompió dos veces). Al ser una
-- marca y no un flag booleano, una cita movida DOS veces vuelve a avisar.

alter table public.reservas
  add column if not exists aviso_cambio text
    check (aviso_cambio in ('movida', 'cancelada')),
  add column if not exists aviso_cambio_en timestamptz;

comment on column public.reservas.aviso_cambio is
  'Qué le pasó a la cita por decisión de la barbería. Pendiente de avisar mientras aviso_cambio_en no sea null; tomar_avisos_cambio() apaga esa marca al entregarlo.';

-- Índice parcial: la cola es diminuta al lado de la tabla.
create index if not exists reservas_aviso_cambio_idx
  on public.reservas (aviso_cambio_en)
  where aviso_cambio is not null;

-- Toma-y-limpia. Devuelve TODO lo que la plantilla necesita para no obligar a
-- n8n a encadenar consultas (cada salto suyo es una expresión más que puede
-- romperse en silencio).
create or replace function public.tomar_avisos_cambio()
returns table (
  reserva_id uuid,
  tipo text,
  cliente_nombre text,
  cliente_email text,
  cliente_telefono text,
  servicio text,
  barbero text,
  barbero_foto text,
  sede text,
  sede_direccion text,
  inicio timestamptz,
  confirm_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with tomadas as (
    -- Se reclama apagando la MARCA DE PENDIENTE (aviso_cambio_en), no el tipo:
    -- RETURNING entrega los valores NUEVOS de la fila, así que si acá se
    -- nulara `aviso_cambio` el correo saldría sin saber si fue movida o
    -- cancelada. El tipo queda como registro de lo último que pasó.
    update public.reservas r
       set aviso_cambio_en = null
     where r.aviso_cambio is not null
       and r.aviso_cambio_en is not null
    returning r.id, r.aviso_cambio as tipo, r.cliente_ref, r.servicio_id,
              r.barbero_id, r.sede_id, r.inicio, r.confirm_token
  )
  select t.id,
         t.tipo,
         c.nombre,
         c.email,
         c.telefono,
         coalesce(s.nombre, 'tu servicio'),
         coalesce(b.nombre, 'tu barbero'),
         b.foto_url,
         coalesce(sd.nombre, ''),
         coalesce(sd.direccion, ''),
         t.inicio,
         t.confirm_token
    from tomadas t
    left join public.clientes c  on c.id = t.cliente_ref
    left join public.servicios s on s.id = t.servicio_id
    left join public.barberos b  on b.id = t.barbero_id
    left join public.sedes sd    on sd.id = t.sede_id
   where coalesce(c.email, '') <> '';
end;
$$;

revoke all on function public.tomar_avisos_cambio() from public, anon, authenticated;
grant execute on function public.tomar_avisos_cambio() to service_role;
