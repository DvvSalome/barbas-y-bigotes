"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DESTINOS, destinoDe } from "@/components/admin/nav-mapa";
import { NavInferior } from "@/components/staff/NavInferior";

/*
  La barra de abajo del panel: solo conecta el mapa de AdminNav con la pieza
  genérica del kit. Conserva el ?sede= al cambiar de destino, que es el mismo
  comportamiento que tenían las pestañas: si el dueño está mirando Plaza de la
  Paz y toca Caja, sigue en Plaza de la Paz.

  PENDIENTE (pasos 15 y 18): los badges de ámbar sobre Caja (una caja de días
  sin cerrar) y sobre Ajustes (PIN bloqueado, stock bajo, cupón por vencer). Los
  datos existen —paraHacer() y el de AvisoCaja— pero hoy los pide la pantalla de
  Hoy, no el layout; ponerlos acá ahora significa dos consultas más en CADA
  pantalla del panel. Se enchufan cuando Inicio se rehaga y ese dato ya viaje.
*/
export function AdminNavInferior() {
  const path = usePathname();
  const sede = useSearchParams().get("sede");
  const activo = destinoDe(path);

  return (
    <NavInferior
      activo={activo}
      destinos={DESTINOS.map((d) => {
        const Icono = d.icono;
        return {
          clave: d.clave,
          etiqueta: d.etiqueta,
          href: sede ? `${d.href}?sede=${sede}` : d.href,
          icono: <Icono />,
        };
      })}
    />
  );
}
