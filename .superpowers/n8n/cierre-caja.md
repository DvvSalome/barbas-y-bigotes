# n8n — Email de cierre de caja al dueño — workflow a crear

> Deliverable del Bloque 9 (spec/caja-auto). En esta máquina no hay API key de
> n8n, así que el workflow se crea a mano en la instancia (n8n de FourG)
> siguiendo esto. Los secretos (service_role) NO están acá: viven en n8n.
>
> Principio del producto: **el dueño no opera; mira.** La caja se abre sola con
> la primera venta del día y la cierra el barbero de la sede. Este workflow le
> manda el resumen del cierre por email para que ni tenga que abrir la app.

## Prerequisitos

1. **Migración `supabase/migrations/0020_caja_auto.sql` aplicada** (todavía NO se
   ejecutó): agrega `caja_sesiones.cerrada_por`, `auto_abierta`, `aviso_sent` y
   crea la vista `v_cierres_caja_pendientes` (security_invoker, solo service_role).
2. Credenciales ya existentes en n8n: Gmail `fgs` (gmailOAuth2) y el service_role
   de Supabase embebido en los HTTP nodes (mismo patrón que los workflows de
   recordatorio, cupo libre y confirmación de reserva).
3. **El email del dueño se configura en el nodo Gmail (campo `To`), NO está en el
   repo.** Ponelo fijo ahí (ej. `dueno@barbasybigotes.com`).

## Workflow nuevo: "💰 cierre de caja"

Patrón idéntico a los workflows existentes (vista pendientes → Gmail → PATCH del
flag).

| # | Nodo | Config |
|---|------|--------|
| 1 | **Schedule Trigger** | Cron cada **5 min** |
| 2 | **HTTP Request** (GET pendientes) | `GET {SUPABASE_URL}/rest/v1/v_cierres_caja_pendientes?select=*` — headers `apikey: {SERVICE_ROLE}` y `Authorization: Bearer {SERVICE_ROLE}` |
| 3 | **Split Out** | Una ejecución por fila (mismo split que el workflow de cupo libre) |
| 4 | **Gmail** (cred `fgs`) | `To:` = **email del dueño** (fijo en el nodo) — asunto y cuerpo abajo |
| 5 | **HTTP Request** (PATCH flag) | `PATCH {SUPABASE_URL}/rest/v1/caja_sesiones?id=eq.{{ $json.sesion_id }}` — mismos headers + `Content-Type: application/json` y `Prefer: return=minimal` — body `{"aviso_sent": true}` |

Orden 4 → 5: primero el email, después se marca `aviso_sent` (así un fallo de
Gmail reintenta en el próximo ciclo; la vista solo trae `aviso_sent = false` de
los últimos 2 días).

### Fecha en Bogotá (expresión n8n, para el asunto)

```
{{ new Date($json.cerrada_en).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }) }}
```

(n8n corre en UTC: nunca formatear `cerrada_en` sin `timeZone`.)

### Desglose por medio (expresión n8n, para el cuerpo)

`totales` es el jsonb `{ slug: { total, propina } }`. Para listarlo:

```
{{ Object.entries($json.totales || {}).map(([m, t]) => `  ${m}: $${(t.total||0).toLocaleString('es-CO')}` + ((t.propina||0) ? ` (+$${t.propina.toLocaleString('es-CO')} propina)` : '')).join('\n') }}
```

### Asunto

```
Cierre de caja · {{ $json.sede }} · <expresión de fecha Bogotá de arriba>
```

### Cuerpo del email (voseo)

```
Se cerró la caja de {{ $json.sede }}.

Total del día: $ suma de los totales de {{ $json.totales }}
Desglose por medio:
<expresión de desglose de arriba>

Efectivo esperado en el cajón: $ ({{ $json.total_efectivo }} + propina en efectivo)
Efectivo contado: $ {{ $json.efectivo_contado }}
Diferencia: $ {{ $json.diferencia }}   ({{ ($json.diferencia||0) === 0 ? 'cuadra exacto' : (($json.diferencia||0) > 0 ? 'sobra' : 'falta') }})

Gastos del turno: $ {{ $json.total_gastos }}
Atenciones cobradas: {{ $json.citas }}
Cerró: {{ $json.cerrada_por_email }}
{{ $json.nota ? 'Nota: ' + $json.nota : '' }}

— Barbas & Bigotes (aviso automático; no hace falta responder)
```

La vista expone: `sesion_id`, `sede_id`, `sede`, `cerrada_en`, `total_efectivo`,
`total_datafono`, `totales` (jsonb), `total_gastos`, `citas`, `efectivo_contado`,
`diferencia`, `nota`, `cerrada_por_email` (coalesce a `'staff'` si el que cerró
no tiene email en `profiles`).

> Nota de plata: `diferencia = efectivo_contado − (efectivo + propina en
> efectivo)`. Positiva = sobra en el cajón; negativa = falta. Es el mismo cálculo
> que hace el cierre del barbero (`cerrarCajaSede`) y el admin (`cerrarCaja`).
