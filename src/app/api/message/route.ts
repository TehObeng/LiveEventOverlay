import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { isUuid } from '@/lib/admin-auth';
import { isE2EMockModeEnabled } from '@/lib/e2e-config';
import { basicFilterIntelligence } from '@/lib/filter';
import { isRememberedSafePhrase } from '@/lib/moderation-memory';
import { noStoreJson } from '@/lib/response';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';
import { EventData } from '@/lib/types';

const rateLimitMap = new Map<string, number>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;
if (!cleanupInterval) {
  cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - 120000;
    for (const [key, time] of rateLimitMap.entries()) {
      if (time < cutoff) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
}

function sanitizeSenderName(name: string | null | undefined) {
  if (!name || typeof name !== 'string') return null;

  const cleaned = name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, 50);

  return cleaned || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const senderName = sanitizeSenderName(body.senderName);

    if (!eventId || !text) {
      return noStoreJson({ error: 'eventId dan text wajib diisi' }, { status: 400 });
    }

    if (!isUuid(eventId)) {
      return noStoreJson({ error: 'Format eventId tidak valid' }, { status: 400 });
    }

    if (text.length > 500) {
      return noStoreJson({ error: 'Pesan terlalu panjang' }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, max_chars, cooldown_seconds, auto_approve, is_active')
      .eq('id', eventId)
      .single();
    const eventData = event as Pick<
      EventData,
      'id' | 'max_chars' | 'cooldown_seconds' | 'auto_approve' | 'is_active'
    > | null;

    if (eventError || !eventData || !eventData.is_active) {
      return noStoreJson(
        { error: 'Event tidak ditemukan atau sudah berakhir' },
        { status: 404 },
      );
    }

    let filterResult = basicFilterIntelligence(text, eventData.max_chars || 100);
    if (
      filterResult.ok &&
      filterResult.riskLevel === 'risky' &&
      (await isRememberedSafePhrase(supabase, text))
    ) {
      filterResult = {
        ...filterResult,
        riskLevel: 'safe',
      };
    }

    if (filterResult.riskLevel === 'blocked') {
      const reasons: Record<string, string> = {
        blacklist: 'Pesan mengandung kata yang tidak diizinkan',
        link: 'Link tidak diizinkan',
        spam: 'Pesan terdeteksi sebagai spam',
        length: `Panjang pesan harus 2-${eventData.max_chars || 100} karakter`,
      };

      return noStoreJson(
        { error: reasons[filterResult.reason || ''] || 'Pesan tidak valid' },
        { status: 400 },
      );
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const ip =
      forwarded?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    if (!isE2EMockModeEnabled()) {
      const cooldownMs = (eventData.cooldown_seconds || 10) * 1000;
      const lastSent = rateLimitMap.get(ipHash) || 0;
      const timeSince = Date.now() - lastSent;

      if (timeSince < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - timeSince) / 1000);
        return noStoreJson(
          { error: `Terlalu cepat. Tunggu ${waitSeconds} detik lagi.` },
          { status: 429 },
        );
      }
    }

    const { data: bannedMessages, error: bannedError } = await supabase
      .from('messages')
      .select('id')
      .eq('event_id', eventId)
      .eq('ip_hash', ipHash)
      .eq('is_banned', true)
      .limit(1);

    if (bannedError) {
      console.error('Ban check error:', bannedError);
      return noStoreJson({ error: 'Gagal memverifikasi status akun' }, { status: 500 });
    }

    const bannedRows = bannedMessages as { id: string }[] | null;
    if (bannedRows && bannedRows.length > 0) {
      return noStoreJson({ error: 'Akun anda telah di-ban dari event ini' }, { status: 403 });
    }

    const autoApprove = eventData.auto_approve !== false;
    const messageStatus = autoApprove && filterResult.riskLevel === 'safe' ? 'approved' : 'pending';
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from('messages').insert({
      event_id: eventId,
      text: filterResult.cleanedText ?? text.trim(),
      sender_name: senderName,
      status: messageStatus,
      risk_level: filterResult.riskLevel,
      ip_hash: ipHash,
      ...(messageStatus === 'approved'
        ? {
            approved_at: now,
            approved_by: 'auto',
          }
        : {}),
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return noStoreJson({ error: 'Gagal menyimpan pesan' }, { status: 500 });
    }

    rateLimitMap.set(ipHash, Date.now());

    return noStoreJson({
      success: true,
      message:
        messageStatus === 'approved'
          ? 'Pesan terkirim dan langsung ditampilkan!'
          : 'Pesan terkirim! Menunggu persetujuan admin.',
      autoApproved: messageStatus === 'approved',
    });
  } catch (error) {
    console.error('Message API error:', error);
    return noStoreJson({ error: 'Internal server error' }, { status: 500 });
  }
}
