import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-panel/30">
      <div className="mx-auto max-w-6xl px-6 py-12">
        
        {/* Main Footer Content */}
        <div className="grid gap-10 md:grid-cols-3 md:gap-8 lg:gap-12 mb-10 text-center">
          
          {/* Brand & Socials */}
          <div className="flex flex-col items-center">
            <Image
              src="/brand/logo-lockup.png"
              alt="Barbas & Bigotes Barbershop"
              width={1024}
              height={348}
              className="h-12 w-auto opacity-90 hover:opacity-100 transition duration-300 mb-4"
            />
            <p className="text-xs text-muted leading-relaxed mb-6 max-w-xs mx-auto">
              El ritual clásico de la barbería en Barranquilla. Tradición, estilo y excelencia en cada detalle.
            </p>
            
            <div className="flex items-center justify-center gap-3">
              <a
                href="https://instagram.com/barbasybigotes.baq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="group flex h-10 items-center gap-2 rounded-full border border-line bg-bg/50 px-4 text-xs font-semibold text-white hover:border-accent-soft hover:bg-panel transition-all duration-300"
              >
                <svg className="h-4 w-4 text-muted group-hover:text-white transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                Instagram
              </a>

              <a
                href="https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20quisiera%20saber%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20y%20reservas."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-xs font-bold text-white transition-all duration-300 hover:bg-[#22c35e] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(37,211,102,0.4)] shadow-[0_4px_10px_rgba(37,211,102,0.2)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                </svg>
                WhatsApp
              </a>
            </div>
          </div>

          {/* Sedes */}
          <div className="flex flex-col items-center space-y-4">
            <h4 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-white">
              Nuestras Sedes
            </h4>
            
            <div>
              <strong className="text-white font-semibold text-[13px] block mb-1">Parque Venezuela</strong>
              <div className="text-[11px] text-muted leading-relaxed">
                Calle 88 #44 - 10, Local 4<br />
                <a href="tel:+573004097624" className="text-accent-soft hover:text-white transition inline-block mt-0.5">📞 +57 300 409 7624</a>
              </div>
            </div>
            
            <div>
              <strong className="text-white font-semibold text-[13px] block mb-1">Plaza de la Paz</strong>
              <div className="text-[11px] text-muted leading-relaxed">
                Carrera 45 frente a la Plaza de la Paz<br />
                <a href="tel:+573006734799" className="text-accent-soft hover:text-white transition inline-block mt-0.5">📞 +57 300 673 4799</a>
              </div>
            </div>
          </div>

          {/* Enlaces & Horario */}
          <div className="flex flex-col items-center space-y-5">
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-white mb-3">
                Enlaces Rápidos
              </h4>
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted">
                <li><Link href="/barberos" className="hover:text-accent-soft transition duration-300">Barberos</Link></li>
                <li><Link href="/nosotros" className="hover:text-accent-soft transition duration-300">Nosotros</Link></li>
                <li><Link href="/cuenta" className="hover:text-accent-soft transition duration-300">Mi Cuenta</Link></li>
                <li><Link href="/reservar" className="text-accent-soft hover:text-accent font-semibold transition duration-300">Reservar Cita</Link></li>
              </ul>
            </div>
            
            <div className="text-[11px] text-muted/80 border border-line/40 rounded-lg px-4 py-2 text-center bg-bg/50 inline-flex flex-col items-center">
              <div className="flex items-center gap-2 mb-1 justify-center">
                <svg className="w-3.5 h-3.5 text-accent-soft shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-semibold text-white">Horario de Atención</span>
              </div>
              <div>Lunes a Sábado: 9:00 am a 8:00 pm</div>
              <div className="text-accent-soft font-medium mt-0.5">Domingos Cerrado</div>
              <div className="mt-1.5 border-t border-line/40 pt-1.5 text-muted">
                Cancelaciones online hasta 2 horas antes
              </div>
            </div>
          </div>

        </div>

        {/* Línea divisora y Copyright */}
        <div className="border-t border-line/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted/50 font-medium">
          <div>
            © {new Date().getFullYear()} Barbas &amp; Bigotes Barbershop. Todos los derechos reservados.
          </div>
          <div className="flex gap-3">
            <span>Tradición y Estilo</span>
            <span>·</span>
            <span>Barranquilla, CO</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
