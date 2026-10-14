"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearBarbero, subirFotoBarbero } from "@/lib/equipo-actions";
import { esPinValido, sanearContrato, correoDeAvisos, COMISION_POR_DEFECTO, PINS_TRIVIALES, SIN_FOTO, type CampoAlta } from "@/lib/equipo-reglas";
import { achicarFoto } from "@/lib/imagen-cliente";
import { plataEnCampo, digitosDePlata } from "@/lib/format";
import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { Campo } from "@/components/ui/Campo";
import { Segmentado } from "@/components/ui/Segmentado";
import { botonClases } from "@/components/ui/Boton";
import { CheckIcon, PlusIcon, CamIcon } from "@/components/icons";
import type { Sede } from "@/lib/data/types";

/*
  "AGREGAR BARBERO" (pedido del dueño, 14-oct). Antes un barbero nuevo exigía
  SQL: la ficha, su usuario, su perfil y su PIN. Ahora es una hoja con lo mínimo
  para que trabaje mañana —nombre, sede, PIN y contrato— más el correo y la foto,
  que son opcionales y se completan después desde su ficha.

  Lo crea crearBarbero (src/lib/equipo-actions.ts) y, si un paso falla, lo deshace
  entero: no quedan fichas que salen en la web pero no pueden entrar a la app.
*/

/** Dónde vive cada campo del formulario, para llevar al dueño al que falló. */
const ID_CAMPO: Record<CampoAlta, string> = {
  nombre: "alta-nombre",
  sede: "alta-sede",
  pin: "alta-pin",
  correo: "alta-correo",
  contrato: "alta-contrato",
};
const NOMBRE_CAMPO: Record<CampoAlta, string> = {
  nombre: "el nombre",
  sede: "la sede",
  pin: "el PIN",
  correo: "el correo",
  contrato: "el contrato",
};

/** Un PIN de 6 dígitos al azar que no sea de los fáciles (123456, 000000…). */
function pinAlAzar(): string {
  const n = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(n);
    const pin = String(n[0] % 1_000_000).padStart(6, "0");
    if (!PINS_TRIVIALES.has(pin) && !/^(\d)\1{5}$/.test(pin)) return pin;
  }
}

