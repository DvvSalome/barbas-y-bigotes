import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo Barbas & Bigotes Barbershop trata los datos personales de sus clientes: qué recolectamos, para qué, con quién se comparte y cómo ejerces tus derechos (Ley 1581 de 2012).",
};

// Página exigida por Google (pantalla de consentimiento OAuth) y por la Ley 1581
// de 2012 (Habeas Data, Colombia). El contenido describe el tratamiento REAL de
// la app: si cambia el modelo de datos, actualizar acá también.
export default function PrivacidadPage() {
  return (
    <LegalLayout
      titulo="Política de privacidad"
      actualizado="19 de julio de 2026"
      intro="En Barbas & Bigotes cuidamos tus datos como cuidamos tu corte. Acá te contamos en español claro qué información guardamos, para qué la usamos y cómo pedirnos que la borremos. Sin letra chica."
    >
      <section>
        <h2>Quién responde por tus datos</h2>
        <p>
          <strong>Barbas &amp; Bigotes Barbershop</strong>, con sedes en Parque Venezuela
          (Cl. 88 #44-10 Loc 4) y Plaza de la Paz (Cra. 45 #50-168), Barranquilla, Colombia.
          Contacto para temas de datos: <a href="mailto:reservas@barbasybigotes.com">reservas@barbasybigotes.com</a>.
        </p>
      </section>

      <section>
        <h2>Qué datos guardamos</h2>
        <p>Solo lo necesario para atenderte:</p>
        <ul>
          <li>
            <strong>Al reservar:</strong> tu nombre y tu correo. El teléfono es opcional y
            sirve para contactarte si pasa algo con tu cita.
          </li>
          <li>
            <strong>Si entras con Google:</strong> tu nombre, tu correo y tu foto de perfil,
            tal como Google nos los entrega. <strong>Nunca vemos tu contraseña de Google</strong>,
            y no accedemos a tu Gmail, contactos ni ningún otro dato de tu cuenta.
          </li>
          <li>
            <strong>De tus visitas:</strong> qué servicio tomaste, con qué barbero, cuándo, el
            valor cobrado y tu avance en la tarjeta de cortes.
          </li>
          <li>
            <strong>Si activas las notificaciones:</strong> un identificador técnico de tu
            navegador para poder enviarte el aviso. No identifica tu dispositivo ni tu ubicación.
          </li>
        </ul>
        <p>
          No pedimos ni guardamos datos de tarjetas ni cuentas bancarias: los pagos se hacen
          en la barbería, por fuera de esta aplicación.
        </p>
      </section>

      <section>
        <h2>Para qué los usamos</h2>
        <ul>
          <li>Agendar, recordar y gestionar tus citas.</li>
          <li>Avisarte por correo o notificación: confirmación, recordatorio del día anterior y cuando se libera un cupo si estás en la lista de espera.</li>
          <li>Llevar tu tarjeta de cortes (un regalo en el 5º corte y 50% en el 10º).</li>
          <li>Que el barbero sepa a quién atiende y qué le gustó la última vez.</li>
          <li>Invitarte a dejar una reseña después de tu visita, si quieres.</li>
        </ul>
        <p>
          <strong>No vendemos tus datos a nadie</strong>, ni los usamos para publicidad de terceros.
        </p>
      </section>

      <section>
        <h2>Con quién los compartimos</h2>
        <p>
          Solo con los proveedores que hacen funcionar la aplicación, y únicamente para eso:
        </p>
        <ul>
          <li><strong>Supabase</strong> — guarda la base de datos y maneja el inicio de sesión.</li>
          <li><strong>Vercel</strong> — sirve el sitio web.</li>
          <li><strong>Google</strong> — solo si eliges entrar con tu cuenta de Google.</li>
          <li><strong>Hostinger</strong> — envía los correos desde nuestro dominio.</li>
        </ul>
        <p>
          Algunos de estos proveedores procesan la información en servidores fuera de Colombia.
          Al usar la aplicación aceptas esa transferencia, hecha bajo los estándares de
          seguridad de cada proveedor.
        </p>
      </section>

      <section>
        <h2>Cuánto tiempo los guardamos</h2>
        <p>
          Mientras seas cliente y mantengas tu cuenta o tu historial con nosotros. Si nos pides
          que borremos tus datos, lo hacemos; conservamos únicamente los registros de ventas que
          la ley colombiana nos obliga a mantener por temas contables y tributarios.
        </p>
      </section>

      <section>
        <h2>Tus derechos</h2>
        <p>
          Según la <strong>Ley 1581 de 2012</strong> y el Decreto 1377 de 2013, en cualquier momento puedes:
        </p>
        <ul>
          <li>Saber qué datos tuyos tenemos.</li>
          <li>Corregirlos si están mal o desactualizados.</li>
          <li>
            Pedir que los borremos, o hacerlo vos mismo desde{" "}
            <Link href="/cuenta/eliminar">Eliminar mi cuenta</Link>.
          </li>
          <li>Revocar el permiso que nos diste para tratarlos.</li>
        </ul>
        <p>
          Para cualquiera de estas, escríbenos a{" "}
          <a href="mailto:reservas@barbasybigotes.com">reservas@barbasybigotes.com</a>. Respondemos en
          un máximo de 15 días hábiles. Si entraste con Google, también puedes quitarle el acceso
          a esta aplicación desde{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            la configuración de tu cuenta de Google
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Cómo los protegemos</h2>
        <p>
          Toda la información viaja cifrada (HTTPS) y la base de datos aplica reglas de acceso
          por rol: cada cliente solo puede ver lo suyo, y cada barbero solo lo de su agenda. El
          acceso del personal a la aplicación va con clave o PIN personal.
        </p>
      </section>

      <section>
        <h2>Cambios</h2>
        <p>
          Si actualizamos esta política, cambiamos la fecha de arriba. Si el cambio es importante,
          te avisamos por correo. Puedes ver también nuestros{" "}
          <Link href="/terminos">términos y condiciones</Link>.
        </p>
      </section>
    </LegalLayout>
  );
}
