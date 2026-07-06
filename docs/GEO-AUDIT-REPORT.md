# GEO Audit Report: Barbas & Bigotes Barbershop

**Fecha:** 2026-07-06 · **URL:** https://barbasybigotes.com · **Tipo:** Negocio local (barbería, 2 sedes) · **Páginas:** 4

## Score general: 40/100 (Poor)

| Dimensión | Score | Peso |
|---|---|---|
| AI Citability | 58 | 25% |
| Brand Authority | 12 | 20% |
| Content E-E-A-T | 41 | 20% |
| Technical GEO | 77 | 15% |
| Schema | 5 | 10% |
| Platform Optimization | 30 | 10% |

Contexto clave: dominio con 1 día de vida, 0 páginas indexadas en Google/Bing, colisión de marca (.co/.es/IG ajeno), 2 fichas de Google Business ya existentes (5.0★ y 3.7★) sin conectar al dominio.

---

## CITABILIDAD · 37/100

Citabilidad a medias, autoridad de marca casi nula. El sitio tiene la mejor materia prima citables posible para una barbería local — tabla de servicios con precios y duraciones (Corte desde $30.000/30min, Corte y barba $40.000/1h, Keratina $90.000) y bloque NAP+horarios de ambas sedes — pero la desperdicia: no existe ni un bloque pregunta-respuesta (nada responde "¿cuánto cuesta un corte en Barranquilla?"), /barberos es un esqueleto con placeholders "Libre Foto", /reservar depende de JS, y los contadores del hero renderizan literalmente ">0</span>" en el HTML estático, así que un crawler de IA sin JavaScript lee "0 Sedes en Barranquilla, 0 Barberos expertos, 0 Servicios y combos" — datos falsos que contradicen el propio texto de la página. En autoridad de marca la situación es crítica: buscar "Barbas y Bigotes barbería Barranquilla" NO devuelve el negocio — los resultados los capturan competidores (Don Bigotes Barberías con 16K seguidores, La Barba VIP) y directorios donde la marca no está registrada. El único activo propio es Instagram @barbasybigotes.baq (existe e indexa en Google); no hay Facebook/TikTok/YouTube propios ni menciones locales. La colisión de nombre agrava todo: @barbasybigotes (IG ajeno, 1.2K followers), barbasybigotes.co (tienda de productos), .es (España), páginas mexicanas homónimas y un pet shop. Encima hay NAP inconsistente: el sitio publica "Cra. 45 #50-168" para Plaza de la Paz mientras la ficha de Google dice "Cra. 45 #53-150" — las IAs cruzan con Maps y ese conflicto destruye confianza de entidad. Hoy una IA preguntada por "Barbas y Bigotes" responde con la entidad equivocada o con datos falsos del propio sitio. Score citabilidad ~58, brand authority ~12 → dimensión combinada 37/100 (Poor).

### Hallazgos

#### 🔴 Crítico · Entidad de marca inexistente y contaminada por homónimos: las IAs responden con el negocio equivocado

Búsquedas de "Barbas y Bigotes barbería Barranquilla" no devuelven el negocio en ningún resultado — capturan la consulta competidores directos (Don Bigotes Barberías, 16K seguidores IG y 8 sedes; La Barba VIP) y directorios locales (AgendaPro, infoisinfo, starofservice) donde la marca no existe. Simultáneamente el nombre está tomado por entidades ajenas: IG @barbasybigotes (1.2K followers, ajeno), barbasybigotes.co (tienda de productos de barba en Colombia — máxima confusión temática), barbasybigotes.es (España), un blog WordPress, páginas de Facebook mexicanas homónimas (Tijuana, Monterrey) y un pet shop. Con dominio comprado ayer y cero páginas indexadas, un LLM que responda hoy sobre "Barbas y Bigotes" citará la tienda .co o ignorará al negocio. No hay ninguna señal machine-readable que conecte dominio ↔ fichas de Google ↔ Instagram como una sola entidad.

**Fix:** Construir el grafo de entidad de forma explícita: (1) JSON-LD tipo Barbershop/LocalBusiness en cada página con name="Barbas & Bigotes Barbershop" + sameAs apuntando a https://instagram.com/barbasybigotes.baq, ambas fichas de Google (placeids ChIJeQo0-QMt9I4R-X3dE0wvF6I y ChIJvbUwJZYt9I4R8KamOLTW3-g) y wa.me/573006734799; (2) agregar barbasybigotes.com como sitio web en ambas fichas de Google Business Profile y en la bio de IG (loop de confirmación bidireccional); (3) usar siempre el nombre completo con calificador geográfico "Barbas & Bigotes Barbershop Barranquilla" en titles y contenido para desambiguar de .co/.es; (4) registrar el negocio en los directorios locales donde hoy sale la competencia (AgendaPro, infoisinfo, starofservice, todoservy).

#### 🟠 Alto · Los contadores del hero renderizan "0" en el HTML estático: crawlers de IA leen datos falsos

Verificado en el HTML crudo servido por SSR: tres ocurrencias de >0</span> junto a los labels "Sedes en Barranquilla", "Barberos expertos" y "Servicios y combos". Los contadores se animan por JavaScript desde 0, pero GPTBot, ClaudeBot y la mayoría de crawlers de IA no ejecutan JS: leen literalmente "0 Sedes en Barranquilla · 0 Barberos expertos · 0 Servicios y combos", lo cual contradice el propio contenido de la página ("dos sedes", "6 especialistas") y puede terminar citado como hecho.

**Fix:** Renderizar los valores finales en el server (2 sedes, 6 barberos, N servicios) y animar el count-up desde el valor real con JS/CSS progresivo (el número correcto queda en el DOM inicial y la animación es puro enhancement). Es un cambio de minutos en el componente de stats.

#### 🟠 Alto · NAP inconsistente: la dirección de Plaza de la Paz del sitio no coincide con la ficha de Google

El sitio publica "Cra. 45 #50-168, Frente a la Plaza de la Paz" (verificado en el HTML) mientras la ficha de Google Business dice "Cra. 45 #53-150". Además los nombres difieren: el sitio llama a ambas sedes "Barbas & Bigotes Barbershop" mientras en Google la sede Plaza de la Paz se llama "BARBAS Y BIGOTES BARBERCLUB". Las IAs de búsqueda (Perplexity, ChatGPT search, Gemini) cruzan el sitio con Google Maps: un conflicto de dirección y de nombre reduce la confianza en toda la entidad y puede hacer que la IA dé una dirección errónea al usuario.

**Fix:** Unificar la dirección exacta (decidir cuál es la correcta y corregir sitio o ficha GBP para que coincidan carácter a carácter) y reflejar la distinción Barbershop/Barberclub en el sitio, o renombrar la ficha GBP si la marca unificada es la estrategia. Aplicar el mismo NAP idéntico en footer, /nosotros, /reservar y el futuro JSON-LD.

#### 🟠 Alto · Cero contenido pregunta-respuesta: ninguna query conversacional tiene respuesta directa en el sitio

No existe FAQ ni ningún bloque redactado como respuesta directa. Queries que las IAs reciben a diario — "¿cuánto cuesta un corte de pelo en Barranquilla?", "¿barbería abierta cerca de Parque Venezuela?", "¿atienden sin cita?", "¿hacen keratina para hombre?" — no tienen ningún passage citable que las responda en primera persona. Los precios existen pero están en cards de marketing, no en formato respuesta. La competencia tampoco lo hace bien, así que es una ventana abierta: el primer negocio local con respuestas directas + datos concretos se convierte en la cita por defecto.

**Fix:** Agregar una sección FAQ en la landing y en /reservar con 6-10 preguntas reales en lenguaje local, cada una respondida en 2-3 frases autocontenidas con número incluido (ej: "Un corte clásico o degradado en Barbas & Bigotes cuesta desde $30.000 COP y tarda 30 minutos. Atendemos en dos sedes en Barranquilla, con o sin reserva online."). Marcar con FAQPage JSON-LD cuando se implemente el schema.

#### 🟡 Medio · /barberos es contenido esqueleto: solo nombres y el placeholder "Libre Foto" visible a los crawlers

La página del equipo — el activo más diferenciador de una barbería — expone únicamente 6 nombres (Meyer, Jhon, Junior, Bryan García, Kevin Valencia, Abel Barbers), un badge "★ Top" y el texto placeholder "Libre Foto" que se filtra al contenido que leen las IAs. Sin bios, sin especialidades por barbero, sin años de experiencia. Score de citabilidad del bloque ~20/100. La home menciona "6 especialistas en degradados, barba, color y diseño" pero /barberos no sustancia esa afirmación.

