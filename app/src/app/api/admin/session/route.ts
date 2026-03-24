import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';

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
