-- 0062 · Al cobrar se puede cambiar el servicio y el valor.
--
-- Lo pidió el dueño (20-ago): "cuando se vaya a cobrar deje modificar servicio y
-- valor tanto al ADM como a los barberos". Pasa todo el tiempo — el cliente pidió
-- corte y terminó en corte+barba, o se le hace un precio a un conocido.
--
-- OJO, esto AFLOJA una defensa puesta a propósito: hasta hoy, cuando la venta
-- cerraba una cita, el servicio se DERIVABA de la reserva justamente para que
-- nadie pudiera cobrar un combo y registrar el corte barato (AUD-A-001). El dueño
-- decidió abrirlo a cambio de dejar rastro, y eso es lo que agregan estas dos
-- columnas.
--
-- `precio_lista` guarda el precio de CATÁLOGO del momento. Cuando difiere del
-- cobrado, la venta se puede señalar sola: no hace falta ir a comparar contra la
-- tabla de precios de hoy (que además pudo cambiar después). Se llena SIEMPRE, no
-- solo al editar: un dato que solo existe cuando alguien hizo algo raro es un dato
-- que no se puede consultar de corrido.
alter table public.venta_items
  add column if not exists precio_lista integer;

comment on column public.venta_items.precio_lista is
  'Precio de catálogo del servicio/producto al momento de cobrar. Si difiere de precio_unitario, alguien lo editó en el mostrador. null = venta anterior a 0062.';

-- Quién OPERÓ el cobro, que no es lo mismo que de quién es la comisión
-- (ventas.barbero_id): en el mostrador se cobra la cita de un compañero. Es el
-- campo que importa si algún día hay que revisar una edición de precio.
-- Sin FK a auth.users a propósito: es un rastro, y no queremos que borrar un
-- usuario falle o se lleve por delante el histórico de ventas.
alter table public.ventas
  add column if not exists cobrada_por uuid;

comment on column public.ventas.cobrada_por is
  'auth uid de quien registró el cobro (el que tenía la sesión abierta en el mostrador). Distinto de barbero_id, que es a quién se le paga la comisión. Rastro, no candado: si el equipo comparte una sesión de sede, todos figuran igual.';
