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

export default nextConfig;