**Fix:** Añadir 2-3 frases por barbero: especialidad concreta (degradados, diseño, color, barba), años de experiencia y sede. Reemplazar/ocultar el placeholder "Libre Foto" del texto renderizado. Esto además habilita Person schema a futuro y respuestas de IA tipo "¿quién hace los mejores degradados en Barranquilla?".

#### 🟡 Medio · /nosotros cuenta una historia sin un solo dato verificable

La página tiene la mejor prosa del sitio (esencia, historia, 4 pilares) pero cero datos anclables: sin año de fundación, sin fundador con nombre, sin cifras (clientes atendidos, años operando). Para un LLM es texto genérico indistinguible del de cualquier otra barbería — densidad estadística ~0, unicidad baja. Score del bloque ~45/100.

**Fix:** Insertar 3-4 hechos concretos: año de fundación, nombre del fundador/dueño, hito de apertura de la segunda sede, algún número real (cortes por mes, años de experiencia acumulada del equipo). Los hechos con fecha y nombre propio son lo que las IAs citan y lo que consolida la entidad.

#### 🟡 Medio · Testimonios propios no verificables mientras las reseñas reales de Google quedan invisibles (y la sede Barberclub tiene 3.7★)

La landing muestra 3 testimonios con nombre de pila (Carlos M., Andrés R., Julián P.) sin ninguna conexión verificable con reseñas reales. Mientras tanto el activo real — 5.0★ (5 reseñas) en la sede Parque Venezuela — no se menciona ni linkea, y la sede Plaza de la Paz tiene 3.7★/10 reseñas, un rating que las IAs SÍ leen desde Maps y citarán tal cual ("tiene reseñas mixtas"). El volumen total (15 reseñas entre ambas) es muy inferior al de la competencia citada por las IAs.

**Fix:** Linkear las fichas de Google desde el bloque de reseñas ("5.0★ en Google — leé las reseñas"), lanzar campaña sistemática de reseñas post-cita (QR + link directo de review en cada sede, aprovechando el flujo de /reservar que ya captura al cliente), y priorizar la recuperación del rating de Plaza de la Paz respondiendo las reseñas negativas.

#### 🟡 Medio · Presencia social propia mínima: solo Instagram, sin Facebook/TikTok/YouTube, y el handle no coincide con la marca

El único perfil social propio es @barbasybigotes.baq (existe, está indexado en Google como "Barbas & Bigotes · Barranquilla" y el footer lo linkea — es el único punto a favor). No hay página de Facebook propia, ni TikTok, ni YouTube — plataformas que los modelos de IA usan intensivamente como fuente para negocios locales, y donde "barberías en Barranquilla" ya tiene ecosistema activo de contenido (TikTok discover pages) dominado por competidores. El handle exacto @barbasybigotes pertenece a un tercero, lo que perpetúa la confusión de entidad.

**Fix:** Crear página de Facebook con NAP idéntico al sitio y a GBP (las fichas de FB alimentan a Meta AI y a los agregadores locales), abrir TikTok @barbasybigotes.baq con clips de cortes (formato de altísimo rendimiento para barberías), y añadir todos los perfiles al sameAs del JSON-LD. Mantener el sufijo .baq consistente en todas las plataformas como desambiguador.

### Quick wins

- Renderizar los contadores del hero con los valores reales en SSR (2 sedes, 6 barberos, N servicios) y animar desde el valor — hoy los crawlers de IA leen '0 sedes, 0 barberos'; fix de minutos
- Corregir la dirección de Plaza de la Paz para que coincida carácter a carácter con la ficha de Google (sitio dice 'Cra. 45 #50-168', Google dice 'Cra. 45 #53-150')
- Agregar barbasybigotes.com como sitio web en ambas fichas de Google Business Profile y en la bio de @barbasybigotes.baq — cierra el loop de entidad dominio↔Google↔Instagram sin tocar código
- Añadir un bloque FAQ en la landing con 6-8 respuestas directas de 2-3 frases con precio/horario incluido ('Un corte en Barranquilla cuesta desde $30.000 COP...')
- Quitar el placeholder 'Libre Foto' de /barberos y añadir 1 frase de especialidad por barbero
- Registrar el negocio en AgendaPro, infoisinfo y starofservice — los directorios que hoy capturan las búsquedas de 'barbería Barranquilla' y donde solo aparece la competencia
- Linkear las reseñas reales de Google (5.0★ Parque Venezuela) desde el bloque de testimonios y montar QR de reseña post-corte en ambas sedes

---

## PLATAFORMAS · 30/100

Promedio de preparación multi-plataforma: 30/100 (AI Overviews 26, ChatGPT Search 28, Perplexity 40, Gemini 31, Bing Copilot 24). El activo más valioso son las dos fichas de Google ya existentes (la de Parque Venezuela con 5.0★), pero el sitio no las aprovecha: cero JSON-LD LocalBusiness, NAP inconsistente con la ficha de Plaza de la Paz (dirección "Cra. 45 #50-168" en el sitio vs "Cra. 45 #53-150" en la ficha, y nombre "Barbershop" vs "BARBERCLUB"), y contenido sin formato pregunta-respuesta para queries locales como "mejor barbería en Barranquilla" o "barbería cerca de Plaza de la Paz". En Bing (motor de ChatGPT Search y Copilot) el negocio es invisible: cero páginas indexadas, sin IndexNow, sin Bing Places, sin panel local. Perplexity es la plataforma "menos mala" porque el sitio es SSR con NAP legible y PerplexityBot está permitido, pero la validación comunitaria es casi nula (15 reseñas totales, cero Reddit/foros) y la colisión de marca (barbasybigotes.co tienda, .es España, @barbasybigotes ajeno, pet shop homónimo) diluye la entidad en los 5 motores. Fortaleza: acceso técnico (robots allow-all a todos los crawlers IA, contenido server-rendered). Debilidad estructural: el dominio tiene 1 día, así que la única vía de citación IA a corto plazo son las fichas GBP + Bing Places, no el sitio.

### Hallazgos

#### 🔴 Crítico · NAP inconsistente entre el sitio y la ficha de Google de Plaza de la Paz

El sitio muestra 'Cra. 45 #50-168, Frente a la Plaza de la Paz' mientras la ficha Google (placeid ChIJvbUwJZYt9I4R8KamOLTW3-g) dice 'Cra. 45 #53-150'. Además el sitio llama a ambas sedes 'Barbas & Bigotes Barbershop' mientras la ficha 2 se llama 'BARBAS Y BIGOTES BARBERCLUB'. Los motores IA (Gemini, AI Overviews, Copilot) resuelven entidades locales cruzando sitio↔ficha: una dirección y un nombre distintos rompen esa consolidación y pueden hacer que el sitio y la ficha se traten como negocios diferentes. Los teléfonos de las fichas no son verificables desde fuera (comprobar que sean 300 409 7624 y 300 673 4799 respectivamente).

**Fix:** Decidir la versión canónica de dirección y nombre por sede (la de la ficha, salvo que la ficha esté mal) y unificar carácter-a-carácter en: footer del sitio, /nosotros, /reservar, JSON-LD, ficha GBP, Instagram bio y futuro Bing Places. Incluir el nombre 'Barberclub' en el sitio para la sede Plaza de la Paz.

#### 🔴 Crítico · Cero JSON-LD: sin schema LocalBusiness/BarberShop pese a tener 2 fichas de Google activas

No existe ningún structured data en el sitio. Para un negocio local con dos sedes es el vector #1 de consolidación de entidad para Gemini/Knowledge Graph, AI Overviews y Copilot: sin él, los motores no pueden vincular barbasybigotes.com con las fichas existentes ni distinguirlo de barbasybigotes.co (tienda), .es (España) y el pet shop homónimo.

**Fix:** Añadir en el layout dos nodos JSON-LD tipo BarberShop (o HairSalon): name exacto de cada ficha, address completa (streetAddress, addressLocality: Barranquilla, addressRegion: Atlántico, addressCountry: CO), telephone por sede, openingHoursSpecification (Lu-Sá 09:00-20:00), geo, hasMap apuntando a la URL de Maps con cada placeid, sameAs: [instagram.com/barbasybigotes.baq], y url: https://barbasybigotes.com. Añadir también FAQPage cuando exista la sección FAQ.

#### 🟠 Alto · Invisible en el ecosistema Bing: sin índice, sin IndexNow, sin Bing Places (afecta ChatGPT Search y Copilot a la vez)

Búsqueda directa en Bing no devuelve ningún resultado del dominio ni panel local del negocio. ChatGPT web search se alimenta del índice de Bing: aunque OAI-SearchBot está permitido en robots.txt, no hay nada que citar. No hay señal de IndexNow ni de verificación en Bing Webmaster Tools (msvalidate.01 ausente). Bing Places para el negocio: no encontrado.

