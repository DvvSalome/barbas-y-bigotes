import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClienteDetalle, getBarberos } from "@/lib/data/queries";
import { ClienteDetalle } from "@/components/admin/ClienteDetalle";

export const metadata: Metadata = { title: "Ficha de cliente · Admin" };

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detalle, barberos] = await Promise.all([getClienteDetalle(id), getBarberos()]);
  if (!detalle) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clientes" className="text-sm text-muted transition hover:text-ink">
        ← Clientes
      </Link>
      <ClienteDetalle detalle={detalle} barberos={barberos} />
    </div>
  );
}
