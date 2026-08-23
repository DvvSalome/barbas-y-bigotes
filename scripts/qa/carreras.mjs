// Las garantías que no puede romper nadie: que dos clientes no se queden con el
// mismo turno, y que una cita no se cobre dos veces.
//
//   node scripts/qa/carreras.mjs
//
// No necesita navegador. ESCRIBE EN PRODUCCIÓN (dispara reservas y ventas de
// verdad) y borra todo lo que crea, pase lo que pase.
//
// Por qué existe: estas reglas NO viven en el código, viven en la base — un
// EXCLUDE de Postgres para el solape y dos índices únicos para el cobro. Eso es
// bueno (la pantalla puede mentir, la base no), pero tiene un costo: si alguien
// borra un índice en una migración, NADA falla. La app sigue andando y un día
// aparecen dos clientes a la misma hora, o una cita cobrada dos veces. No hay
// error, no hay log: solo plata y clientes perdidos.
//
// Esto lo dispara a propósito. Correrlo después de cualquier migración que toque
// `reservas` o `ventas`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = Object.fromEntries(
  readFileSync(join(RAIZ, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};
const MARCA = "QA carreras";

const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
const crear = (tabla, fila) =>
  fetch(`${U}/rest/v1/${tabla}`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(fila),
  }).then(async (r) => ({ status: r.status, cuerpo: await r.json() }));
const borrar = (tabla, id) => fetch(`${U}/rest/v1/${tabla}?id=eq.${id}`, { method: "DELETE", headers: H });

const fallos = [];
const ok = (cond, msg) => {
  console.log((cond ? "  OK    " : "  FALLA ") + msg);
  if (!cond) fallos.push(msg);
};

/** Reparte n intentos EN PARALELO y cuenta cómo salió cada uno. */
async function carrera(n, hacer) {
  const res = await Promise.all(Array.from({ length: n }, (_, i) => hacer(i + 1)));
  return {
    ganadores: res.filter((r) => r.status === 201),
    rebotados: res.filter((r) => r.cuerpo?.code === "23P01" || r.cuerpo?.code === "23505").length,
    otros: res.filter((r) => r.status !== 201 && !["23P01", "23505"].includes(r.cuerpo?.code)),
  };
}

const creado = { reservas: [], ventas: [] };

