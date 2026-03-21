import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { basicFilterIntelligence } from '@/lib/filter';
import crypto from 'crypto';

// Simple in-memory rate limiter (per IP)
const rateLimitMap = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, text, senderName } = body;

    if (!eventId || !text) {
      return NextResponse.json(
        { error: 'eventId dan text wajib diisi' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch event to get config
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event tidak ditemukan atau sudah berakhir' },
        { status: 404 }
      );
    }

    // Server-side filter
    const filterResult = basicFilterIntelligence(text, event.max_chars || 100);
    if (!filterResult.ok) {
      const reasons: Record<string, string> = {
        blacklist: 'Pesan mengandung kata yang tidak diizinkan',
        link: 'Link tidak diizinkan',
        spam: 'Pesan terdeteksi sebagai spam',
        length: `Panjang pesan harus 2-${event.max_chars || 100} karakter`,
      };
      return NextResponse.json(
        { error: reasons[filterResult.reason || ''] || 'Pesan tidak valid' },
        { status: 400 }
      );
    }

    // IP hash for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    // Rate limiting
    const cooldownMs = (event.cooldown_seconds || 10) * 1000;
    const lastSent = rateLimitMap.get(ipHash) || 0;
    const timeSince = Date.now() - lastSent;

    if (timeSince < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - timeSince) / 1000);
      return NextResponse.json(
        { error: `Terlalu cepat. Tunggu ${waitSeconds} detik lagi.` },
        { status: 429 }
      );
    }

    // Check if IP is banned for this event
    const { data: bannedMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('event_id', eventId)
      .eq('ip_hash', ipHash)
      .eq('is_banned', true)
      .limit(1);

    if (bannedMsg && bannedMsg.length > 0) {
      return NextResponse.json(
        { error: 'Akun anda telah di-ban dari event ini' },
        { status: 403 }
      );
    }

    // Insert message
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        event_id: eventId,
        text: filterResult.cleanedText,
        sender_name: senderName || null,
        status: 'pending',
        ip_hash: ipHash,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Gagal menyimpan pesan' },
        { status: 500 }
      );
    }

    // Update rate limit
    rateLimitMap.set(ipHash, Date.now());

    // Cleanup old entries (prevent memory leak)
    if (rateLimitMap.size > 10000) {
      const cutoff = Date.now() - 60000;
      for (const [key, time] of rateLimitMap.entries()) {
        if (time < cutoff) rateLimitMap.delete(key);
      }
    }

    return NextResponse.json({ success: true, message: 'Pesan terkirim' });
  } catch (error) {
    console.error('Message API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
