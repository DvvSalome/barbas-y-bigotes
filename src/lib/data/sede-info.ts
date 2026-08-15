// OJO: `detalle` es lo que el CLIENTE lee al elegir sede en el wizard, así que
// tiene que ser la dirección DE VERDAD. Decía "Cra 65" para Parque Venezuela
// —una calle que no aparece en ninguna otra parte del sitio— mientras la home,
// /nosotros, el schema.org y el correo decían Calle 88 #44-10. Un cliente podía
// terminar parado en la cuadra equivocada.
// Detalle corto + fachada DE FÁBRICA por sede (las dos fundadoras, proto §6.3).
// Es el RESPALDO: si el admin sube una foto propia (0058, Admin → Horarios),
// esa manda. Compartido por el wizard (lo que ve el cliente) y por la tarjeta
// de FotoSede del admin (que debe mostrar LO MISMO que ve el cliente).
export const SEDE_INFO: Record<string, { nombre: string; detalle: string; frente: string | null }> = {
  "parque-venezuela": { nombre: "Parque Venezuela", detalle: "Cl. 88 #44-10 · Barranquilla", frente: "/sedes/parque-venezuela-frente.jpg" },
  "plaza-de-la-paz": { nombre: "Plaza de la Paz", detalle: "Cra. 45 #50-168 · Barranquilla", frente: "/sedes/plaza-de-la-paz-frente.jpg" },
};
