import Link from "next/link";

// Sección "la app": explica en la home QUÉ hace la aplicación y para qué sirve
// entrar con Google. Google la exige para verificar la pantalla de consentimiento
// OAuth ("your home page does not explain the purpose of your app") y además el
// nombre "Barbas & Bigotes" debe coincidir con el App name configurado allá.
const PASOS = [
  {
    n: "01",
    titulo: "Reservá en 30 segundos",
    texto:
      "Elegí sede, servicio, barbero y hora. Ves los horarios libres en tiempo real y tu cupo queda confirmado al instante.",
  },
  {
    n: "02",
    titulo: "Entrá con tu cuenta de Google",
    texto:
      "Opcional, pero te deja todo a mano: tus citas guardadas, tu lugar en la fila y tu tarjeta de cortes. Solo usamos tu nombre, tu correo y tu foto de perfil.",
  },
  {
    n: "03",
    titulo: "Te avisamos nosotros",
    texto:
      "Confirmación al reservar, recordatorio el día antes y aviso si se libera un cupo más temprano. Cancelás o reagendás vos mismo hasta 2 horas antes.",
  },
];

export function HomeApp() {
  return (
    <section id="la-app" className="mx-auto max-w-[1180px] px-6 pt-[52px] md:px-16">
      <div className="text-center">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.34em] text-accent-soft">
          Reservas online
        </p>
        <h2 className="mt-3 font-display text-[34px] font-extrabold uppercase leading-[0.95] md:text-[44px]">
          Barbas &amp; Bigotes
        </h2>
        <p className="mx-auto mt-4 max-w-[58ch] text-[15px] leading-[1.7] text-muted">
          Esta aplicación se llama <strong className="text-ink">Barbas &amp; Bigotes</strong> y es
          el sistema de reservas de nuestra barbería en Barranquilla, Colombia. Con ella agendás tu
          cita por internet, mirás tu historial de visitas y seguís tu tarjeta de cortes, sin llamar
          ni esperar en el local. La desarrolla y opera Barbas &amp; Bigotes Barbershop.
        </p>
      </div>

      <div className="mt-9 grid gap-3 md:grid-cols-3">
        {PASOS.map((p) => (
          <div
            key={p.n}
            className="rounded-[18px] border border-line bg-panel p-6 transition hover:border-accent/40"
          >
            <div className="font-display text-[13px] font-extrabold tracking-[0.1em] text-accent">
              {p.n}
            </div>
            <h3 className="mt-2.5 font-display text-[21px] font-bold uppercase leading-tight">
              {p.titulo}
            </h3>
            <p className="mt-2 text-[14px] leading-[1.65] text-muted">{p.texto}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/reservar"
          className="rounded-full bg-accent px-8 py-3.5 text-center text-[13px] font-bold uppercase tracking-[0.1em] text-on-accent transition hover:bg-accent-soft"
        >
          Reservar mi cita
        </Link>
        <Link
          href="/cuenta"
          className="rounded-full border border-line px-8 py-3.5 text-center text-[13px] font-bold uppercase tracking-[0.1em] text-ink transition hover:border-accent/40"
        >
          Entrar a mi cuenta
        </Link>
      </div>

      <p className="mx-auto mt-5 max-w-[60ch] text-center text-[12.5px] leading-relaxed text-muted">
        Usar la app es gratis. Mirá cómo tratamos tu información en la{" "}
        <Link href="/privacidad" className="text-accent-soft underline decoration-line underline-offset-4">
          política de privacidad
        </Link>{" "}
        y las reglas de reserva en los{" "}
        <Link href="/terminos" className="text-accent-soft underline decoration-line underline-offset-4">
          términos y condiciones
        </Link>
        .
      </p>
    </section>
  );
}
