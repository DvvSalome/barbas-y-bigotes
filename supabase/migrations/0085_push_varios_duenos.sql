-- 0085 · Un aparato puede avisarle a VARIOS dueños a la vez (14-oct).
--
-- Hasta acá cada aparato (endpoint del navegador) era de UN solo dueño: el
-- unique push_sub_endpoint_unica (0022) y el upsert por endpoint re-vinculaban la
-- fila a quien activara los avisos último. En la tableta del mostrador eso
-- significaba que si el dueño (o un barbero con su PIN) tocaba "Activar avisos",
-- la SEDE dejaba de recibir la cita nueva, las cancelaciones y "la caja sigue
-- abierta", y nadie se enteraba. La tarjeta, además, decía "activos" mirando solo
-- el navegador, sin saber de quién era la fila.
--
-- Ahora la llave es (endpoint, dueño): la tableta puede ser de la sede Y del
-- dueño al mismo tiempo. Lo que NO cambia:
--   · cada fila sigue teniendo exactamente un dueño (CHECK push_sub_dueno_unico);
--   · un aparato sigue siendo de UN solo cliente (índice parcial de abajo): en un
--     equipo compartido el cliente nuevo re-vincula al anterior y no se filtran
--     los avisos de uno al otro (por eso existía 0022). Eso además mantiene sano
--     el unir_clientes de 0078, que mueve filas de un cliente a otro.
--
-- `dueno` es una columna GENERADA (no se escribe nunca): existe para que el
-- upsert de PostgREST tenga una llave con nombre (on_conflict=endpoint,dueno).
-- Un índice por expresión no sirve para eso.
--
-- ORDEN: primero el deploy (el código prueba endpoint,dueno y, si esta migración
-- todavía no está, vuelve al upsert por endpoint) y DESPUÉS esta migración. Al
-- revés, el código viejo pediría on_conflict=endpoint sin índice que lo respalde
-- y activar avisos fallaría hasta el deploy.
--
-- Idempotente.

alter table public.push_subscriptions
  add column if not exists dueno text generated always as (
    case
      when cliente_ref is not null then 'cliente:' || cliente_ref::text
      when barbero_id  is not null then 'barbero:' || barbero_id::text
      when sede_id     is not null then 'sede:'    || sede_id
      when admin_auth  is not null then 'admin:'   || admin_auth::text
    end
  ) stored;

-- La llave nueva: una fila por aparato y por dueño.
create unique index if not exists push_sub_endpoint_dueno
  on public.push_subscriptions (endpoint, dueno);

-- Un aparato, un solo CLIENTE (lo que garantizaba 0022, ahora solo para clientes).
create unique index if not exists push_sub_endpoint_cliente
  on public.push_subscriptions (endpoint) where cliente_ref is not null;

-- Recién ahora se suelta la llave vieja (con las dos nuevas ya creadas, nunca
-- queda la tabla sin unicidad).
drop index if exists public.push_sub_endpoint_unica;

notify pgrst, 'reload schema';
