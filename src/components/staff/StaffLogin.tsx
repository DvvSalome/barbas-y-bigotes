"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BarberoPinLogin } from "@/components/barbero/BarberoPinLogin";
import { AdminLoginForm } from "@/components/staff/AdminLoginForm";
import type { Barbero, Sede } from "@/lib/data/types";

// Gateway único del staff (/login): primero se elige el perfil, después va el
// login que corresponde. Barbero = PIN de 6 dígitos; Admin = correo + contraseña.
// Reemplaza las dos rutas separadas (/entrar y /login) por una sola.
export function StaffLogin({ barberos, sedes }: { barberos: Barbero[]; sedes: Sede[] }) {
  const [modo, setModo] = useState<null | "admin" | "barbero">(null);

  if (modo === "barbero") {
    return (
      <BarberoPinLogin
        barberos={barberos}
        sedes={sedes}
        onVolver={() => setModo(null)}
        onAdmin={() => setModo("admin")}
      />
    );
  }
  if (modo === "admin") {
    return <AdminLoginForm onVolver={() => setModo(null)} />;
  }

  return (
    <div className="w-full max-w-sm text-center">
      <Link href="/" className="flex justify-center" aria-label="Barbas & Bigotes">
        <Image
          src="/brand/logo-lockup.png"
          alt="Barbas & Bigotes Barbershop"
          width={1024}
          height={348}
          priority
          className="h-12 w-auto"
        />
      </Link>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-muted">Panel · Staff</div>
      <h1 className="mt-6 font-display text-3xl font-semibold uppercase">¿Cómo entrás?</h1>
      <p className="mt-2 text-sm text-muted">Elegí tu perfil.</p>

      <div className="mt-7 space-y-3">
        <button
          onClick={() => setModo("barbero")}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] py-3.5 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105"
        >
          Soy barbero <span className="font-normal normal-case opacity-80">· con PIN</span>
        </button>
        <button
          onClick={() => setModo("admin")}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-3.5 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-accent/50"
        >
          Soy admin <span className="font-normal normal-case text-muted">· con contraseña</span>
        </button>
      </div>

      <Link href="/" className="mt-6 block text-sm text-muted transition hover:text-ink">
        ← Volver al sitio
      </Link>
    </div>
  );
}
