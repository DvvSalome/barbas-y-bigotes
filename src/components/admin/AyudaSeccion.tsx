"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

// El párrafo explicativo de cada sección, detrás de un "?" (decisión del dueño,
// 9-sep): ayuda la primera vez y estorba la número cincuenta. Abierto la
// primera vez que se ve la sección en ese navegador; después, cerrado hasta que
// se toque el "?".
//
// El "ya lo vio" se lee de localStorage UNA vez por sesión de navegación (caché
// de módulo): si se re-leyera en cada render, un refresh del realtime cerraría
// la ayuda mientras el dueño la está leyendo.
const visto = new Map<string, boolean>();
const suscribir = () => () => {};
const clave = (c: string) => `bb:ayuda:${c}`;

function leer(c: string): boolean {
  if (!visto.has(c)) {
    let v = true;
    try {
      v = localStorage.getItem(clave(c)) === "1";
    } catch {
      v = true;
    }
    visto.set(c, v);
  }
  return visto.get(c)!;
}

export function AyudaSeccion({ clave: c, titulo, children }: { clave: string; titulo: ReactNode; children: ReactNode }) {
  // En el servidor (y durante la hidratación) se asume "ya visto" → cerrado, sin
  // salto de layout; el cliente abre en su primer render propio si nunca lo vio.
  const yaVisto = useSyncExternalStore(suscribir, () => leer(c), () => true);
  const [forzado, setForzado] = useState<boolean | null>(null);
  const abierto = forzado ?? !yaVisto;

  useEffect(() => {
    try {
      localStorage.setItem(clave(c), "1");
    } catch {
      /* sin almacenamiento: se abre siempre, no pasa nada */
    }
  }, [c]);

  return (
    <>
      <div className="mt-1 flex items-center gap-2">
        {titulo}
        <button
          type="button"
          aria-expanded={abierto}
          aria-label={abierto ? "Ocultar la explicación" : "Qué es esta sección"}
          onClick={() => setForzado(!abierto)}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-bold transition ${
            abierto ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <span className={`grid h-6 w-6 place-items-center rounded-full border ${abierto ? "border-ink/60" : "border-line"}`}>?</span>
        </button>
      </div>
      {abierto && <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">{children}</p>}
    </>
  );
}
