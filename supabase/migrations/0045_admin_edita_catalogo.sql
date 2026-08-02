-- 0045 — El admin puede EDITAR el catálogo (precios por sede y contratos).
-- Causa raíz de que "los precios no se editan desde acá": servicio_sede y
-- barberos tenían SOLO policy de lectura pública. Cualquier update del admin lo
-- bloqueaba RLS en silencio (Postgres no falla: simplemente afecta 0 filas), así
-- que la UI se rendía y quedó el cartel de "pídemelo y lo actualizo".
-- Se replica el patrón que productos ya tenía (productos_write_admin).

-- Precio y disponibilidad de cada servicio en cada sede.
drop policy if exists servicio_sede_write_admin on public.servicio_sede;
create policy servicio_sede_write_admin on public.servicio_sede
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Ficha del barbero: contrato (comisión/arriendo), foto, bio, activo, orden.
drop policy if exists barberos_write_admin on public.barberos;
create policy barberos_write_admin on public.barberos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
