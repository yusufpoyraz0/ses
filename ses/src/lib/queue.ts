// src/lib/queue.ts
// Düzeltme: IORedis instance geçmek yerine plain options objesi kullanılıyor.
// BullMQ 5.x kendi içinde ioredis bundle'lıyor — dışarıdan instance geçince tip çakışması oluyor.
// Queue singleton için ReturnType pattern kullanılıyor (6 generic parametreden kaçınmak için).

import { Queue, QueueEvents } from 'bullmq'

// ─── Redis bağlantı seçenekleri ─────────────────────────────────────────────
// IORedis instance değil, plain options objesi → BullMQ ile tip uyumlu
function redisOptions() {
  const url = process.env.REDIS_URL ?? 'redis://redis:6379'
  try {
    const u = new URL(url)
    return {
      host:                 u.hostname || 'redis',
      port:                 Number(u.port) || 6379,
      password:             u.password || undefined,
      maxRetriesPerRequest: null as null,  // BullMQ blocking komutları için zorunlu
      enableReadyCheck:     false,
    }
  } catch {
    // URL parse edilemezse varsayılan Docker Compose değerleri
    return {
      host:                 'redis',
      port:                 6379,
      maxRetriesPerRequest: null as null,
      enableReadyCheck:     false,
    }
  }
}

// ─── Tip tanımları ──────────────────────────────────────────────────────────

export interface DubbingJobData {
  jobId:             string
  type:              'url' | 'file'
  youtubeUrl?:       string
  filePath?:         string
  originalFileName?: string
}

export interface DubbingJobResult {
  outputPath:      string
  outputUrl:       string
  durationSeconds: number
}

export interface DubbingJobProgress {
  step:     'downloading' | 'transcribing' | 'translating' | 'tts' | 'mixing' | 'finalizing'
  progress: number   // 0–100
  message:  string
}

// ─── Queue adı ──────────────────────────────────────────────────────────────
export const QUEUE_NAME = 'dubbing' as const

// ─── Queue singleton ────────────────────────────────────────────────────────
// ReturnType ile singleton tipi türetiliyor → 6-generic BullMQ tipini elle yazmaya gerek yok

function _makeQueue() {
  return new Queue<DubbingJobData, DubbingJobResult>(QUEUE_NAME, {
    connection: redisOptions(),
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50  },
      attempts:         1,
    },
  })
}

type DubbingQueueType = ReturnType<typeof _makeQueue>
let _queue: DubbingQueueType | null = null

export function getDubbingQueue(): DubbingQueueType {
  if (!_queue) {
    _queue = _makeQueue()
  }
  return _queue
}

// ─── QueueEvents factory ────────────────────────────────────────────────────
// Her SSE bağlantısı için YENİ örnek — pub/sub nedeniyle paylaşılamaz

export function createDubbingQueueEvents(): QueueEvents {
  return new QueueEvents(QUEUE_NAME, {
    connection: redisOptions(),
  })
}