**Fix:** 1) Alta en Bing Webmaster Tools con importación desde Google Search Console y envío del sitemap. 2) Habilitar IndexNow (archivo de key en la raíz; Vercel/Next lo soporta con un endpoint estático). 3) Crear Bing Places for Business importando directamente desde el perfil de Google Business (opción 'Import from Google My Business'), una ficha por sede con el NAP canónico.

#### 🟠 Alto · Sin contenido pregunta-respuesta ni página orientada a queries locales conversacionales

Los H2 del sitio son genéricos ('Dónde estamos', 'Servicios', 'Galería'). No existe ningún heading tipo pregunta, ninguna FAQ, ni respuestas directas de 40-60 palabras que AI Overviews/Gemini puedan extraer para 'mejor barbería en Barranquilla', 'barbería cerca de Plaza de la Paz' o 'barbería en Parque Venezuela'. Tampoco hay página por sede (una URL por ubicación es el patrón que mejor citan los motores para 'cerca de X').

**Fix:** Crear una página por sede (/sedes/parque-venezuela y /sedes/plaza-de-la-paz) con H1 geo-específico, respuesta directa inicial ('Barbas & Bigotes es una barbería en [zona], Barranquilla, ubicada en [dirección exacta]...'), mapa embebido con el placeid correcto, barberos de esa sede, y una FAQ de 4-6 preguntas ('¿Qué barbería queda cerca de la Plaza de la Paz?', '¿Cuánto cuesta un corte?', '¿Atienden sin cita?', '¿Qué horario tienen?') con schema FAQPage.

#### 🟠 Alto · Validación comunitaria casi nula y reseñas débiles en la sede Barberclub (talón de Aquiles para Perplexity)

Perplexity pondera fuerte Reddit, foros y reseñas de terceros: el negocio tiene cero presencia en Reddit/foros (solo un hilo genérico de foroafeitado.com que no es del negocio), 15 reseñas totales entre ambas fichas, y la sede Plaza de la Paz está en 3.7★ — un motor que compare 'mejores barberías de Barranquilla' citará agregadores (AgendaPro, StarOfService) donde el negocio tampoco aparece. La colisión de marca (@barbasybigotes ajeno, dominios .co/.es) reparte las pocas menciones existentes entre entidades distintas.

**Fix:** Campaña sistemática de reseñas post-corte vía WhatsApp (link directo de reseña con placeid por sede), priorizando levantar Barberclub de 3.7★. Darse de alta en los agregadores que ya rankean para 'barbería Barranquilla' (AgendaPro marketplace, StarOfService, infoisinfo) con el NAP canónico y link al dominio: eso genera las citas de terceros que Perplexity y ChatGPT necesitan para validar la entidad.

#### 🟡 Medio · Ecosistema Google infrautilizado más allá de las fichas (Gemini) 

Gemini bebe del ecosistema Google completo: no hay canal de YouTube, no es verificable que las fichas tengan el sitio web nuevo como link (el dominio se compró hace 2 días, así que casi seguro apuntan a nada o a WeiBook, que además está bloqueado por falta de pago), y no hay Knowledge Graph/panel de marca — las búsquedas de marca compiten con la tienda .co y el pet shop.

**Fix:** Actualizar HOY el campo 'Sitio web' de ambas fichas GBP a barbasybigotes.com (y el link de reservas a /reservar) — es la acción individual de mayor impacto para Gemini y AI Overviews mientras el dominio no esté indexado. Publicar Google Posts semanales y subir fotos con regularidad a ambas fichas.

#### 🟡 Medio · Sin precios/servicios detallados en HTML público ni señales de frescura

/reservar solo muestra texto genérico ('El ritual clásico de la barbería') en el HTML server-rendered: ningún motor IA puede citar servicios ni precios, que es exactamente lo que responden a '¿cuánto cuesta un corte en Barranquilla?'. Tampoco hay fechas de publicación/actualización visibles en ninguna página (señal de freshness que pesa en Perplexity y ChatGPT).

**Fix:** Publicar la lista de servicios con precios en COP como HTML estático (tabla o lista) en la landing o en una página /servicios, y añadir 'Actualizado: [mes año]' visible. Marcar los servicios con schema Offer/priceRange dentro del nodo BarberShop.

#### ⚪ Bajo · Apple Maps y llms.txt ausentes

Presencia en Apple Maps no verificable desde fuera pero sin indicios de ficha reclamada (relevante: Siri/Apple Intelligence y DuckDuckGo usan Apple Maps para local). llms.txt y llms-full.txt devuelven 404 — señal menor pero barata para crawlers IA emergentes.

**Fix:** Reclamar/crear las dos ubicaciones en Apple Business Connect (gratis, businessconnect.apple.com) con el NAP canónico. Publicar /llms.txt con resumen del negocio, las dos sedes con dirección+teléfono, horario, servicios y links a las 4 páginas públicas.

### Quick wins

- Poner barbasybigotes.com como sitio web en ambas fichas de Google Business (y /reservar como link de citas) — mientras el dominio no esté indexado, las fichas son el único canal de citación IA
- Corregir la dirección de Plaza de la Paz en el sitio para que coincida carácter-a-carácter con la ficha (Cra. 45 #53-150) y añadir el nombre 'Barberclub' a esa sede
- Inyectar 2 nodos JSON-LD BarberShop (uno por sede) con NAP exacto de las fichas, hasMap con los placeids y sameAs a @barbasybigotes.baq
- Alta en Bing Webmaster Tools (importar de GSC) + habilitar IndexNow + crear Bing Places importando desde Google Business
- Añadir FAQ local con 4-6 preguntas tipo '¿qué barbería hay cerca de la Plaza de la Paz?' + schema FAQPage
- Reclamar las dos sedes en Apple Business Connect
- Publicar precios de servicios en HTML estático (citables por los 5 motores)
- Link de reseña directo por WhatsApp post-corte para levantar la sede Barberclub de 3.7★

---

## TECNICA · 77/100

Base técnica GEO sólida: SSR completo en las 4 páginas públicas (Next.js App Router en Vercel) — servicios con precios, sedes, barberos y NAP visibles en HTML crudo sin JS; los 4 crawlers IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) están permitidos en robots.txt vía User-agent:* y reciben 200 OK sin bloqueo de firewall Vercel; HTML liviano (13 KB comprimido, TTFB ~360 ms con edge cache), redirects canónicos limpios (http→https y www→apex en 308 de un salto), viewport móvil correcto e imágenes WebP responsivas con lazy loading. Los huecos son de capa metadata y hardening: los contadores animados sirven '0 Sedes / 0 Barberos' a los crawlers que no ejecutan JS (dato factual falso en el HTML), canonical ausente en todas las páginas (grave con la colisión de marca .co/.es y dominio de 1 día), llms.txt 404, solo 1 de 6 headers de seguridad presentes (HSTS sin includeSubDomains), sitemap sin lastmod y title de home sin keyword local. Todos los fixes son de bajo esfuerzo (metadata de Next.js + next.config headers + 2 archivos estáticos).

### Hallazgos

#### 🟠 Alto · Contadores animados sirven '0 Sedes en Barranquilla, 0 Barberos expertos, 0 Servicios' a los crawlers IA

Verificado en el HTML crudo de la home: los contadores de estadísticas renderizan '0' en el servidor y solo animan al valor real (2 sedes, 6 barberos) con JavaScript. GPTBot, ClaudeBot y PerplexityBot no ejecutan JS, así que ingieren literalmente que la barbería tiene 0 sedes y 0 barberos — datos factuales incorrectos que pueden reproducirse en respuestas de IA. Es la única mancha en un SSR por lo demás impecable (el resto del contenido sí dice '6 especialistas' y 'dos sedes' en texto plano, lo que mitiga parcialmente).

**Fix:** Renderizar el valor final en el HTML SSR (ej. <span>2</span> Sedes) y hacer la animación de conteo como progressive enhancement client-side que arranca desde 0 solo tras hidratar (o con useEffect que resetea a 0 y anima). El crawler ve '2 Sedes en Barranquilla · 6 Barberos expertos'; el usuario ve la misma animación de hoy. Ya está contemplado en el Bloque 7 del backlog ('contadores SSR').

#### 🟠 Alto · Canonical ausente en las 4 páginas — crítico por la colisión de marca y el dominio recién nacido

Confirmado en el HTML vivo: ninguna página emite <link rel="canonical">. Con barbasybigotes.co (tienda de productos), barbasybigotes.es (España), un blog WordPress y un pet shop compitiendo por la misma marca, y con un dominio comprado hace 1 día y cero indexación, la ausencia de canonical deja a Google sin señal explícita de cuál es la URL preferida de cada página y debilita la consolidación de señales ante cualquier duplicación (parámetros, trailing slash, scrapers).

