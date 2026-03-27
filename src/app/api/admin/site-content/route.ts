import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdminUser } from '@/lib/admin-auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';
import { DEFAULT_SITE_CONTENT, normalizeSiteContent, SITE_CONTENT_KEY } from '@/lib/site-content';

export async function GET() {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', SITE_CONTENT_KEY)
      .maybeSingle();

    if (error && error.code !== '42P01') {
      return jsonError(error.message, 500);
    }

    const row = data as { content?: unknown } | null;
    return NextResponse.json({
      content: normalizeSiteContent(row?.content),
    });
  } catch (error) {
    console.error('Admin site-content GET error:', error);
    return NextResponse.json({ content: DEFAULT_SITE_CONTENT });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('Payload JSON tidak valid');
  }

  const normalized = normalizeSiteContent(body);

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('site_content')
      .upsert({
        key: SITE_CONTENT_KEY,
        content: normalized,
        updated_by: auth.user.id,
      }, { onConflict: 'key' })
      .select('content')
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    const row = data as { content?: unknown } | null;
    return NextResponse.json({ content: normalizeSiteContent(row?.content) });
  } catch (error) {
    console.error('Admin site-content PUT error:', error);
    return jsonError('Internal server error', 500);
  }
}
