import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Deprecated endpoint. Gunakan /api/admin/events/[id]/messages.' },
    { status: 410 },
  );
}
