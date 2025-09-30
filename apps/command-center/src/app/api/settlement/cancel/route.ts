export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env['API_URL'] || 'http://localhost:3000'
const AUTH_HEADERS: Record<string, string> = process.env['OPS_API_KEY']
  ? { Authorization: `Bearer ${process.env['OPS_API_KEY']}` }
  : { 'x-e2e-test': 'true' }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resp = await fetch(`${API_BASE}/api/settlement/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADERS,
      },
      body: JSON.stringify(body),
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to cancel settlement job' }, { status: 500 })
  }
}