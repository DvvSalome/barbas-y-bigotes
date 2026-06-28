"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { adminNav, NavLinks } from "@/components/admin/AdminNav";
import { MenuIcon, CloseIcon, LogoutIcon } from "@/components/icons";

function tituloActual(path: string) {
  const exact = adminNav.find((n) => n.href === path);
  if (exact) return exact.label;
  const match = adminNav.find((n) => n.href !== "/admin" && path.startsWith(n.href));
  return match?.label ?? "Panel admin";
}

export function AdminTopbar({ email }: { email: string }) {
  const router = useRouter();
  const path = usePathname();
  const name = email.split("@")[0] || "Staff";
  const [open, setOpen] = useState(false);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-bg/85 px-4 py-3.5 backdrop-blur-md sm:px-8 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <motion.button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            whileTap={{ scale: 0.9 }}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-elevated hover:text-ink md:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </motion.button>
          <Image
            src="/brand/logo-lockup.png"
            alt="Barbas & Bigotes"
            width={1024}
            height={348}
            className="h-6 w-auto shrink-0 md:hidden"
          />
          <div className="hidden min-w-0 text-sm sm:block">
            <span className="text-muted">Panel de administración · </span>
            <span className="font-display text-sm text-ink">{tituloActual(path)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent ring-2 ring-accent/20">
              {name.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm sm:inline">{name}</span>
          </div>
          <button
            onClick={logout}
            aria-label="Cerrar sesión"
            className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:text-ink sm:px-4"
          >
            <LogoutIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col rounded-r-2xl border-r border-line bg-panel md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between p-6 pb-0">
                <Link href="/" aria-label="Barbas & Bigotes">
                  <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes Barbershop" width={1024} height={348} className="h-9 w-auto" />
                </Link>
                <motion.button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar menú"
                  whileTap={{ scale: 0.9 }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-ink"
                >
                  <CloseIcon className="h-4 w-4" />
                </motion.button>
              </div>
              <div className="mb-6 mt-1 px-6 text-[10px] uppercase tracking-[0.3em] text-muted">Panel admin</div>

              <div className="flex-1 overflow-y-auto px-6">
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>

              <div className="m-4 mt-2 shrink-0 space-y-3">
                <div className="rounded-xl border border-accent/25 bg-accent/5 p-3 text-xs text-muted/90">
                  Gestionás <span className="text-ink">ambas sedes</span> desde acá.
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent ring-2 ring-accent/20">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-sm">{name}</span>
                  </div>
                  <button
                    onClick={logout}
                    aria-label="Cerrar sesión"
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                  >
                    <LogoutIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
