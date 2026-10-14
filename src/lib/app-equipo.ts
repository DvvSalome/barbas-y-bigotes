import type { Metadata } from "next";

// Lo que hace que la app instalada desde /login, /barbero o /admin sea la del
// EQUIPO: su manifiesto (abre en /equipo) y su nombre en la pantalla de inicio
// del iPhone. appleWebApp se reemplaza entero al heredarlo, por eso va completo.
export const APP_EQUIPO_META: Metadata = {
  manifest: "/manifest-staff.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "B&B Equipo" },
};
