-- 0079: de qué parte de la landing salió cada reserva web (punto 5, 26-sep).
--
-- La landing manda a /reservar con ?desde=<posición> (hero, hero-cara, carta,
-- elenco, galeria, app, cierre, barra, cabecera). El wizard lo guarda acá tal
-- cual, para saber qué parte de la página vende. Texto libre y opcional: las
-- reservas del mostrador, del portal o las viejas quedan en null.
--
-- No es `canal`: esa columna ya existe (enum canal_reserva: link / app / walkin)
-- y dice POR DÓNDE se creó la reserva; esta dice DESDE QUÉ LUGAR de la web.
alter table public.reservas
  add column if not exists origen_web text
  check (origen_web is null or char_length(origen_web) <= 60);

comment on column public.reservas.origen_web is
  'Posición de la landing desde la que se abrió el wizard (?desde=). null = no vino de la landing.';
