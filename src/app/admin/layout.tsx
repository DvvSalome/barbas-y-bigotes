import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { supabaseServerAuth } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { RealtimeRefresh } from "@/components/motion/RealtimeRefresh";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServerAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Solo admin entra al panel: un barbero autenticado se va a su app.
  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("auth_id", user.id)
    .maybeSingle();
  if ((profile as { rol?: string } | null)?.rol !== "admin") redirect("/barbero");

  return (
    <div className="flex min-h-dvh">
      <RealtimeRefresh
        subscriptions={[
          { table: "reservas" },
          { table: "ventas" },
          { table: "gastos" },
          { table: "caja_sesiones" },
        ]}
      />
      <aside className="hidden w-64 shrink-0 border-r border-line bg-panel md:flex md:flex-col">
        <div className="border-b border-line p-6">
          <Link href="/" aria-label="Barbas & Bigotes" className="block">
            <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes Barbershop" width={1024} height={348} className="h-10 w-auto" priority />
          </Link>
          <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted">Panel admin</div>
        </div>
        <div className="flex-1 p-4">
          <AdminNav />
        </div>
        <div className="m-4 rounded-xl border border-accent/25 bg-accent/5 p-3 text-xs text-muted/90">
          Gestionás <span className="text-ink">ambas sedes</span> desde acá.
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <AdminTopbar email={user.email ?? ""} />
        <main className="max-w-full flex-1 overflow-x-auto p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
