export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env['API_URL'] || 'http://localhost:3000'
const AUTH_HEADERS: Record<string, string> = process.env['OPS_API_KEY']
  ? { Authorization: `Bearer ${process.env['OPS_API_KEY']}` }
  : { 'x-e2e-test': 'true' }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId") ?? null;
    const resp = await fetch(`${API_BASE}/api/settlement/status?jobId=${encodeURIComponent(jobId || '')}`, {
      headers: { ...AUTH_HEADERS },
      cache: 'no-store',
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 })
  }
}