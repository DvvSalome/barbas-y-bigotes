# Barbas & Bigotes en Google Play (TWA)

**Qué es una TWA.** *Trusted Web Activity*: una app Android real (un `.aab` que se sube a
Play) cuyo contenido es nuestro sitio, mostrado por Chrome a pantalla completa, sin barra
de direcciones. No es una copia del sitio dentro de la app: **es el sitio**. Por eso cada
deploy a barbasybigotes.com actualiza la app al instante, sin volver a pasar por revisión.
La "confianza" (trusted) es un archivo en nuestro dominio,
`/.well-known/assetlinks.json`, que declara que la app firmada con cierta huella es
nuestra; sin él Chrome muestra la barra del navegador.

Cuenta de Play: **personal**, perfil `adriangar713@gmail.com` (aprobada 8-sep-2026).
Consecuencia: antes de publicar en producción, Google exige una **prueba cerrada con al
menos 12 testers durante 14 días seguidos**.

## Estado

| Pieza | Estado |
|---|---|
| PWA lista (manifest, íconos 192/512/maskable, standalone, es-CO) | ✅ ya estaba |
| `public/.well-known/assetlinks.json` | ✅ publicado con la huella de la llave de subida; **falta la de firma de Play** (paso 4) |
| Página de eliminación de cuenta `/cuenta/eliminar` | ✅ (Play la exige por el login con Google) |
| Proyecto TWA `twa/twa-manifest.json` (Bubblewrap) | ✅ configurado, `com.barbasybigotes.app` · **compilado 9-sep: `twa/app-release-bundle.aab` (2,5 MB) y `twa/app-release-signed.apk`**, firmados con la llave de subida |
| Bubblewrap CLI instalado en la máquina de FourG | ✅ (`npm i -g @bubblewrap/cli`) |
| Android SDK + licencia | ✅ instalado en `~/.bubblewrap/android_sdk` (licencia aceptada 9-sep con permiso de FourG) |
| Llave de subida (keystore) | ✅ `twa/android.keystore` (alias `barbasybigotes`, 9-sep). Huella `32:E8:F2:E8:9A:4E:53:64:33:8C:89:0F:90:6B:E2:AF:AF:0A:AA:6F:BB:26:2D:DB:65:BC:8D:81:3A:99:D4:07`. Guardar copia + contraseña en el gestor |
| Gráfico destacado 1024×500 | ✅ `docs/play-store/grafico-1024x500.png` |
| Capturas de teléfono | ✅ `public/screenshots/home-movil.png`, `reservar-movil.png` (500×844; mínimo 320 px, relación ≤ 2:1 ✓). Mejor sacar 4–6 reales de la app instalada antes de publicar. |
| Ficha (textos) | ✅ abajo |
| Seguridad de los datos (respuestas) | ✅ abajo |

## Pasos

### 1. Llave de subida (FourG, una sola vez)

```bash
cd "D:/TRABAJOS PROPIOS/projects/barbas-y-bigotes/twa"
keytool -genkeypair -v -keystore android.keystore -alias barbasybigotes -keyalg RSA -keysize 2048 -validity 10000
```

Pide una contraseña (la misma para el almacén y la llave, para no enredarse) y datos del
titular (nombre: Barbas & Bigotes Barbershop, ciudad: Barranquilla, país: CO). **Guardar
la contraseña en el gestor de contraseñas.** Con Play App Signing, si esta llave se pierde
Google permite registrar una nueva, así que no es catastrófico, pero sí una gestión.

### 2. Generar y compilar (así quedó funcionando el 9-sep)

Bubblewrap es interactivo (inquirer) y no acepta respuestas por tubería, así que la
configuración se dejó escrita a mano en `~/.bubblewrap/config.json`:

```json
{ "jdkPath": "C:/jdk17", "androidSdkPath": "C:/Users/jhanf/.bubblewrap/android_sdk" }
```

`C:/jdk17` es un *junction* (enlace de carpeta, sin admin) al Temurin 17 de `C:/Program Files/Eclipse Adoptium/`:
Bubblewrap no entrecomilla la ruta del JDK al firmar y el espacio de "Program Files" rompe apksigner
(`New-Item -ItemType Junction -Path C:/jdk17 -Target <ruta del JDK>` en PowerShell).

El Android SDK se instaló a mano en esa carpeta (cmdline-tools 11076708 → `cmdline-tools/latest`
**y una copia en `tools/`**, porque Bubblewrap busca `tools/bin/sdkmanager.bat`), con
`yes | sdkmanager --licenses` (licencia de Google aceptada con permiso de FourG) y
`platform-tools`, `platforms;android-34`, `build-tools;34.0.0`.

```bash
cd "D:/TRABAJOS PROPIOS/projects/barbas-y-bigotes/twa"
export JAVA_HOME="C:/jdk17"
export BUBBLEWRAP_KEYSTORE_PASSWORD="$(cat /ruta/segura/keystore-pass.txt)"
export BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"
bubblewrap update --skipVersionUpgrade          # regenera el proyecto desde twa-manifest.json
env -u NoDefaultCurrentDirectoryInExePath bubblewrap build --skipPwaValidation
```

- `--skipVersionUpgrade`: sin eso `update` pregunta versionName/versionCode (prompt interactivo).
  Para una versión nueva: editar `appVersionName`/`appVersionCode` en `twa-manifest.json`.
- `--skipPwaValidation`: evita la consulta a PageSpeed y su prompt.
- Las contraseñas van por variables de entorno, nunca en el comando.
- Si sale **"gradlew.bat no se reconoce"**: el entorno tiene `NoDefaultCurrentDirectoryInExePath=1`
  y `cmd` no busca en la carpeta actual; de ahí el `env -u`.
