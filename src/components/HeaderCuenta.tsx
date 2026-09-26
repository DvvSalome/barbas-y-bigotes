"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// Botón de cuenta INTELIGENTE del header (mismo lugar en móvil y escritorio):
//   • Deslogueado (o cargando) → pill "Entrar" que lleva a /cuenta.
//   • Logueado → chip con avatar + nombre que abre un menú (Mi cuenta / Cerrar sesión).
// Antes había un "Entrar" fijo arriba (que seguía diciendo "Entrar" aunque estuvieras
// logueado) y un "Cerrar sesión" suelto dentro de /cuenta: dos botones separados. Este
// los unifica arriba. Client component porque la sesión vive en el navegador.

const pill =
  "relative rounded-full border border-[rgba(242,237,228,0.16)] text-xs text-ink transition before:absolute before:-inset-2 before:content-['']";
// La versión grande (landing /propuesta): 44 px de alto, vidrio, y un ícono de
// persona para que se entienda de un vistazo aunque el texto no quepa.
const pillGrande =
  "relative inline-flex min-h-11 items-center gap-2 rounded-full border border-[rgba(242,237,228,0.22)] bg-[rgba(21,19,17,0.55)] text-[14px] font-semibold text-ink backdrop-blur-[12px] transition hover:border-[rgba(242,237,228,0.5)] hover:bg-[rgba(242,237,228,0.09)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent-soft";

type Sesion = { nombre: string; foto: string | null };

function PersonaIcono() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

export function HeaderCuenta({ grande = false }: { grande?: boolean }) {
  const router = useRouter();
  // undefined = todavía no sabemos; null = deslogueado; objeto = logueado.
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    let vivo = true;
    const leer = (user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) => {
      if (!user) {
        setSesion(null);
        return;
      }
      const m = user.user_metadata ?? {};
      const full = (m.full_name as string) || (m.name as string) || user.email || "";
      setSesion({
        nombre: full.split(" ")[0] || "Mi cuenta",
        foto: (m.avatar_url as string) || (m.picture as string) || null,
      });
    };
    sb.auth.getSession().then(({ data }) => {
      if (vivo) leer(data.session?.user ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (vivo) leer(session?.user ?? null);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Cerrar el menú al tocar afuera o con Escape.
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  async function salir() {
    setMenu(false);
    await supabaseBrowser().auth.signOut();
    router.refresh();
  }

  // Cargando o deslogueado → "Entrar" (evita el salto de mostrar el chip antes de saber).
  if (!sesion) {
    return grande ? (
      <Link href="/cuenta" aria-label="Entrar a mi cuenta" className={`${pillGrande} px-4`}>
        <PersonaIcono />
        <span className="max-[379px]:hidden">Entrar</span>
      </Link>
    ) : (
      <Link href="/cuenta" className={`${pill} px-3.5 py-[7px]`}>
        Entrar
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menu}
        className={grande ? `${pillGrande} py-1 pl-1 pr-3` : `${pill} flex items-center gap-2 py-1 pl-1 pr-2.5`}
      >
        <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-[11px] font-bold text-muted ${grande ? "h-9 w-9" : "h-7 w-7"}`}>
          {sesion.foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Google; <img> evita configurar el dominio en next/image
            <img src={sesion.foto} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            sesion.nombre.charAt(0).toUpperCase()
          )}
        </span>
        <span className="max-w-[92px] truncate font-semibold">{sesion.nombre}</span>
        <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-muted transition ${menu ? "rotate-180" : ""}`} aria-hidden>
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {menu && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_18px_44px_-16px_rgba(0,0,0,.7)]"
        >
          <Link
            href="/cuenta"
            role="menuitem"
            onClick={() => setMenu(false)}
            className="block px-4 py-3 text-sm text-ink transition hover:bg-elevated"
          >
            Mi cuenta
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={salir}
            className="block w-full border-t border-line/60 px-4 py-3 text-left text-sm font-semibold text-accent-soft transition hover:bg-elevated"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
