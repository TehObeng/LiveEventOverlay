'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { basicFilterIntelligence } from '@/lib/filter';
import { fetchPublicEvent } from '@/lib/public-api';
import { requestJson } from '@/lib/request';
import { PublicEventData } from '@/lib/types';

function ChatForm() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');

  const [event, setEvent] = useState<PublicEventData | null>(null);
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState('');
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const maxChars = event?.max_chars || 100;
  const cooldownSeconds = event?.cooldown_seconds || 10;

  const showToast = useCallback((type: string, text: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ type, text });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!eventId) {
      setEventLoading(false);
      setEventError('Event ID tidak ditemukan. Scan QR code untuk mengirim pesan.');
      return;
    }

    let active = true;
    setEventLoading(true);
    setEventError('');

    const loadEvent = async () => {
      try {
        const nextEvent = await fetchPublicEvent(eventId);
        if (!active) return;
        setEvent(nextEvent);
      } catch (error) {
        if (!active) return;
        const messageText = error instanceof Error ? error.message : 'Gagal memuat event';
        setEvent(null);
        setEventError(messageText);
        showToast('error', messageText);
      } finally {
        if (active) {
          setEventLoading(false);
        }
      }
    };

    void loadEvent();

    return () => {
      active = false;
    };
  }, [eventId, showToast]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(cooldownSeconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);

    cooldownRef.current = setInterval(() => {
      setCooldown((previous) => {
        if (previous <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);
  }, [cooldownSeconds]);

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!message.trim() || loading || cooldown > 0 || !eventId) {
      return;
    }

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
      const data = await requestJson<{ message?: string; autoApproved?: boolean }>('/api/message', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          text: filterResult.cleanedText,
          senderName: senderName.trim() || null,
        }),
      });

      showToast('success', data.message || 'Pesan terkirim!');
      setMessage('');
      startCooldown();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Gagal mengirim pesan');
    } finally {
      setLoading(false);
    }
  };

  const charCount = message.length;
  const charClass =
    charCount > maxChars ? 'danger' : charCount > maxChars * 0.8 ? 'warning' : '';

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

  if (!event) {
    return (
      <div className="chat-page">
        <div className="chat-container">
          <div className="empty-state">
            <div className="empty-state-icon">🎟️</div>
            <p>{eventError || 'Event tidak ditemukan atau sudah berakhir.'}</p>
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
          <h1>{event.name || 'Live Chat'}</h1>
          <p>Kirim pesan ke layar utama 🎬</p>
        </div>

        <form onSubmit={handleSubmit} className="chat-form-card">
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="sender-name-input" className="input-label">
              Nama kamu
            </label>
            <input
              type="text"
              className="input"
              placeholder="Nama kamu (opsional)"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={30}
              style={{ fontSize: '0.875rem', padding: '10px 14px' }}
              id="sender-name-input"
            />
          </div>

          <div className="chat-input-wrapper">
            <label htmlFor="message-input" className="input-label">
              Pesan
            </label>
            <textarea
              className="chat-input"
              placeholder="Ketik pesanmu di sini..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={maxChars + 20}
              rows={2}
              id="message-input"
            />
            <span className={`char-counter ${charClass}`}>
              {charCount}/{maxChars}
            </span>
          </div>

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
    <Suspense
      fallback={
        <div className="chat-page">
          <div className="chat-container">
            <div className="chat-form-card">
              <div className="loading-shimmer" style={{ marginBottom: 12 }} />
              <div className="loading-shimmer" style={{ height: 40 }} />
            </div>
          </div>
        </div>
      }
    >
      <ChatForm />
    </Suspense>
  );
}
