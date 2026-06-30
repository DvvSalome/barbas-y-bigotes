"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
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
    
    // Obtener rol del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("auth_id", authData.user.id)
      .maybeSingle();
      
    const rol = (profile as any)?.rol;
    
    if (rol === "admin") {
      router.push("/admin");
    } else if (rol === "barbero") {
      router.push("/barbero");
    } else {
      router.push("/cuenta");
    }
    
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex justify-center" aria-label="Barbas & Bigotes">
          <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes Barbershop" width={1024} height={348} className="h-12 w-auto" />
        </Link>
        <div className="mt-2 text-center text-[10px] uppercase tracking-[0.3em] text-muted">
          Panel · Staff
        </div>

        <form onSubmit={submit} className="mt-9 space-y-3 rounded-2xl border border-line bg-panel p-7">
          <h1 className="font-display text-2xl">Iniciar sesión</h1>
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
            className="w-full rounded-full bg-accent py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <Link href="/" className="mt-5 block text-center text-sm text-muted transition hover:text-ink">
          ← Volver al sitio
        </Link>
      </div>
    </main>
  );
}
