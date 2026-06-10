// src/lib/worker.ts
// BullMQ Worker — her job için Python pipeline'ı HTTP ile tetikler
// Çalıştırma: node -r ts-node/register src/lib/worker.ts
// Docker'da: ayrı bir process olarak başlatılır

import { Worker, Job } from 'bullmq'
import { type DubbingJobData, type DubbingJobResult, QUEUE_NAME } from './queue'

const PIPELINE_URL = process.env.PIPELINE_URL ?? 'http://pipeline:8001'
const REDIS_URL    = process.env.REDIS_URL    ?? 'redis://redis:6379'

function redisOptions() {
  try {
    const u = new URL(REDIS_URL)
    return {
      host:                 u.hostname || 'redis',
      port:                 Number(u.port) || 6379,
      password:             u.password || undefined,
      maxRetriesPerRequest: null as null,
      enableReadyCheck:     false,
    }
  } catch {
    return {
      host:                 'redis',
      port:                 6379,
      maxRetriesPerRequest: null as null,
      enableReadyCheck:     false,
    }
  }
}

async function processJob(job: Job<DubbingJobData, DubbingJobResult>) {
  console.log(`[worker] İş başladı: ${job.id}`)

  await job.updateProgress({ step: 'downloading', progress: 5, message: 'Başlatılıyor...' })

  // Python pipeline'ı tetikle
  const response = await fetch(`${PIPELINE_URL}/process`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job_id:      job.data.jobId,
      type:        job.data.type,
      youtube_url: job.data.youtubeUrl,
      file_path:   job.data.filePath,
      source_lang: 'en',
      target_lang: 'tr',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Pipeline hatası (${response.status}): ${err}`)
  }

  // Pipeline arka planda çalışıyor — ilerleme /api/internal/progress üzerinden gelir
  // Worker burada beklemez; job tamamlanması internal/progress endpoint'i tarafından
  // job.moveToCompleted() ile sağlanır.
  console.log(`[worker] Pipeline tetiklendi: ${job.id}`)

  // Placeholder return — gerçek tamamlanma pipeline callback'inden gelir
  return {
    outputPath: '',
    outputUrl:  `/api/download/${job.data.jobId}`,
    durationSeconds: 0,
  } satisfies DubbingJobResult
}

// ─── Worker başlat ────────────────────────────────────────────────────────
const worker = new Worker<DubbingJobData, DubbingJobResult>(
  QUEUE_NAME,
  processJob,
  {
    connection: redisOptions(),
    concurrency: 2, // aynı anda max 2 iş
  }
)

worker.on('completed', (job) => {
  console.log(`[worker] ✓ Tamamlandı: ${job.id}`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] ✗ Başarısız: ${job?.id}`, err.message)
})

worker.on('error', (err) => {
  console.error('[worker] Hata:', err)
})

console.log(`[worker] Başlatıldı — queue: ${QUEUE_NAME}, pipeline: ${PIPELINE_URL}`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[worker] Kapatılıyor...')
  await worker.close()
  process.exit(0)
})