- En `twa-manifest.json` los atajos usan `shortName` (camelCase), no `short_name`.

Salida: `app-release-bundle.aab` (para Play) y `app-release-signed.apk` (para instalar a mano y
probar; con la huella de la llave de subida ya en assetlinks abre sin barra de navegador).

### 3. Crear la app en Play Console (el dueño, con FourG al lado)

1. *Crear app*: nombre **Barbas & Bigotes**, idioma es-419 (o es-CO), app gratuita.
2. *Configuración de la app* → cuestionario: política de privacidad
   `https://barbasybigotes.com/privacidad`; acceso a la app: "todo accesible sin
   credenciales especiales" (la reserva es pública; para el portal, cuenta de Google
   propia); anuncios: no; clasificación de contenido: cuestionario "Utilidades /
   Productividad" → Todos; público objetivo: 18+ (no dirigida a niños); app de noticias:
   no; COVID: no; **Seguridad de los datos**: ver abajo; apps del gobierno: no; financiera: no.
3. *Ficha de la tienda*: textos e imágenes de abajo.
4. *Pruebas → Prueba cerrada*: crear la versión, subir el `.aab`, agregar una lista de
   testers con **12+ correos de Gmail** (los 6 barberos, el dueño, FourG, familia y clientes
   de confianza), copiar el enlace de participación y mandárselo. **Cada tester debe aceptar e
   instalar; los 14 días cuentan desde que hay 12 activos.**
5. Cuando Play habilite *Producción*, solicitar acceso, responder el formulario y publicar.

### 4. La huella (assetlinks) — apenas exista la app en Play

Play Console → *Configuración* → *Integridad de la app* → *Firma de apps* → copiar la
**huella SHA-256 del certificado de firma de la app** (la de Google, no la de subida).
Pegarla en `public/.well-known/assetlinks.json`:

```json
"sha256_cert_fingerprints": ["AA:BB:...:ZZ"]
```

Agregar también la huella de la llave de subida (para probar el `.apk` local):

```bash
keytool -list -v -keystore twa/android.keystore -alias barbasybigotes | grep SHA256
```

Push a `main` → deploy → comprobar en
`https://barbasybigotes.com/.well-known/assetlinks.json` y con el verificador:
`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://barbasybigotes.com&relation=delegate_permission/common.handle_all_urls`.
Sin este paso la app abre **con barra de navegador**.

### 5. Subir por API (opcional, para que FourG suba versiones sin entrar a la consola)

Google Play Developer API (Android Publisher v3): Play Console → *Configuración* → *Acceso a
la API* → vincular proyecto de Google Cloud → crear cuenta de servicio → otorgarle en Play
el permiso "Administrar versiones de prueba" → guardar el JSON en el scratchpad (no en el
repo, no por chat). No existe MCP de Play Console; la API no crea la app ni responde
cuestionarios: eso es consola.

## Ficha de la tienda

**Nombre (30):** `Barbas & Bigotes`

**Descripción breve (80):** `Reservá tu corte en Barranquilla: turno, barbero y hora en un minuto.`

**Descripción completa (≤ 4000):**

```
Tu barbería de confianza en Barranquilla, ahora en tu bolsillo.

RESERVÁ EN UN MINUTO
Elegí la sede (Parque Venezuela o Plaza de la Paz), el servicio, tu barbero y la hora. Sin
llamadas, sin filas, sin esperar respuesta.

TUS CITAS, A LA MANO
Mirá tus próximas citas, cambiá la hora o cancelá hasta 2 horas antes. Te avisamos por
correo y con una notificación cuando falte poco.

SIN CUPO? ANOTATE EN LA LISTA
Si tu barbero está lleno, entrá en la lista de espera: te avisamos apenas se libere un turno.

TARJETA DE CORTES
Cada visita suma. Seguí tu tarjeta de fidelidad y tus beneficios desde la app.

TU BARBERO, TU ESTILO
Conocé al equipo, sus horarios y sus especialidades. Volvé con el que te dejó como querías.

Barbas & Bigotes Barbershop · Barranquilla, Colombia.
Cl. 88 #44-10 Loc 4 (Parque Venezuela) · Cra. 45 #50-168 (Plaza de la Paz).
```

**Categoría:** Belleza. **Etiquetas:** barbería, reservas, citas, corte de pelo.
**Correo de contacto:** reservas@barbasybigotes.com. **Sitio:** https://barbasybigotes.com.
**Política de privacidad:** https://barbasybigotes.com/privacidad.
**Eliminación de cuenta:** https://barbasybigotes.com/cuenta/eliminar.

## Seguridad de los datos (respuestas para el formulario)

- ¿Recopila o comparte datos del usuario? **Sí, recopila. No comparte** con terceros con
  fines propios (Supabase y Vercel son encargados del tratamiento; Google, el proveedor
  de inicio de sesión).
- ¿Cifrado en tránsito? **Sí** (HTTPS). ¿Se pueden pedir la eliminación? **Sí**
  (`/cuenta/eliminar`).
- Datos y para qué:
  - **Nombre**, **correo**, **número de teléfono** → funciones de la app (reservar, avisar)
    y gestión de la cuenta. Obligatorios para reservar. No se comparten.
  - **Historial de compras** (servicios pagados en la barbería) → funciones de la app
    (tarjeta de fidelidad, historial) y analítica interna del negocio.
  - **Identificadores de dispositivo**: no. **Ubicación**: no. **Fotos**: no.
    **Contactos**: no. **Mensajes**: no.
- Datos recopilados de forma efímera: ninguno.

## Qué falta que decida el dueño

- Correos de los 12 testers.
- Si quiere cuenta de Google para `reservas@barbasybigotes.com` con el logo (para que Gmail
  muestre la foto del remitente en los correos).
