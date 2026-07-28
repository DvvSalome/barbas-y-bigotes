import type { Metadata } from "next";
import { getClientes } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { ClientesLista } from "./ClientesLista";

export const metadata: Metadata = { title: "Clientes · Admin" };

export default async function ClientesPage() {
  const clientes = await getClientes();

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Base de datos"
        title="Clientes"
        description={`${clientes.length} clientes, del que vino hoy al que hace rato no aparece · abrí una ficha para ver historial, notas, wallet y reseñas.`}
      />

      <ClientesLista clientes={clientes} />
    </div>
  );
}
