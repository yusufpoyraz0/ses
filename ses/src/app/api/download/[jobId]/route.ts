// src/app/api/download/[jobId]/route.ts
// GET /api/download/:jobId → işlenmiş dublajlı videoyu indir

import { NextRequest, NextResponse } from 'next/server'
import { isValidJobId, getOutputPath, fileExists } from '@/lib/storage'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = Promise<{ jobId: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<Response> {
  const { jobId } = await params

  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'Geçersiz jobId' }, { status: 400 })
  }

  const outputPath = getOutputPath(jobId)
  const exists = await fileExists(outputPath)

  if (!exists) {
    return NextResponse.json(
      { error: 'Dosya bulunamadı. İş tamamlanmamış veya süresi dolmuş olabilir.' },
      { status: 404 }
    )
  }

  try {
    const fileBuffer = await fs.readFile(outputPath)
    const fileName = `ses-dublaj-${jobId.slice(0, 8)}.mp4`

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[GET /api/download]', error)
    return NextResponse.json({ error: 'Dosya okunamadı' }, { status: 500 })
  }
}
