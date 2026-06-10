import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Büyük video dosyası yüklemeleri için body size artır
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },

  // Font indirme başarısız olursa sistem fontuna düş, uyarı verme
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  // Docker içinde çalışırken hostname izinleri
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ses.net.tr",
      },
    ],
  },

  // Geliştirmede cross-origin erişimine izin ver
  allowedDevOrigins: ["192.168.1.36", "localhost"],
};

export default nextConfig;