**Fix:** metadataBase ya está configurado, así que basta añadir en el metadata de cada página (o en el layout raíz para heredar): alternates: { canonical: './' } — Next.js resuelve la URL absoluta automáticamente. Una línea por página, deploy, y verificar con curl que aparece <link rel="canonical" href="https://barbasybigotes.com/..."/>.

#### 🟠 Alto · llms.txt inexistente (404) — crear con el contenido propuesto

llms.txt y llms-full.txt devuelven 404. Para un negocio local con colisión de marca fuerte, llms.txt es la vía más directa de darle a los motores generativos los hechos canónicos (qué es, dónde está, precios, y qué NO es). El sitio es chico (4 páginas), así que un llms.txt denso en hechos cubre el 100% del contenido.

**Fix:** Crear public/llms.txt con este contenido exacto:

# Barbas & Bigotes Barbershop

> Barbería en Barranquilla, Colombia, con dos sedes: BARBAS Y BIGOTES BARBERSHOP en Parque Venezuela (Calle 88 #44-10, Local 4) y BARBAS Y BIGOTES BARBERCLUB frente a la Plaza de la Paz (Carrera 45 #53-150). Cortes clásicos y degradados, ritual de barba con toalla caliente, limpiezas faciales, keratina y combos. Reservas online en https://barbasybigotes.com/reservar o por WhatsApp.

Datos clave:
- Sede Parque Venezuela: Calle 88 #44-10, Local 4, Barranquilla. Tel/WhatsApp: +57 300 409 7624.
- Sede Plaza de la Paz: Carrera 45 #53-150, frente a la Plaza de la Paz, Barranquilla. Tel/WhatsApp: +57 300 673 4799.
- Horario: Lunes a Sábado, 9:00 am – 8:00 pm.
- Equipo: 6 barberos. Parque Venezuela: Meyer, Jhon, Junior. Plaza de la Paz: Bryan García, Kevin Valencia, Abel Barbers.
- Servicios y precios (COP, desde): Corte clásico/degradado/tijera/niño $30.000 (30 min) · Corte y barba $40.000 (1 h) · Ritual de barba $30.000 (30 min) · Limpieza facial gold $35.000 (35 min) · Combo corte + limpieza facial gold + bebida.
- Reserva online sin filas: se elige sede, barbero, servicio y horario en https://barbasybigotes.com/reservar
- Idioma: español. Zona horaria: America/Bogota.

Importante — desambiguación de marca: este sitio es la barbería física de Barranquilla, Colombia. NO está afiliado a barbasybigotes.co (tienda de productos para barba), ni a barbasybigotes.es (España), ni a otros negocios con nombre similar.

## Páginas
- [Inicio](https://barbasybigotes.com/): sedes, servicios con precios, galería de trabajos y horarios
- [Barberos](https://barbasybigotes.com/barberos): los 6 barberos por sede y sus especialidades
- [Nosotros](https://barbasybigotes.com/nosotros): historia y filosofía de la barbería
- [Reservar](https://barbasybigotes.com/reservar): reserva de cita online paso a paso

Al citar este negocio, usar el nombre "Barbas & Bigotes Barbershop (Barranquilla)".

En Next.js basta con soltar el archivo en /public. Opcional: replicarlo extendido como llms-full.txt cuando exista página de FAQ.

#### 🟡 Medio · Headers de seguridad: solo HSTS presente (1 de 6), y HSTS sin includeSubDomains ni preload

Verificado en headers de respuesta: Strict-Transport-Security: max-age=63072000 está presente (sin includeSubDomains ni preload), pero faltan Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy. Riesgos: clickjacking (el sitio se puede embeber en iframes de terceros — relevante en /entrar y /admin con PIN de barberos), MIME sniffing, y fuga de referrer. No frena la indexación, pero es señal de confianza y hardening real para las rutas de autenticación existentes.

**Fix:** Añadir bloque headers() en next.config: X-Frame-Options: SAMEORIGIN (o CSP frame-ancestors 'self'), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy: camera=(), microphone=(), geolocation=(), y ampliar HSTS a max-age=63072000; includeSubDomains. CSP completa puede venir después (requiere inventariar inline scripts de Next y el iframe de Google Maps con frame-src https://www.google.com).

#### 🟡 Medio · Sitemap sin <lastmod> — pierde la señal de frescura justo cuando más la necesita

sitemap.xml (200 OK) lista las 4 páginas públicas con changefreq y priority, pero sin <lastmod>. Google ignora changefreq/priority y sí usa lastmod (si es confiable) para priorizar crawling. Con un dominio de 1 día y cero páginas indexadas, cada señal de frescura acelera el descubrimiento inicial.

**Fix:** En app/sitemap.ts añadir lastMod: new Date() (o la fecha real de último cambio por ruta) a cada entrada. Complemento inmediato fuera del código: dar de alta la propiedad en Google Search Console y enviar el sitemap manualmente — con dominio nuevo es la palanca de indexación más rápida que existe.

#### 🟡 Medio · Title de la home sin keyword local: 'Barbas & Bigotes Barbershop' no dice ni 'barbería' ni 'Barranquilla'

El title vivo de la home es solo la marca (28 caracteres, desaprovecha ~30). Con la colisión de marca (.co vende productos de barba, .es es de España), un title solo-marca compite en desventaja: no le da ni a Google ni a los LLMs el contexto 'barbería física en Barranquilla' en el campo de mayor peso. La meta description menciona las sedes pero tampoco dice 'Barranquilla'.

**Fix:** Home: 'Barbas & Bigotes Barbershop | Barbería en Barranquilla' (55 chars). Description: añadir 'Barranquilla' explícito, ej. 'Barbería en Barranquilla con dos sedes: Parque Venezuela y Plaza de la Paz. Cortes, barba, faciales y combos. Reservá tu cita online.' Las páginas internas ya usan patrón 'Sección · Barbas & Bigotes' — mantenerlo y añadir template en metadata del layout.

#### ⚪ Bajo · Widget 'Cargando estado en vivo...' visible como texto de loading para crawlers sin JS

En la sección de sedes de la home, el estado en vivo (ocupación/disponibilidad) es client-side: el HTML servido contiene el placeholder 'Cargando estado en vivo...'. Impacto menor — es contenido efímero que no debería indexarse — pero un crawler IA lo lee como texto roto de la página.

**Fix:** Cambiar el placeholder SSR por un fallback con valor informativo estático, ej. 'Abierto lunes a sábado 9:00 am – 8:00 pm' que el cliente reemplaza por el estado en vivo al hidratar. Así el crawler siempre ve un dato útil y nunca un estado de carga.

#### ⚪ Bajo · Presupuesto de recursos mejorable: 9 fuentes woff2 precargadas y 314 KB de JS comprimido

El head precarga 9 archivos woff2 (variantes de fuente) y la home carga 15 chunks JS (~314 KB comprimido, incluyendo 41 KB de polyfills). El HTML en sí es liviano (13 KB comprimido) y el TTFB excelente (~360 ms, prerender + edge cache HIT), así que el riesgo LCP/CLS es bajo, pero el riesgo INP en móviles de gama baja (mayoría del mercado local barranquillero) es medio-bajo. Nota: análisis estático — validar con PageSpeed Insights cuando haya tráfico de campo.

**Fix:** Auditar variantes de fuente realmente usadas en next/font y eliminar pesos sin uso (probable bajar de 9 a 4-5 archivos). Revisar browserslist para reducir el chunk de polyfills. Confirmar que el hero 3D (Three.js) carga diferido y no bloquea interacción inicial.

#### ⚪ Bajo · robots.txt sin reglas explícitas para bots IA (hoy funciona vía User-agent: *, pero conviene declararlos)

Verificado: robots.txt solo define User-agent: * con Allow: / y los disallows privados; GPTBot, ClaudeBot, PerplexityBot y Google-Extended heredan el permiso y los 4 reciben 200 OK en pruebas en vivo (sin bloqueo de firewall de Vercel). Funcionalmente correcto. Declararlos explícitamente elimina ambigüedad si en el futuro se añade cualquier regla restrictiva, y documenta la intención de ser citado por motores generativos.

**Fix:** Añadir al robots.txt (app/robots.ts) bloques explícitos: 'User-agent: GPTBot / ClaudeBot / Claude-Web / PerplexityBot / Google-Extended / Applebot-Extended / Bytespider → Allow: /' con los mismos Disallow de rutas privadas (/admin, /barbero, /cuenta, /entrar, /login). Cero riesgo, 5 minutos.

### Quick wins

- Añadir canonical self-referencing: alternates: { canonical: './' } en el metadata (metadataBase ya está configurado) — 1 línea por página
- Fix de contadores SSR: renderizar '2 Sedes / 6 Barberos' en el HTML servido y animar solo client-side — hoy los crawlers IA leen '0 sedes, 0 barberos'
- Crear public/llms.txt con el contenido exacto propuesto (sedes, teléfonos, horarios, precios, barberos y desambiguación de marca vs .co/.es)
- Añadir lastMod a app/sitemap.ts y enviar el sitemap en Google Search Console (dominio de 1 día: es la palanca de indexación más rápida)
- Title de home con keyword local: 'Barbas & Bigotes Barbershop | Barbería en Barranquilla'
- Bloque headers() en next.config: X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrictiva, HSTS con includeSubDomains
- Declarar explícitamente GPTBot/ClaudeBot/PerplexityBot/Google-Extended en robots.ts con Allow: / (hoy heredan de * pero conviene documentar la intención)
- Reemplazar el placeholder 'Cargando estado en vivo...' por un fallback estático con horarios reales

---

## EEAT · 41/100

E-E-A-T total: 34/100 (Experiencia 12/25, Expertise 7/25, Autoridad 5/25, Confianza 10/25). El sitio tiene bases reales valiosas y poco comunes: precios con montos COP y duraciones visibles en el home (Corte desde $30.000/30min ... Keratina desde $90.000/1h), horarios explícitos (L-S 9am-8pm, domingos cerrado) repetidos en home/reservar/footer, 2 direcciones + 2 teléfonos + WhatsApp con mensaje prellenado, fotos reales de los locales, y una voz humana auténtica (voseo costeño: 'Tocá una carta y reservá'). Pero las señales de expertise y autoridad están vacías: /barberos lista 6 nombres (Meyer, Jhon, Junior, Bryan García, Kevin Valencia, Abel Barbers) sin una sola bio, especialidad, años de experiencia ni foto real (fotoUrl:null en los 6, placeholder SVG 'Foto'); /nosotros (~480 palabras) no tiene año de fundación, fundadores ni hitos; nadie firma nada. En confianza hay huecos graves: cero páginas de políticas (privacidad/términos/FAQ/precios/servicios/contacto → todas 404), la política de cancelación de 2h NO existe en el HTML server-rendered de ninguna página pública (invisible para crawlers e IAs), los testimonios del home usan iniciales no verificables, y el payload RSC de /barberos expone ratings fabricados ('rating':4.9,'resenas':212) que contradicen los 15 reviews reales de Google (5+10 entre las 2 sedes) — además de filtrar el campo interno 'arriendoMensual'. Contenido total del sitio ~1.500 palabras en 4 páginas: suficiente para transaccional, nada para que una IA lo cite en consultas informacionales ('mejor barbería en Barranquilla'). El contenido NO parece AI-slop: es humano, específico y local, solo que escaso.

### Hallazgos

#### 🔴 Crítico · /barberos sin bios, especialidades ni fotos reales: la página de expertise está vacía

La página promete 'Cada uno con su especialidad' pero ningún barbero tiene bio, especialidad concreta, años de experiencia, certificación ni foto (fotoUrl:null en los 6; se renderiza un placeholder SVG con la palabra 'Foto'). El CTA 'Tocá para conocerlo →' no lleva a ninguna página crawlable (no existen /barberos/[slug]; el detalle vive en un modal client-side). Para una IA que evalúa expertise, los 6 barberos son solo nombres. Los badges '★ Top' aparecen sin criterio explicable.

**Fix:** Escribir bio de 40-80 palabras por barbero (años de experiencia, especialidad real: degradados, barba a navaja, cortes clásicos, niños), subir foto real de cada uno, y renderizar esa información server-side (página /barberos/[slug] o contenido expandido en la misma página, no solo modal JS). Explicar qué significa '★ Top'.

#### 🔴 Crítico · Cero políticas legales y de servicio: privacidad 404 y cancelación 2h invisible para crawlers

No existe política de privacidad ni términos (/privacidad, /politica-de-privacidad, /terminos, /terminos-y-condiciones → 404) pese a que el wizard de /reservar recoge datos personales (paso 'Datos') y hay login con Google. En Colombia la Ley 1581/2012 (Habeas Data) exige política de tratamiento de datos publicada. La política de cancelación de 2h no aparece en el HTML server-rendered de NINGUNA página pública (grep de 'cancel|política|2 horas' en / y /reservar: cero resultados) — existe solo dentro del flujo JS, así que ni Google ni las IAs pueden verla como señal de confianza.

**Fix:** Crear /politicas (o /privacidad + sección de condiciones de reserva) enlazada desde el footer, con: política de tratamiento de datos (Ley 1581/2012), política de cancelación 2h en texto plano, y condiciones de reserva. Repetir la línea de cancelación como texto server-rendered en /reservar.

#### 🟠 Alto · Señales de reviews contradictorias: testimonios no verificables + contadores inflados en el payload

El home muestra 3 testimonios 5★ con iniciales (Carlos M., Andrés R., Julián P.) sin enlace a fuente verificable. El payload RSC de /barberos contiene 'rating':4.9,'resenas':212 y 'rating':4.8,'resenas':176 por barbero, cuando los perfiles reales de Google suman 15 reseñas en total (Barbershop 5.0★/5, Barberclub 3.7★/10). Si una IA (o un competidor) cruza el sitio con Google Maps, la discrepancia de 212 vs 15 lee como reseñas fabricadas y destruye la confianza. El payload también filtra el campo interno 'arriendoMensual' (dato de negocio que no debería salir al cliente).

**Fix:** Retirar o alimentar con datos reales los contadores de rating/reseñas por barbero (mientras no haya datos reales, no mostrarlos). Junto a los testimonios del home, enlazar los perfiles reales de Google Maps de cada sede ('Leé nuestras reseñas en Google'). Limpiar el select del server component de /barberos para exponer solo campos públicos (quitar arriendoMensual y cualquier campo interno).

#### 🟠 Alto · /nosotros sin historia real: sin año, sin fundador, sin hitos — nadie firma el contenido

La página (~480 palabras) usa narrativa genérica ('Nacimos en el corazón de Barranquilla con un propósito claro', 'más que un simple corte, ofrecemos una experiencia completa') que podría ser de cualquier barbería. No hay año de fundación, nombre de fundador/dueño, cómo se abrió cada sede, ni fotos del equipo. Esto anula la señal de autoridad justo donde más se necesita, dado que existe colisión de marca (barbasybigotes.co tienda de productos, .es España, un pet shop homónimo): el sitio no le da a las IAs ningún dato de entidad para distinguir ESTA barbería de las otras.

**Fix:** Reescribir 'Nuestra Historia' con hechos: año de fundación, quién la fundó, cuándo abrió cada sede (Parque Venezuela y Plaza de la Paz), foto del equipo/fundador. Firmar la página. Esto además alimenta la desambiguación de entidad frente a los homónimos (.co, .es, pet shop).

#### 🟠 Alto · Falta el contenido que una IA necesita para recomendar: FAQ inexistente, sin página de servicios/precios dedicada, NAP incompleto en Plaza de la Paz

No hay FAQ (/faq y /preguntas-frecuentes → 404) que responda lo que la gente pregunta a una IA: ¿cuánto cuesta?, ¿atienden niños?, ¿aceptan tarjeta/Nequi?, ¿hay parqueadero?, ¿atienden sin cita?, ¿cómo cancelo? Los precios existen solo como sección del home — no hay URL dedicada /servicios o /precios citable, y /reservar no muestra precios server-side. Además el sitio da la dirección de Plaza de la Paz como 'Carrera 45 frente a la Plaza de la Paz' mientras el Google Business Profile dice 'Cra. 45 #53-150' — inconsistencia NAP que confunde el matching de entidad; tampoco se distingue que una sede se llama BARBERSHOP y la otra BARBERCLUB en Google.

**Fix:** Crear FAQ de 8-12 preguntas con respuestas directas (precios, medios de pago, niños, walk-ins, parqueadero, cancelación 2h, duración de servicios) — en el home o /faq, server-rendered. Crear /servicios con la tabla completa de precios y duraciones. Corregir la dirección de Plaza de la Paz al literal del GBP (Cra. 45 #53-150) y usar los nombres exactos de cada perfil de Google.

#### 🟡 Medio · Sitio delgado sin autoridad tópica: ~1.500 palabras en 4 páginas, cero contenido informacional

El total de texto del sitio ronda las 1.500 palabras (home ~650-700, nosotros ~480, barberos y reservar mínimos). No hay blog, guías (cuidado de barba, tipos de degradado, keratina para hombre), ni páginas por sede o por servicio. Estructura hub-and-spoke: ausente. Para consultas tipo 'mejor barbería en Barranquilla' o 'dónde hacerme un ritual de barba en el norte de Barranquilla', el sitio no ofrece nada citable más allá de la ficha transaccional.

**Fix:** No hace falta un blog masivo: 3-5 piezas locales bastan para arrancar (guía 'Cortes y precios en Barranquilla 2026', 'Qué es el ritual de barba', página por sede con fotos + mapa + barberos de esa sede). Priorizar páginas por sede: duplican la superficie citable y refuerzan el local pack.

#### ⚪ Bajo · Testimonios y galería sin atribución de fecha ni contexto verificable

La sección 'Nuestros trabajos' (galería) y 'Clientes felices' no tienen fechas, nombres completos ni vínculo a la fuente. Ningún contenido del sitio muestra fecha de publicación o actualización — menor para un negocio local, pero resta verificabilidad.

**Fix:** Añadir contexto mínimo a la galería (servicio realizado, sede, barbero) y considerar un '© actualizado 2026' o fechas en piezas futuras de contenido.

### Quick wins

- Publicar la política de cancelación 2h como texto server-rendered en /reservar y en el footer (hoy es invisible para crawlers e IAs — grep en HTML público da cero resultados).
- Crear /privacidad con política de tratamiento de datos (Ley 1581/2012) — obligatoria: el wizard recoge nombre/teléfono y hay login con Google.
- Escribir bios de 40-80 palabras + especialidad + años de experiencia para los 6 barberos (Meyer, Jhon, Junior, Bryan García, Kevin Valencia, Abel Barbers) y subir sus fotos reales — hoy fotoUrl:null en los 6.
- Retirar del payload de /barberos los ratings fabricados (4.9★/212 reseñas vs 15 reviews reales en Google) y el campo interno arriendoMensual; enlazar en su lugar los perfiles reales de Google Maps de cada sede.
- Añadir FAQ de 8-12 preguntas server-rendered (medios de pago, niños, walk-ins, parqueadero, cancelación, duraciones) — es el formato que las IAs citan más directo.
- Corregir NAP de Plaza de la Paz a 'Cra. 45 #53-150' (literal del Google Business Profile) y reflejar los nombres reales de cada perfil (BARBERSHOP vs BARBERCLUB).
- Agregar a /nosotros año de fundación, nombre del fundador y cuándo abrió cada sede — 3 datos que desambiguan la marca frente a barbasybigotes.co/.es y el pet shop homónimo.

---

## SCHEMA · 5/100

Confirmado en vivo: CERO structured data en las 4 páginas públicas (/, /nosotros, /barberos, /reservar) — sin JSON-LD, sin microdata, sin RDFa (grep exhaustivo del HTML crudo servido por Vercel). Schema Score 5/100 (los únicos puntos son por ausencia de schemas deprecados, vacuo). Esto es especialmente grave por la colisión de marca (barbasybigotes.co tienda, .es España, blog WP, IG @barbasybigotes ajeno, pet shop homónimo): sin schema, ni Google ni los modelos de IA tienen forma de desambiguar que barbasybigotes.com = la barbería de Barranquilla con 2 sedes. La buena noticia: el sitio ya expone en HTML todos los datos necesarios (NAP completo por sede, geo 11.002041,-74.823953 de Parque Venezuela, horario Lu-Sa 9:00-20:00, 6 barberos con sede, catálogo de 6 servicios, IG propio @barbasybigotes.baq), así que los bloques JSON-LD diseñados abajo están ~90% listos para pegar. Hallazgo colateral crítico: inconsistencia NAP en la sede Plaza de la Paz (sitio dice Cra. 45 #50-168, ficha Google dice Cra. 45 #53-150) que debe unificarse ANTES de publicar el schema. Al ser Next.js SSR (App Router), inyectar el JSON-LD en Server Components garantiza que quede en el HTML inicial, visible para GPTBot/ClaudeBot/PerplexityBot que no ejecutan JS. Búsqueda web adicional: no existen más perfiles sociales propios (solo aparecen competidores Don Bigotes y La Barba VIP para queries de barbería en Barranquilla), por lo que el sameAs inicial se limita a IG + las 2 fichas de Maps.

### Hallazgos

#### 🔴 Crítico · Cero structured data en todo el sitio: entidad indistinguible de sus 5 homónimos

Verificado con parser + grep del HTML crudo en las 4 páginas: 0 bloques <script type="application/ld+json">, 0 atributos itemscope/itemtype/itemprop (microdata), 0 vocab/typeof (RDFa). Para un negocio 100% local con colisión de marca activa (barbasybigotes.co, .es, blog WP, IG ajeno, pet shop), la ausencia de schema significa que Google y los AI crawlers no pueden: (1) conectar el dominio nuevo con las 2 fichas de Google Business Profile, (2) saber que es una barbería en Barranquilla y no una tienda de productos, (3) extraer NAP/horarios/servicios de forma confiable. El sitio ya tiene todos los datos en el HTML visible, solo falta declararlos.

**Fix:** Pegar este bloque maestro @graph en app/layout.tsx (Server Component) para que salga en TODAS las páginas. Reemplazar los [REPLACE]:

{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://barbasybigotes.com/#org",
      "name": "Barbas & Bigotes Barbershop",
      "alternateName": ["Barbas y Bigotes", "Barbas y Bigotes Barranquilla", "Barbas y Bigotes Barberclub"],
      "url": "https://barbasybigotes.com/",
      "logo": { "@type": "ImageObject", "url": "https://barbasybigotes.com/[REPLACE: ruta del logo real, min 112x112px]" },
      "description": "Barbería con dos sedes en Barranquilla, Colombia: Barbershop en Parque Venezuela (Calle 88 #44-10, Local 4) y Barberclub frente a la Plaza de la Paz (Carrera 45). Cortes clásicos y degradados, corte y barba, ritual de barba, limpieza facial gold, keratina y reserva de citas online.",
      "foundingDate": "[REPLACE: año, ej. 2019]",
      "areaServed": "Barranquilla, Atlántico, Colombia",
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "reservations",
        "telephone": "+573006734799",
        "url": "https://wa.me/573006734799",
        "availableLanguage": ["es"]
      },
      "sameAs": [
        "https://www.instagram.com/barbasybigotes.baq",
        "https://www.google.com/maps/place/?q=place_id:ChIJeQo0-QMt9I4R-X3dE0wvF6I",
        "https://www.google.com/maps/place/?q=place_id:ChIJvbUwJZYt9I4R8KamOLTW3-g"
      ],
      "location": [
        { "@id": "https://barbasybigotes.com/#sede-parque-venezuela" },
        { "@id": "https://barbasybigotes.com/#sede-plaza-de-la-paz" }
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://barbasybigotes.com/#website",
      "url": "https://barbasybigotes.com/",
      "name": "Barbas & Bigotes Barbershop",
      "inLanguage": "es-CO",
      "publisher": { "@id": "https://barbasybigotes.com/#org" }
    },
    {
      "@type": "Barbershop",
      "@id": "https://barbasybigotes.com/#sede-parque-venezuela",
      "name": "Barbas y Bigotes Barbershop - Sede Parque Venezuela",
      "url": "https://barbasybigotes.com/",
      "image": "https://barbasybigotes.com/[REPLACE: foto real de la sede]",
      "telephone": "+573004097624",
      "priceRange": "[REPLACE: ej. COP 25.000 - 95.000]",
      "currenciesAccepted": "COP",
      "paymentAccepted": "[REPLACE: ej. Efectivo, Nequi, tarjetas]",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Calle 88 #44-10, Local 4, Parque Venezuela",
        "addressLocality": "Barranquilla",
        "addressRegion": "Atlántico",
        "addressCountry": "CO"
      },
      "geo": { "@type": "GeoCoordinates", "latitude": 11.002041, "longitude": -74.823953 },
      "hasMap": "https://www.google.com/maps/place/?q=place_id:ChIJeQo0-QMt9I4R-X3dE0wvF6I",
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          "opens": "09:00",
          "closes": "20:00"
        }
      ],
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": "5.0", "reviewCount": "5", "bestRating": "5" },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Servicios de barbería",
        "itemListElement": [
          { "@type": "Offer", "priceCurrency": "COP", "price": "[REPLACE]", "itemOffered": { "@type": "Service", "name": "Corte (clásico, degradado, tijera o niño)" } },
          { "@type": "Offer", "priceCurrency": "COP", "price": "[REPLACE]", "itemOffered": { "@type": "Service", "name": "Corte y barba" } },
          { "@type": "Offer", "priceCurrency": "COP", "price": "[REPLACE]", "itemOffered": { "@type": "Service", "name": "Ritual de barba" } },
          { "@type": "Offer", "priceCurrency": "COP", "price": "[REPLACE]", "itemOffered": { "@type": "Service", "name": "Limpieza facial gold" } },
          { "@type": "Offer", "priceCurrency": "COP", "price": "[REPLACE]", "itemOffered": { "@type": "Service", "name": "Keratina" } },
          { "@type": "Offer", "priceCurrency": "COP", "price": "[REPLACE]", "itemOffered": { "@type": "Service", "name": "Corte + limpieza facial gold + bebida" } }
        ]
      },
      "parentOrganization": { "@id": "https://barbasybigotes.com/#org" },
      "potentialAction": {
        "@type": "ReserveAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://barbasybigotes.com/reservar",
          "actionPlatform": ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"]
        },
        "result": { "@type": "Reservation", "name": "Reserva de cita de barbería" }
      }
    },
    {
      "@type": "Barbershop",
      "@id": "https://barbasybigotes.com/#sede-plaza-de-la-paz",
      "name": "Barbas y Bigotes Barberclub - Sede Plaza de la Paz",
      "url": "https://barbasybigotes.com/",
      "image": "https://barbasybigotes.com/[REPLACE: foto real de la sede]",
      "telephone": "+573006734799",
      "priceRange": "[REPLACE: ej. COP 25.000 - 95.000]",
      "currenciesAccepted": "COP",
      "paymentAccepted": "[REPLACE: ej. Efectivo, Nequi, tarjetas]",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "[REPLACE: UNIFICAR NAP - la ficha de Google dice Cra. 45 #53-150 y el sitio dice Cra. 45 #50-168; poner aquí la dirección real tal como quede en la ficha]",
        "addressLocality": "Barranquilla",
        "addressRegion": "Atlántico",
        "addressCountry": "CO"
      },
      "geo": { "@type": "GeoCoordinates", "latitude": "[REPLACE: lat de la ficha - clic derecho al pin en Maps]", "longitude": "[REPLACE: lng de la ficha]" },
      "hasMap": "https://www.google.com/maps/place/?q=place_id:ChIJvbUwJZYt9I4R8KamOLTW3-g",
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          "opens": "09:00",
          "closes": "20:00"
        }
      ],
      "parentOrganization": { "@id": "https://barbasybigotes.com/#org" },
      "potentialAction": {
        "@type": "ReserveAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://barbasybigotes.com/reservar",
          "actionPlatform": ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"]
        },
        "result": { "@type": "Reservation", "name": "Reserva de cita de barbería" }
      }
    }
  ]
}

