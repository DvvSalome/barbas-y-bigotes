-- 0067 · Con qué se pagó el gasto y el adelanto (efectivo, Nequi, datáfono…).
--
-- El dueño lo pidió para el cuadre: "cómo se realizó el adelanto o el gasto, con
-- los medios de pago que ya existen". El slug referencia medios_pago (se valida
-- en la action contra los activos, igual que la propina de 0053; sin FK porque
-- ventas.medio tampoco la tiene y un medio borrado no puede romper el histórico).
--
-- Además arregla una mentira silenciosa del cierre: TODO gasto descontaba del
-- efectivo esperado del cajón, aunque se hubiera pagado por Nequi. Con el medio
-- guardado, solo lo pagado en efectivo descuenta (sumaGastosEfectivo en cobro.ts).
-- Lo viejo queda como 'efectivo': era la única forma que existía.

alter table public.gastos add column if not exists medio text not null default 'efectivo';
alter table public.adelantos add column if not exists medio text not null default 'efectivo';

notify pgrst, 'reload schema';
