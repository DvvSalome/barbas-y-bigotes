// Nodo Code de n8n "Filas aviso dueño" — modo "Run Once for All Items".
// Cuerpo EXACTO para pegar en el nodo (todo este archivo, comentarios incluidos).
//
// Entrada: las filas del RPC public.tomar_avisos_dueno() (migración 0084), una por
// aviso × destinatario: { aviso_id, tipo, datos, email }.
//   tipo = 'cita' | 'cierre' | 'caja_abierta' | 'resena_baja' | 'prueba'
//   datos = lo que armó la app o el trigger del cierre (nombres, montos, fechas ISO)
// Salida: un item por correo → { para, asunto, html, text, tipo, aviso_id }, que el
// nodo emailSend manda desde reservas@ (toEmail = para, subject = asunto,
// html = html, text = text, formato "both", appendAttribution apagado).
//
// Reglas del sandbox de n8n: JS pelado, sin import/require ni APIs del navegador
// (nada de URLSearchParams ni document). Intl sí está.
// La vista previa local: node scripts/qa/preview-aviso-dueno.mjs <carpeta>.
//
// Diseño: el mismo de confirmacion.html y aviso-barbero.html — tema oscuro con
// bgcolor en cada td (Gmail en modo claro invierte los fondos que solo están en
// CSS), franja barber pole, logo arriba, un botón rojo al panel.

const SITIO = "https://barbasybigotes.com";
const TZ = "America/Bogota";

// Por qué le llega (el pie). La prueba de un correo que todavía NO está en la
// lista lo cambia: decir "tu correo está en Avisos" le haría creer que ya quedó.
const MOTIVO_HTML =
  'Te llega porque tu correo est&aacute; en <a href="' + SITIO + '/admin/avisos" style="color:#9c958a;">Ajustes &rarr; Avisos</a>. Ah&iacute; eliges qu&eacute; te llega o lo quitas.';
const MOTIVO_TEXTO = "Te llega porque tu correo está en Ajustes → Avisos (" + SITIO + "/admin/avisos).";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const num = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};
const fPlata = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const plata = (n) => fPlata.format(Math.round(num(n))).replace(/\s/g, " ");
const fHora = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const fLargo = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fCorto = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const fYmd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const fecha = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};
const hora = (d) => fHora.format(d).replace(/\s/g, " ");
// "sábado 17 de octubre" / "sáb 17 oct"
const diaLargo = (d) => cap(fLargo.format(d).replace(",", ""));
const diaCorto = (d) =>
  fCorto
    .formatToParts(d)
    .filter((p) => p.type !== "literal")
    .map((p) => p.value.replace(".", ""))
    .join(" ");
const mismoDia = (a, b) => fYmd.format(a) === fYmd.format(b);
const primerNombre = (s) => String(s || "").trim().split(/\s+/)[0] || "";

// ---------- Piezas del correo ----------

const COLOR = { rojo: "#e8675c", verde: "#34d399", ambar: "#e0b25c", oro: "#c9b18a" };
const FONDO = { rojo: "rgba(210,63,52,.14)", verde: "rgba(52,211,153,.12)", ambar: "rgba(224,178,92,.14)", oro: "rgba(201,177,138,.15)" };
const BORDE = { rojo: "rgba(210,63,52,.4)", verde: "rgba(52,211,153,.3)", ambar: "rgba(224,178,92,.45)", oro: "rgba(201,177,138,.45)" };

const etiqueta = (texto, tono) =>
  '<span style="display:inline-block;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;background:' +
  FONDO[tono] + ";border:1px solid " + BORDE[tono] + ";color:" + COLOR[tono] + ';">&#9679; ' + esc(texto) + "</span>";

// Una caja oscura con rótulo arriba. `cuerpo` ya viene en HTML (escapado por quien lo arma).
const caja = (rotulo, cuerpo, resaltada) =>
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>' +
  '<td bgcolor="' + (resaltada ? "#1a1210" : "#151311") + '" style="border:1px solid ' + (resaltada ? "rgba(210,63,52,.3)" : "rgba(242,237,228,.1)") +
  ";background:" + (resaltada ? "#1a1210" : "#151311") + ";background-image:linear-gradient(" + (resaltada ? "#1a1210,#1a1210" : "#151311,#151311") +
  ');border-radius:14px;padding:14px 16px;">' +
  (rotulo
    ? '<div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:' + (resaltada ? COLOR.rojo : "#9c958a") + ';">' + esc(rotulo) + "</div>"
    : "") +
  cuerpo +
  "</td></tr></table>";

