import { NextRequest } from 'next/server';
import { Message } from '@/lib/types';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { noStoreJson } from '@/lib/response';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return jsonError('Event ID tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return jsonError(error.message, 500);
    }

    return noStoreJson({
      messages: (data || []) as Message[],
    });
  } catch (error) {
    console.error('Admin event messages GET error:', error);
    return jsonError('Internal server error', 500);
  }
}
