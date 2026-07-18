"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const GoogleG = () => (
  {/* viewBox 48: los paths son del lienzo 48x48 de la G oficial; con 24 solo se
      veía la esquina (una mancha naranja en vez del logo). */}
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.9 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
  </svg>
);

export function ClienteLoginButton() {
  async function login() {
    const sb = supabaseBrowser();
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/cuenta`,
        // Selector de cuenta siempre: sin esto Google reusa la última sesión y no
        // deja entrar con otra cuenta tras cerrar sesión.
        queryParams: { prompt: "select_account" },
      },
    });
  }
  return (
    <button
      onClick={login}
      className="inline-flex items-center gap-3 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-bg transition hover:-translate-y-0.5 hover:bg-white"
    >
      <GoogleG /> Entrar con Google
    </button>
  );
}

export function ClienteLogout() {
  const router = useRouter();
  async function logout() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    router.refresh();
  }
  return (
    <button onClick={logout} className="text-xs uppercase tracking-wide text-muted transition hover:text-ink">
      Cerrar sesión
    </button>
  );
}
