import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wvmdsxznujklgfezqtfy.supabase.co" },
    ],
  },
  // Permite probar el dev server desde el celular u otro dispositivo en la
  // misma red Wi-Fi (sin esto, Next bloquea el HMR por origen cruzado).
  allowedDevOrigins: ["192.168.40.12"],
};

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);