// Dos cajas lado a lado (barbero / sede).
const dosCajas = (a, b) =>
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>' +
  [a, b]
    .map(
      (x, i) =>
        (i ? '<td width="2%"></td>' : "") +
        '<td width="49%" valign="top" bgcolor="#151311" style="border:1px solid rgba(242,237,228,.1);background:#151311;background-image:linear-gradient(#151311,#151311);border-radius:14px;padding:14px 16px;">' +
        '<div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:#9c958a;">' + esc(x.rotulo) + "</div>" +
        '<div style="margin-top:3px;font-size:14px;font-weight:700;color:#f2ede4;">' + esc(x.valor || "—") + "</div>" +
        (x.extra ? '<div style="margin-top:2px;font-size:11.5px;color:#9c958a;">' + esc(x.extra) + "</div>" : "") +
        "</td>",
    )
    .join("") +
  "</tr></table>";

const valorGrande = (texto) =>
  '<div style="margin-top:3px;font-family:\'Barlow Condensed\',Arial,sans-serif;font-size:26px;font-weight:800;color:#f2ede4;line-height:1.1;">' + texto + "</div>";
const linea = (texto) => '<div style="margin-top:4px;font-size:12.5px;color:#9c958a;line-height:1.5;">' + texto + "</div>";

// Filas etiqueta / monto.
const filas = (lista) =>
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;font-size:14px;">' +
  lista
    .map(
      (f) =>
        '<tr><td bgcolor="#151311" style="padding:5px 0;color:#9c958a;">' + f[0] + "</td>" +
        '<td bgcolor="#151311" align="right" style="padding:5px 0;color:' + (f[2] || "#f2ede4") + ";font-weight:" + (f[3] ? "800" : "700") + ';">' + f[1] + "</td></tr>",
    )
    .join("") +
  "</table>";

const boton = (texto, url) =>
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>' +
  '<td align="center" bgcolor="#d23f34" style="border-radius:13px;background:#d23f34;background-image:linear-gradient(180deg,#e8675c,#d23f34);">' +
  '<a href="' + esc(url) + '" style="display:block;padding:16px;text-align:center;color:#fbf7f0;font-family:\'Barlow Condensed\',Arial,sans-serif;font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;">' +
  esc(texto) + "</a></td></tr></table>";

// El cascarón: igual para todos los tipos.
const render = (d) => `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><meta name="viewport" content="width=device-width"><title>${esc(d.asunto)}</title></head>
<body style="margin:0;padding:0;background:#060504;background-image:linear-gradient(#060504,#060504);">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#060504" style="background:#060504;background-image:linear-gradient(#060504,#060504);">
<tr><td align="center" bgcolor="#060504" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#0c0b0a" style="width:560px;max-width:100%;background:#0c0b0a;background-image:linear-gradient(#0c0b0a,#0c0b0a);border:1px solid rgba(242,237,228,.12);border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#f2ede4;">
<tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:#d23f34;background-image:repeating-linear-gradient(115deg,#d23f34 0 14px,#f2ede4 14px 28px,#12100e 28px 42px);">&nbsp;</td></tr>
<tr><td align="center" bgcolor="#0a0908" style="background:#0a0908;background-image:linear-gradient(#0a0908,#0a0908);padding:22px 24px 16px;text-align:center;">
<img src="${SITIO}/brand/logo-lockup.png" alt="Barbas &amp; Bigotes" height="46" style="display:block;margin:0 auto;height:46px;width:auto;border:0;">
<div style="margin-top:8px;font-size:10px;text-transform:uppercase;letter-spacing:.34em;color:#cfc7ba;">Aviso para el due&ntilde;o${d.sede ? " &middot; " + esc(d.sede) : ""}</div>
</td></tr>
<tr><td bgcolor="#0c0b0a" style="padding:24px 22px 26px;background:#0c0b0a;">
${d.etiqueta}
<h1 style="margin:12px 0 6px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:28px;font-weight:800;text-transform:uppercase;line-height:1.05;color:#f2ede4;">${esc(d.titulo)}</h1>
<p style="margin:0;font-size:14px;color:#9c958a;line-height:1.55;">${d.intro}</p>
${d.cuerpo}
${boton(d.boton, d.url)}
${d.pie ? '<p style="margin:14px 0 0;font-size:12px;color:#9c958a;text-align:center;line-height:1.5;">' + d.pie + "</p>" : ""}
</td></tr>
<tr><td align="center" bgcolor="#0a0908" style="border-top:1px solid rgba(242,237,228,.08);background:#0a0908;background-image:linear-gradient(#0a0908,#0a0908);padding:20px;text-align:center;">
<img src="${SITIO}/brand/logo-face-transparent.png" alt="" height="30" style="height:30px;width:auto;opacity:.8;border:0;">
<div style="margin-top:8px;font-size:11px;color:#8f877a;line-height:1.6;">Barbas &amp; Bigotes Barbershop &middot; Barranquilla<br>${d.motivo || MOTIVO_HTML}</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>
`;

