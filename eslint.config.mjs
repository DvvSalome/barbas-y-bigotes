import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos generados por next-pwa en el build (no son fuente): en CI no
    // existen al correr lint (lint va antes del build), pero localmente sí y
    // ensuciaban el lint con miles de errores de JS compilado.
    "public/sw.js",
    "public/workbox-*.js",
    "public/worker-*.js",
    // "worker-*.js" NO matchea "swe-worker-*.js" (el worker de Serwist que
    // emite next-pwa): se colaba con sus propios errores de JS compilado.
    "public/swe-worker-*.js",
    "public/fallback-*.js",
    // Copia vieja del proyecto que quedó dentro de la carpeta (ya está en
    // .gitignore, no es código nuestro). En CI ni existe; localmente aportaba
    // ~1200 errores y dejaba `npm run lint` inservible como puerta de calidad.
    "antigravity barbas/**",
    // Build de Next anidado en cualquier subcarpeta (".next/**" solo ancla en raíz).
    "**/.next/**",
  ]),
  {
    // react-three-fiber muta el scene graph imperativamente cada frame
    // (useFrame, refs de THREE.*). Las reglas de pureza del React Compiler
    // no aplican a r3f por diseño — se eximen solo en /three.
    files: ["src/components/three/**"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