export function AgregarBarbero({ sedes, onCreado }: { sedes: Sede[]; onCreado: (id: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className={botonClases("primario", "md")}>
        <PlusIcon className="h-4 w-4" />
        Agregar barbero
      </button>
      {abierta && (
        <HojaAlta
          sedes={sedes}
          onCerrar={() => setAbierta(false)}
          onAbrirFicha={(id) => {
            setAbierta(false);
            onCreado(id);
          }}
        />
      )}
    </>
  );
}

function HojaAlta({ sedes, onCerrar, onAbrirFicha }: { sedes: Sede[]; onCerrar: () => void; onAbrirFicha: (id: string) => void }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [sedeId, setSedeId] = useState<string>(sedes[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [correo, setCorreo] = useState("");
  const [tipo, setTipo] = useState<"porcentaje" | "arriendo">("porcentaje");
  const [pct, setPct] = useState(String(COMISION_POR_DEFECTO));
  const [arriendo, setArriendo] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ campo?: CampoAlta; texto: string; homonimo?: boolean } | null>(null);
  const [creado, setCreado] = useState<{ id: string; aviso: string; foto: string | null; pin: string } | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  // La vista previa de la foto vive mientras la hoja esté abierta.
  useEffect(() => {
    if (!foto) return;
    const url = URL.createObjectURL(foto);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL temporal del archivo elegido, se libera al cambiar
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const contratoOk = sanearContrato({ tipo, comisionPct: pct, arriendoMensual: arriendo }).ok;
  const correoRevisado = correoDeAvisos(correo);
  const valido = nombre.trim().length >= 2 && !!sedeId && esPinValido(pin) && contratoOk && correoRevisado.ok;
  // Por qué el botón está apagado, dicho junto al botón: apagado y mudo, el
  // dueño no sabía qué le faltaba.
  const falta = valido
    ? null
    : nombre.trim().length < 2
      ? "Falta el nombre."
      : !esPinValido(pin)
        ? pin.length < 6
          ? "Falta el PIN (6 dígitos)."
          : "Ese PIN es muy fácil: usa otro."
        : !contratoOk
          ? tipo === "arriendo"
            ? "Pon el monto del arriendo."
            : "Pon el % de comisión (0 a 100)."
          : !correoRevisado.ok
            ? "Revisa el correo de avisos."
            : null;
  // Mientras corre en el servidor, salir no lo frena: la hoja no se deja cerrar.
  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  async function crear(otraPersona = false) {
    setEnviando(true);
    setError(null);
    const r = await crearBarbero({ nombre, sedeId, pin, correo, tipo, comisionPct: pct, arriendoMensual: arriendo, otraPersona }).catch(
      () => null,
    );
    if (!r || !r.ok || !r.id) {
      setEnviando(false);
      const campo = r?.campo;
      setError({ campo, texto: r?.error ?? "No se pudo. Revisa la conexión e intenta de nuevo.", homonimo: r?.homonimo });
      // El error de un campo se escribe junto al campo, que suele quedar arriba,
      // fuera de la vista: se lleva al dueño hasta él.
      if (campo) {
        requestAnimationFrame(() => {
          const el = document.getElementById(ID_CAMPO[campo]);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
        });
      }
      return;
    }
    // La foto va después: el barbero ya existe y, si la foto falla, se sube desde su ficha.
    let avisoFoto: string | null = null;
    if (foto) {
      try {
        const fd = new FormData();
        fd.set("barberoId", r.id);
        fd.set("foto", await achicarFoto(foto));
        const f = await subirFotoBarbero(fd);
        // Si reintentar no sirve (todavía no se pueden guardar fotos), no se le
        // manda a la ficha a fallar otra vez.
        if (!f.ok) avisoFoto = f.reintentable === false ? (f.error ?? "La foto no se pudo guardar.") : "La foto no se pudo guardar. Súbela desde su ficha.";
      } catch {
        avisoFoto = "La foto no se pudo guardar. Súbela desde su ficha.";
      }
    }
    setEnviando(false);
    setCreado({ id: r.id, aviso: r.aviso ?? "Barbero creado.", foto: avisoFoto, pin });
    router.refresh();
  }

  if (creado) {
    return (
      <Hoja
        titulo="Barbero creado"
        onCerrar={onCerrar}
        ancho="max-w-lg"
        pie={
          <PieHoja onCancelar={onCerrar} textoCancelar="Cerrar">
            <button type="button" onClick={() => onAbrirFicha(creado.id)} className={primarioDeHoja}>
              Abrir su ficha
            </button>
          </PieHoja>
        }
      >
        <div className="flex items-start gap-3 pb-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ok/15 text-ok">
            <CheckIcon className="h-5 w-5" />
          </span>
          <p className="text-[14px] leading-relaxed text-ink">{creado.aviso}</p>
        </div>
        {/* El PIN, ahora que se lo va a dar: después no se puede ver, solo cambiar. */}
        <div className="mb-3 rounded-2xl border border-accent/40 bg-panel px-4 py-3 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide text-muted">Su PIN</p>
          <p className="font-display text-[34px] font-extrabold leading-tight tracking-[0.3em] tabular-nums text-ink">{creado.pin}</p>
          <p className="text-[12px] text-muted">Anótalo ahora o díselo ya: después no se puede ver, solo cambiar.</p>
        </div>
        {creado.foto && (
          <p className="mb-3 rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2 text-[12.5px] text-warn">{creado.foto}</p>
        )}
        <p className="pb-4 text-[12.5px] leading-relaxed text-muted">
          En su ficha ves lo que le falta para trabajar con la app: probar el correo, compartirle la agenda de Google y que active los
          avisos en su celular la primera vez que entre.
        </p>
      </Hoja>
    );
  }

  const errDe = (c: CampoAlta) => (error?.campo === c ? error.texto : undefined);

  return (
    <Hoja
      titulo="Agregar barbero"
      onCerrar={cerrar}
      ancho="max-w-lg"
      pie={
        <PieHoja onCancelar={cerrar} bloqueado={enviando}>
          <div className="flex min-w-[46%] flex-col items-stretch gap-1">
            {(error || falta) && !enviando && (
              <p role="status" className="text-right text-[12px] leading-snug text-warn">
                {error
                  ? error.campo
                    ? `Revisa ${NOMBRE_CAMPO[error.campo]}: ${error.homonimo ? "ya trabajó aquí alguien con ese nombre." : error.texto}`
                    : error.texto
                  : falta}
              </p>
            )}
            <button type="button" onClick={() => crear()} disabled={!valido || enviando} className={botonClases("primario", "md", "w-full")}>
              {enviando ? "Creando…" : "Crear barbero"}
            </button>
          </div>
        </PieHoja>
      }
    >
      <div className="grid gap-4 pb-5">
        <Campo
          id="alta-nombre"
          etiqueta="Nombre"
          obligatorio
          value={nombre}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => {
            setNombre(e.target.value);
            // Cambió el nombre: el aviso de antes (repetido, homónimo) ya no aplica.
            if (error?.campo === "nombre") setError(null);
          }}
          error={errDe("nombre")}
          ayuda="Como lo conocen los clientes: sale así en la web y al reservar."
        />
        {error?.homonimo && (
          <button type="button" onClick={() => crear(true)} disabled={enviando} className={`${botonClases("secundario", "md")} -mt-2 justify-self-start`}>
            Es otra persona: crearlo igual
          </button>
        )}

        <div id="alta-sede" className="scroll-mt-4">
          <p className="mb-1.5 px-1 text-[12px] font-medium text-muted">Sede donde trabaja</p>
          <Segmentado
            etiqueta="Sede donde trabaja"
            opciones={sedes.map((s) => ({ valor: s.id as string, texto: s.nombre }))}
            valor={sedeId}
            onCambio={setSedeId}
          />
          {errDe("sede") && <p className="mt-1.5 px-1 text-[12px] text-warn">{errDe("sede")}</p>}
        </div>

        <div>
          <div className="flex items-end gap-2">
            <Campo
              id="alta-pin"
              etiqueta="PIN para entrar (6 dígitos)"
              obligatorio
              className="min-w-0 flex-1"
              value={pin}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <button type="button" onClick={() => setPin(pinAlAzar())} className={`${botonClases("secundario", "md")} mb-[6px]`}>
              Inventar uno
            </button>
          </div>
          <p className={`mt-1.5 px-1 text-[12px] ${errDe("pin") || (pin.length === 6 && !esPinValido(pin)) ? "text-warn" : "text-muted"}`}>
            {errDe("pin") ??
              (pin.length === 6 && !esPinValido(pin)
                ? "Ese es muy fácil de adivinar. Usa otro."
                : "Anótalo y díselo en persona: no se lo mandamos por ningún lado y después no se puede ver, solo cambiar.")}
          </p>
        </div>

        <Campo
          id="alta-correo"
          etiqueta="Correo de avisos (opcional)"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errDe("correo") ?? (correo.trim() && !correoRevisado.ok ? correoRevisado.error : undefined)}
          ayuda="Su correo personal (Gmail, Outlook…). Le llega un aviso cada vez que le reservan. Lo pruebas después desde su ficha."
        />

        <div id="alta-contrato" className="scroll-mt-4">
          <p className="mb-1.5 px-1 text-[12px] font-medium text-muted">Cómo trabaja</p>
          <Segmentado
            etiqueta="Tipo de contrato"
            opciones={[
              { valor: "porcentaje", texto: "Por comisión" },
              { valor: "arriendo", texto: "Paga arriendo" },
            ]}
            valor={tipo}
            onCambio={setTipo}
          />
          {tipo === "porcentaje" ? (
            <Campo
              id="alta-pct"
              etiqueta="Se lleva (% de lo que cobra)"
              className="mt-3"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              error={errDe("contrato")}
              ayuda={`El resto del equipo va al ${COMISION_POR_DEFECTO} %. Es lo que usa el cobro para repartir.`}
            />
          ) : (
            <Campo
              id="alta-arriendo"
              etiqueta="Arriendo de la silla, al mes"
              className="mt-3"
              inputMode="numeric"
              placeholder="$ 500.000"
              value={plataEnCampo(arriendo)}
              onChange={(e) => setArriendo(digitosDePlata(e.target.value))}
              error={errDe("contrato")}
              ayuda="Lo que cobra es suyo; el local le cobra la silla aparte."
            />
          )}
        </div>

        <div>
          <p className="mb-1.5 px-1 text-[12px] font-medium text-muted">Foto (opcional)</p>
          {/* Un BOTÓN que abre el selector (como FotoBarbero): el <label> con el
              input escondido no se alcanzaba con el teclado. */}
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-3 text-left transition hover:border-ink/40 focus-visible:border-ink/60 focus-visible:outline-none"
          >
            {vista ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por el optimizador
              <img src={vista} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover object-top ring-2 ring-line" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-elevated text-muted">
                <CamIcon className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0 text-[12.5px] leading-snug text-muted">
              {foto ? "Toca para cambiarla." : "Elegir foto: una de frente, con la cara bien visible. La ve el cliente al elegir barbero."}
            </span>
          </button>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            tabIndex={-1}
            aria-hidden
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (f) setFoto(f);
            }}
          />
          {!foto && <p className="mt-1.5 px-1 text-[12px] text-warn">{SIN_FOTO}</p>}
        </div>

        <div className="rounded-2xl border border-line bg-panel px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          <p className="font-semibold text-ink">Qué pasa al crearlo</p>
          <ul className="mt-1.5 grid gap-1">
            <li>· Sale en la web y en la reserva apenas termine de crearse, al final de su sede.</li>
            <li>· Se le crea su acceso a la app. No le llega ningún correo: entra en barbasybigotes.com/login tocando su nombre y poniendo el PIN.</li>
            <li>· Si algo falla a mitad, no se crea nada y te decimos qué pasó.</li>
          </ul>
        </div>

        {error && !error.campo && (
          <p role="alert" className="rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2 text-[12.5px] font-semibold text-warn">
            {error.texto}
          </p>
        )}
      </div>
    </Hoja>
  );
}
