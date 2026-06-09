// src/app/api/status/[jobId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getDubbingQueue, createDubbingQueueEvents } from '@/lib/queue'
import { isValidJobId } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic  = 'force-dynamic'

// ─── Yardımcılar ────────────────────────────────────────────────────────────

const encoder = new TextEncoder()

// new Response(body) için → string (BodyInit kabul eder)
function sseString(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// controller.enqueue() için → Uint8Array
function sseChunk(data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

function sseHeaders(): HeadersInit {
  return {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}

// ─── Tip ────────────────────────────────────────────────────────────────────
type RouteParams = Promise<{ jobId: string }>

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<Response> {
  const { jobId } = await params

  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'Geçersiz jobId formatı' }, { status: 400 })
  }

  const queue = getDubbingQueue()
  const job   = await queue.getJob(jobId)

  if (!job) {
    return NextResponse.json({ error: 'İş bulunamadı' }, { status: 404 })
  }

  const currentState = await job.getState()

  // ── Zaten tamamlanmış → tek string mesaj, stream açma ───────────────────
  if (currentState === 'completed') {
    return new Response(
      sseString({                          // ← string, Uint8Array değil
        type:      'completed',
        progress:  100,
        message:   'Dublaj tamamlandı!',
        outputUrl: `/api/download/${jobId}`,
      }),
      { headers: sseHeaders() }
    )
  }

  // ── Başarısız olmuş → tek string mesaj ──────────────────────────────────
  if (currentState === 'failed') {
    return new Response(
      sseString({                          // ← string, Uint8Array değil
        type:    'error',
        message: job.failedReason ?? 'İş başarısız oldu',
      }),
      { headers: sseHeaders() }
    )
  }

  // ── Aktif / bekleyen iş için ReadableStream ──────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const send = (data: Record<string, unknown>): void => {
        if (closed) return
        try {
          controller.enqueue(sseChunk(data))  // ← Uint8Array, ReadableStream için doğru
        } catch {
          closed = true
        }
      }

      const cleanup = (): void => {
        if (closed) return
        closed = true
        clearInterval(heartbeatTimer)
        clearTimeout(timeoutTimer)
        queueEvents.close().catch(() => {})
        try { controller.close() } catch { /* zaten kapanmış */ }
      }

      const queueEvents = createDubbingQueueEvents()

      const heartbeatTimer = setInterval(() => {
        send({ type: 'heartbeat' })
      }, 20_000)

      const timeoutTimer = setTimeout(() => {
        send({ type: 'timeout', message: 'Maksimum bekleme süresi aşıldı (30 dk)' })
        cleanup()
      }, 30 * 60 * 1000)

      queueEvents.on('progress', ({ jobId: evtId, data }) => {
        if (evtId !== jobId) return
        if (typeof data === 'object' && data !== null) {
          send({ type: 'progress', ...(data as Record<string, unknown>) })
        } else {
          send({ type: 'progress', progress: data })
        }
      })

      queueEvents.on('completed', ({ jobId: evtId }) => {
        if (evtId !== jobId) return
        send({
          type:      'completed',
          progress:  100,
          message:   'Dublaj tamamlandı!',
          outputUrl: `/api/download/${jobId}`,
        })
        cleanup()
      })

      queueEvents.on('failed', ({ jobId: evtId, failedReason }) => {
        if (evtId !== jobId) return
        send({ type: 'error', message: failedReason ?? 'İşlem başarısız oldu' })
        cleanup()
      })

      queueEvents.on('error', (err) => {
        console.error(`[SSE ${jobId}] QueueEvents hatası:`, err)
        send({ type: 'error', message: 'Kuyruk bağlantısında hata oluştu' })
        cleanup()
      })

      request.signal.addEventListener('abort', cleanup, { once: true })

      send({ type: 'connected', message: 'Bağlandı, iş izleniyor...' })

      const freshJob = await queue.getJob(jobId)
      if (freshJob && typeof freshJob.progress === 'number' && freshJob.progress > 0) {
        send({ type: 'progress', progress: freshJob.progress })
      }
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}