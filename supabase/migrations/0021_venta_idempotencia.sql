-- 0021 — Idempotencia de la VENTA RÁPIDA (sin reserva).
-- Problema: el cobro con reservaId null salta el claim y el unique parcial
-- ventas_reserva_unica (que es `where reserva_id is not null`), así que un
-- doble-clic tras timeout o 2 dispositivos crean 2 ventas idénticas (doble baja
-- de stock, doble ingreso, doble puntos).
-- Fix: token de idempotencia que la UI genera una vez por apertura del form; el
-- unique parcial rechaza (23505) la segunda inserción con el mismo token.
-- NO ejecutar acá: solo se versiona el .sql (lo aplica el proceso de migración).

alter table public.ventas add column if not exists idem_token text;

create unique index if not exists ventas_idem_unica
  on public.ventas (idem_token)
  where idem_token is not null;
