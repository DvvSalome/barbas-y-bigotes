import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones de uso de la aplicación de reservas de Barbas & Bigotes Barbershop: reservas, cancelaciones, tarjeta de cortes y precios.",
};

// Página exigida por Google (pantalla de consentimiento OAuth). Las reglas acá
// descritas son las que la app aplica de verdad (ventana de 2h en slots.ts,
// tarjeta 10 cortes en tarjeta.ts): si cambian las constantes, actualizar acá.
export default function TerminosPage() {
  return (
    <LegalLayout
      titulo="Términos y condiciones"
      actualizado="19 de julio de 2026"
      intro="Las reglas del juego para reservar con nosotros por internet. Son las mismas que aplicamos en la barbería, escritas para que no haya sorpresas."
    >
      <section>
        <h2>De qué se trata</h2>
        <p>
          Esta aplicación es el sistema de reservas de <strong>Barbas &amp; Bigotes Barbershop</strong>,
          Barranquilla. Sirve para agendar tu cita, ver tu historial y llevar tu tarjeta de cortes.
          Usarla es gratis; lo que se paga es el servicio en la barbería.
        </p>
      </section>

      <section>
        <h2>Tu cita</h2>
        <ul>
          <li>Puedes reservar como invitado (con nombre y correo) o entrando con tu cuenta de Google.</li>
          <li>La cita queda confirmada al instante y te llega un correo con los detalles.</li>
          <li>Los horarios que ves disponibles son reales y se actualizan en vivo. Si dos personas eligen el mismo horario, se queda quien confirme primero.</li>
          <li>Te pedimos llegar unos minutos antes. Si llegas tarde, hacemos lo posible por atenderte, pero puede que el turno se corra o se reasigne.</li>
        </ul>
      </section>

      <section>
        <h2>Cancelar o reagendar</h2>
        <ul>
          <li>
            Puedes cancelar o cambiar tu cita tú mismo desde <Link href="/cuenta">Mi cuenta</Link>{" "}
            hasta <strong>2 horas antes</strong> de la hora reservada.
          </li>
          <li>
            Dentro de esas 2 horas, escríbenos por{" "}
            <a href="https://wa.me/573006734799" target="_blank" rel="noopener noreferrer">WhatsApp</a>{" "}
            y lo resolvemos.
          </li>
          <li>
            Cuando cancelas a tiempo, tu cupo se le ofrece automáticamente a quien esté en la lista
            de espera. Cancelar a tiempo nos ayuda un montón.
          </li>
          <li>
            Si no llegas y no avisas, la cita queda registrada como <strong>no asistida</strong>.
            Si se vuelve costumbre, podemos pedirte confirmar por teléfono antes de agendarte de nuevo.
          </li>
        </ul>
        <p>
          También nosotros podemos cancelar una cita por una eventualidad (un barbero que se
          enferma, una falla del local). En ese caso te avisamos apenas pase y reagendamos.
        </p>
      </section>

      <section>
        <h2>Tarjeta de cortes</h2>
        <ul>
          <li>Cada corte que te haces suma un sello. Son <strong>10 sellos</strong> por tarjeta.</li>
          <li>En el <strong>5º corte</strong> te llevas <strong>un regalo de la casa</strong> (el corte lo pagas normal).</li>
          <li>En el <strong>10º corte</strong> tienes <strong>50% de descuento</strong> sobre el corte.</li>
          <li>Al completarla, la tarjeta arranca de nuevo.</li>
          <li>
            El beneficio aplica solo sobre el corte, es personal, no se transfiere y no se cambia
            por dinero. Los sellos se cuentan por las visitas cobradas en la barbería.
          </li>
        </ul>
      </section>

      <section>
        <h2>Precios</h2>
        <p>
          Los precios que ves al reservar son los vigentes para esa sede y pueden cambiar. El valor
          final es el que se cobra en la barbería al terminar el servicio. Si un servicio requiere
          más trabajo del previsto, el barbero te lo comenta <strong>antes</strong> de hacerlo.
        </p>
      </section>

      <section>
        <h2>Uso correcto</h2>
        <p>
          Te pedimos usar datos reales al reservar y no hacer reservas falsas o masivas que le
          quiten el turno a otros clientes. Si detectamos ese uso, podemos cancelar esas citas y
          restringir el acceso.
        </p>
      </section>

      <section>
        <h2>Responsabilidad</h2>
        <p>
          Ponemos todo para que la aplicación esté siempre disponible, pero puede tener
          interrupciones por mantenimiento o fallas de terceros. Si el sistema llegara a fallar,
          tu cita sigue valiendo: acércate a la sede o escríbenos por WhatsApp y te atendemos igual.
        </p>
      </section>

      <section>
        <h2>Tus datos</h2>
        <p>
          Cómo tratamos tu información está en nuestra{" "}
          <Link href="/privacidad">política de privacidad</Link>.
        </p>
      </section>

      <section>
        <h2>Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes de la República de Colombia. Cualquier tema lo
          resolvemos primero hablando: <a href="mailto:hola@barbasybigotes.com">hola@barbasybigotes.com</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
