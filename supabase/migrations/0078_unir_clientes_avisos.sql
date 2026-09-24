-- 0078 · "Unir fichas" dejaba borrarse los avisos de marketing de la ficha que se une.
--
-- unir_clientes (0056) mueve al destino las 9 tablas que apuntaban a clientes
-- cuando se escribió. Después llegó `avisos_marketing` (0068, "te toca corte"),
-- con la FK en ON DELETE CASCADE — y la función no la conocía. Al borrar la
-- ficha de origen, sus avisos se iban en cascada, sin error y sin rastro: el
-- cliente unido podía volver a recibir un "te toca corte" que ya le había llegado,
-- porque el registro que lo evitaba desapareció.
--
-- Se encontró el 24-sep al unir los clientes inventados del walk-in, contando
-- TODAS las FK a clientes en la base antes de borrar nada (ninguno de esos tenía
-- avisos, así que esa unión no perdió nada). La función queda igual a la 0056
-- más una línea.
--
-- Regla para la próxima tabla que apunte a clientes: agregarla ACÁ, o "Unir
-- fichas" vuelve a perder datos en silencio.

create or replace function public.unir_clientes(p_origen uuid, p_destino uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen public.clientes%rowtype;
begin
  if p_origen = p_destino then
    raise exception 'La ficha de origen y la de destino son la misma.';
  end if;

  -- Lock de ambas filas: dos merges simultáneos del mismo grupo se serializan.
  select * into v_origen from public.clientes where id = p_origen for update;
  if not found then
    raise exception 'La ficha de origen ya no existe.';
  end if;
  perform 1 from public.clientes where id = p_destino for update;
  if not found then
    raise exception 'La ficha de destino ya no existe.';
  end if;

  update public.reservas           set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.ventas             set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.cliente_notas      set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.cliente_resenas    set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.cliente_wallet_mov set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.puntos_mov         set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.resenas_servicio   set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.lista_espera       set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.push_subscriptions set cliente_ref = p_destino where cliente_ref = p_origen;
  update public.avisos_marketing   set cliente_ref = p_destino where cliente_ref = p_origen;

  delete from public.clientes where id = p_origen;

  update public.clientes set
    telefono   = coalesce(telefono, v_origen.telefono),
    email      = coalesce(email, v_origen.email),
    auth_id    = coalesce(auth_id, v_origen.auth_id),
    notas      = coalesce(notas, v_origen.notas),
    fidelizado = (coalesce(fidelizado, false) or coalesce(v_origen.fidelizado, false))
  where id = p_destino;
end;
$$;

revoke all on function public.unir_clientes(uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
