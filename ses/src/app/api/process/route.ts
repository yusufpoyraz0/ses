// src/app/api/process/route.ts
// POST /api/process
// İki mod:
//   1) JSON body: { youtubeUrl: string }  → YouTube URL işleme
//   2) multipart/form-data: file=<video>  → Dosya yükleme
//
// Başarıda: 202 Accepted + { jobId }
// Hatalarda: 400 / 500 + { error }

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDubbingQueue, type DubbingJobData } from '@/lib/queue'
import { saveUploadedFile, ensureDirectories } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic  = 'force-dynamic'
export const maxDuration = 300  // 5 dk — büyük dosya yüklemesi için

// ─── Yardımcılar ────────────────────────────────────────────────────────────

function isValidYouTubeUrl(url: string): boolean {
  try {
    const { hostname, pathname, searchParams } = new URL(url)
    const isYT =
      hostname === 'youtube.com'     ||
      hostname === 'www.youtube.com' ||
      hostname === 'youtu.be'        ||
      hostname === 'm.youtube.com'

    if (!isYT) return false

    // youtube.com/watch?v=... veya youtu.be/<id>
    const hasVideoId =
      searchParams.has('v') ||
      (hostname === 'youtu.be' && pathname.length > 1) ||
      pathname.startsWith('/shorts/')

    return hasVideoId
  } catch {
    return false
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await ensureDirectories()

    const contentType = request.headers.get('content-type') ?? ''
    let jobData: DubbingJobData

    // ── Mod 1: YouTube URL ──────────────────────────────────────────────────
    if (contentType.includes('application/json')) {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ error: 'Geçersiz JSON gövdesi' }, { status: 400 })
      }

      if (
        typeof body !== 'object' ||
        body === null ||
        !('youtubeUrl' in body) ||
        typeof (body as Record<string, unknown>).youtubeUrl !== 'string'
      ) {
        return NextResponse.json(
          { error: 'youtubeUrl alanı zorunlu (string)' },
          { status: 400 }
        )
      }

      const { youtubeUrl } = body as { youtubeUrl: string }

      if (!isValidYouTubeUrl(youtubeUrl)) {
        return NextResponse.json({ error: 'Geçersiz YouTube URL' }, { status: 400 })
      }

      const jobId = randomUUID()
      jobData = { jobId, type: 'url', youtubeUrl }
    }

    // ── Mod 2: Dosya yükleme ────────────────────────────────────────────────
    else if (contentType.includes('multipart/form-data')) {
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        return NextResponse.json({ error: 'Form verisi okunamadı' }, { status: 400 })
      }

      const file = formData.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: '"file" alanı multipart/form-data içinde bulunmalı' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())

      let saved: { jobId: string; filePath: string }
      try {
        saved = await saveUploadedFile(buffer, file.name)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Dosya kaydedilemedi'
        return NextResponse.json({ error: message }, { status: 400 })
      }

      jobData = {
        jobId:            saved.jobId,
        type:             'file',
        filePath:         saved.filePath,
        originalFileName: file.name,
      }
    }

    // ── Geçersiz Content-Type ───────────────────────────────────────────────
    else {
      return NextResponse.json(
        {
          error:    'Content-Type desteklenmiyor',
          accepted: ['application/json', 'multipart/form-data'],
        },
        { status: 415 }
      )
    }

    // ── BullMQ kuyruğuna ekle ───────────────────────────────────────────────
    const queue = getDubbingQueue()
    const job   = await queue.add('dub', jobData, {
      jobId: jobData.jobId, // BullMQ job ID = uygulama job ID (SSE'de takip için)
    })

    return NextResponse.json(
      { jobId: job.id, message: 'İş kuyruğa alındı' },
      { status: 202 }
    )
  } catch (error) {
    console.error('[POST /api/process]', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}