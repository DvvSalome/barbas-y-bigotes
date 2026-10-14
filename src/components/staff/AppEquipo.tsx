"use client";

import { useEffect } from "react";

/*
  La app instalada (iPhone "Agregar a pantalla de inicio", Android, la de Play
  Store) arranca en la portada de clientes: el manifiesto público abre en "/".
  El equipo la quiere abriendo en su parte.

  Dos piezas, porque iOS no siempre respeta el start_url del manifiesto y las
  apps ya instaladas no se actualizan solas:
   · RecordarEquipo (layouts de /barbero y /admin): este aparato es del equipo.
   · AbrirComoEquipo (portada): si la app instalada arranca en "/" en un aparato
     del equipo, pasa directo a /equipo, que manda a cada uno a su pantalla.
  En Safari o Chrome normal no hace nada: el barbero sigue viendo el sitio.

  ponytail: la marca no se borra al cerrar sesión; un aparato del equipo que
  sale queda en /login, que es justo lo que se quiere.
*/
const CLAVE = "bb-equipo";

export function RecordarEquipo() {
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {}
  }, []);
  return null;
}

export function AbrirComoEquipo() {
  useEffect(() => {
    try {
      const instalada =
        (window.navigator as { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (instalada && localStorage.getItem(CLAVE)) window.location.replace("/equipo");
    } catch {}
  }, []);
  return null;
}
