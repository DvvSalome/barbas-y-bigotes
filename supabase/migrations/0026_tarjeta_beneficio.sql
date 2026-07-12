-- 0026_tarjeta_beneficio.sql — Barbas & Bigotes
-- Tarjeta de cortes: traza qué beneficio de fidelidad se aplicó en la venta.
-- El conteo de sellos se deriva de las ventas-con-corte (no hay tabla nueva);
-- esta columna es solo para reportes / recibo / admin. NO ejecutar acá: el .sql
-- se versiona y lo aplica el proceso de migración.
alter table public.ventas
  add column if not exists beneficio_tarjeta text; -- '50%' | 'gratis' | null
