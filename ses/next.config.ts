// next.config.ts
// Değişiklikler:
//   output: 'standalone'     → Docker multi-stage build için zorunlu
//   serverBodySizeLimit: '2gb' → Video dosya yükleme için

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',

  experimental: {
    serverBodySizeLimit: '2gb',   // /api/process büyük dosya yüklemesi
  },
}

export default nextConfig