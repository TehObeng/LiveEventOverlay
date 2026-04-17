'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  approveAdminMessage,
  banEventSender,
  clearAdminOverlay,
  createAdminEvent,
  deleteAdminEvent,
  deleteAdminMessage,
  fetchAdminEvents,
  fetchAdminMessages,
  fetchAdminSession,
  rejectAdminMessage,
  runBulkMessageAction,
  sendAdminTestMessage,
  updateAdminEvent,
  updateAdminMessage,
  fetchAdminSiteContent,
  updateAdminSiteContent,
} from '@/lib/admin-api';
import { ApiRequestError } from '@/lib/request';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/datetime';
import { normalizeOverlayConfig } from '@/lib/public';
import {
  getBrowserSupabaseClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
  isSupabaseSessionMissingError,
} from '@/lib/supabase';
import { AdminSessionData, DEFAULT_OVERLAY_CONFIG, EventData, Message, OverlayConfig, SiteContent } from '@/lib/types';
import { isLocalhostUrl, resolveAppBaseUrl, withBasePath } from '@/lib/url';
import { DEFAULT_SITE_CONTENT, normalizeSiteContent } from '@/lib/site-content';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { EventModals } from '@/components/admin/EventModals';
import { MessagePanel } from '@/components/admin/MessagePanel';

function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan') {
  return error instanceof Error ? error.message : fallback;
}

function getAdminAccessError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) {
      return 'Akun ini tidak memiliki akses admin.';
    }

    if (error.status === 401) {
      return 'Sesi admin berakhir. Silakan login ulang.';
    }

    return error.message;
  }

  return getErrorMessage(error, 'Gagal memverifikasi sesi admin');
}

function getRuntimeDataBackendLabel() {
  return process.env.NEXT_PUBLIC_LIVE_DATA_BACKEND || 'local';
}

function getBuildVersionLabel() {
  return process.env.NEXT_PUBLIC_BUILD_VERSION || '0.0.0';
}

function getBuildCommitLabel() {
  return process.env.NEXT_PUBLIC_BUILD_COMMIT || 'unknown';
}

