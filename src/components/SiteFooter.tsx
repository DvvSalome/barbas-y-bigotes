import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center">
        <Image
          src="/brand/logo-lockup.png"
          alt="Barbas & Bigotes Barbershop"
          width={1024}
          height={348}
          className="h-10 w-auto"
        />
        <div className="text-center text-sm text-muted sm:text-left">
          <div>Sedes: Parque Venezuela · Plaza de la Paz</div>
          <a
            href="https://instagram.com/barbasybigotes.baq"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-soft transition hover:text-accent"
          >
            @barbasybigotes.baq
          </a>
        </div>
        <div className="text-xs text-muted/60">Sistema por FourG Solutions</div>
      </div>
    </footer>
  );
}