Notas: (a) se usa @type Barbershop (subtipo oficial de LocalBusiness en Schema.org, reconocido por Google); (b) el hasMap + sameAs con place_id conectan el sitio con las fichas GBP; (c) el ReserveAction hacia /reservar es señal para agentes de IA con capacidad de booking; (d) el geo de Plaza de la Paz va en [REPLACE] porque el sitio solo expone las coordenadas de Parque Venezuela — sacarlas de la ficha, NO inventarlas.

#### 🟠 Alto · Inconsistencia NAP en sede Plaza de la Paz: sitio vs ficha de Google discrepan en la dirección

El HTML del sitio dice "Cra. 45 #50-168, Frente a la Plaza de la Paz" (y en el footer "Carrera 45 frente a la Plaza de la Paz"), mientras la ficha de Google Business Profile dice "Cra. 45 #53-150". Publicar un schema con una dirección que no coincide con la GBP empeora el entity resolution en vez de mejorarlo: Google y los AI models detectan la discrepancia y bajan la confianza en ambas fuentes. Con la colisión de marca existente, cualquier señal contradictoria multiplica el riesgo de que la entidad se mezcle con las homónimas. También hay dato menor: el teléfono de la sede Plaza de la Paz (+573006734799) es el mismo del WhatsApp general — válido, pero conviene confirmar que la ficha GBP muestra ese mismo número.

