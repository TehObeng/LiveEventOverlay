import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// POST /api/messages/:id/approve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('messages')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'admin', // Could be extracted from auth session
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
