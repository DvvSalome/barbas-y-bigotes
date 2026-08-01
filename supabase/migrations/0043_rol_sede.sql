-- 0043 — Nuevo rol 'sede' (administrador de sede).
-- VA SOLO en su migración: Postgres no permite USAR un valor de enum en la misma
-- transacción en que se agrega. La 0044 ya lo usa.
--
-- Modelo nuevo (decisión del dueño, 2026-08-01): en vez de un login por barbero
-- (6 PINes), hay 3 perfiles: el dueño (admin) y un administrador por sede, que
-- opera el mostrador compartido del local. Los barberos siguen existiendo como
-- DATO (agenda, comisiones, fotos), no como identidad de login.
alter type public.rol_usuario add value if not exists 'sede';
