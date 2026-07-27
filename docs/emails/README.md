# Plantillas de correo

Las 4 plantillas HTML que le llegan al cliente. Diseño: `.superpowers/design/correos.md`
(§2 a §5 del prototipo). La 5ª del prototipo, cierre de caja para el dueño, todavía
no está cableada.

| Archivo | Asunto | Workflow n8n | Cron | Datos |
|---|---|---|---|---|
| `confirmacion.html` | ¡Tu reserva en Barbas & Bigotes está confirmada! | `JJiAjBoc9NBQbky1` | cada 1 min | vista `v_confirmaciones_pendientes` |
| `recordatorio.html` | Recordatorio de tu cita 🔔 | `x8B5l6NbG2supIbH` | 9:15, 13:15, 17:15, 20:15 | RPC `tomar_recordatorios_pendientes()` |
| `cupo.html` | ¡Se liberó un cupo! 🎉 | `Psk61KioW7QM0tdA` | cada 10 min | vista `v_avisos_cola_pendientes` |
| `resena.html` | ¿Cómo te quedó? Dejanos tu reseña ✂️ | `3Y5sa4e6ve1PuwpK` | cada 30 min | RPC `tomar_resenas_pendientes()` |

**`options.appendAttribution: false` en los 4 nodos de correo.** Por defecto n8n
mete "This email was sent automatically with n8n" al pie. Son correos de cara al
cliente de la barbería: si se crea un workflow nuevo, apagarlo también.

## Esto es una copia, no la fuente

Lo que se ejecuta vive dentro de n8n, en el nodo `emailSend` de cada workflow.
Estos archivos son la copia versionada para no depender de que esa instancia siga
viva. **Si editás una, editá la otra.** `resena.html` es la excepción: esa nació
acá y se subió a n8n desde el repo.

## Trampas de n8n (aprendidas a los golpes)

- Las `{{ }}` son expresiones de n8n. **No pongas llaves dobles ni en los comentarios
  HTML**, las evalúa igual y revienta el envío.
- Backticks anidados dentro de `{{ }}` rompen el parser. Si necesitás armar HTML en
  un bucle, hacelo en el nodo Code y pasalo como una variable más.
- Los nodos "marcar enviado" que referencian `$('otro nodo').item` **después** de un
  `emailSend` pueden devolver 2xx sin marcar nada. Eso provocó que el correo de cupo
  se reenviara cada 10 minutos al mismo cliente. Preferí filtros por estado, o que la
  base marque sola (lo que hace el RPC de reseñas).
- Tema oscuro: hace falta el `<meta name="color-scheme" content="dark">` **y**
  `bgcolor` en los `td`, o Gmail en modo claro invierte los fondos.

## Por qué no está el JSON de los workflows

Porque los nodos HTTP llevan la `service_role` de Supabase embebida en las cabeceras.
Exportar el workflow completo metería esa llave al repo. Si necesitás recrear uno,
duplicá otro desde la interfaz de n8n: así hereda las credenciales sin que nadie las
tenga que copiar y pegar.