// ---------- Un correo por tipo ----------

function cita(x) {
  const ini = fecha(x.inicio) || new Date();
  const fin = fecha(x.fin) || new Date(ini.getTime() + num(x.duracion_min || 30) * 60000);
  const minutos = Math.max(5, Math.round((fin - ini) / 60000));
  const cliente = x.cliente || "Un cliente";
  const servicio = x.servicio || "una cita";
  const barbero = x.barbero || "";
  const sede = x.sede || "la barbería";
  const visitas = x.visitas === null || x.visitas === undefined ? null : num(x.visitas);
  const nuevo = x.cliente_nuevo === true || visitas === 0;
  const insignia = nuevo
    ? ' <span style="display:inline-block;vertical-align:middle;margin-left:6px;border-radius:999px;padding:3px 9px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;background:' + FONDO.oro + ";border:1px solid " + BORDE.oro + ";color:" + COLOR.oro + ';">Cliente nuevo</span>'
    : visitas
      ? ' <span style="display:inline-block;vertical-align:middle;margin-left:6px;border-radius:999px;padding:3px 9px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;background:' + FONDO.verde + ";border:1px solid " + BORDE.verde + ";color:" + COLOR.verde + ';">' + (visitas + 1) + ".&ordf; visita</span>"
      : "";
  let tel = "";
  let telTexto = null;
  if (x.telefono) {
    const dig = String(x.telefono).replace(/\D/g, "");
    const wa = dig.length === 10 ? "57" + dig : dig;
    tel = linea("&#128241; " + esc(x.telefono) + (wa ? ' &middot; <a href="https://wa.me/' + esc(wa) + '" style="color:' + COLOR.rojo + ';text-decoration:none;font-weight:700;">Escribirle por WhatsApp</a>' : ""));
    telTexto = "Teléfono: " + x.telefono;
  }
  const cuando = diaCorto(ini) + " " + hora(ini);
  const asunto = "Nueva cita: " + cliente + " · " + servicio + " · " + cuando + (barbero ? " · con " + primerNombre(barbero) : "") + " · " + sede;
  return {
    asunto,
    preheader: cliente + " reservó " + servicio.toLowerCase() + " para el " + diaLargo(ini).toLowerCase() + " a las " + hora(ini),
    sede,
    etiqueta: etiqueta("Nueva cita", "rojo"),
    titulo: "Nueva cita en " + sede,
    intro: esc(cliente) + " reserv&oacute; " + esc(servicio.toLowerCase()) + " por la web.",
    cuerpo:
      caja("Cuándo", valorGrande(esc(diaLargo(ini)) + " &middot; " + esc(hora(ini))) + linea(minutos + " min &middot; hasta las " + esc(hora(fin))), true) +
      caja("Cliente", '<div style="margin-top:4px;font-size:16px;font-weight:700;color:#f2ede4;">' + esc(cliente) + insignia + "</div>" + tel) +
      (x.nota ? caja("Nota del cliente", '<div style="margin-top:4px;font-size:14px;color:#f2ede4;line-height:1.5;">' + esc(x.nota) + "</div>") : "") +
      dosCajas({ rotulo: "Barbero", valor: barbero || "Sin asignar" }, { rotulo: "Servicio", valor: servicio, extra: minutos + " min" }),
    boton: "Ver la agenda",
    url: SITIO + "/admin/agenda",
    // Sin prometer que al barbero o al mostrador también les llegó: depende de que
    // tengan los avisos activados y el correo puesto, y este correo no lo sabe.
    pie: "Ya est&aacute; en la agenda del panel.",
    text: [
      "Nueva cita en " + sede,
      "",
      cliente + (nuevo ? " (cliente nuevo)" : visitas ? " (" + (visitas + 1) + "ª visita)" : "") + " — " + servicio,
      diaLargo(ini) + " · " + hora(ini) + " (" + minutos + " min, hasta las " + hora(fin) + ")",
      "Con " + (barbero || "barbero sin asignar") + " · " + sede,
      telTexto,
      x.nota ? "Nota del cliente: " + x.nota : null,
      "",
      "Ver la agenda: " + SITIO + "/admin/agenda",
    ],
  };
}

