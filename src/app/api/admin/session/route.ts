import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdminUser } from '@/lib/admin-auth';
import { isE2EMockModeEnabled, MOCK_SESSION_COOKIE } from '@/lib/e2e-config';
import {
  clearMockSessionResponse,
  createMockSessionResponse,
  resetMockDatabase,
  validateMockLogin,
} from '@/lib/mock-backend';

export async function GET() {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  return NextResponse.json({
    user: {
      userId: auth.user.id,
      email: auth.user.email ?? null,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isE2EMockModeEnabled()) {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const resetStore = body?.resetStore === true;

  if (!validateMockLogin(email, password)) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
  }

  if (resetStore) {
    resetMockDatabase();
  }

  return createMockSessionResponse({
    user: {
      userId: '00000000-0000-4000-8000-000000000001',
      email,
    },
  });
}

export async function DELETE() {
  if (!isE2EMockModeEnabled()) {
    return NextResponse.json({ success: true });
  }

  const cookieStore = await cookies();
  return clearMockSessionResponse(cookieStore.get(MOCK_SESSION_COOKIE)?.value, {
    success: true,
  });
}
