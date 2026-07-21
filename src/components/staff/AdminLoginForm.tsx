"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// Login del admin por correo + contraseña. Antes vivía en /login como página
// propia; ahora es un modo dentro del gateway unificado /login (StaffLogin).
export function AdminLoginForm({ onVolver }: { onVolver?: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const supabase = supabaseBrowser();
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error || !authData.user) {
      setLoading(false);
      setErr("Correo o contraseña incorrectos.");
      return;
    }
    // Rol para elegir el panel (defensa real = RLS + guards de cada layout).
    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("auth_id", authData.user.id)
      .maybeSingle();
    const rol = (profile as { rol?: string } | null)?.rol;
    if (rol === "admin") router.push("/admin");
    else if (rol === "barbero") router.push("/barbero");
    else router.push("/cuenta");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      {onVolver && (
        <button onClick={onVolver} className="mb-3 text-xs text-muted transition hover:text-ink">
          ← Volver
        </button>
      )}
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-panel p-7">
        <h1 className="font-display text-2xl font-semibold uppercase">Iniciar sesión</h1>
        <p className="text-xs text-muted">Acceso de administrador.</p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo"
          autoComplete="email"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <input
          type="password"
          required
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        {err && <p className="text-sm text-accent-soft">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] py-3 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
