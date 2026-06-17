import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { supabaseServerAuth } from "@/lib/supabase/server";

export default async function BarberoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServerAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" aria-label="Barbas & Bigotes">
            <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes" width={1024} height={348} className="h-10 w-auto" />
          </Link>
          <span className="text-xs uppercase tracking-[0.3em] text-accent">App del barbero</span>
        </div>
      </header>
      {children}
    </>
  );
}
