// Achica la foto EN EL NAVEGADOR antes de subirla.
//
// Por qué: el dueño fotografía el producto con el celular y esas fotos pesan
// 2-5MB, pero el thumbnail se muestra a 36-42px en toda la app. Subir 4MB para
// eso es tirar los datos móviles del barrio a la basura, y además chocaba con
// el límite de 1MB que los server actions de Next imponen por defecto: el
// archivo moría con un 500 crudo ANTES de llegar a la validación de la action,
// y la UI se quedaba en "Subiendo…" para siempre.
//
// La parte pura (calcularDestino) está en admin-reglas para poder testearla;
// acá queda solo lo que necesita canvas.

import { calcularDestino, LADO_MAX_FOTO } from "@/lib/admin-reglas";

/** Calidad del JPEG/WebP resultante. 0.82 es indistinguible a este tamaño. */
const CALIDAD = 0.82;

/**
 * Devuelve un File achicado (WebP si el navegador puede, si no JPEG). Si algo
 * falla —canvas bloqueado, formato raro, imagen corrupta— devuelve el original:
 * es preferible intentar subirlo y que el server decida, a perder la foto.
 */
export async function achicarFoto(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  // Los formatos que el server acepta; un HEIC de iPhone no lo decodifica el
  // canvas, así que se manda tal cual y la action lo rechaza con su mensaje.
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { ancho, alto, hayQueAchicar } = calcularDestino(bitmap.width, bitmap.height);
    // Ya es chica: no se recomprime (recomprimir degrada sin ganar nada).
    if (!hayQueAchicar && file.size <= 400_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const tipo = canvas.toDataURL("image/webp").startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, tipo, CALIDAD));
    if (!blob || blob.size >= file.size) return file; // no mejoró: deja el original

    const ext = tipo === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.${ext}`, { type: tipo });
  } catch {
    return file;
  }
}

export { LADO_MAX_FOTO };
