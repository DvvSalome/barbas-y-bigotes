# Google Calendar · la agenda de cada barbero

Desde el 9-sep-2026 cada barbero tiene un calendario de Google que la app llena sola:
cada cita nueva, cambio de hora, cambio de barbero o servicio, cancelación o borrado se
refleja en minutos. El barbero lo ve en su Google Calendar del celular, con los
recordatorios que él configure; el dueño puede ver todas las agendas desde su Gmail.

## Cómo está armado

```
reservas ──trigger──▶ calendar_cola ──RPC toma-y-marca──▶ /api/calendar/sync ──▶ Google Calendar API
   (0073)               (una fila por cambio)              (n8n: al reservar + cada 5 min)
```

- **La base decide qué cambió.** `trg_encolar_calendar` encola cualquier alta/cambio/borrado
  de `reservas`; ningún camino de escritura (wizard, admin, mostrador, portal, backfill) sabe
  de Google. `tomar_calendar_cola(p_limite)` entrega las filas con todo lo necesario (hora,
  cliente, teléfono, nota, servicio, sede, barbero, evento previo) y las marca tomadas.
- **`src/lib/calendar-sync.ts`** traduce: crea/corrige el evento (`reserva_calendar` guarda
  el `event_id`), lo muda de agenda si cambió el barbero, lo borra si la cita se canceló o
  se borró, y omite las citas "cualquier barbero" hasta que se asignen. Un error suelta la
  fila para reintentar; a los 6 intentos queda con su error a la vista en Equipo.
- **`src/lib/google-calendar.ts`**: cliente mínimo con `fetch` (crear calendario, compartir,
  evento, borrar). Colores: amarillo pendiente, verde completada, rojo no vino.
- **Quién dispara**: n8n (workflow `JJiAjBoc9NBQbky1`, nodo "Sincronizar Google Calendar")
  llama a `POST /api/calendar/sync` con `x-push-secret` desde el webhook de reserva (al
  instante) y desde el cron de 5 min (cambios y cancelaciones). También el botón
  "Sincronizar ahora" del admin.

## Identidad SIN llaves (Workload Identity Federation)

El proyecto de Google `barbas-y-bigotes` no tiene organización y Google le impone
`iam.disableServiceAccountKeyCreation`: **no se pueden crear llaves** de cuenta de servicio
(ni levantar la política sin organización). Por eso la app no guarda ningún secreto de Google:

1. Vercel le da a cada función un **token OIDC** (`getVercelOidcToken()` de `@vercel/functions`).
2. La app lo cambia en **STS** (`sts.googleapis.com/v1/token`) por una credencial federada,
   contra el proveedor `//iam.googleapis.com/projects/174041817479/locations/global/workloadIdentityPools/vercel/providers/vercel`
   (issuer `https://oidc.vercel.com/fourgsolutions-fgs-projects`, audiencia
   `https://vercel.com/fourgsolutions-fgs-projects`, condición `assertion.project == 'barbas-y-bigotes'`).
3. Con ella pide un access token de la cuenta de servicio
   **`barbas-calendar@barbas-y-bigotes.iam.gserviceaccount.com`** (`generateAccessToken`, scope
   calendar). La cuenta de servicio es la dueña de todos los calendarios.

Variables (no secretas) en Vercel y `.env.local`: `GOOGLE_CALENDAR_SA`, `GOOGLE_WIF_AUDIENCE`.
Si algún día se permiten llaves, `GOOGLE_CALENDAR_SA_JSON` (base64) sigue soportada.

Para probar desde la máquina de FourG sin llaves: `gcloud auth print-access-token
--impersonate-service-account=barbas-calendar@…` (four4gsolutions tiene
`roles/iam.serviceAccountTokenCreator` sobre la cuenta). E2E: `scratchpad/e2e-calendar.mjs`
(cita QA → evento → mover → cancelar → borrar; 11/11 el 9-sep).

## Qué hace el dueño (Admin → Equipo → Google Calendar)

1. **Crear las agendas**: una por barbero activo; encola y sincroniza las citas futuras.
2. **Compartir con los barberos**: usa el correo de avisos de cada uno (Equipo → Correo de
   avisos). A cada barbero le llega un correo de Google "compartieron un calendario contigo";
   lo acepta y la agenda aparece en su Google Calendar. Ahí, en la configuración de esa
   agenda, activa las notificaciones (p. ej. 30 min antes).
3. **Ver todas las agendas**: poner su Gmail en "Ver todas las agendas desde mi Google
   Calendar"; recibe una invitación por barbero y ve todo junto.

Ojo con los correos que **no son de Google** (Outlook/Hotmail): Google solo comparte con
cuentas de Google. Ese barbero puede crear una cuenta de Google con ese mismo correo
("usar mi dirección actual") o dar un Gmail y cambiarlo en Correo de avisos.

## Límites y deuda

- Es de **un solo sentido**: lo que el barbero anote a mano en Google no bloquea cupos en la
  app (nivel 3, +1 día: push notifications de Calendar → `barbero_ausencias`).
- La descripción del evento lleva teléfono y nota del cliente: datos personales en Google.
  Cubierto por la política de privacidad (encargados del tratamiento); al eliminar la cuenta
  del cliente (0072) sus citas futuras se cancelan y el evento se borra.
- Si dos vueltas crean el calendario de un barbero a la vez puede quedar uno huérfano y vacío
  en la cuenta de servicio (comentado en `calendarioDeBarbero`).