function cierre(x) {
  const sede = x.sede || "la sede";
  const abierta = fecha(x.abierta_en);
  const cerrada = fecha(x.cerrada_en) || new Date();
  const medios = Array.isArray(x.medios) && x.medios.length
    ? x.medios
    : Object.keys(x.totales || {}).map((k) => ({ medio: k, nombre: cap(k), total: (x.totales[k] || {}).total, propina: (x.totales[k] || {}).propina }));
  const total = medios.reduce((a, m) => a + num(m.total), 0);
  const propinas = medios.reduce((a, m) => a + num(m.propina), 0);
  const citas = num(x.citas);
  const contado = x.efectivo_contado === null || x.efectivo_contado === undefined ? null : num(x.efectivo_contado);
  const dif = num(x.diferencia);
  const esperado = contado === null ? null : contado - dif;
  const cuadre = dif === 0 ? "cuadra exacto" : dif < 0 ? "faltan " + plata(-dif) : "sobran " + plata(dif);
  const horario = abierta
    ? mismoDia(abierta, cerrada)
      ? diaLargo(cerrada) + ", de " + hora(abierta) + " a " + hora(cerrada)
      : "Abierta el " + diaLargo(abierta).toLowerCase() + " a las " + hora(abierta) + " y cerrada el " + diaLargo(cerrada).toLowerCase() + " a las " + hora(cerrada)
    : diaLargo(cerrada) + ", cerrada a las " + hora(cerrada);

  const desglose = medios.length
    ? filas(
        medios.map((m) => [
          esc(m.nombre || m.medio || "Otro"),
          esc(plata(m.total)) + (num(m.propina) ? ' <span style="color:#9c958a;font-weight:400;">(+' + esc(plata(m.propina)) + " propina)</span>" : ""),
        ]),
      )
    : linea("No se cobró nada en este turno.");

  // La caja Efectivo tiene que SUMAR a la vista: fondo + cobrado en efectivo +
  // propinas en efectivo − gastos = lo que debería haber (la misma cuenta que
  // snapshotDinero en src/lib/cobro.ts). Sin el cobrado, los renglones no daban.
  const ef = medios.find((m) => m.medio === "efectivo") || {};
  const cobradoEf = num(ef.total);
  const propinaEf = num(ef.propina);
  const efectivo = [];
  if (num(x.monto_apertura)) efectivo.push(["Fondo con el que abrió", esc(plata(x.monto_apertura))]);
  efectivo.push(["Cobrado en efectivo", "+" + esc(plata(cobradoEf))]);
  if (propinaEf) efectivo.push(["Propinas en efectivo", "+" + esc(plata(propinaEf))]);
  efectivo.push(["Gastos y adelantos en efectivo", num(x.total_gastos) ? "&minus;" + esc(plata(x.total_gastos)) : esc(plata(0))]);
  if (esperado !== null) efectivo.push(["Deber&iacute;a haber en el caj&oacute;n", esc(plata(esperado))]);
  if (contado !== null) efectivo.push(["Contado", esc(plata(contado)), "#f2ede4", true]);

  const resultado =
    dif === 0
      ? '<div style="margin-top:10px;font-size:14px;font-weight:800;color:' + COLOR.verde + ';">&#10003; Cuadra exacto</div>'
      : '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr><td bgcolor="#21190f" style="border:1px solid ' + BORDE.ambar + ';background:#21190f;background-image:linear-gradient(#21190f,#21190f);border-radius:10px;padding:10px 12px;">' +
        '<div style="font-family:\'Barlow Condensed\',Arial,sans-serif;font-size:22px;font-weight:800;color:' + COLOR.ambar + ';">' + (dif < 0 ? "Faltan " : "Sobran ") + esc(plata(Math.abs(dif))) + " en el caj&oacute;n</div>" +
        '<div style="margin-top:2px;font-size:12px;color:#cfc7ba;">Revisa los cobros en efectivo y los gastos del turno en Caja.</div></td></tr></table>';

  return {
    asunto: "Cierre de caja · " + sede + " · " + diaCorto(cerrada) + " · " + plata(total) + " · " + cuadre,
    preheader: "Entró " + plata(total) + " en " + citas + (citas === 1 ? " atención" : " atenciones") + ". Efectivo: " + cuadre + ".",
    sede,
    etiqueta: etiqueta("Cierre de caja", dif === 0 ? "verde" : "ambar"),
    titulo: "Cierre de " + sede,
    // "p. m." ya trae su punto: no se le pone otro.
    intro: esc(horario) + (x.cerrada_por ? " &middot; cerr&oacute; " + esc(x.cerrada_por) + "." : /\.$/.test(horario) ? "" : "."),
    cuerpo:
      caja(
        "Entró en el turno",
        valorGrande(esc(plata(total))) +
          linea(citas + (citas === 1 ? " atenci&oacute;n cobrada" : " atenciones cobradas") + (propinas ? " &middot; " + esc(plata(propinas)) + " en propinas" : "")),
        true,
      ) +
      caja("Por medio de pago", desglose) +
      caja("Efectivo", filas(efectivo) + resultado) +
      (x.nota ? caja("Nota del cierre", '<div style="margin-top:4px;font-size:14px;color:#f2ede4;line-height:1.5;">' + esc(x.nota) + "</div>") : ""),
    boton: "Ver el cuadre",
    url: SITIO + "/admin/cuadre",
    pie: "El detalle de cada cobro est&aacute; en Caja.",
    text: [
      "Cierre de " + sede,
      horario + (x.cerrada_por ? " · cerró " + x.cerrada_por : ""),
      "",
      "Entró: " + plata(total) + " en " + citas + (citas === 1 ? " atención" : " atenciones") + (propinas ? " (+" + plata(propinas) + " en propinas)" : ""),
      ...medios.map((m) => "  " + (m.nombre || m.medio) + ": " + plata(m.total) + (num(m.propina) ? " (+" + plata(m.propina) + " propina)" : "")),
      "",
      num(x.monto_apertura) ? "Fondo con el que abrió: " + plata(x.monto_apertura) : null,
      "Cobrado en efectivo: +" + plata(cobradoEf),
      propinaEf ? "Propinas en efectivo: +" + plata(propinaEf) : null,
      "Gastos y adelantos en efectivo: " + (num(x.total_gastos) ? "-" + plata(x.total_gastos) : plata(0)),
      esperado !== null ? "Debería haber en el cajón: " + plata(esperado) : null,
      contado !== null ? "Contado: " + plata(contado) : null,
      "Resultado: " + (dif === 0 ? "cuadra exacto" : (dif < 0 ? "faltan " : "sobran ") + plata(Math.abs(dif)) + " en el cajón"),
      x.nota ? "Nota: " + x.nota : null,
      "",
      "Ver el cuadre: " + SITIO + "/admin/cuadre",
    ],
  };
}

