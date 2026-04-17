import { noStoreJson } from '@/lib/response';
import { jsonError } from '@/lib/admin-auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';
import { DEFAULT_SITE_CONTENT, normalizeSiteContent, SITE_CONTENT_KEY } from '@/lib/site-content';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', SITE_CONTENT_KEY)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        return noStoreJson({ content: DEFAULT_SITE_CONTENT });
      }

      return jsonError(error.message, 500);
    }

    const row = data as { content?: unknown } | null;
    return noStoreJson({
      content: normalizeSiteContent(row?.content),
    });
  } catch (error) {
    console.error('Public site-content GET error:', error);
    return noStoreJson({ content: DEFAULT_SITE_CONTENT });
  }
}
