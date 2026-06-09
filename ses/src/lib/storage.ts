// src/lib/storage.ts
// Yerel disk dosya yönetimi — Docker volume: /data/videos
// Klasör yapısı:
//   /data/videos/uploads/   → yüklenen ham videolar
//   /data/videos/output/    → işlenmiş dublajlı videolar
//   /data/videos/temp/      → Python pipeline çalışma dizinleri

import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// ─── Sabitler ───────────────────────────────────────────────────────────────
const STORAGE_BASE = process.env.STORAGE_PATH ?? '/data/videos'

export const DIRS = {
  uploads: path.join(STORAGE_BASE, 'uploads'),
  output:  path.join(STORAGE_BASE, 'output'),
  temp:    path.join(STORAGE_BASE, 'temp'),
} as const

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v'])
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2 GB

// ─── Dizin yönetimi ─────────────────────────────────────────────────────────

/** Gerekli tüm klasörleri oluşturur. Uygulama başlangıcında çağrılabilir. */
export async function ensureDirectories(): Promise<void> {
  await Promise.all(
    Object.values(DIRS).map((dir) => fs.mkdir(dir, { recursive: true }))
  )
}

// ─── Dosya işlemleri ────────────────────────────────────────────────────────

/**
 * Yüklenen video dosyasını diske kaydeder.
 * @returns jobId ve kaydedilen dosyanın tam yolu
 * @throws Desteklenmeyen format veya boyut aşımında hata fırlatır
 */
export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string,
): Promise<{ jobId: string; filePath: string }> {
  await ensureDirectories()

  const ext = path.extname(originalName).toLowerCase()

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Desteklenmeyen format: "${ext}". İzin verilenler: ${[...ALLOWED_EXTENSIONS].join(', ')}`
    )
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('Dosya çok büyük. Maksimum boyut: 2 GB')
  }

  const jobId    = randomUUID()
  const fileName = `${jobId}${ext}`
  const filePath = path.join(DIRS.uploads, fileName)

  await fs.writeFile(filePath, buffer)

  return { jobId, filePath }
}

/**
 * Python pipeline'ın yazacağı çıktı dosyasının beklenen yolunu döner.
 * Dosyanın var olup olmadığını garanti etmez.
 */
export function getOutputPath(jobId: string): string {
  return path.join(DIRS.output, `${jobId}_dubbed.mp4`)
}

/**
 * Python pipeline için geçici çalışma dizini oluşturur.
 * Pipeline bu dizini ffmpeg ara dosyaları için kullanabilir.
 */
export async function createJobWorkdir(jobId: string): Promise<string> {
  const workdir = path.join(DIRS.temp, jobId)
  await fs.mkdir(workdir, { recursive: true })
  return workdir
}

/** Dosyanın var olup olmadığını kontrol eder */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * İş tamamlandıktan sonra upload ve temp dosyalarını temizler.
 * Output dosyası silinmez (kullanıcı indirmeden önce kalmaya devam eder).
 */
export async function cleanupJobFiles(jobId: string): Promise<void> {
  const toDelete: string[] = [
    // Tüm olası uzantılarla yükleme dosyaları
    ...[...ALLOWED_EXTENSIONS].map((ext) =>
      path.join(DIRS.uploads, `${jobId}${ext}`)
    ),
    // Geçici çalışma dizini
    path.join(DIRS.temp, jobId),
  ]

  await Promise.allSettled(
    toDelete.map((p) => fs.rm(p, { recursive: true, force: true }))
  )
}

/**
 * Çıktı dosyasını okur (indirme endpoint'i için).
 * Dosya yoksa hata fırlatır.
 */
export async function readOutputFile(jobId: string): Promise<Buffer> {
  const outputPath = getOutputPath(jobId)
  return fs.readFile(outputPath)
}

/** UUID v4 formatını doğrular — jobId manipülasyon saldırılarını önler */
export function isValidJobId(jobId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    jobId
  )
}