function cajaAbierta(x) {
  const sede = x.sede || "la sede";
  const abierta = fecha(x.abierta_en);
  const dias = num(x.dias);
  const desde = !abierta
    ? "Todavía nadie la ha cerrado."
    : dias === 0
      ? "Se abrió hoy a las " + hora(abierta) + " y todavía nadie la ha cerrado."
      : "Se abrió el " + diaLargo(abierta).toLowerCase() + " y lleva " + (dias === 1 ? "1 día" : dias + " días") + " sin cerrarse.";
  return {
    asunto: "La caja de " + sede + " sigue abierta" + (dias > 0 ? " · hace " + (dias === 1 ? "1 día" : dias + " días") : ""),
    preheader: desde,
    sede,
    etiqueta: etiqueta("Caja abierta", "ambar"),
    titulo: "La caja de " + sede + " sigue abierta",
    intro: esc(desde),
    cuerpo:
      caja(
        "Por qué importa",
        linea("Lo que se cobre de aqu&iacute; en adelante se sigue sumando a ese turno, y el cuadre deja de servir para saber cu&aacute;nto entr&oacute; cada d&iacute;a."),
      ) +
      caja(
        "Qué hacer",
        linea("P&iacute;dele al mostrador que cuente el efectivo y la cierre en la pesta&ntilde;a <b style=\"color:#f2ede4;\">Cierre</b>, o ci&eacute;rrala t&uacute; desde Caja."),
        true,
      ),
    boton: "Ir a Caja",
    url: SITIO + "/admin/cuadre",
    pie: "Este aviso sale una vez por noche mientras la caja siga abierta.",
    text: [
      "La caja de " + sede + " sigue abierta",
      desde,
      "",
      "Lo que se cobre de aquí en adelante se sigue sumando a ese turno.",
      "Pídele al mostrador que cuente el efectivo y la cierre en la pestaña Cierre, o ciérrala tú desde Caja.",
      "",
      "Ir a Caja: " + SITIO + "/admin/cuadre",
    ],
  };
}

