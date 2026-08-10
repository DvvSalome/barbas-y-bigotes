-- 0053 — La propina puede tener su PROPIO medio de pago (auditoría #16).
--
-- La propina se guardaba con el medio de la VENTA. En Colombia es común pagar el
-- servicio por Nequi/datáfono y dejar la propina en efectivo en la mano: ese efectivo
-- entra al cajón pero el sistema lo atribuía al medio de la venta y NO lo esperaba en
-- el cajón → sobrante recurrente en el cierre.
--
-- Nueva columna propina_medio (nullable). null = la propina va con el medio de la
-- venta (comportamiento de siempre, retro-compatible); si se registra (p.ej.
-- 'efectivo'), la propina se atribuye a ESE medio en el desglose y el esperado del
-- cajón. El form de cobro deja marcar "propina en efectivo". Aplicar en el SQL Editor.

alter table public.ventas add column if not exists propina_medio text;

notify pgrst, 'reload schema';