try {
  const barbero = (await get("barberos?select=id,nombre&sede_id=eq.parque-venezuela&limit=1"))[0];
  const serv = (await get("servicio_sede?select=servicio_id&sede_id=eq.parque-venezuela&limit=1"))[0];
  if (!barbero || !serv) {
    console.log("No hay barbero o servicio en parque-venezuela para probar.");
    process.exit(1);
  }
  // Bien lejos en el futuro: no estorba ninguna agenda real.
  const base = new Date(Date.now() + 30 * 86_400_000);
  base.setUTCHours(19, 0, 0, 0);
  const cita = (ini, min, extra = {}) => ({
    sede_id: "parque-venezuela",
    barbero_id: barbero.id,
    servicio_id: serv.servicio_id,
    inicio: ini.toISOString(),
    fin: new Date(ini.getTime() + min * 60_000).toISOString(),
    estado: "confirmada",
    canal: "app",
    nota: MARCA,
    ...extra,
  });

  console.log(`Barbero de prueba: ${barbero.nombre} · ${base.toISOString().slice(0, 16)}Z\n`);

  // ---------------------------------------------------------------------------
  console.log("1) Ocho clientes peleando el MISMO turno");
  // ---------------------------------------------------------------------------
  const a = await carrera(8, () => crear("reservas", cita(base, 30)));
  creado.reservas.push(...a.ganadores.map((r) => r.cuerpo[0].id));
  ok(a.ganadores.length === 1, `gana UNO solo (ganaron ${a.ganadores.length}, rebotaron ${a.rebotados})`);
  ok(a.otros.length === 0, "los perdedores rebotan por solape, no por otro error");

  // ---------------------------------------------------------------------------
  console.log("\n2) Un turno que SE PISA con el anterior (no idéntico)");
  // ---------------------------------------------------------------------------
  // Importa desde que la grilla es de 15 min: alcanza con que se toquen.
  const encima = await crear("reservas", cita(new Date(base.getTime() + 15 * 60_000), 30));
  if (encima.status === 201) creado.reservas.push(encima.cuerpo[0].id);
  ok(encima.cuerpo?.code === "23P01", "una cita que arranca 15 min dentro de otra se rechaza");

  // Pegada al final NO se pisa: es justo lo que permite encadenar turnos.
  const pegada = await crear("reservas", cita(new Date(base.getTime() + 30 * 60_000), 30));
  if (pegada.status === 201) creado.reservas.push(pegada.cuerpo[0].id);
  ok(pegada.status === 201, "la que arranca justo cuando termina la otra SÍ entra (turnos encadenados)");

  // ---------------------------------------------------------------------------
  console.log("\n3) Cancelar libera el turno");
  // ---------------------------------------------------------------------------
  const ganadora = a.ganadores[0]?.cuerpo[0]?.id;
  if (ganadora) {
    await fetch(`${U}/rest/v1/reservas?id=eq.${ganadora}`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ estado: "cancelada" }),
    });
    const otra = await crear("reservas", cita(base, 30));
    if (otra.status === 201) creado.reservas.push(otra.cuerpo[0].id);
    ok(otra.status === 201, "cancelada la cita, el turno vuelve a estar libre");
  }

  // ---------------------------------------------------------------------------
  console.log("\n4) Seis cobros simultáneos de la MISMA cita");
  // ---------------------------------------------------------------------------
  const paraCobrar = (await crear("reservas", cita(new Date(base.getTime() + 5 * 3_600_000), 30))).cuerpo[0];
  creado.reservas.push(paraCobrar.id);
  const c = await carrera(6, () =>
    crear("ventas", {
      sede_id: "parque-venezuela",
      barbero_id: barbero.id,
      reserva_id: paraCobrar.id,
      medio: "efectivo",
      total: 35000,
      propina: 0,
      descuento: 0,
    }),
  );
  creado.ventas.push(...c.ganadores.map((r) => r.cuerpo[0].id));
  ok(c.ganadores.length === 1, `la cita se cobra UNA vez (cobraron ${c.ganadores.length}, rebotaron ${c.rebotados})`);

  // ---------------------------------------------------------------------------
  console.log("\n5) Cuatro clics del mismo botón (venta rápida, sin cita)");
  // ---------------------------------------------------------------------------
  const token = `qa-carreras-${Date.now()}`;
  const d = await carrera(4, () =>
    crear("ventas", {
      sede_id: "parque-venezuela",
      barbero_id: barbero.id,
      idem_token: token,
      medio: "efectivo",
      total: 20000,
      propina: 0,
      descuento: 0,
    }),
  );
  creado.ventas.push(...d.ganadores.map((r) => r.cuerpo[0].id));
  ok(d.ganadores.length === 1, `el doble clic cobra UNA vez (cobraron ${d.ganadores.length}, rebotaron ${d.rebotados})`);
} finally {
  for (const id of creado.ventas) await borrar("ventas", id);
  for (const id of creado.reservas) await borrar("reservas", id);
  const resto = await get(`reservas?select=id&nota=eq.${encodeURIComponent(MARCA)}`);
  for (const r of resto) await borrar("reservas", r.id);
  console.log(`\nLimpieza hecha · restos: ${(await get(`reservas?select=id&nota=eq.${encodeURIComponent(MARCA)}`)).length}`);
}

if (fallos.length) {
  console.log(`\nFALLARON ${fallos.length}:`);
  for (const f of fallos) console.log(`  · ${f}`);
  console.log("\nOJO: esto significa que la base dejó de proteger contra dobles reservas o dobles cobros.");
  process.exit(1);
}
console.log("\ncarreras OK — un turno es de uno solo, y una cita se cobra una sola vez.");
