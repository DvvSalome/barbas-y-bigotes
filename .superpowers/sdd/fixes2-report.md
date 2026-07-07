# Fix batch 2 — reporte (branch spec/fixes2)

Auditoría de concurrencia/notificaciones + quick-wins de CI/ops. Copy voseo.
Migraciones: SOLO escritas (0021/0022/0023), NO ejecutadas.

## Status por fix

| Fix | Estado | Commit | Qué cambió |
|-----|--------|--------|------------|
| 1 — cerrarCaja sin guard de idempotencia | ✅ | `810f2a6` | Nueva `ejecutarCierreCaja` (server) que comparten `cerrarCaja` (admin) y `cerrarCajaSede` (barbero): update condicional a `estado='abierta'` + `.select("id")`, 0 filas → "La caja ya fue cerrada." El admin ya no pisa en silencio el conteo del barbero al recerrar. |
| 2 — tope de cupón excedible bajo concurrencia | ✅ | `810f2a6` | En `completarReserva`, `bump_cupon_uso` se llama ANTES de armar/insertar la venta; `false` → "Cupón agotado." (revirtiendo el claim), sin cobrar el descuento. Se eliminó el bump del final. Tradeoff documentado: si la venta falla tras el bump el uso queda consumido (nunca doble cobro). |
| 3 — venta rápida sin anti-doble-cobro | ✅ | `810f2a6` | `input.idemToken` obligatorio para venta rápida (reservaId null); `idem_token` en el insert; 23505 → "Esta venta ya fue cobrada." (reserva → "Esta cita ya fue cobrada."). `CheckoutForm` genera el token 1× por apertura (`useState(() => crypto.randomUUID())`). Migración `0021_venta_idempotencia.sql` (unique parcial). |
| 4 — push_subscriptions sin UNIQUE(endpoint) | ✅ | `377e2df` | `savePushSubscription` → `upsert(..., { onConflict: "endpoint" })`; elimina el select+branch y cierra la fuga residual en equipos compartidos. Migración `0022_push_endpoint_unique.sql` (dedup por ctid + unique). |
| 5 — reagendar no resetea reminder_sent | ✅ | `377e2df` | `reagendarReservaCliente` y `responderPropuestaAdelanto` (rama aceptar, que mueve inicio/fin) setean `reminder_sent: false` → la nueva fecha vuelve a la vista de recordatorios. |
| 6 — vista de cupo libre sin cota temporal | ✅ | `5acc09f` | Confirmado: `v_avisos_cola_pendientes` (0014) NO tenía cota. Migración `0023_cola_cota.sql`: `create or replace view` + `and le.creado_en >= now() - interval '2 days'` (patrón de v_confirmaciones/v_recordatorios). Evita el bounce loop. |
| 7 — check-*.ts no corrían en CI | ✅ | `104050a` | `package.json` gana `"test"` = `node scripts/check-{cobro,caja,tz,push}.ts` (type stripping nativo). `ci.yml`: Node 20→24, secrets VAPID (para check-push) y step `npm test` tras el build. |
| 8 — /api/health | ✅ | `89beedc` | `src/app/api/health/route.ts` (force-dynamic): count head-only de `sedes` con anon → `{ ok, db, ts }` o 503. No expone datos. |

### Nota de tooling (Fix 7 — cómo corren los scripts)
Los `check-*.ts` importan `../src/lib/*.ts` con extensión `.ts` y corren con `node script.ts`
directo (type stripping nativo, Node ≥23.6) — el mismo mecanismo que usó el implementador de caja
(`node scripts/check-caja.ts`). Node 20 (el que tenía el CI) NO soporta TS sin build ni el flag
`--experimental-strip-types`, por eso el CI sube a **Node 24** y se usa `node` pelado (no el flag).
**Acción requerida del dueño:** agregar 3 secrets al repo en GitHub Actions —
`VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (los mismos de .env.local /
Vercel) — o `check-push` fallará el CI. Las otras 3 (cobro/caja/tz) son puras y no necesitan env.

## Verificación
- `npx tsc --noEmit` → **limpio** (exit 0).
- `npm run build` → **OK** (aparece `ƒ /api/health` en la tabla de rutas).
- `npm test` → `check-cobro OK` · `check-caja OK` · `check-tz OK` · `check-push OK`.
- `eslint` de los archivos tocados (actions.ts, cliente-actions.ts, AgendaList.tsx, health/route.ts) → 0 errores.
- Grep: guard de caja (`.eq("estado","abierta")` en el cierre unificado), `bump_cupon_uso` antes del insert de venta, `idem_token` en la venta rápida, `upsert(onConflict:"endpoint")`, `reminder_sent:false` en ambos reagendos, cota `>= now() - interval '2 days'` en 0023.
- Migraciones 0021/0022/0023 escritas, **NO ejecutadas** (solo .sql versionado).

## NO se arreglaron (follow-up, documentados)
- `upsert_cliente` sin ON CONFLICT explícito (dedup perfeccionable).
- `decrement_stock` oversell (decisión de producto: ¿vender sin stock?).
- `trg_notificar_cola`: N cancelaciones simultáneas promueven a 1 (raro, mejora futura).
- Reverso del uso de cupón si la venta falla tras el bump: aceptado consumido (evita RPC de decremento no briefeada).

## 5 métricas de negocio recomendadas (BLOQUE aparte, readiness 38/100 — proponer al dueño)
1. **Funnel de reserva (conversión):** vista del wizard → slot elegido → reserva confirmada → cita completada. Muestra dónde se cae el booking (elección de barbero/horario, abandono) para subir la tasa de conversión.
2. **No-show y cancelación** por sede/barbero/canal (app vs walk-in) y por antelación: cuantifica cupos e ingreso perdidos; base para política de depósito o recordatorio reforzado.
3. **Ingreso por barbero** con ticket promedio, mix servicios/productos y propina: rendimiento real, insumo directo de comisiones y de decisiones de agenda.
4. **Retención/recurrencia de clientes:** LTV, días entre visitas, % de fidelizados activos y saldo de puntos: salud del CRM y efectividad del programa de fidelización.
5. **Error monitoring + alertas de plata** (Sentry o similar): hoy solo hay `console`/`errorPublico`. Capturar cobros fallidos, cajas descuadradas y 5xx con alertas es el mayor salto de readiness de producción.

## Resumen (≤12 líneas)
8/8 fixes aplicados en 5 commits (`810f2a6` plata 1-3, `377e2df` notif 4-5, `5acc09f` cota 6,
`104050a` CI 7, `89beedc` health 8). Plata: cierre de caja unificado con guard de idempotencia,
uso de cupón reservado atómicamente antes del cobro, y token de idempotencia para la venta rápida.
Notif: push por upsert(endpoint), reminder_sent reseteado al reagendar, y cota de 2 días en la vista
de cupo libre. Tooling: check-*.ts enchufados al CI (npm test, Node 24) y /api/health para uptime.
La matemática de plata queda con el server como fuente de verdad (funciones puras testeadas sin
cambios); los efectos secundarios siguen fire-and-forget. `tsc` + `build` + `npm test` limpios.
Migraciones 0021/0022/0023 escritas y NO ejecutadas. Pendiente del dueño: cargar 3 secrets VAPID en
GitHub Actions (o check-push falla el CI) y evaluar las 5 métricas de negocio propuestas.
