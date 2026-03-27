import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return jsonError('Message ID tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase
      .from('messages')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: auth.user.email || 'admin',
      })
      .eq('id', id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({
      success: true,
      message: 'Pesan disetujui',
    });
  } catch (error) {
    console.error('Admin approve message error:', error);
    return jsonError('Internal server error', 500);
  }
}
