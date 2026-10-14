// POST /api/avisos/caja — "la caja sigue abierta": lo dispara un cron externo
// (GitHub Actions, 21:05 Bogotá) con el header x-push-secret. Busca cajas en
// estado 'abierta' y avisa:
//   · a la SEDE (la pantalla del mostrador), que es quien puede cerrarla;
//   · al DUEÑO, en sus aparatos y por correo (alertas, 0084). Antes solo iba a
//     la sede, y con 0 aparatos del local suscritos no le llegaba a nadie: una
//     caja quedó 15 días abierta y el cron respondía "ok".
// Nace del caso real del piloto: una caja quedó 22 días abierta y nadie lo vio
// hasta entrar al cuadre.
// ?dry=1 = ensayo: reporta qué mandaría sin notificar a nadie.
//
// La respuesta dice la verdad: cuántos aparatos lo recibieron, si quedó un
// correo para el dueño, y `nadieRecibio: true` cuando no le llegó a nadie.

import { supabaseAdmin } from "@/lib/supabase/server";
import { pushASede, pushAAdmins } from "@/lib/push";
import { encolarAvisoDueno } from "@/lib/avisos-dueno";
import { conteo } from "@/lib/avisos-reglas";
import { secretoCronValido } from "@/lib/cron-secret";
import { horaBogota, diasDesde } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!secretoCronValido(request.headers.get("x-push-secret"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("caja_sesiones")
    .select("sede_id,abierta_en")
    .eq("estado", "abierta");
  if (error) return Response.json({ ok: false, error: "No se pudo leer las cajas" }, { status: 500 });

  const abiertas = (data ?? []) as { sede_id: string; abierta_en: string }[];

  // Nombres de las sedes (para el texto) y a cuántos correos del dueño les llegan
  // las alertas (null = la tabla de 0084 todavía no existe).
  const { data: sedes } = await admin.from("sedes").select("id,nombre");
  const nombreSede = new Map(((sedes ?? []) as { id: string; nombre: string }[]).map((s) => [s.id, s.nombre]));
  // conteo(): con la tabla sin crear el HEAD no trae error, solo count null.
  const correosDueno = conteo(
    await admin.from("avisos_dueno").select("id", { count: "exact", head: true }).eq("recibe_alertas", true),
  );

  const resultados: {
    sede: string;
    mostrador?: { enviadas: number; fallidas: number };
    dueno?: { enviadas: number; fallidas: number };
    correoEncolado?: boolean;
  }[] = [];

  for (const c of abiertas) {
    if (dry) {
      resultados.push({ sede: c.sede_id });
      continue;
    }
    const sede = nombreSede.get(c.sede_id) ?? c.sede_id;
    const dias = diasDesde(c.abierta_en);
    const desde = dias === 0 ? `las ${horaBogota(c.abierta_en)}` : dias === 1 ? "ayer" : `hace ${dias} días`;

    // El celular del dueño es personal: de madrugada no se le hace sonar (el cron
    // de GitHub a veces corre horas tarde). El correo igual queda en la cola y la
    // base lo retiene hasta las 7 am (tomar_avisos_dueno, 0084).
    const rDueno = enHorarioDelDueno()
      ? await pushAAdmins({
          title: `La caja de ${sede} sigue abierta 💰`,
          body: `Se abrió ${dias === 0 ? "a " : ""}${desde} y nadie la ha cerrado. Ciérrala en Caja o pídele al mostrador que cuente el efectivo.`,
          url: "/admin/cuadre",
          // Por sede (igual que el del mostrador): si quedan las dos abiertas, el
          // dueño ve las dos; en un aparato compartido no se duplican.
          tag: `caja-abierta-${c.sede_id}`,
        })
      : { enviadas: 0, fallidas: 0 };
    // El del dueño va ANTES que el del mostrador: comparten tag, y en un aparato
    // que es de los dos (la tableta del local, 0085) queda el último, que tiene
    // que abrir el cierre del mostrador y no el panel del admin.
    const rSede = await pushASede(c.sede_id, {
      title: "La caja sigue abierta 💰",
      body: `Se abrió ${dias === 0 ? "a " : ""}${desde} y aún no se cierra. Cuenta el efectivo y ciérrala en el mostrador antes de salir.`,
      url: "/barbero?tab=cierre",
      // El MISMO tag que el del dueño: si el cron repite, el aviso se REEMPLAZA en
      // vez de apilarse, y en un aparato que es de la sede y del dueño a la vez
      // (0085, la tableta del local) queda UNA notificación por sede, no dos.
      tag: `caja-abierta-${c.sede_id}`,
    });
    const correoEncolado = await encolarCajaAbierta(c.sede_id, sede, c.abierta_en, dias);
    resultados.push({
      sede: c.sede_id,
      mostrador: { enviadas: rSede.enviadas, fallidas: rSede.fallidas },
      dueno: { enviadas: rDueno.enviadas, fallidas: rDueno.fallidas },
      correoEncolado,
    });
  }

  const entregadosPush = resultados.reduce((a, r) => a + (r.mostrador?.enviadas ?? 0) + (r.dueno?.enviadas ?? 0), 0);
  // El correo solo cuenta si hay a quién mandarlo (algún correo del dueño con las
  // alertas prendidas): encolar sin destinatario no es avisar.
  const correoConDestino = (correosDueno ?? 0) > 0 && resultados.some((r) => r.correoEncolado);
  const nadieRecibio = !dry && abiertas.length > 0 && entregadosPush === 0 && !correoConDestino;

  return Response.json({
    ok: true,
    dry,
    cajasAbiertas: abiertas.length,
    entregadosPush,
    correosDueno,
    nadieRecibio,
    ...(nadieRecibio
      ? {
          aviso:
            "Nadie recibió el aviso: ni el mostrador ni el dueño tienen avisos al celular, y el dueño no tiene correo para alertas en Avisos.",
        }
      : {}),
    resultados,
  });
}

/** Entre 7 am y 10 pm en Bogotá: la hora en que se le puede hacer sonar el celular al dueño. */
function enHorarioDelDueno(ahora = new Date()): boolean {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "numeric", hourCycle: "h23" }).format(ahora),
  );
  return hora >= 7 && hora < 22;
}

/**
 * El correo de "caja abierta" para el dueño. Uno por sede cada 12 horas aunque el
 * cron se dispare a mano varias veces: el buzón de reservas@ no puede mandar
 * ráfagas. Devuelve si quedó encolado (o si ya había uno reciente).
 */
async function encolarCajaAbierta(sedeId: string, sede: string, abiertaEn: string, dias: number): Promise<boolean> {
  try {
    const hace12h = new Date(Date.now() - 12 * 3_600_000).toISOString();
    const recientes = conteo(
      await supabaseAdmin()
        .from("aviso_dueno_cola")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "caja_abierta")
        .eq("datos->>sede_id", sedeId)
        .gte("creado_en", hace12h),
    );
    if (recientes === null) return false; // sin la tabla (0084) no hay correo que encolar
    if (recientes > 0) return true;
    return await encolarAvisoDueno("caja_abierta", { sede, sede_id: sedeId, abierta_en: abiertaEn, dias });
  } catch (e) {
    console.error("[encolarCajaAbierta]", e);
    return false;
  }
}