// Los chips que marcó el cliente ("Tuve que esperar"), como píldoras. Datos
// viejos sin `etiquetas` no muestran nada (el correo queda como antes).
const chips = (lista) =>
  '<div style="margin-top:10px;">' +
  lista
    .map(
      (t) =>
        '<span style="display:inline-block;margin:0 6px 6px 0;border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:700;background:' +
        FONDO.rojo + ";border:1px solid " + BORDE.rojo + ';color:#f2ede4;">' + esc(t) + "</span>",
    )
    .join("") +
  "</div>";

function resenaBaja(x) {
  const score = Math.max(1, Math.min(5, Math.round(num(x.score) || 1)));
  const cliente = x.cliente || "Un cliente";
  const barbero = x.barbero || "";
  const sede = x.sede || "";
  const estrellas = "&#9733;".repeat(score) + '<span style="color:#3a332c;">' + "&#9733;".repeat(5 - score) + "</span>";
  const marcadas = Array.isArray(x.etiquetas) ? x.etiquetas.filter((t) => typeof t === "string" && t) : [];
  return {
    asunto: "Calificación de " + score + " ★ · " + cliente + (barbero ? " con " + primerNombre(barbero) : ""),
    // Entre «» solo lo que escribió él: el texto armado no se cita como suyo.
    preheader: marcadas.length
      ? marcadas.join(" · ").slice(0, 90)
      : x.comentario && !x.texto_generado
        ? "«" + String(x.comentario).slice(0, 90) + "»"
        : cliente + " calificó la visita con " + score + " de 5.",
    sede,
    etiqueta: etiqueta("Calificación baja", "rojo"),
    titulo: cliente + " calificó con " + score + " de 5",
    intro: "Una calificaci&oacute;n de 3 o menos. Mientras m&aacute;s pronto le escribas, m&aacute;s f&aacute;cil es que vuelva.",
    cuerpo:
      caja(
        "Lo que dijo",
        '<div style="margin-top:4px;font-size:24px;letter-spacing:3px;color:' + COLOR.ambar + ';">' + estrellas + "</div>" +
          (marcadas.length ? chips(marcadas) : "") +
          (x.comentario
            ? '<div style="margin-top:8px;font-size:15px;color:#f2ede4;line-height:1.55;font-style:italic;">&laquo;' + esc(x.comentario) + "&raquo;</div>" +
              (x.texto_generado ? linea("Texto armado con lo que marc&oacute; (&eacute;l lo revis&oacute; y lo envi&oacute;).") : "")
            : linea("No dej&oacute; comentario.")),
        true,
      ) +
      dosCajas({ rotulo: "Barbero", valor: barbero || "—", extra: x.servicio || "" }, { rotulo: "Sede", valor: sede || "—" }),
    boton: "Verla en el panel",
    url: SITIO + "/admin",
    pie: "En el Inicio aparece en «Para hacer», con el enlace a la ficha del cliente.",
    text: [
      cliente + " calificó con " + score + " de 5" + (barbero ? " (con " + barbero + ")" : "") + (sede ? " · " + sede : ""),
      marcadas.length ? "Marcó: " + marcadas.join(" · ") : null,
      x.comentario ? "«" + x.comentario + "»" + (x.texto_generado ? " (texto armado con lo que marcó)" : "") : "No dejó comentario.",
      x.servicio ? "Servicio: " + x.servicio : null,
      "",
      "Verla en el panel: " + SITIO + "/admin",
    ],
  };
}