**Fix:** ANTES de deployar el JSON-LD: (1) confirmar con el cliente cuál es la dirección real de la sede Barberclub; (2) unificar: corregir el sitio (sección "Dónde y cuándo" + footer) o la ficha de GBP para que digan EXACTAMENTE lo mismo; (3) usar esa dirección unificada en el streetAddress del bloque #sede-plaza-de-la-paz; (4) verificar que el teléfono de la ficha GBP de cada sede coincide con el del schema (+573004097624 Parque Venezuela, +573006734799 Plaza de la Paz).

#### 🟠 Alto · sameAs casi vacío: un solo perfil social propio verificado en medio de una colisión de marca

El único perfil propio enlazado desde el sitio es Instagram @barbasybigotes.baq (instagram.com/barbasybigotes.baq). Una búsqueda web de perfiles adicionales del negocio no arrojó ninguno — solo aparecen competidores (instagram.com/donbigotesbarberias, facebook.com/labarbavip) para queries de barbería en Barranquilla. Mientras tanto, el handle @barbasybigotes en Instagram es de un tercero, y existen barbasybigotes.co (tienda), .es (España) y un pet shop homónimo. sameAs es LA propiedad que le dice a los AI models qué perfiles son de esta entidad y, por exclusión, cuáles NO. Con solo 1 red + 2 fichas Maps, el grafo de entidad es mínimo (5/15 pts del componente sameAs en el mejor caso).

