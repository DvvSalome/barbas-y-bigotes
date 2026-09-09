import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ClienteLoginButton } from "@/components/cuenta/ClienteAuth";
import { EliminarCuenta } from "@/components/cuenta/EliminarCuenta";
import { ensureCliente } from "@/lib/cliente-actions";

export const metadata: Metadata = {
  title: "Eliminar mi cuenta",
  description: "Cómo eliminar tu cuenta de Barbas & Bigotes: qué se borra, qué se conserva y cómo hacerlo en un toque.",
};

// Página pública: Google Play exige un enlace de eliminación de cuenta que se
// pueda abrir sin instalar la app (y es el derecho de supresión de la Ley 1581).
// Explica qué se borra y qué se conserva, deja hacerlo acá mismo entrando con
// Google, y da un camino por escrito para quien ya no puede entrar.
export default async function EliminarCuentaPage() {
  const ctx = await ensureCliente();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.34em] text-accent-soft">Mi cuenta</p>
        <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-[0.95] text-balance">Eliminar mi cuenta</h1>
        <p className="mt-4 max-w-[52ch] text-muted">
          Si ya no querés tener cuenta en Barbas &amp; Bigotes, la podés eliminar acá. Tarda un segundo, no hay que
          pedirle nada a nadie y aplica tanto a la app como al sitio: es la misma cuenta.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-warn">Se borra</h2>
            <ul className="mt-3 grid gap-2 text-sm text-ink">
              <li>Tu nombre, teléfono y correo.</li>
              <li>El acceso con Google a la app y al sitio.</li>
              <li>Tus citas pendientes (se cancelan y el turno se libera).</li>
              <li>Las notas que dejaste al reservar y tus avisos al celular.</li>
              <li>Tu lugar en la lista de espera y los avisos por correo.</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-accent-soft">Se conserva</h2>
            <ul className="mt-3 grid gap-2 text-sm text-ink">
              <li>
                Los registros de pago de tus visitas, <strong>sin tus datos personales</strong>: la ley colombiana obliga a
                guardarlos por temas contables y tributarios.
              </li>
              <li>Las calificaciones que diste, ya sin tu nombre ni tus comentarios.</li>
            </ul>
          </section>
        </div>

        <section className="mt-10">
          {ctx.estado === "anon" && (
            <div className="rounded-2xl border border-line bg-panel p-6 text-center">
              <p className="text-sm text-muted">Entrá con la cuenta de Google que usás en la app y confirmá la eliminación.</p>
              <div className="mt-5 flex justify-center">
                <ClienteLoginButton next="/cuenta/eliminar" />
              </div>
            </div>
          )}
          {ctx.estado === "cliente" && <EliminarCuenta nombre={ctx.nombre} />}
          {ctx.estado === "staff" && (
            <div className="rounded-2xl border border-line bg-panel p-6">
              <p className="text-sm text-muted">
                Entraste con una cuenta del equipo. Esas cuentas las administra el dueño desde el panel; esta página es
                para los clientes.
              </p>
            </div>
          )}
        </section>

        <section className="mt-10 text-sm text-muted">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-ink">¿No podés entrar?</h2>
          <p className="mt-3">
            Si perdiste el acceso a tu cuenta de Google, pedinos la eliminación por escrito: mandá un correo a{" "}
            <a href="mailto:reservas@barbasybigotes.com" className="text-accent-soft transition hover:text-accent">
              reservas@barbasybigotes.com
            </a>{" "}
            desde el correo de tu cuenta, o escribinos por{" "}
            <a href="https://wa.me/573006734799" className="text-accent-soft transition hover:text-accent">
              WhatsApp
            </a>{" "}
            desde el número con el que reservaste. Lo hacemos en máximo 5 días hábiles y te confirmamos.
          </p>
          <p className="mt-3">
            Qué datos guardamos y para qué, en la{" "}
            <Link href="/privacidad" className="text-accent-soft transition hover:text-accent">
              política de privacidad
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
