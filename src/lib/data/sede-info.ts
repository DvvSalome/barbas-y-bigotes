// Detalle corto + fachada DE FÁBRICA por sede (las dos fundadoras, proto §6.3).
// Es el RESPALDO: si el admin sube una foto propia (0058, Admin → Horarios),
// esa manda. Compartido por el wizard (lo que ve el cliente) y por la tarjeta
// de FotoSede del admin (que debe mostrar LO MISMO que ve el cliente).
export const SEDE_INFO: Record<string, { detalle: string; frente: string | null }> = {
  "parque-venezuela": { detalle: "Cra 65 · Barranquilla", frente: "/sedes/parque-venezuela-frente.jpg" },
  "plaza-de-la-paz": { detalle: "Centro · Barranquilla", frente: "/sedes/plaza-de-la-paz-frente.jpg" },
};
