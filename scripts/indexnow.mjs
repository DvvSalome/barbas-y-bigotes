// Avisa a IndexNow (Bing, Yandex, Seznam — el índice que alimenta ChatGPT Search
// y Copilot) que las páginas públicas cambiaron. Google NO usa IndexNow, pero
// Bing sí y ahí el sitio estaba invisible según el audit GEO.
//
//   node scripts/indexnow.mjs
//
// La clave vive en public/<KEY>.txt (IndexNow la lee de ahí para validar que el
// dominio es nuestro). Si rotás la clave, renombrá el archivo y actualizá KEY.
const KEY = "***REDACTED***";
const HOST = "barbasybigotes.com";

const URLS = [
  "https://barbasybigotes.com/",
  "https://barbasybigotes.com/barberos",
  "https://barbasybigotes.com/nosotros",
  "https://barbasybigotes.com/reservar",
  "https://barbasybigotes.com/privacidad",
  "https://barbasybigotes.com/terminos",
];

const res = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: URLS,
  }),
});
// 200 = aceptado, 202 = aceptado y pendiente de validar la clave.
console.log("IndexNow ->", res.status, res.status === 200 || res.status === 202 ? "OK" : await res.text());
console.log("URLs enviadas:", URLS.length);
