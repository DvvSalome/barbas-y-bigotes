-- 0060 · Una venta puede cobrarse con VARIOS medios de pago.
--
-- Hueco que tapa: `ventas.medio` es una sola columna, así que si el cliente paga
-- $20.000 en efectivo y $15.000 por Nequi, el barbero tiene que elegir uno. Elija
-- el que elija, el desglose de la caja queda mal y el efectivo esperado en el
-- cajón NUNCA cuadra — que es justo lo que el dueño vio en el cierre.
--
-- Por qué jsonb y no una tabla `venta_pagos`: el reparto se lee SIEMPRE junto con
-- su venta y nunca por separado, no necesita índices propios ni políticas de RLS
-- aparte (hereda las de `ventas`), y a esta escala una tabla nueva solo agrega
-- joins. Si algún día hace falta consultarlo suelto, se normaliza sin perder nada.
--
-- `medio` NO se toca ni se deja de llenar: sigue siendo el medio PRINCIPAL (el de
-- mayor monto). Así todo lo que ya lo lee —listados, filtros, histórico— sigue
-- funcionando igual, y `pagos` es el detalle fino para quien lo entienda.

alter table public.ventas
  add column if not exists pagos jsonb;

comment on column public.ventas.pagos is
  'Reparto del cobro entre medios cuando se pagó con más de uno: [{"medio":"efectivo","monto":20000},...]. null = todo con el medio de la venta. La suma debe dar ventas.total (lo valida el server action).';

-- Guarda estructural: si viene, tiene que ser una lista con al menos dos partes.
-- Una sola parte es `medio` a secas, y guardarla acá sería tener el mismo dato en
-- dos lugares con dos formas de leerlo.
alter table public.ventas
  drop constraint if exists ventas_pagos_forma;
alter table public.ventas
  add constraint ventas_pagos_forma check (
    pagos is null
    or (jsonb_typeof(pagos) = 'array' and jsonb_array_length(pagos) between 2 and 6)
  );