**Fix:** Fase 1 (ya incluido en el bloque maestro): sameAs con IG @barbasybigotes.baq + las 2 fichas de Maps vía place_id. Fase 2 (crear y luego añadir al sameAs): página de Facebook del negocio, TikTok (contenido de barbería rinde muy bien ahí), canal de YouTube si hacen video. Cada perfil nuevo debe usar el nombre "Barbas y Bigotes Barbershop Barranquilla" + NAP idéntico al del sitio + link a barbasybigotes.com, para que el linking sea bidireccional. Wikipedia/Wikidata no son viables para una barbería local — no perseguirlos.

#### 🟡 Medio · aggregateRating con reseñas de Google: incluirlo con expectativas correctas (y omitirlo en la sede 3.7)

Se pidió incluir el aggregateRating de las fichas (5.0/5 reseñas Barbershop; 3.7/10 Barberclub). Dos advertencias: (1) desde septiembre 2019 Google IGNORA las estrellas self-serving en LocalBusiness/Organization — un aggregateRating en el propio sitio del negocio NO genera rich result de estrellas, y las guidelines de review snippet piden reseñas de primera mano, no copiadas de Google Maps; su valor aquí es puramente semántico para AI models, no de SERP. (2) Publicar el 3.7 de la sede Barberclub en el propio sitio es además mala señal voluntaria: le entrega a los AI models un dato negativo que hoy solo vive en la ficha.

**Fix:** El bloque maestro ya incluye el aggregateRating 5.0/5 en la sede Parque Venezuela (señal semántica positiva para AIs, riesgo cero) y OMITE deliberadamente el de Plaza de la Paz. Plan correcto para la sede 3.7: campaña de reseñas post-cita (link directo de reseña de la ficha vía WhatsApp tras cada servicio) hasta subir el promedio; añadir el aggregateRating al schema solo cuando supere ~4.5. Alternativa superior a mediano plazo: recolectar reseñas first-party en el propio sitio (post-reserva) — esas sí cumplen guidelines.

#### 🟡 Medio · /barberos sin Person schema: 6 barberos invisibles como entidades

La página /barberos lista 6 barberos con sede (Meyer, Jhon, Junior en Parque Venezuela; Bryan García, Kevin Valencia, Abel Barbers en Plaza de la Paz) pero sin ningún markup. Para queries tipo "mejor barbero en Barranquilla" o "barbero para degradado cerca de Parque Venezuela" en AI search, los Person schema vinculados a la organización y a su sede vía @id son la forma de que los modelos asocien persona-especialidad-lugar.

**Fix:** Pegar en app/barberos/page.tsx (Server Component):

