// src/app/api/internal/progress/route.ts
// POST /api/internal/progress
// Python pipeline bu endpoint'i çağırarak iş ilerlemesini bildirir.
// Bu endpoint BullMQ job'unu günceller → SSE stream üzerinden kullanıcıya yansır.

import { NextRequest, NextResponse } from 'next/server'
import { getDubbingQueue } from '@/lib/queue'
import { isValidJobId } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ProgressPayload {
  jobId:    string
  step:     string
  progress: number   // 0–100
  message:  string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Sadece iç ağdan (Docker network) erişilebilmeli
  // Production'da nginx bu endpoint'i dış dünyaya kapatmalı
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp    = request.headers.get('x-real-ip')

  // İsteğe bağlı: iç ağ IP kontrolü
  // const allowedPrefixes = ['172.', '10.', '127.']
  // if (realIp && !allowedPrefixes.some(p => realIp.startsWith(p))) {
  //   return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  // }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const { jobId, step, progress, message } = body as ProgressPayload

  if (!jobId || !isValidJobId(jobId)) {
    return NextResponse.json({ error: 'Geçersiz jobId' }, { status: 400 })
  }

  const queue = getDubbingQueue()
  const job   = await queue.getJob(jobId)

  if (!job) {
    return NextResponse.json({ error: 'İş bulunamadı' }, { status: 404 })
  }

  try {
    if (step === 'done') {
      // Pipeline tamamlandı → job'u complete olarak işaretle
      const storagePath = process.env.STORAGE_PATH ?? './data/videos'
      await job.moveToCompleted(
        {
          outputPath:      `${storagePath}/output/${jobId}_dubbed.mp4`,
          outputUrl:       `/api/download/${jobId}`,
          durationSeconds: 0,
        },
        job.token ?? 'worker',
        false
      )
      console.log(`[internal/progress] ✓ Job tamamlandı: ${jobId}`)
    } else if (step === 'error') {
      // Pipeline hata verdi → job'u fail olarak işaretle
      await job.moveToFailed(
        new Error(message || 'Pipeline hatası'),
        job.token ?? 'worker',
        false
      )
      console.log(`[internal/progress] ✗ Job başarısız: ${jobId} — ${message}`)
    } else {
      // Normal ilerleme güncellemesi
      await job.updateProgress({ step, progress, message })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[internal/progress] Job güncelleme hatası:', error)
    return NextResponse.json({ error: 'Job güncellenemedi' }, { status: 500 })
  }
}
