import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Plegable } from "@/components/ui/Plegable";
import { CANCELACION_MIN_HORAS } from "@/lib/slots";

export const metadata: Metadata = { title: "Cómo se usa · Admin" };

// La guía vive DENTRO de la app, no en un PDF suelto: el PDF se desactualiza el
// día que cambia una pantalla y nadie lo vuelve a abrir. Esto se lee desde el
// mismo celular donde se está trabajando y se corrige junto con el código.

type Paso = { n: string; que: string; detalle: string };

const MOSTRADOR: Paso[] = [
  {
    n: "1",
    que: "Entra con tu PIN",
    detalle:
      "En el celular del local, toca tu foto y escribe tus 6 números. Si te equivocas 5 veces se bloquea 5 minutos — pídele al dueño que lo desbloquee desde Equipo.",
  },
  {
    n: "2",
    que: "Turnos: el día en orden",
    detalle:
      "Cada tarjeta es un cliente. Arriba los que ya llegaron, abajo lo que viene. El chip dice si confirmó su cita o no.",
  },
  {
    n: "3",
    que: "Llegó, a la silla",
    detalle:
      "Cuando el cliente entra, toca Llegó. Solo se habilita cerca de la hora: si la cita es en más de 2 horas el botón no deja, así nadie cierra por error la cita de la tarde.",
  },
  {
    n: "4",
    que: "Cobrar",
    detalle:
      "Al terminar, Cobrar: elige el medio de pago y suma productos si se llevó algo. La propina va aparte, y puedes marcar que te la dieron en efectivo aunque el corte fuera por Nequi.",
  },
  {
    n: "5",
    que: "El que llega sin cita",
    detalle:
      "Walk-in: nombre, servicio y a la silla. Si estás ocupado va a Espera. Si se cancela una cita que todavía no pasó, a los que se anotaron en los últimos 2 días y dejaron su correo les llega el aviso del cupo libre: el primero que reserva se lo queda.",
  },
  {
    n: "6",
    que: "Cerrar la caja",
    detalle:
      "Al final del día, pestaña Cierre: cuentas el efectivo, lo escribes y el sistema te dice si cuadra. Si no la cierras, mañana sigue sumando ahí y el corte del día se mezcla.",
  },
];

const PANEL: Paso[] = [
  {
    n: "Hoy",
    que: "La pantalla de abrir",
    detalle:
      "Cuánto entró, cuántas atenciones, ticket promedio, propinas, qué tan llena está la agenda y la plata que se atendió sin pasar por caja. Abajo, cada barbero con lo que lleva cobrado.",
  },
  {
    n: "Agenda",
    que: "El calendario",
    detalle:
      "Una columna por barbero. Toca un hueco para agendar, o una cita para verla, moverla o cancelarla. Con mouse se arrastra. Bloquear tapa horas: almuerzo, diligencia, lo que sea.",
  },
  {
    n: "Caja",
    que: "Cuadre, gastos y adelantos",
    detalle:
      "El cierre de cada sede, los gastos del día y los adelantos a los barberos. Acá también se prenden o apagan los medios de pago que aparecen al cobrar.",
  },
  {
    n: "Clientes",
    que: "Las fichas",
    detalle:
      "Historial, notas del staff, saldo a favor y reseñas. Si alguien quedó con dos fichas, Fichas repetidas las une sin perder nada.",
  },
  {
    n: "Catálogo",
    que: "Servicios y productos",
    detalle:
      "Toca cualquier precio para cambiarlo, y puede ser distinto por sede. Sube la foto y la descripción que ve el cliente al reservar. En Productos: stock, mínimos y qué se le ofrece al final de la reserva.",
  },
  {
    n: "Equipo",
    que: "Barberos, comisiones y horarios",
    detalle:
      "PINes, especialidades, tipo de contrato (comisión o arriendo) y el horario de cada sede, con excepciones para festivos o cierres.",
  },
  {
    n: "Marketing",
    que: "Cupones, tarjeta y avisos",
    detalle:
      "Cupones con tope de usos y vencimiento, la tarjeta de cortes y los avisos: los tuyos (a qué correo te llegan las citas, los cierres y las alertas) y los del cliente.",
  },
  {
    n: "Métricas",
    que: "Cómo viene el negocio",
    detalle:
      "Plata, cobros y ticket contra el período anterior; quién produce, qué se pide y qué se vende. Con archivo para el contador.",
  },
];