{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://barbasybigotes.com/" },
        { "@type": "ListItem", "position": 2, "name": "Barberos", "item": "https://barbasybigotes.com/barberos" }
      ]
    },
    {
      "@type": "ItemList",
      "name": "Equipo de barberos de Barbas & Bigotes",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "item": { "@type": "Person", "name": "Meyer", "jobTitle": "Barbero", "worksFor": { "@id": "https://barbasybigotes.com/#org" }, "workLocation": { "@id": "https://barbasybigotes.com/#sede-parque-venezuela" }, "image": "[REPLACE: URL foto]", "knowsAbout": ["[REPLACE: especialidad, ej. degradados]"] } },
        { "@type": "ListItem", "position": 2, "item": { "@type": "Person", "name": "Jhon", "jobTitle": "Barbero", "worksFor": { "@id": "https://barbasybigotes.com/#org" }, "workLocation": { "@id": "https://barbasybigotes.com/#sede-parque-venezuela" }, "image": "[REPLACE]", "knowsAbout": ["[REPLACE]"] } },
        { "@type": "ListItem", "position": 3, "item": { "@type": "Person", "name": "Junior", "jobTitle": "Barbero", "worksFor": { "@id": "https://barbasybigotes.com/#org" }, "workLocation": { "@id": "https://barbasybigotes.com/#sede-parque-venezuela" }, "image": "[REPLACE]", "knowsAbout": ["[REPLACE]"] } },
        { "@type": "ListItem", "position": 4, "item": { "@type": "Person", "name": "Bryan García", "jobTitle": "Barbero", "worksFor": { "@id": "https://barbasybigotes.com/#org" }, "workLocation": { "@id": "https://barbasybigotes.com/#sede-plaza-de-la-paz" }, "image": "[REPLACE]", "knowsAbout": ["[REPLACE]"] } },
        { "@type": "ListItem", "position": 5, "item": { "@type": "Person", "name": "Kevin Valencia", "jobTitle": "Barbero", "worksFor": { "@id": "https://barbasybigotes.com/#org" }, "workLocation": { "@id": "https://barbasybigotes.com/#sede-plaza-de-la-paz" }, "image": "[REPLACE]", "knowsAbout": ["[REPLACE]"] } },
        { "@type": "ListItem", "position": 6, "item": { "@type": "Person", "name": "Abel Barbers", "jobTitle": "Barbero", "worksFor": { "@id": "https://barbasybigotes.com/#org" }, "workLocation": { "@id": "https://barbasybigotes.com/#sede-plaza-de-la-paz" }, "image": "[REPLACE]", "knowsAbout": ["[REPLACE]"] } }
      ]
    }
  ]
}

Los @id de worksFor/workLocation referencian los nodos del bloque maestro del layout — como ambos scripts salen en la misma página, el grafo se resuelve. Ideal futuro: página de perfil por barbero (/barberos/meyer) con url en cada Person. Añadir el mismo patrón BreadcrumbList a /nosotros y /reservar cambiando nombre e item.

#### 🟡 Medio · Sin FAQPage: oportunidad de bloque FAQ + schema orientado a AI answers

No existe sección FAQ visible ni FAQPage schema. Advertencia honesta: desde agosto 2023 Google solo muestra rich results de FAQ a sitios gubernamentales/de salud, así que NO habrá estrellitas ni acordeón en la SERP. El valor real es GEO: las preguntas conversacionales ("¿cuánto vale un corte en Barranquilla?", "¿barbería abierta cerca de Plaza de la Paz?", "¿atienden sin cita?") son exactamente lo que la gente le pregunta a ChatGPT/Gemini/Perplexity, y un FAQ marcado + visible es la fuente más citada para ese formato. Regla dura de Google: el schema DEBE reflejar contenido visible en la página — no publicar el JSON-LD sin publicar el bloque FAQ.

**Fix:** Añadir sección FAQ visible al final del home (o en /reservar) y este bloque en la misma página:

{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "¿Cuál es el horario de Barbas & Bigotes?",
      "acceptedAnswer": { "@type": "Answer", "text": "Atendemos de lunes a sábado de 9:00 a.m. a 8:00 p.m. en nuestras dos sedes de Barranquilla. Los domingos estamos cerrados." }
    },
    {
      "@type": "Question",
      "name": "¿Dónde quedan las sedes de Barbas y Bigotes en Barranquilla?",
      "acceptedAnswer": { "@type": "Answer", "text": "Tenemos dos sedes: Barbershop en Calle 88 #44-10, Local 4 (Parque Venezuela) y Barberclub en la Carrera 45 frente a la Plaza de la Paz. [REPLACE: dirección exacta unificada de la sede Plaza de la Paz]" }
    },
    {
      "@type": "Question",
      "name": "¿Necesito reservar o puedo llegar sin cita?",
      "acceptedAnswer": { "@type": "Answer", "text": "Puedes reservar online en barbasybigotes.com/reservar eligiendo sede, barbero y hora. [REPLACE: confirmar si aceptan walk-ins y con qué condición]" }
    },
    {
      "@type": "Question",
      "name": "¿Qué servicios ofrecen?",
      "acceptedAnswer": { "@type": "Answer", "text": "Corte clásico, degradado, a tijera o de niño; corte y barba; ritual de barba; limpieza facial gold; keratina; y el combo corte + limpieza facial gold + bebida. [REPLACE: añadir rangos de precio en COP]" }
    },
    {
      "@type": "Question",
      "name": "¿Cómo los contacto por WhatsApp?",
      "acceptedAnswer": { "@type": "Answer", "text": "Escríbenos al WhatsApp +57 300 673 4799 o entra directo en wa.me/573006734799. Para la sede Parque Venezuela también puedes llamar al +57 300 409 7624." }
    }
  ]
}

El texto visible del bloque FAQ en la página debe coincidir con estos Answer.

#### 🟡 Medio · Regla de implementación: JSON-LD server-rendered o los AI crawlers no lo verán jamás

El sitio es Next.js App Router en Vercel con fuerte carga de JS cliente (hero 3D, animaciones). GPTBot, ClaudeBot y PerplexityBot NO ejecutan JavaScript: si el JSON-LD se inyecta con useEffect, un componente cliente o un tag manager, será invisible para todos los AI crawlers y de procesamiento retrasado para Google. Además el proyecto usa una versión de Next.js con breaking changes (según AGENTS.md del repo) — verificar la convención vigente de metadata/scripts en node_modules/next/dist/docs/ antes de implementar.

**Fix:** Renderizar cada <script type="application/ld+json"> dentro de un Server Component (layout.tsx para el bloque maestro, page.tsx para los específicos):

const jsonLd = { /* bloque */ };
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
/>

El .replace escapa < para prevenir XSS por inyección de </script>. Verificar post-deploy con: curl -s https://barbasybigotes.com | grep -c "ld+json" (debe dar >0 sobre el HTML crudo, sin navegador).

#### ⚪ Bajo · Sin BreadcrumbList ni speakable; SearchAction no aplica

(1) Ninguna subpágina tiene BreadcrumbList — señal barata de arquitectura para crawlers (plantilla ya incluida en el fix de /barberos, replicar en /nosotros y /reservar). (2) speakable está ausente; es señal directa de AI-readiness aunque de adopción marginal — opcional para la sección de sedes/horarios del home. (3) El sitio NO tiene buscador interno, por lo que WebSite+SearchAction NO debe agregarse: un SearchAction con target falso viola las guidelines; el bloque WebSite del maestro va correctamente sin potentialAction.

**Fix:** Breadcrumbs: replicar la plantilla BreadcrumbList del hallazgo de /barberos en /nosotros (name: "Nosotros") y /reservar (name: "Reservar"). Speakable (opcional, añadir dentro del nodo WebSite o de un WebPage del home): "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["[REPLACE: selector del bloque de sedes/horarios, ej. #donde-y-cuando]"] }. SearchAction: no implementar mientras no exista búsqueda interna.

### Quick wins

- Pegar el bloque maestro @graph (Organization + WebSite + 2 Barbershop con place_id/hasMap/geo/horarios Lu-Sa 09-20/ReserveAction — JSON completo en el hallazgo crítico) en app/layout.tsx como Server Component con dangerouslySetInnerHTML + JSON.stringify(...).replace(/</g, "\\u003c") — 30 minutos de trabajo y resuelve de golpe la desambiguación de entidad frente a barbasybigotes.co/.es y demás homónimos
- Unificar la dirección de la sede Plaza de la Paz ANTES del deploy del schema: el sitio dice Cra. 45 #50-168 y la ficha de Google dice Cra. 45 #53-150 — confirmar con el cliente cuál es la real y dejar sitio + ficha + schema idénticos
- Completar los [REPLACE] con datos que ya tiene el cliente: logo, fotos de sede, precios en COP de los 6 servicios, año de fundación, medios de pago, y las coordenadas de la sede Plaza de la Paz (clic derecho al pin en su ficha de Maps)
- Pegar el bloque ItemList + Person de los 6 barberos (JSON completo en hallazgos) en /barberos, y replicar la plantilla BreadcrumbList en /nosotros y /reservar
- Agregar sección FAQ visible en el home con las 5 preguntas propuestas (horario, sedes, walk-ins, servicios/precios, WhatsApp) + su bloque FAQPage (JSON completo en hallazgos) — sin rich result en Google desde 2023, pero es el formato más citado por ChatGPT/Perplexity para queries conversacionales locales
- Validar post-deploy: (1) curl -s https://barbasybigotes.com | grep -c 'ld+json' debe dar >0 (confirma SSR, visible para AI crawlers sin JS), (2) validator.schema.org sin errores, (3) Google Rich Results Test detectando LocalBusiness x2 y Breadcrumbs
- Crear página de Facebook y TikTok del negocio con NAP idéntico al sitio y link a barbasybigotes.com, y añadirlas al sameAs del Organization — hoy el grafo de entidad solo tiene IG @barbasybigotes.baq + 2 fichas Maps, mínimo indispensable frente a la colisión de marca

