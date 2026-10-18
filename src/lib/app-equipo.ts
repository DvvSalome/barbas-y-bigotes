import type { Metadata } from "next";
import { rutaManifiesto, tituloApp, type DuenoApp } from "@/lib/app-personal";

// Lo que hace que la app instalada desde /login, /barbero o /admin sea la del
// EQUIPO: su manifiesto (abre en /equipo) y su nombre en la pantalla de inicio
// del iPhone. appleWebApp se reemplaza entero al heredarlo, por eso va completo.
export const APP_EQUIPO_META: Metadata = {
  manifest: "/manifest-staff.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "B&B Equipo" },
};

/**
 * La app PROPIA de un barbero o de un mostrador (/equipo/<slug>, ver
 * app-personal.ts): su manifiesto (abre en su ruta) y "B&B Meyer" debajo del
 * ícono del iPhone, que usa este título y la página donde se agregó.
 */
export function metaAppPersonal(d: Pick<DuenoApp, "tipo" | "nombre"> & { ruta: string }): Metadata {
  return {
    manifest: rutaManifiesto(d.ruta),
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: tituloApp(d) },
  };
}
