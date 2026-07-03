# Seed de demo

`demo.sql` siembra datos de demostración **idempotentes** y **aislados** (todo tageado
`clientes.origen='demo'`). Re-ejecutarlo borra lo demo anterior y vuelve a sembrar = reset.

## Correr / resetear

Con la CLI de Supabase (proyecto ya linkeado) o el SQL Editor del dashboard:

```bash
# vía psql (usar la connection string del proyecto)
psql "$DATABASE_URL" -f supabase/seed/demo.sql
```

O pegar el contenido en el **SQL Editor** de Supabase y ejecutar.

## Ver el portal del cliente con datos

El portal `/cuenta` filtra por `auth_id` (login Gmail). Para verlo poblado, enlazá una
ficha demo a tu login de prueba (una sola vez, tras loguearte con un Gmail):

```sql
-- reemplazá <AUTH_UID> por el auth.users.id de tu sesión de prueba
update public.clientes
set auth_id = '<AUTH_UID>'
where origen = 'demo' and auth_id is null
order by creado_en
limit 1;
```

Luego, para que esa ficha tenga citas próximas visibles, reasigná algunas reservas demo
futuras a esa ficha (opcional; el seed ya deja reservas en varios clientes).

## Seguridad

El seed **solo** toca filas `origen='demo'`. Nunca borra ni modifica datos reales.
Sede ids usadas: `parque-venezuela`, `plaza-de-la-paz`.
