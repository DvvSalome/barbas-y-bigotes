"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("bb_auth") === "1") {
      setOk(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!ok) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
        Cargando…
      </div>
    );
  }
  return <>{children}</>;
}
