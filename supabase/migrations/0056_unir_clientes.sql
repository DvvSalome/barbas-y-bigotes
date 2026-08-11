-- 0056 — Unir fichas repetidas de un cliente (badge "Repetida ×N" del CRM).
-- TODO el traspaso pasa en UNA transacción (función): si algo falla a mitad,
-- no queda un cliente con la wallet en una ficha y las visitas en otra.
-- Convención del proyecto para definer functions: search_path = '' y todo
-- schema-qualified (evita search_path injection). Solo la invoca el server
-- (service role) tras requireAdmin; se revoca a anon/authenticated.
--
-- Reglas del merge:
--   · Las 9 tablas que apuntan a clientes (reservas, ventas, notas, reseñas,
--     wallet, puntos, calificaciones, espera, push) pasan al DESTINO.
--   · El ORIGEN se borra ANTES de completar el destino: libera sus únicos
--     (telefono, auth_id) para poder heredarlos sin chocar.
--   · El destino conserva lo suyo y hereda solo lo que le falte (coalesce);
--     fidelizado queda true si cualquiera de los dos lo era.

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
