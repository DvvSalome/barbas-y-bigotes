"use client";

import { useEffect } from "react";
import { CLAVE_EQUIPO, marcaPara, rutaRecordada } from "@/lib/app-personal";

/*
  La app instalada (iPhone "Agregar a pantalla de inicio", Android, la de Play
  Store) arranca en la portada de clientes: el manifiesto público abre en "/".
  El equipo la quiere abriendo en su parte.

  Piezas, porque iOS no siempre respeta el start_url del manifiesto y las apps
  ya instaladas no se actualizan solas:
   · RecordarEquipo (layouts de /barbero y /admin): este aparato es del equipo,
     y de QUIÉN fue el último que entró. Guarda su ruta personal
     (/equipo/meyer, /equipo/mostrador-<sede>); el dueño, que no tiene app
     personal, deja "1" (la marca de antes: la app general del equipo).
   · AbrirComoEquipo (portada): si la app instalada arranca en "/" en un aparato
     del equipo, pasa directo a /equipo, que manda a cada uno a su pantalla.
   · IrAMiApp (/equipo sin sesión): al teclado de PIN del último que entró en
     este aparato; si no hay nadie recordado, al login general.
   · OlvidarRuta (/equipo/<slug> que ya no sirve): si el aparato recordaba ESA
     ruta, la olvida, para no volver a caer en un enlace muerto.
  En Safari o Chrome normal la portada no hace nada: el barbero sigue viendo el sitio.

  ponytail: la marca no se borra al cerrar sesión; un aparato del equipo que
  sale queda en el PIN del último que entró, que es justo lo que se quiere.
*/

function leerMarca(): string | null {
  try {
    return localStorage.getItem(CLAVE_EQUIPO);
  } catch {
    return null;
  }
}

export function RecordarEquipo({ ruta }: { ruta?: string | null }) {
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_EQUIPO, marcaPara(ruta));
    } catch {}
  }, [ruta]);
  return null;
}

export function AbrirComoEquipo() {
  useEffect(() => {
    try {
      const instalada =
        (window.navigator as { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (instalada && leerMarca()) window.location.replace("/equipo");
    } catch {}
  }, []);
  return null;
}

export function IrAMiApp() {
  useEffect(() => {
    window.location.replace(rutaRecordada(leerMarca()) ?? "/login");
  }, []);
  return null;
}

export function OlvidarRuta({ ruta }: { ruta: string }) {
  useEffect(() => {
    try {
      if (leerMarca() === ruta) localStorage.setItem(CLAVE_EQUIPO, "1");
    } catch {}
  }, [ruta]);
  return null;
}
