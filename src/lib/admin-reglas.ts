// Reglas puras del back-office (sin I/O): las usan las server actions de
// src/lib/actions.ts, los componentes de /admin y el chequeo ejecutable
// scripts/check-admin.ts. Mantener libre de imports de Next/Supabase para que
// Node lo corra directo, igual que cobro.ts.
//
// Por qué existe: la validación de estas mutaciones vivía suelta dentro de cada
// action (y a veces duplicada en el cliente, o directamente ausente). Acá queda
// una sola definición por regla, verificable sin levantar la app ni la base.

// ---------- Dinero y cantidades (COP) ----------

/**
 * Saneo de un monto en pesos: entero, finito y >= 0. Devuelve null si no sirve,
 * para que el que llama decida el mensaje. El negocio no usa centavos: 19.99 es
 * un error de tipeo, no 19 pesos con 99 centavos, así que se rechaza en vez de
 * truncar en silencio.
 */
export function sanearCop(valor: unknown): number | null {
  // Number("") y Number("   ") dan 0, no NaN: sin este guard, dejar el campo de
  // precio vacío guardaba un producto GRATIS en vez de dar error.
  if (typeof valor === "string" && valor.trim() === "") return null;
  if (valor === null || valor === undefined || typeof valor === "boolean") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

/** Cantidades enteras >= 0 (stock, mínimo). Mismo criterio que sanearCop. */
export const sanearCantidad = sanearCop;

/**
 * Comisión en porcentaje: 0 a 100, hasta 2 decimales (la columna es numeric(5,2)).
 * Un 250% no es un typo inofensivo: se multiplica por cada venta del barbero.
 */
export function sanearComisionPct(valor: unknown): number | null {
  // Mismo guard que sanearCop: sin esto Number('')/Number('  ')/Number(null) dan 0
  // y Number(true) da 1 — todos finitos y en [0,100], así que un campo vacío o un
  // booleano se guardaba como 0%/1% en vez de rechazarse.
  if (typeof valor === "string" && valor.trim() === "") return null;
  if (valor === null || valor === undefined || typeof valor === "boolean") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

/** Nombre visible: recorta espacios y exige algo real. Tope para no romper la UI. */
export function sanearNombre(valor: unknown, maxLargo = 80): string | null {
  const s = (typeof valor === "string" ? valor : "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  return s.slice(0, maxLargo);
}

// ---------- Especialidades del barbero ----------

export const MAX_ESPECIALIDADES = 6;

/**
 * Una especialidad por línea o separadas por coma. Vivía duplicado en
 * EquipoPinAdmin.tsx; que el cliente y el server partan distinto es cómo se
 * cuelan diferencias entre lo que el admin ve y lo que se guarda.
 */
export function partirEspecialidades(texto: string): string[] {
  return (texto ?? "")
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export type SaneoEspecialidades = {
  /** Las que se guardan. */
  especialidades: string[];
  /** Las que se descartaron y por qué, para poder AVISARLE al admin. */
  descartadas: { valor: string; motivo: "duplicada" | "excede-maximo" }[];
};

/**
 * Recorta, quita duplicados (case-insensitive: el PK es (barbero_id, especialidad)
 * y "Fade"/"fade" chocarían) y corta en MAX_ESPECIALIDADES.
 *
 * Devuelve TAMBIÉN lo descartado. La versión vieja sanaba en silencio y
 * respondía "Perfil guardado": el admin escribía 8 especialidades, veía éxito y
 * se publicaban 6 sin enterarse. Varios barberos ya tienen 7-8 cargadas de
 * antes, así que abrir su perfil para tocar la bio les recortaba el resto.
 */
export function sanearEspecialidades(entrada: unknown): SaneoEspecialidades {
  const lista = Array.isArray(entrada) ? entrada : [];
  const vistas = new Set<string>();
  const especialidades: string[] = [];
  const descartadas: SaneoEspecialidades["descartadas"] = [];

  for (const raw of lista) {
    const e = (typeof raw === "string" ? raw : "").trim();
    if (!e) continue;
    const key = e.toLowerCase();
    if (vistas.has(key)) {
      descartadas.push({ valor: e, motivo: "duplicada" });
      continue;
    }
    vistas.add(key);
    if (especialidades.length >= MAX_ESPECIALIDADES) {
      descartadas.push({ valor: e, motivo: "excede-maximo" });
      continue;
    }
    especialidades.push(e);
  }
  return { especialidades, descartadas };
}

// ---------- Combos ----------

/** id kebab a partir del nombre (sin acentos, solo [a-z0-9-]). */
export function slugCombo(nombre: string): string {
  const base = (nombre ?? "")
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "combo";
}

/** Primer id libre: base, base-2, base-3… */
export function resolverColisionSlug(base: string, tomados: Iterable<string>): string {
  const usados = new Set(tomados);
  let id = base;
  for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Un combo necesita 2 partes, o 1 parte más la bebida. */
export function esComboValido(partes: unknown, conBebida: boolean): boolean {
  const p = Array.isArray(partes) ? partes.filter((x) => typeof x === "string" && x) : [];
  return p.length >= 2 || (p.length >= 1 && conBebida);
}

/** Una jornada completa es el techo razonable de un servicio. */
export const DURACION_MAX_MIN = 480;

// ---------- Fotos de producto ----------

export const FORMATOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const EXTENSIONES = ["jpg", "png", "webp", "avif"] as const;

/** Extensión del archivo a partir del MIME. jpeg→jpg; cualquier rareza cae a jpg. */
export function extDeMime(mime: string): string {
  const ext = ((mime ?? "").split("/")[1] ?? "")
    .toLowerCase()
    .replace("jpeg", "jpg")
    .replace(/[^a-z0-9]/g, "");
  return (EXTENSIONES as readonly string[]).includes(ext) ? ext : "jpg";
}

/**
 * Las otras variantes del mismo producto en el bucket. El path lleva la
 * extensión, así que re-subir un png como webp dejaría el png viejo servido
 * para siempre en un bucket público.
 */
export function variantesObsoletas(productoId: string, extNueva: string): string[] {
  return EXTENSIONES.filter((e) => e !== extNueva).map((e) => `${productoId}.${e}`);
}

// ---------- Antelación del aviso previo ----------

/**
 * Redondea a la media hora y valida el rango del CHECK previo_horas_razonable
 * (migración 0038). Devuelve el valor EFECTIVO para que la UI pueda mostrar
 * "se guardó 30 min" cuando el admin escribió 0.7, en vez de mentirle.
 */
export function sanearPrevioHoras(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return null;
  const horas = Math.round(n * 2) / 2;
  if (horas < 0.5 || horas > 12) return null;
  return horas;
}

// ---------- Fechas del calendario del admin ----------

/**
 * "vie 18 jul" desde YYYY-MM-DD. Se arma con new Date(y, m-1, d) y NO con
 * new Date(ymd): el string ISO se parsea como UTC y en Bogotá (UTC-5) mostraría
 * el día anterior. Estaba duplicada en AusenciasAdmin y DiasEspecialesAdmin.
 */
export function fechaLabel(ymd: string): string {
  const [y, m, d] = (ymd ?? "").split("-").map(Number);
  if (!y || !m || !d) return ymd ?? "";
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** ¿Ese YYYY-MM-DD cae domingo? (la barbería cierra domingos por defecto) */
export function esDomingo(ymd: string): boolean {
  const [y, m, d] = (ymd ?? "").split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 0;
}

// ---------- Redimensionado de fotos de producto ----------

/**
 * Lado máximo de la foto guardada. El thumbnail se muestra a 36-42px en toda la
 * app; 800px deja margen de sobra para pantallas retina y para mostrarla más
 * grande algún día, sin arrastrar los 2-5MB que pesa una foto de celular.
 */
export const LADO_MAX_FOTO = 800;

/**
 * Tamaño de destino conservando la proporción. Parte pura del compresor del
 * navegador (src/lib/imagen-cliente.ts), acá para poder verificarla sin canvas.
 */
export function calcularDestino(
  ancho: number,
  alto: number,
  ladoMax = LADO_MAX_FOTO,
): { ancho: number; alto: number; hayQueAchicar: boolean } {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
    return { ancho: 1, alto: 1, hayQueAchicar: false };
  }
  const lado = Math.max(ancho, alto);
  if (lado <= ladoMax) return { ancho: Math.round(ancho), alto: Math.round(alto), hayQueAchicar: false };
  const escala = ladoMax / lado;
  // Nunca por debajo de 1px: una foto 4000x10 daría alto 0 y el canvas
  // devolvería un blob vacío.
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
    hayQueAchicar: true,
  };
}

/**
 * ¿Los primeros bytes son de una imagen real? El MIME lo declara el cliente y se
 * puede forjar: un .txt renombrado con type image/png pasaba la allowlist y
 * quedaba servido desde el bucket público (thumbnail roto para siempre).
 * No es un agujero de seguridad grave —el SVG, que sí ejecutaría script, ya
 * estaba fuera de la lista— pero sí de integridad.
 */
export function pareceImagen(bytes: Uint8Array): boolean {
  const b = bytes;
  if (b.length < 12) return false;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return true;
  const ascii = (i: number, s: string) => s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  // WebP: "RIFF" .... "WEBP"
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return true;
  // AVIF/HEIF: .... "ftyp" + marca de tipo
  if (ascii(4, "ftyp")) return true;
  return false;
}