function prueba(x) {
  // guardado === false: se probó un correo escrito pero todavía sin «Agregar».
  // Datos viejos sin la marca cuentan como guardado (era lo único que se probaba).
  const sinGuardar = x.guardado === false;
  const lista = [
    ["Citas nuevas", "cada cliente que reserva por la web."],
    ["Cierre de caja", "el resumen de cada cierre: lo que entró, los gastos y si cuadró."],
    ["Alertas", "una caja que sigue abierta en la noche y las calificaciones de 3 o menos."],
  ];
  return {
    asunto: "Prueba: así te van a llegar los avisos ✅",
    preheader: "Si lees esto, a esta dirección le llegan bien los avisos de la barbería.",
    sede: "",
    etiqueta: etiqueta("Prueba", "verde"),
    titulo: "Así te van a llegar los avisos",
    intro: "Esta es la prueba que pediste desde el panel. Si la est&aacute;s leyendo, a esta direcci&oacute;n le llegan bien.",
    cuerpo:
      (sinGuardar
        ? caja(
            "Falta un paso",
            linea(
              '<b style="color:#f2ede4;">Este correo todav&iacute;a NO est&aacute; en tu lista.</b> Vuelve al panel, en Ajustes &rarr; Avisos, y toca &laquo;Agregar&raquo;: hasta entonces no te llega ninguna cita ni ning&uacute;n cierre.',
            ),
            true,
          )
        : "") +
      caja(
        "Lo que te puede llegar acá",
        lista.map((l) => linea('<b style="color:#f2ede4;">' + l[0] + "</b>: " + l[1])).join("") +
          linea("Eliges cu&aacute;les en Ajustes &rarr; Avisos."),
        !sinGuardar,
      ) +
      caja("Un consejo", linea("Si este correo cay&oacute; en Spam o en Promociones, m&aacute;rcalo como &laquo;No es spam&raquo; para que los pr&oacute;ximos lleguen a tu bandeja.")),
    boton: sinGuardar ? "Agregar este correo" : "Abrir mis avisos",
    url: SITIO + "/admin/avisos",
    pie: "No hay ninguna cita ni ning&uacute;n cierre: es solo la prueba.",
    motivo: sinGuardar
      ? 'Te llega porque alguien prob&oacute; esta direcci&oacute;n desde el panel. Todav&iacute;a no est&aacute; en <a href="' + SITIO + '/admin/avisos" style="color:#9c958a;">Ajustes &rarr; Avisos</a>.'
      : "",
    motivoTexto: sinGuardar
      ? "Te llega porque alguien probó esta dirección desde el panel. Todavía no está en Ajustes → Avisos (" + SITIO + "/admin/avisos)."
      : "",
    text: [
      "Así te van a llegar los avisos",
      "Esta es la prueba que pediste desde el panel. Si la estás leyendo, a esta dirección le llegan bien.",
      sinGuardar ? "" : null,
      sinGuardar
        ? "FALTA UN PASO: este correo todavía NO está en tu lista. Vuelve al panel, en Ajustes → Avisos, y toca «Agregar»: hasta entonces no te llega ninguna cita ni ningún cierre."
        : null,
      "",
      ...lista.map((l) => "· " + l[0] + ": " + l[1]),
      "Eliges cuáles en Ajustes → Avisos: " + SITIO + "/admin/avisos",
      "",
      "Si cayó en Spam, márcalo como «No es spam».",
    ],
  };
}

const ARMAR = { cita, cierre, caja_abierta: cajaAbierta, resena_baja: resenaBaja, prueba };

// ---------- Las filas que manda el RPC ----------

const items = $input.all();
let rows = [];
if (items.length === 1 && Array.isArray(items[0].json)) rows = items[0].json;
else rows = items.map((i) => i.json);
rows = rows.filter((r) => r && r.email && r.tipo && ARMAR[r.tipo]);

const salida = [];
for (const r of rows) {
  let datos = r.datos || {};
  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos);
    } catch {
      datos = {};
    }
  }
  const m = ARMAR[r.tipo](datos);
  salida.push({
    json: {
      para: r.email,
      asunto: m.asunto,
      html: render(m),
      // null = línea opcional que no aplica; "" = renglón en blanco a propósito.
      text: m.text.filter((l) => l !== null).join("\n") + "\n\n—\nBarbas & Bigotes · " + (m.motivoTexto || MOTIVO_TEXTO),
      tipo: r.tipo,
      aviso_id: r.aviso_id,
    },
  });
}
return salida;