// Cada aviso con DE QUÉ depende y DÓNDE se arregla. Antes la lista prometía
// avisos sin decir que el del barbero necesita su correo, que la reseña necesita
// elegir al cliente al cobrar o que el cupo libre no va "al primero", y pedía
// "avisar" si algo fallaba sin decir a quién.
const AUTOMATICO: { t: string; depende: string }[] = [
  {
    t: "Cuando alguien reserva, le llega la confirmación por correo.",
    depende: "Que el cliente haya dejado su correo.",
  },
  {
    t: "El día antes, el recordatorio; y un rato antes de la cita, otro aviso.",
    depende:
      "El correo del cliente. Al que reservó ese mismo día no le llega el del día antes. El de «un rato antes» se prende y se ajusta en Ajustes → Avisos.",
  },
  {
    t: "Si mueves o cancelas una cita desde la agenda o el mostrador, al cliente le llega el correo, y el panel te ofrece avisarle por WhatsApp con el mensaje ya escrito.",
    depende: "El correo del cliente; para el WhatsApp, su teléfono.",
  },
  {
    t: "Si se cancela una cita que todavía no pasó, a los de la lista de espera de esa sede les llega el aviso del cupo libre.",
    depende:
      "Que se hayan anotado en los últimos 2 días y hayan dejado su correo. Marcar que alguien no vino no lo dispara: ese turno ya pasó.",
  },
  {
    t: "Un par de horas después del cobro, la invitación a calificar la visita y a dejar la reseña en Google, con lo que le falta para su próximo premio de la tarjeta.",
    depende: "Que al cobrar se elija al cliente y tenga correo. Le llega una vez al mes como máximo.",
  },
  {
    t: "Al barbero le llega por correo cada cita que le agendan.",
    depende: "Su correo en Ajustes → Barberos y PINes, en su ficha. Con «Probar» confirmas que le llega.",
  },
  {
    t: "A ti te llegan la cita que reservan por la web, el resumen de cada cierre de caja y las alertas (una caja que sigue abierta, una calificación de 3 o menos).",
    depende: "Tu correo en Ajustes → Avisos → «Avisos para ti», y los avisos activados en tu celular.",
  },
  {
    t: "Al mostrador y al barbero les suena en el celular la cita que un cliente reserva por la web y la que cancela o mueve desde su cuenta; «la caja sigue abierta», solo al mostrador (y a ti). Lo que se agenda, mueve o cancela desde el mostrador o la agenda no suena.",
    depende:
      "Que cada uno active los avisos en SU aparato: el mostrador entrando con el PIN de la sede y cada barbero con el suyo, en Turnos → «Activar avisos». Tú no los puedes activar por ellos; el Inicio te dice a quién le falta.",
  },
];

const REGLAS: [string, string][] = [
  [
    "Cierra la caja todos los días",
    "Si queda abierta, lo de mañana se suma a lo de hoy y el cuadre deja de servir para saber cuánto entró de verdad.",
  ],
  [
    `El cliente cambia su cita hasta ${CANCELACION_MIN_HORAS} horas antes`,
    "Con menos tiempo tiene que escribir por WhatsApp, y ahí se la mueves tú desde la agenda.",
  ],
  [
    "Cobra siempre desde la cita",
    "Si cobras por fuera, la venta no queda atada al cliente: se pierde el historial y la comisión queda coja.",
  ],
];

