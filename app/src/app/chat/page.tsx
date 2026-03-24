'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { basicFilterIntelligence } from '@/lib/filter';
import { EventData } from '@/lib/types';

function ChatForm() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');

  const [event, setEvent] = useState<EventData | null>(null);
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const maxChars = event?.max_chars || 100;
  const cooldownSeconds = event?.cooldown_seconds || 10;

  // Fetch event data
  useEffect(() => {
    if (!eventId) {
      setEventLoading(false);
      return;
    }

    const fetchEvent = async () => {
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          showToast('error', 'Event tidak ditemukan atau sudah berakhir');
        } else {
          setEvent(data as EventData);
        }
      } catch {
        showToast('error', 'Gagal memuat event');
      } finally {
        setEventLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const showToast = useCallback((type: string, text: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ type, text });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(cooldownSeconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);

    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [cooldownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading || cooldown > 0 || !eventId) return;

    // Client-side filter
    const filterResult = basicFilterIntelligence(message, maxChars);
    if (!filterResult.ok) {
      const reasons: Record<string, string> = {
        blacklist: 'Pesan mengandung kata yang tidak diizinkan',
        link: 'Link tidak diizinkan',
        spam: 'Pesan terdeteksi sebagai spam',
        length: `Panjang pesan harus 2-${maxChars} karakter`,
      };
      showToast('error', reasons[filterResult.reason || ''] || 'Pesan tidak valid');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          text: filterResult.cleanedText,
          senderName: senderName.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('success', '✅ Pesan terkirim! Menunggu persetujuan admin.');
        setMessage('');
        startCooldown();
      } else {
        showToast('error', data.error || 'Gagal mengirim pesan');
      }
    } catch {
      showToast('error', 'Koneksi bermasalah. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const charCount = message.length;
  const charClass = charCount > maxChars ? 'danger' : charCount > maxChars * 0.8 ? 'warning' : '';

  if (!eventId) {
    return (
      <div className="chat-page">
        <div className="chat-container">
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <p>Event ID tidak ditemukan.<br />Scan QR code untuk mengirim pesan.</p>
          </div>
        </div>
      </div>
    );
  }

  if (eventLoading) {
    return (
      <div className="chat-page">
        <div className="chat-container">
          <div className="chat-form-card">
            <div className="loading-shimmer" style={{ marginBottom: 12 }} />
            <div className="loading-shimmer" style={{ height: 40 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      {toast && (
        <div className={`toast toast-${toast.type}`} key={toast.text}>
          {toast.text}
        </div>
      )}

      <div className="chat-container">
        <div className="chat-header">
          <h1>{event?.name || 'Live Chat'}</h1>
          <p>Kirim pesan ke layar utama 🎬</p>
        </div>

        <form onSubmit={handleSubmit} className="chat-form-card">
          {/* Optional Sender Name */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              className="input"
              placeholder="Nama kamu (opsional)"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              maxLength={30}
              style={{ fontSize: '0.875rem', padding: '10px 14px' }}
              id="sender-name-input"
            />
          </div>

          {/* Message Input */}
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              placeholder="Ketik pesanmu di sini..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={maxChars + 20}
              rows={2}
              id="message-input"
            />
            <span className={`char-counter ${charClass}`}>
              {charCount}/{maxChars}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary chat-submit"
            disabled={loading || cooldown > 0 || !message.trim() || charCount > maxChars}
            id="submit-button"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-sm">
                <span className="spinner" />
                Mengirim...
              </span>
            ) : cooldown > 0 ? (
              `Tunggu ${cooldown} detik...`
            ) : (
              '🚀 Kirim Pesan'
            )}
          </button>

          {/* Cooldown Bar */}
          {cooldown > 0 && (
            <div>
              <div className="cooldown-bar">
                <div
                  className="cooldown-fill"
                  style={{ width: `${(cooldown / cooldownSeconds) * 100}%` }}
                />
              </div>
              <div className="cooldown-text">
                Kamu bisa kirim lagi dalam {cooldown} detik
              </div>
            </div>
          )}
        </form>

        <div className="chat-footer">
          Powered by Live Chat Overlay System
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="chat-page">
        <div className="chat-container">
          <div className="chat-form-card">
            <div className="loading-shimmer" style={{ marginBottom: 12 }} />
            <div className="loading-shimmer" style={{ height: 40 }} />
          </div>
        </div>
      </div>
    }>
      <ChatForm />
    </Suspense>
  );
}
