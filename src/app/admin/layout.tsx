import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServerAuth } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

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
      <aside className="hidden w-64 shrink-0 border-r border-line bg-panel p-6 md:block">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide">
          Barbas <span className="text-accent">&amp;</span> Bigotes
        </Link>
        <div className="mb-8 mt-1 text-[10px] uppercase tracking-[0.3em] text-muted">
          Panel admin
        </div>
        <AdminNav />
        <div className="mt-10 rounded-xl border border-line p-3 text-xs text-muted/80">
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
