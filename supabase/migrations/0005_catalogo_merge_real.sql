-- 0005_catalogo_merge_real.sql — Barbas & Bigotes
-- Revierte la reducción de 0003 y deja el catálogo definitivo: el menú real
-- completo (el que ya teníamos) + 3 combos rápidos que aporta WeiBook y no estaban,
-- sin duplicados y con nombres claros para el cliente. Misma información/precios
-- que ya existían (no se inventan valores).

-- 1) Reactivar el menú real completo (0003 lo había ocultado).
update public.servicios set activo = true;

-- 2) Restaurar nombre/categoría/duración + precios por sede de los servicios base
--    que 0003 había pisado con la versión plana de WeiBook.
update public.servicios set nombre = 'Corte (clásico, degradado, tijera o niño)', categoria = 'cortes', duracion_min = 30 where id = 'corte';
update public.servicios set nombre = 'Corte y barba', categoria = 'cortes', duracion_min = 60 where id = 'corte-barba';
update public.servicios set nombre = 'Perfilamiento de barba', categoria = 'barba', duracion_min = 20 where id = 'perfilamiento-barba';

update public.servicio_sede set precio = 35000 where servicio_id = 'corte' and sede_id = 'parque-venezuela';
update public.servicio_sede set precio = 30000 where servicio_id = 'corte' and sede_id = 'plaza-de-la-paz';
update public.servicio_sede set precio = 45000 where servicio_id = 'corte-barba' and sede_id = 'parque-venezuela';
update public.servicio_sede set precio = 40000 where servicio_id = 'corte-barba' and sede_id = 'plaza-de-la-paz';
update public.servicio_sede set precio = 25000 where servicio_id = 'perfilamiento-barba' and sede_id = 'parque-venezuela';
update public.servicio_sede set precio = 20000 where servicio_id = 'perfilamiento-barba' and sede_id = 'plaza-de-la-paz';

-- 3) Los 3 combos rápidos que aporta WeiBook (no estaban en el menú): nombres
--    claros, agrupados con los cortes. Precio plano en ambas sedes (ya seteado en 0003).
update public.servicios set nombre = 'Corte y cejas',          categoria = 'cortes', es_combo = false, activo = true where id = 'corte-cejas';
update public.servicios set nombre = 'Corte + barba + cejas',   categoria = 'cortes', es_combo = true,  activo = true where id = 'corte-barba-cejas';
update public.servicios set nombre = 'Cerquillo y barba',       categoria = 'cortes', es_combo = true,  activo = true where id = 'cerquillo-barba';

-- 4) Quitar los duplicados que generó 0003 (se conserva la versión original del menú).
update public.servicios set activo = false where id in ('cerquillo', 'limpieza-facial-silver', 'corte-limpieza-facial-silver');
