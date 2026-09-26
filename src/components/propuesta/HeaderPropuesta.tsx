import Link from "next/link";
import Image from "next/image";
import { HeaderCuenta } from "@/components/HeaderCuenta";
import css from "./propuesta.module.css";

/*
  La cabecera de la propuesta (tercera vuelta: "que los botones de la navbar
  estén mil veces mejor"). Vive aparte del SiteHeader del sitio porque este
  sigue al prototipo de Claude Design y no se toca sin aprobación.

  Transparente sobre la pared del hero y vidrio al bajar (CSS ligado al scroll,
  sin JS). En escritorio, una píldora con las tres secciones de la página; en
  todos lados, "Entrar" (el botón de cuenta inteligente del sitio, en grande) y
  "Reservar" con el botón primario de la página.
*/
export function HeaderPropuesta() {
  return (
    <header className={css.cabecera}>
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-5">
        <Link href="/" aria-label="Barbas & Bigotes Barbershop, inicio" className="shrink-0">
          <Image src="/brand/logo-lockup.png" alt="" width={1024} height={348} preload className="h-11 w-auto lg:h-[54px]" />
        </Link>

        <nav aria-label="Secciones de la página" className={css.navPill}>
          <a href="#precios" className={css.navLink}>
            Precios
          </a>
          <a href="#barberos" className={css.navLink}>
            Barberos
          </a>
          <a href="#la-app" className={css.navLink}>
            Cómo funciona
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <HeaderCuenta grande />
          <Link href="/reservar?desde=cabecera" className={`${css.btn} ${css.primario} ${css.chico}`}>
            Reservar
          </Link>
        </div>
      </div>
    </header>
  );
}
