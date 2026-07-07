-- 0022 — UNIQUE(endpoint) en push_subscriptions.
-- Problema: savePushSubscription re-vincula por endpoint, pero endpoint NO era
-- UNIQUE. Con 2 filas del mismo endpoint (equipo compartido), .maybeSingle()
-- tiraba error y la re-vinculación fallaba → el dueño anterior seguía recibiendo
-- los avisos de sus citas en ese dispositivo (fuga residual). Con el UNIQUE el
-- server puede pasar a un upsert por endpoint (una sola fila por dispositivo).
-- NO ejecutar acá: solo se versiona el .sql (lo aplica el proceso de migración).

-- Dedup previo: dejar una sola fila por endpoint (la de menor ctid) antes del unique.
delete from public.push_subscriptions a
  using public.push_subscriptions b
  where a.endpoint = b.endpoint and a.ctid < b.ctid;

create unique index if not exists push_sub_endpoint_unica
  on public.push_subscriptions (endpoint);
