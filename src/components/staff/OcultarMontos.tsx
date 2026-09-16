"use client";

import { useEffect, useSyncExternalStore } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

/*
  El ojo que tapa la plata. La tablet del mostrador y el celular del dueño se
  miran DENTRO del local, con clientes al lado: el total del mes no tiene por qué
  estar a la vista de quien está pagando un corte.

  Pone data-montos="oculto" en <html> y el CSS de globals difumina todo lo que
  lleve .bb-monto. Se difumina en vez de reemplazar por asteriscos para que el
  bloque conserve su alto y la pantalla no salte. Lo que no es plata —cantidad de
  atenciones, porcentajes— no lleva la clase y sigue a la vista.

  Se recuerda por aparato: el celular del dueño puede quedar destapado y la
  tablet del mostrador tapada. El dato vive en localStorage y se lee con
  useSyncExternalStore y no con un estado que se setea en un efecto, que es lo
  que prohíbe el compilador de React. En el servidor arranca visible.
*/
const LLAVE = "bb-montos-ocultos";
const oyentes = new Set<() => void>();

function leer(): boolean {
  try {
    return localStorage.getItem(LLAVE) === "1";
  } catch {
    // Navegador con el almacenamiento bloqueado: se queda visible y listo.
    return false;
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  // `storage` avisa de los CAMBIOS hechos en otra pestaña; los de esta los
  // propaga alternar(), porque el navegador no se manda el evento a sí mismo.
  window.addEventListener("storage", avisar);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

function alternar() {
  const proximo = !leer();
  try {
    if (proximo) localStorage.setItem(LLAVE, "1");
    else localStorage.removeItem(LLAVE);
  } catch {
    // Sin persistencia no hay nada que alternar: se sale sin avisar.
    return;
  }
  oyentes.forEach((f) => f());
}

export function OcultarMontos({ className = "" }: { className?: string }) {
  const oculto = useSyncExternalStore(suscribir, leer, () => false);

  useEffect(() => {
    const raiz = document.documentElement;
    if (oculto) raiz.setAttribute("data-montos", "oculto");
    else raiz.removeAttribute("data-montos");
  }, [oculto]);

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oculto}
      aria-label={oculto ? "Mostrar los montos" : "Ocultar los montos"}
      title={oculto ? "Mostrar los montos" : "Ocultar los montos"}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-elevated text-muted transition hover:text-ink ${className}`}
    >
      {oculto ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
    </button>
  );
}
