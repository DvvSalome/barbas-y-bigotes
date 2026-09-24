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
      "Walk-in: nombre, servicio y a la silla. Si estás ocupado va a Espera, y el sistema le avisa al primero de la fila apenas se libera un cupo.",
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
    que: "Cupones y avisos",
    detalle:
      "Cupones con tope de usos y vencimiento, y cuánto antes de la cita se le avisa al cliente.",
  },
  {
    n: "Métricas",
    que: "Cómo viene el negocio",
    detalle:
      "Plata, cobros y ticket contra el período anterior; quién produce, qué se pide y qué se vende. Con archivo para el contador.",
  },
];

const AUTOMATICO = [
  "Cuando alguien reserva, le llega la confirmación por correo.",
  "El día antes y un rato antes de la cita, el recordatorio.",
  "Si mueves o cancelas una cita desde el calendario, le llega el correo — y el panel te ofrece avisarle por WhatsApp con el mensaje ya escrito.",
  "Cuando se libera un cupo, le avisa al primero de la lista de espera.",
  "Un par de horas después del corte, la invitación a dejar reseña en Google.",
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

        <Plegable titulo="Lo que sale solo" subtitulo="Los avisos automáticos. Si alguno no llegó, es una falla — avisa">
          <ul className={CAJA}>
            {AUTOMATICO.map((t) => (
              <li
                key={t}
                className="flex gap-3 border-b border-line/60 px-4 py-3 text-[13px] leading-relaxed text-muted last:border-b-0"
              >
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                {t}
              </li>
            ))}
          </ul>
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
