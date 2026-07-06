# n8n — Email de confirmación de reserva (+ push) — workflow a crear

> Deliverable del Bloque 3 (spec/notifs). En esta máquina no hay API key de n8n,
> así que el workflow se crea a mano en la instancia (n8n de FourG) siguiendo esto.
> Los secretos (service_role, PUSH_CRON_SECRET) NO están acá: viven en n8n /
> .env.local / Vercel.

## Prerequisitos

1. **Migración `supabase/migrations/0017_notifs.sql` aplicada** (todavía NO se
   ejecutó): crea `reservas.confirm_sent`, la vista `v_confirmaciones_pendientes`
   y re-versiona `v_recordatorios_pendientes`; ambas vistas exponen
   `cliente_ref` (última columna) justamente para el nodo de push.
2. Deploy de la ruta `POST /api/push` en producción (este branch) con
   `PUSH_CRON_SECRET` seteado en Vercel.
3. Credenciales ya existentes en n8n: Gmail `fgs` (gmailOAuth2) y el
   service_role de Supabase embebido en los HTTP nodes (mismo patrón que los
   workflows de recordatorio y cupo libre).

## Workflow nuevo: "✅ confirmación de reserva"

Patrón idéntico a los 2 workflows existentes (vista pendientes → Gmail → PATCH
del flag), con un nodo extra de push al final.

| # | Nodo | Config |
|---|------|--------|
| 1 | **Schedule Trigger** | Cron cada **5 min** |
| 2 | **HTTP Request** (GET pendientes) | `GET {SUPABASE_URL}/rest/v1/v_confirmaciones_pendientes?select=*` — headers `apikey: {SERVICE_ROLE}` y `Authorization: Bearer {SERVICE_ROLE}` |
| 3 | **Split Out** | Una ejecución por fila (mismo split que usa el workflow de cupo libre) |
| 4 | **Gmail** (cred `fgs`) | `To: {{ $json.email }}` — asunto: `¡Tu reserva en Barbas & Bigotes está confirmada!` — cuerpo abajo |
| 5 | **HTTP Request** (PATCH flag) | `PATCH {SUPABASE_URL}/rest/v1/reservas?id=eq.{{ $json.reserva_id }}` — mismos headers + `Content-Type: application/json` y `Prefer: return=minimal` — body `{"confirm_sent": true}` |
| 6 | **HTTP Request** (push) | `POST https://barbasybigotes.com/api/push` — header `x-push-secret: {PUSH_CRON_SECRET}` — body abajo |

Orden 4 → 5 → 6: primero el email, después se marca `confirm_sent` (así un
fallo de Gmail reintenta en el próximo ciclo) y por último el push (si el push
falla, NO se repite el email: el flag ya quedó en true).

### Fecha/hora en Bogotá (expresión n8n, sirve para el email y el push)

```
{{ new Date($json.inicio).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) }}
```

(n8n corre en UTC: nunca formatear `inicio` sin `timeZone`.)

### Cuerpo del email (voseo, mismo tono que el recordatorio)

```
Hola {{ $json.cliente }}:

¡Tu reserva en Barbas & Bigotes está confirmada! ✂️

Servicio: {{ $json.servicio }}
Barbero: {{ $json.barbero }}
Fecha: <expresión de fecha Bogotá de arriba>

Podés ver, reagendar o cancelar tu cita en https://barbasybigotes.com/cuenta

¡Te esperamos!
Barbas & Bigotes
```

(`barbero` / `servicio` pueden venir null — la vista usa left join; cubrilo con
`{{ $json.barbero ?? 'tu barbero' }}` y `{{ $json.servicio ?? 'tu servicio' }}`.)

### Body del nodo push (JSON)

```json
{
  "clienteRef": "={{ $json.cliente_ref }}",
  "title": "¡Tu reserva está confirmada! ✂️",
  "body": "={{ ($json.servicio ?? 'Tu cita') + ' — ' + <expresión de fecha Bogotá> }}",
  "url": "/cuenta"
}
```

La vista **sí** expone `cliente_ref` (se agregó en 0017 exactamente para esto).
La ruta responde `{ "ok": true }`; 401 = secreto mal configurado, 400 = body
inválido.

## Modificaciones a los 2 workflows existentes

### 1. "🔔 recordatorios de cita" (`x8B5l6NbG2supIbH`)

Agregar **al final** (después del PATCH `reminder_sent=true`) el mismo nodo
HTTP POST `https://barbasybigotes.com/api/push` con header `x-push-secret` y
body:

```json
{
  "clienteRef": "={{ $json.cliente_ref }}",
  "title": "Recordatorio de tu cita 🔔",
  "body": "={{ ($json.servicio ?? 'Tu cita') + ' — ' + <expresión de fecha Bogotá> }}",
  "url": "/cuenta"
}
```

**Requiere 0017 aplicada**: la definición vieja de `v_recordatorios_pendientes`
(la que hoy vive en la nube) no expone `cliente_ref`; la versión de 0017 sí.

### 2. "🔔 cupo libre (lista de espera)" (`Psk61KioW7QM0tdA`)

Mismo nodo HTTP POST al final (título sugerido: `¡Se liberó un cupo! 🎉`, body
con el servicio/barbero de la espera, url `/reservar`). **PENDIENTE — no
cablearlo todavía**: la vista `v_avisos_cola_pendientes` (0014) no expone
`cliente_ref` y 0017 deliberadamente NO la toca. Queda para una migración
futura (agregar `le.cliente_ref` como última columna de esa vista) antes de
poder disparar este push.

## Checklist de verificación (al crear el workflow)

- [ ] 0017 aplicada (existe `v_confirmaciones_pendientes` con `cliente_ref`).
- [ ] GET a la vista devuelve filas solo con service_role (anon → vacío/401).
- [ ] Email de prueba llega con fecha en hora de Bogotá.
- [ ] Tras el ciclo, `confirm_sent=true` y la fila desaparece de la vista.
- [ ] POST /api/push con el secreto responde `{ "ok": true }` (y sin secreto, 401).
