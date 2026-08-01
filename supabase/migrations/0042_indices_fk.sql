-- 0042 — Índices en las llaves foráneas que se usan de verdad.
-- Postgres NO indexa las FK solo: sin índice, cada JOIN por esa columna y cada
-- DELETE en la tabla padre hacen scan completo del hijo. Con el piloto arrancando
-- no se nota; con un año de ventas y reservas, sí.
--
-- Criterio: se indexan las FK de las tablas TRANSACCIONALES (crecen con el uso).
-- Las de catálogo (sedes, servicios, servicio_sede, barberos, profiles) se dejan
-- como están: son decenas de filas, el índice costaría más de lo que ahorra.
-- Todos CONCURRENTLY no: son tablas chicas hoy y esto corre en una migración.

-- Reservas: la tabla más consultada (agenda, cuadre, métricas).
create index if not exists idx_reservas_cliente_id on public.reservas (cliente_id);
create index if not exists idx_reservas_servicio_id on public.reservas (servicio_id);

-- Ventas: cuadre, comisiones, CRM.
create index if not exists idx_ventas_cliente_id on public.ventas (cliente_id);
create index if not exists idx_ventas_medio on public.ventas (medio);

-- Lista de espera: se filtra por sede/barbero/estado en cada carga del mostrador.
create index if not exists idx_lista_espera_sede_id on public.lista_espera (sede_id);
create index if not exists idx_lista_espera_barbero_id on public.lista_espera (barbero_id);
create index if not exists idx_lista_espera_cliente_ref on public.lista_espera (cliente_ref);
create index if not exists idx_lista_espera_cupo_barbero_id on public.lista_espera (cupo_barbero_id);
create index if not exists idx_lista_espera_servicio_id on public.lista_espera (servicio_id);

-- Fidelización y CRM del cliente (crecen una fila por visita).
create index if not exists idx_puntos_mov_venta_id on public.puntos_mov (venta_id);
create index if not exists idx_cliente_notas_creado_por on public.cliente_notas (creado_por);
create index if not exists idx_cliente_wallet_mov_creado_por on public.cliente_wallet_mov (creado_por);
create index if not exists idx_cliente_resenas_barbero_id on public.cliente_resenas (barbero_id);
create index if not exists idx_resenas_servicio_cliente_ref on public.resenas_servicio (cliente_ref);

-- Plata del día a día.
create index if not exists idx_gastos_sede_id on public.gastos (sede_id);
create index if not exists idx_gastos_registrado_por on public.gastos (registrado_por);
create index if not exists idx_adelantos_barbero_id on public.adelantos (barbero_id);
create index if not exists idx_caja_sesiones_abierta_por on public.caja_sesiones (abierta_por);
create index if not exists idx_caja_sesiones_cerrada_por on public.caja_sesiones (cerrada_por);

-- Push: se borra por cliente cuando la suscripción muere (410).
create index if not exists idx_push_subscriptions_cliente_ref on public.push_subscriptions (cliente_ref);

-- Tabla muerta desde 0006 (la reemplazó cliente_resenas): tiene RLS habilitado y
-- CERO policies, o sea que nadie puede leerla ni escribirla. No la usa ninguna
-- query del código. Se elimina para que no confunda al leer el esquema.
drop table if exists public.calificaciones_cliente;
