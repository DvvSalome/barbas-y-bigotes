import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClienteDetalle, getBarberos, getTarjetaCliente, getMediosTodos } from "@/lib/data/queries";
import { bogotaYmd } from "@/lib/slots";
import { ClienteDetalle } from "@/components/admin/ClienteDetalle";

export const metadata: Metadata = { title: "Ficha de cliente · Admin" };

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detalle, barberos, tarjeta, medios] = await Promise.all([
    getClienteDetalle(id),
    getBarberos(),
    getTarjetaCliente(id),
    getMediosTodos(),
  ]);
  if (!detalle) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clientes" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted transition hover:text-accent-soft">
        ← Clientes
      </Link>
      {/* "Hoy" sale del servidor: el "hace 12 días" no puede calcularse en el
          render del cliente (daría una hora distinta en servidor y navegador). */}
      <ClienteDetalle detalle={detalle} barberos={barberos} tarjeta={tarjeta} medios={medios} hoy={bogotaYmd()} />
    </div>
  );
}
