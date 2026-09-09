-- 0072 · Eliminación de cuenta del cliente (Google Play la exige para toda app
-- con inicio de sesión; también es el derecho de supresión de la Ley 1581).
--
-- Un solo lugar, atómico: la app llama eliminar_cuenta_cliente(auth_id) con el
-- service role DESPUÉS de comprobar que el usuario es ese mismo cliente, y luego
-- borra el usuario de Auth (eso cierra el acceso con Google).
--
-- Qué pasa con cada tabla (mapa tomado de unir_clientes, 0056):
--   clientes            se ANONIMIZA (las ventas la referencian): nombre genérico,
--                       sin teléfono/correo/notas, sin auth_id, marketing apagado.
--   reservas            las futuras se cancelan (el cupo se libera); las notas del
--                       cliente se borran en todas.
--   ventas              QUEDAN (registro contable) sin el nombre copiado.
--   cliente_notas       se borran (observaciones del staff sobre la persona).
--   push_subscriptions  se borran (dejan de llegarle avisos al celular).
--   lista_espera        turnos activos fuera; en el resto se borran nombre/teléfono/nota.
--   cliente_resenas / resenas_servicio  quedan las notas numéricas, se borra el texto.
--   cliente_wallet_mov / puntos_mov / avisos_marketing  quedan (no tienen datos
--                       personales; cuelgan de la ficha anonimizada).
--   profiles            si el cliente tuviera fila (rol cliente), se anonimiza igual.

create or replace function public.eliminar_cuenta_cliente(p_auth_id uuid)
returns table (cliente_id uuid, citas_canceladas int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_canceladas int := 0;
begin
  select c.id into v_id from public.clientes c where c.auth_id = p_auth_id;
  if v_id is null then
    -- Sin ficha (nunca reservó): no hay nada que anonimizar; la app borra el Auth igual.
    return;
  end if;

  update public.reservas r
     set estado = 'cancelada', nota = null
   where r.cliente_ref = v_id
     and r.estado in ('pendiente', 'confirmada')
     and r.inicio > now();
  get diagnostics v_canceladas = row_count;

  update public.reservas r set nota = null
   where r.cliente_ref = v_id and r.nota is not null;

  update public.ventas v set cliente_nombre = null
   where v.cliente_ref = v_id and v.cliente_nombre is not null;

  delete from public.cliente_notas where cliente_ref = v_id;
  delete from public.push_subscriptions where cliente_ref = v_id;

  delete from public.lista_espera
   where cliente_ref = v_id and estado in ('esperando', 'notificado');
  update public.lista_espera
     set cliente_nombre = null, telefono = null, nota = null
   where cliente_ref = v_id;

  update public.cliente_resenas set nota = null where cliente_ref = v_id and nota is not null;
  update public.resenas_servicio set comentario = null where cliente_ref = v_id and comentario is not null;

  update public.clientes c
     set nombre = 'Cliente eliminado',
         telefono = null,
         email = null,
         auth_id = null,
         notas = null,
         acepta_marketing = false,
         baja_en = coalesce(c.baja_en, now()),
         -- Se rota para que los enlaces de baja viejos dejen de apuntar a alguien.
         marketing_token = gen_random_uuid()
   where c.id = v_id;

  update public.profiles p
     set nombre = 'Cliente eliminado', telefono = null, email = null, auth_id = null
   where p.auth_id = p_auth_id and p.rol = 'cliente';

  return query select v_id, v_canceladas;
end;
$$;

revoke all on function public.eliminar_cuenta_cliente(uuid) from public, anon, authenticated;
grant execute on function public.eliminar_cuenta_cliente(uuid) to service_role;
