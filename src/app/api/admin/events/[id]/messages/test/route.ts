import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

const testMessages = [
  'Hello World! 🎉',
  'Ini pesan test overlay',
  'Selamat datang!',
  'Testing 1 2 3...',
  'Live chat working! ✅',
  'Keren banget! 🔥',
  'Mantap! 💪',
  'Halo semua! 👋',
  'Pesan dari admin 📢',
];

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
    return jsonError('Event ID tidak valid');
  }

  try {
    const text = testMessages[Math.floor(Math.random() * testMessages.length)];
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from('messages').insert({
      event_id: id,
      text,
      sender_name: 'Admin Test',
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: auth.user.email || 'admin-test',
      risk_level: 'safe',
      ip_hash: 'admin-test',
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({
      success: true,
      message: `Test message terkirim: "${text}"`,
    });
  } catch (error) {
    console.error('Admin test message error:', error);
    return jsonError('Internal server error', 500);
  }
}
