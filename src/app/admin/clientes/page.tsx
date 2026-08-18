import type { Metadata } from "next";
import { getClientes, getSedes } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { ClientesLista } from "./ClientesLista";

export const metadata: Metadata = { title: "Clientes · Admin" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const [clientes, sedes] = await Promise.all([getClientes(), getSedes()]);
  // El ?sede= del selector del topbar. Se valida contra las sedes reales: un id
  // inventado en la URL no puede dejar la lista vacía sin explicación.
  const sede = sedes.find((s) => s.id === (typeof sp.sede === "string" ? sp.sede : undefined))?.id ?? null;
  const enSede = sede ? clientes.filter((c) => c.sedes.includes(sede)).length : clientes.length;
  const nombreSede = sedes.find((s) => s.id === sede)?.nombre;

  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Base de datos"
        title="Clientes"
        description={
          sede
            ? `${enSede} de ${clientes.length} clientes pasaron por ${nombreSede} · abre una ficha para ver historial, notas, wallet y reseñas.`
            : `${clientes.length} clientes, del que vino hoy al que hace rato no aparece · abre una ficha para ver historial, notas, wallet y reseñas.`
        }
      />

      <ClientesLista
        clientes={clientes}
        sedes={sedes.map((s) => ({ id: s.id as string, nombre: s.nombre }))}
        sedeActiva={sede}
      />
    </div>
  );
}
