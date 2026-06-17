"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function AdminTopbar({ email }: { email: string }) {
  const router = useRouter();
  const name = email.split("@")[0] || "Staff";

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between border-b border-line px-6 py-4 sm:px-8">
      <div className="text-sm text-muted">
        Panel de administración · <span className="text-ink">ambas sedes</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
            {name.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm sm:inline">{name}</span>
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-line px-4 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
