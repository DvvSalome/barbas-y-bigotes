-- 0027_combo_cuenta_corte.sql — Barbas & Bigotes
-- Armador de combos: un combo creado SIN corte no debe sumar sello ni canje en
-- la tarjeta de cortes (hoy la detección cuenta toda la categoría combos).
-- null = legado (todos los combos existentes llevan corte, siguen contando).
alter table public.servicios add column if not exists cuenta_corte boolean;
