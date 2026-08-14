import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServerAuth } from "@/lib/supabase/server";
import { TEMA_COOKIE, temaDesdeCookie } from "@/lib/tema";
import { getSedes, getCajaChip } from "@/lib/data/queries";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { CommandK } from "@/components/staff/CommandK";
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

  const [sedes, caja] = await Promise.all([getSedes(), getCajaChip()]);

  // Tema del staff desde la cookie (SSR sin flash). cookies() vuelve dinámico
  // el layout, pero /admin ya lo es (sesión Supabase en cada request).
  const tema = temaDesdeCookie((await cookies()).get(TEMA_COOKIE)?.value);

  return (
    <div data-staff data-theme={tema} className="flex min-h-dvh flex-col">
      <RealtimeRefresh
        subscriptions={[
          { table: "reservas" },
          { table: "ventas" },
          { table: "gastos" },
          { table: "caja_sesiones" },
        ]}
      />
      <AdminTopbar email={user.email ?? ""} sedes={sedes} caja={caja} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 pt-6 sm:px-5">{children}</main>
      <CommandK />
    </div>
  );
}
