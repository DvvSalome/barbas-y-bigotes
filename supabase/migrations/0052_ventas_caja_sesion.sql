-- 0052 — Ata cada venta a su sesión de caja por ID, no por ventana de tiempo (#08).
--
-- Antes las ventas se asociaban a una caja SOLO por sede + creado_en >= abierta_en.
-- Si un cobro se confirmaba justo mientras alguien cerraba la caja (la venta commit
-- después de la foto del cierre), quedaba en la ventana pero fuera del cierre, y como
-- la siguiente caja abre después, no caía en NINGUNA sesión: huérfana. No se perdía
-- plata (el cuadre diario la contaba), pero el "esperado" de esa sesión salía corto.
--
-- Fix: una columna caja_sesion_id que se ESTAMPA al insertar la venta (desde la caja
-- que estaba abierta en ese momento). Así la pertenencia se decide atómicamente y no
-- depende del timing del cierre. El código lee por caja_sesion_id (con red de
-- transición por ventana para las ventas viejas/sin estampar).
--
-- ORDEN DE APLICACIÓN: esta migración va ANTES de desplegar el código que estampa la
-- columna (el código la escribe; si no existe, el INSERT de la venta fallaría). La
-- columna es nullable, así que el código VIEJO (que aún no la estampa) sigue andando.
-- Aplicar manualmente en el SQL Editor.

alter table public.ventas
  add column if not exists caja_sesion_id uuid references public.caja_sesiones(id) on delete set null;

create index if not exists ventas_caja_sesion_idx on public.ventas(caja_sesion_id);

-- Backfill: cada venta histórica a la sesión de SU sede cuya ventana la contiene
-- (la más reciente que abrió antes de la venta y que no había cerrado todavía). Las
-- ventas sin sesión que las contenga quedan en null (la red por ventana las cubre).
update public.ventas v
set caja_sesion_id = (
  select cs.id
  from public.caja_sesiones cs
  where cs.sede_id = v.sede_id
    and cs.abierta_en <= v.creado_en
    and (cs.cerrada_en is null or v.creado_en < cs.cerrada_en)
  order by cs.abierta_en desc
  limit 1
)
where v.caja_sesion_id is null;

notify pgrst, 'reload schema';
