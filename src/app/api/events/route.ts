import { NextResponse } from 'next/server';

function deprecatedResponse() {
  return NextResponse.json(
    { error: 'Deprecated endpoint. Gunakan /api/public/* atau /api/admin/*.' },
    { status: 410 },
  );
}

export async function GET() {
  return deprecatedResponse();
}

export async function POST() {
  return deprecatedResponse();
}
