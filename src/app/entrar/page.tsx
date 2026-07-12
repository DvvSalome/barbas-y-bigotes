import { redirect } from "next/navigation";

// /entrar quedó unificado en /login (un solo gateway del staff con selector de
// perfil). Se mantiene esta ruta como redirect para no romper enlaces viejos
// (QRs, marcadores de los barberos).
export default function EntrarRedirect() {
  redirect("/login");
}