function getBuildTimeLabel() {
  const value = process.env.NEXT_PUBLIC_BUILD_TIME || '';
  if (!value) {
    return 'unknown';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function AdminPage() {
  const router = useRouter();

  const [user, setUser] = useState<AdminSessionData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [editEventName, setEditEventName] = useState('');
  const [editEventDate, setEditEventDate] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(DEFAULT_OVERLAY_CONFIG);
  const [autoApprove, setAutoApprove] = useState(true);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [shareBaseUrl, setShareBaseUrl] = useState('');
  const [shareWarning, setShareWarning] = useState('');
  const [shareIsCrossDeviceSafe, setShareIsCrossDeviceSafe] = useState(false);

  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [siteContentDraft, setSiteContentDraft] = useState(() => JSON.stringify(DEFAULT_SITE_CONTENT, null, 2));
  const [cmsLoading, setCmsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((type: string, text: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ type, text });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const hasUnsavedOverlayChanges = useMemo(() => {
    if (!selectedEvent) {
      return false;
    }

    const savedConfig = normalizeOverlayConfig(selectedEvent.overlay_config);
    const savedAutoApprove = selectedEvent.auto_approve !== false;

    return JSON.stringify(savedConfig) !== JSON.stringify(overlayConfig) || savedAutoApprove !== autoApprove;
  }, [autoApprove, overlayConfig, selectedEvent]);

  const runWithPendingAction = useCallback(async (actionKey: string, task: () => Promise<void>) => {
    if (pendingAction) {
      return;
    }

    setPendingAction(actionKey);
    try {
      await task();
    } finally {
      setPendingAction((current) => (current === actionKey ? null : current));
    }
  }, [pendingAction]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const nextEvents = await fetchAdminEvents();
      setEvents(nextEvents);
      setSelectedEventId((previous) => {
        if (previous && nextEvents.some((event) => event.id === previous)) {
          return previous;
        }

        return nextEvents[0]?.id || '';
      });
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Gagal memuat event'));
    } finally {
      setEventsLoading(false);
    }
  }, [showToast]);

  const loadMessages = useCallback(async (eventId: string) => {
    if (!eventId) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);
    try {
      const nextMessages = await fetchAdminMessages(eventId);
      setMessages(nextMessages);
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Gagal memuat pesan'));
    } finally {
      setMessagesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigError(true);
      setAuthLoading(false);
      return;
    }

    let active = true;
    const supabase = getBrowserSupabaseClient();

    const bootstrap = async () => {
      try {
        const { data: authUser, error } = await supabase.auth.getUser();
        if (!active) return;

        if (error && !isSupabaseSessionMissingError(error)) {
          throw error;
        }

        if (!authUser.user) {
          if (!process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND || process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND !== '1') {
            router.replace('/admin/login');
            return;
          }
        }

        const session = await fetchAdminSession();
        if (!active) return;

        setUser(session.user);
      } catch (error) {
        console.error('Admin bootstrap error:', error);
        if (active) {
          setUser(null);

          if (
            error instanceof ApiRequestError &&
            (error.status === 401 || error.status === 403)
          ) {
            await supabase.auth.signOut().catch(() => null);
          }

          showToast('error', getAdminAccessError(error));
          router.replace('/admin/login');
        }
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    };

    void bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        router.replace('/admin/login');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router, showToast]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let active = true;
    setCmsLoading(true);

    const loadSiteContent = async () => {
      try {
        const nextContent = normalizeSiteContent(await fetchAdminSiteContent());
        if (!active) return;
        setSiteContent(nextContent);
        setSiteContentDraft(JSON.stringify(nextContent, null, 2));
      } catch (error) {
        if (active) {
          showToast('error', getErrorMessage(error, 'Gagal memuat konten CMS'));
        }
      } finally {
        if (active) setCmsLoading(false);
      }
    };

    void loadSiteContent();

    return () => {
      active = false;
    };
  }, [authLoading, user, showToast]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    void loadEvents();
    const intervalId = setInterval(() => {
      void loadEvents();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [authLoading, user, loadEvents]);

  useEffect(() => {
    if (authLoading || !user || !selectedEventId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedEventId);
    const intervalId = setInterval(() => {
      void loadMessages(selectedEventId);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [authLoading, user, selectedEventId, loadMessages]);

  useEffect(() => {
    const selectedEvent = events.find((event) => event.id === selectedEventId);
    if (!selectedEvent) {
      setOverlayConfig(DEFAULT_OVERLAY_CONFIG);
      setAutoApprove(true);
      return;
    }

    setOverlayConfig(normalizeOverlayConfig(selectedEvent.overlay_config));
    setAutoApprove(selectedEvent.auto_approve !== false);
  }, [events, selectedEventId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const runtimeOrigin = window.location.origin;
    const nextBaseUrl = resolveAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL, runtimeOrigin);

    setShareBaseUrl(nextBaseUrl);
    setShareIsCrossDeviceSafe(nextBaseUrl ? !isLocalhostUrl(nextBaseUrl) : false);

    if (!nextBaseUrl) {
      setShareWarning('Origin halaman ini belum bisa dipastikan. Link chat/overlay belum tersedia.');
      return;
    }

    if (isLocalhostUrl(nextBaseUrl)) {
      setShareWarning('Link memakai localhost. Aman untuk browser di mesin ini, tetapi tidak untuk perangkat lain.');
      return;
    }

    setShareWarning('');
  }, []);

  const shareUrl = useMemo(() => {
    if (!selectedEventId || !shareBaseUrl) {
      return '';
    }

    return `${shareBaseUrl}/chat?eventId=${selectedEventId}`;
  }, [selectedEventId, shareBaseUrl]);

  const overlayUrl = useMemo(() => {
    if (!selectedEventId || !shareBaseUrl) {
      return '';
    }

    return `${shareBaseUrl}/overlay?eventId=${selectedEventId}&obs=1`;
  }, [selectedEventId, shareBaseUrl]);

  const previewOverlayPath = useMemo(() => {
    if (!selectedEventId) {
      return '';
    }

    return withBasePath(`/overlay?eventId=${selectedEventId}`);
  }, [selectedEventId]);

  const diagnostics = useMemo(() => ({
    backend: getRuntimeDataBackendLabel(),
    shareBaseUrl: shareBaseUrl || '-',
    selectedEventId: selectedEventId || '-',
    safeToShare: shareIsCrossDeviceSafe ? 'Ya' : 'Tidak',
    buildVersion: getBuildVersionLabel(),
    buildCommit: getBuildCommitLabel(),
    buildTime: getBuildTimeLabel(),
  }), [selectedEventId, shareBaseUrl, shareIsCrossDeviceSafe]);

  useEffect(() => {
    if (!shareUrl) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(shareUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch((error) => {
        console.error('QR generation error:', error);
        showToast('error', 'Gagal membuat QR code');
      });
  }, [shareUrl, showToast]);

  const handleApprove = async (id: string) => {
    await runWithPendingAction(`approve:${id}`, async () => {
      try {
        await approveAdminMessage(id);
        showToast('success', 'Pesan disetujui');
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal menyetujui pesan'));
      }
    });
  };

  const handleReject = async (id: string) => {
    await runWithPendingAction(`reject:${id}`, async () => {
      try {
        await rejectAdminMessage(id);
        showToast('info', 'Pesan ditolak');
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal menolak pesan'));
      }
    });
  };

  const handleDeleteMessage = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Hapus pesan ini dari antrean? Tindakan ini tidak bisa dibatalkan.')) {
      return;
    }

    await runWithPendingAction(`delete:${id}`, async () => {
      try {
        await deleteAdminMessage(id);
        setMessages((previous) => previous.filter((message) => message.id !== id));
        showToast('info', 'Pesan dihapus');
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal menghapus pesan'));
      }
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) {
      showToast('error', 'Pesan tidak boleh kosong');
      return;
    }

    await runWithPendingAction(`save-edit:${id}`, async () => {
      try {
        await updateAdminMessage(id, { text: editText.trim() });
        setEditingId(null);
        setEditText('');
        showToast('success', 'Pesan diperbarui');
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal memperbarui pesan'));
      }
    });
  };

  const handleBan = async (ipHash: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Ban pengirim ini untuk event terpilih? Pesan berikutnya dari pengirim yang sama akan diblokir.')) {
      return;
    }

    await runWithPendingAction(`ban:${ipHash}`, async () => {
      try {
        await banEventSender(selectedEventId, ipHash);
        showToast('info', 'Pengirim berhasil di-ban');
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal mem-ban pengirim'));
      }
    });
  };

  const handleSendTestMessage = async () => {
    await runWithPendingAction('send-test', async () => {
      try {
        const response = await sendAdminTestMessage(selectedEventId);
        showToast('success', response.message || 'Test message terkirim');
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal mengirim test message'));
      }
    });
  };

  const handleClearScreen = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Bersihkan layar overlay sekarang? Komentar yang sedang tampil akan langsung hilang.')) {
      return;
    }

    await runWithPendingAction('clear-screen', async () => {
      try {
        const response = await clearAdminOverlay(selectedEventId);
        showToast('info', response.message || 'Layar overlay dibersihkan');
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal membersihkan overlay'));
      }
    });
  };

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newEventName.trim()) {
      return;
    }

    try {
      const createdEvent = await createAdminEvent({
        name: newEventName.trim(),
        date: fromDatetimeLocalValue(newEventDate),
      });

      setEvents((previous) => [createdEvent, ...previous]);
      setSelectedEventId(createdEvent.id);
      setShowCreateEvent(false);
      setNewEventName('');
      setNewEventDate('');
      showToast('success', 'Event dibuat');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Gagal membuat event'));
    }
  };

  const handleUpdateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editEventName.trim() || !selectedEventId) {
      return;
    }

    try {
      const updatedEvent = await updateAdminEvent(selectedEventId, {
        name: editEventName.trim(),
        date: fromDatetimeLocalValue(editEventDate),
      });

      setEvents((previous) => previous.map((current) => (current.id === selectedEventId ? updatedEvent : current)));
      setShowEditEvent(false);
      showToast('success', 'Event diperbarui');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Gagal memperbarui event'));
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEventId) {
      return;
    }

    try {
      await deleteAdminEvent(selectedEventId);
      const remainingEvents = events.filter((event) => event.id !== selectedEventId);
      setEvents(remainingEvents);
      setSelectedEventId(remainingEvents[0]?.id || '');
      setMessages([]);
      setShowDeleteConfirm(false);
      showToast('info', 'Event dihapus');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Gagal menghapus event'));
    }
  };

  const handleResetOverlayConfig = () => {
    setOverlayConfig({ ...DEFAULT_OVERLAY_CONFIG });
  };

  const handleSaveOverlayConfig = async () => {
    if (!selectedEventId) {
      return;
    }

    await runWithPendingAction('save-config', async () => {
      try {
        const updatedEvent = await updateAdminEvent(selectedEventId, {
          overlay_config: overlayConfig,
          auto_approve: autoApprove,
        });

        setEvents((previous) => previous.map((event) => (event.id === selectedEventId ? updatedEvent : event)));
        setPreviewKey((previous) => previous + 1);
        showToast('success', 'Pengaturan tersimpan');
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal menyimpan pengaturan'));
      }
    });
  };

  const handleBulkApprove = async () => {
    const ids = messages.filter((message) => message.status === 'pending').map((message) => message.id);
    if (ids.length === 0) return;

    await runWithPendingAction('bulk-approve', async () => {
      try {
        const response = await runBulkMessageAction(selectedEventId, {
          action: 'approve',
          ids,
        });
        showToast('success', response.message || `${ids.length} pesan disetujui`);
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal menyetujui semua pesan'));
      }
    });
  };

  const handleBulkReject = async () => {
    const ids = messages.filter((message) => message.status === 'pending').map((message) => message.id);
    if (ids.length === 0) return;

    if (typeof window !== 'undefined' && !window.confirm(`Tolak ${ids.length} pesan yang masih menunggu?`)) {
      return;
    }

    await runWithPendingAction('bulk-reject', async () => {
      try {
        const response = await runBulkMessageAction(selectedEventId, {
          action: 'reject',
          ids,
        });
        showToast('info', response.message || `${ids.length} pesan ditolak`);
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal menolak semua pesan'));
      }
    });
  };

  const handleBulkDelete = async () => {
    const ids = messages.filter((message) => message.status === activeTab).map((message) => message.id);
    if (ids.length === 0) return;

    if (typeof window !== 'undefined' && !window.confirm(`Hapus ${ids.length} pesan pada tab ${activeTab}? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }

    await runWithPendingAction('bulk-delete', async () => {
      try {
        const response = await runBulkMessageAction(selectedEventId, {
          action: 'delete',
          ids,
        });
        showToast('info', response.message || `${ids.length} pesan dihapus`);
        await loadMessages(selectedEventId);
      } catch (error) {
        showToast('error', getErrorMessage(error, 'Gagal menghapus pesan'));
      }
    });
  };

  const handleExportCSV = () => {
    const safeCsvValue = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      if (/^[=+\-@]/.test(escaped)) {
        return `'${escaped}`;
      }
      return escaped;
    };

    const csv = [
      'ID,Text,Sender,Status,Created,Approved At',
      ...messages.map((message) =>
        `"${safeCsvValue(message.id)}","${safeCsvValue(message.text)}","${safeCsvValue(message.sender_name || '-')}","${safeCsvValue(message.status)}","${safeCsvValue(message.created_at)}","${safeCsvValue(message.approved_at || '-')}"`,
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `messages-${selectedEventId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSiteContent = async () => {
    try {
      const parsed = JSON.parse(siteContentDraft);
      const normalized = normalizeSiteContent(parsed);
      setCmsLoading(true);
      const saved = await updateAdminSiteContent(normalized);
      const clean = normalizeSiteContent(saved);
      setSiteContent(clean);
      setSiteContentDraft(JSON.stringify(clean, null, 2));
      showToast('success', 'Konten website berhasil diperbarui');
    } catch (error) {
      if (error instanceof SyntaxError) {
        showToast('error', 'JSON konten tidak valid');
        return;
      }

      showToast('error', getErrorMessage(error, 'Gagal menyimpan konten CMS'));
    } finally {
      setCmsLoading(false);
    }
  };

  const copyToClipboard = useCallback(async (value: string, successMessage: string) => {
    if (!value) {
      showToast('error', 'Link belum tersedia');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showToast('success', successMessage);
    } catch {
      showToast('error', 'Gagal menyalin link');
    }
  }, [showToast]);

  const handleLogout = async () => {
    try {
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut();
    } finally {
      router.replace('/admin/login');
    }
  };

  const openEditEvent = () => {
    const selectedEvent = events.find((event) => event.id === selectedEventId);
    if (!selectedEvent) {
      return;
    }

    setEditEventName(selectedEvent.name);
    setEditEventDate(toDatetimeLocalValue(selectedEvent.date));
    setShowEditEvent(true);
  };

  const selectedEventName = selectedEvent?.name || 'event ini';

  if (configError) {
    return (
      <div className="login-page">
        <div className="login-card glass-card">
          <h1>Konfigurasi Error</h1>
          <p className="text-muted" style={{ lineHeight: 1.7 }}>
            {getSupabaseConfigError()}
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="admin-page">
        <div className="flex items-center justify-center" style={{ height: '100vh' }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {toast && <div className={`toast toast-${toast.type}`} key={toast.text}>{toast.text}</div>}

      <div className="admin-topbar">
        <h1>Admin Panel</h1>
        <div className="flex items-center gap-md">
          <div className="event-selector">
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              id="event-selector"
              aria-label="Pilih event aktif"
              disabled={events.length === 0}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateEvent(true)} id="create-event-btn">+ Baru</button>
            <button className="btn btn-ghost btn-sm" onClick={openEditEvent} title="Edit Event" disabled={!selectedEventId}>✏️</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(true)} style={{ color: 'var(--accent-danger)' }} title="Hapus Event" disabled={!selectedEventId}>🗑️</button>
          </div>
          <span className="text-muted text-sm">{user?.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="logout-btn">Keluar</button>
        </div>
      </div>

      <div className="admin-layout">
        {eventsLoading && events.length === 0 ? (
          <div className="admin-main">
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <p>Memuat data admin...</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="admin-main">
            <div className="empty-state">
              <div className="empty-state-icon">🎟️</div>
              <p>Belum ada event. Buat event pertama untuk mulai menggunakan overlay.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateEvent(true)}>Buat Event</button>
            </div>
          </div>
        ) : (
          <MessagePanel
            messages={messages}
            activeTab={activeTab}
            loading={messagesLoading}
            editingId={editingId}
            editText={editText}
            pendingAction={pendingAction}
            onTabChange={setActiveTab}
            onEditTextChange={setEditText}
            onStartEdit={(message) => {
              setEditingId(message.id);
              setEditText(message.text);
            }}
            onCancelEdit={() => {
              setEditingId(null);
              setEditText('');
            }}
            onSaveEdit={handleSaveEdit}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDeleteMessage}
            onBan={handleBan}
            onBulkApprove={handleBulkApprove}
            onBulkReject={handleBulkReject}
            onBulkDelete={handleBulkDelete}
            onSendTestMessage={handleSendTestMessage}
            onClearScreen={handleClearScreen}
            onExportCsv={handleExportCSV}
          />
        )}

        <AdminSidebar
          selectedEventId={selectedEventId}
          qrDataUrl={qrDataUrl}
          shareUrl={shareUrl}
          shareWarning={shareWarning}
          overlayUrl={overlayUrl}
          diagnostics={diagnostics}
          previewOverlayPath={previewOverlayPath}
          onCopyChatLink={() => { void copyToClipboard(shareUrl, 'Chat link disalin'); }}
          onCopyOverlayLink={() => { void copyToClipboard(overlayUrl, 'Overlay link disalin'); }}
          previewKey={previewKey}
          overlayConfig={overlayConfig}
          setOverlayConfig={setOverlayConfig}
          autoApprove={autoApprove}
          setAutoApprove={setAutoApprove}
          hasUnsavedChanges={hasUnsavedOverlayChanges}
          isSaving={pendingAction === 'save-config'}
          onResetConfig={handleResetOverlayConfig}
          onSaveConfig={handleSaveOverlayConfig}
        />
      </div>

      <section className="glass-card cms-editor" style={{ marginTop: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>CMS Konten Landing Page</h2>
            <p className="text-sm text-muted">Edit hampir seluruh copy website dari JSON terstruktur. Perubahan tersimpan ke database Supabase.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { void handleSaveSiteContent(); }} disabled={cmsLoading}>
            {cmsLoading ? 'Menyimpan...' : 'Simpan Konten'}
          </button>
        </div>
        <textarea
          className="input textarea"
          value={siteContentDraft}
          onChange={(event) => setSiteContentDraft(event.target.value)}
          aria-label="JSON konten website"
        />
        <p className="text-xs text-muted" style={{ marginTop: 8 }}>Snapshot aktif: {siteContent.hero.title}</p>
      </section>

      <EventModals
        showCreateEvent={showCreateEvent}
        showEditEvent={showEditEvent}
        showDeleteConfirm={showDeleteConfirm}
        newEventName={newEventName}
        newEventDate={newEventDate}
        editEventName={editEventName}
        editEventDate={editEventDate}
        selectedEventName={selectedEventName}
        onNewEventNameChange={setNewEventName}
        onNewEventDateChange={setNewEventDate}
        onEditEventNameChange={setEditEventName}
        onEditEventDateChange={setEditEventDate}
        onCloseCreate={() => setShowCreateEvent(false)}
        onCloseEdit={() => setShowEditEvent(false)}
        onCloseDelete={() => setShowDeleteConfirm(false)}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
      />
    </div>
  );
}
