import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'smart-form', timestamp: new Date().toISOString() }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

