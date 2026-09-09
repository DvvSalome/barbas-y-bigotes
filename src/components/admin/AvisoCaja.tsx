import Link from "next/link";
import { getCajaChip } from "@/lib/data/queries";
import { diasDesde } from "@/lib/format";
import { AlertIcon } from "@/components/icons";

// "La caja lleva N días sin cerrar", como tarjeta ámbar DENTRO del contenido de
// Hoy y de Caja (tanda 1, 9-sep). Antes era una franja de la cabecera en todas
// las secciones: gastaba 44 px de cada pantalla del celular para decir algo que
// solo se resuelve en Caja. Si la caja está bien, no dibuja nada.
export async function AvisoCaja({ enlace = true }: { enlace?: boolean }) {
  const caja = await getCajaChip();
  const dias = caja.abierta && caja.desde ? diasDesde(caja.desde) : 0;
  if (dias <= 0) return null;
  const texto = `La caja lleva ${dias === 1 ? "1 día" : `${dias} días`} sin cerrar`;
  const clases =
    "mb-4 flex min-h-11 items-center gap-2 rounded-xl border border-warn/35 bg-warn/10 px-3.5 py-2 text-[13px] font-semibold text-warn";
  if (!enlace) {
    return (
      <div className={clases}>
        <AlertIcon className="h-4 w-4 shrink-0" />
        {texto}
        <span className="ml-auto font-medium text-warn/80">cerrala abajo</span>
      </div>
    );
  }
  return (
    <Link href="/admin/cuadre" className={`${clases} transition hover:bg-warn/15`}>
      <AlertIcon className="h-4 w-4 shrink-0" />
      {texto}
      <span className="ml-auto font-bold">Cerrar →</span>
    </Link>
  );
}