const CAJA = "overflow-hidden rounded-2xl border border-line bg-panel";

export default function AyudaPage() {
  return (
    <div className="max-w-4xl">
      <SectionHeader
        eyebrow="Cómo se usa"
        title="Guía rápida"
        description="Lo que hace falta para operar el día. Vive acá adentro a propósito: si cambia una pantalla, cambia esta guía."
      />

      {/* Cuatro plegables en vez de cuatro secciones abiertas. Medido: la
          pantalla eran 3.569 px de texto corrido a 390 px —la más larga del
          panel que no tiene nada que tocar— y para llegar a "Tres reglas" había
          que pasar por todo lo demás. Ahora los cuatro temas se ven de una y se
          abre el que hace falta.

          `Plegable` es <details> nativo: abre sin JavaScript y el buscador del
          navegador (Ctrl-F) encuentra el texto aunque esté cerrado, que en una
          guía importa más que en cualquier otra pantalla.

          El del mostrador arranca ABIERTO: es el que se consulta de verdad, y
          casi siempre desde el celular del local con el cliente esperando. */}
      <div className="mt-6 rounded-2xl border border-line bg-panel px-4 [&>details:first-child]:border-t-0">
        <Plegable
          titulo="En el mostrador"
          subtitulo="Los 6 pasos del día, para los barberos"
          abierto
        >
          <Link
            href="/barbero"
            className="mb-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-ink/85 underline decoration-line underline-offset-4 transition hover:text-ink"
          >
            Abrir el mostrador →
          </Link>
          <ol className={CAJA}>
            {MOSTRADOR.map((p) => (
              <li
                key={p.n}
                className="grid grid-cols-[34px_1fr] gap-3 border-b border-line/60 px-4 py-3.5 last:border-b-0"
              >
                <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full border border-accent/40 font-display text-[13px] font-bold text-accent-soft">
                  {p.n}
                </span>
                <span>
                  <span className="block text-[14.5px] font-bold text-ink">{p.que}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{p.detalle}</span>
                </span>
              </li>
            ))}
          </ol>
        </Plegable>

        <Plegable titulo="En el panel" subtitulo="Qué hay en cada pestaña — acá se mira y se decide, no se opera">
          <div className="grid gap-3 sm:grid-cols-2">
            {PANEL.map((p) => (
              <div key={p.n} className={`${CAJA} bb-relieve px-4 py-3.5`}>
                <span className="inline-block rounded-full border border-line px-2.5 py-0.5 font-display text-[12px] font-bold uppercase tracking-wide text-accent-soft">
                  {p.n}
                </span>
                <span className="mt-2 block text-[14.5px] font-bold text-ink">{p.que}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{p.detalle}</span>
              </div>
            ))}
          </div>
        </Plegable>

        <Plegable titulo="Lo que sale solo" subtitulo="Los avisos automáticos y de qué depende cada uno">
          <ul className={CAJA}>
            {AUTOMATICO.map((a) => (
              <li
                key={a.t}
                className="flex gap-3 border-b border-line/60 px-4 py-3 text-[13px] leading-relaxed last:border-b-0"
              >
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                <span>
                  <span className="block text-ink/90">{a.t}</span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    <span className="font-semibold">Depende de:</span> {a.depende}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            Si uno no llega y lo de arriba está bien, escríbele a soporte de FourG con el nombre del cliente y la hora de la
            cita. El Inicio, en «Para dejar listo», te muestra lo que falta configurar.
          </p>
        </Plegable>

        <Plegable titulo="Tres reglas que evitan líos" subtitulo="Caja, cambios de cita y cobros">
          <div className="grid gap-3 sm:grid-cols-3">
            {REGLAS.map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-warn/35 bg-warn/[0.06] px-4 py-3.5">
                <span className="block text-[13.5px] font-bold text-warn">{t}</span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{d}</span>
              </div>
            ))}
          </div>
        </Plegable>
      </div>

    </div>
  );
}
