'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { EventData, Message, OverlayConfig, DEFAULT_OVERLAY_CONFIG } from '@/lib/types';
import QRCode from 'qrcode';

export default function AdminPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  // Auth state
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Event state
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Overlay config
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(DEFAULT_OVERLAY_CONFIG);

  // QR
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Toast
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);

  const showToast = useCallback((type: string, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ============================================
  // Auth Check
  // ============================================
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      setUser({ email: session.user.email });
      setAuthLoading(false);
    };
    checkAuth();
  }, [router, supabase]);

  // ============================================
  // Fetch Events
  // ============================================
  useEffect(() => {
    if (authLoading) return;

    const fetchEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setEvents(data as EventData[]);
        if (!selectedEventId) {
          setSelectedEventId(data[0].id);
        }
      }
    };

    fetchEvents();
  }, [authLoading, supabase, selectedEventId]);

  // ============================================
  // Fetch Messages for Selected Event
  // ============================================
  useEffect(() => {
    if (!selectedEventId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: false });

      if (data) {
        setMessages(data as Message[]);
      }
    };

    fetchMessages();

    // Load overlay config from selected event
    const selectedEvent = events.find(e => e.id === selectedEventId);
    if (selectedEvent?.overlay_config) {
      setOverlayConfig({ ...DEFAULT_OVERLAY_CONFIG, ...selectedEvent.overlay_config });
    }
  }, [selectedEventId, events, supabase]);

  // ============================================
  // Realtime Subscription
  // ============================================
  useEffect(() => {
    if (!selectedEventId) return;

    const channel = supabase
      .channel(`messages-${selectedEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${selectedEventId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [payload.new as Message, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m)
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== (payload.old as Message).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, supabase]);

  // ============================================
  // Generate QR Code
  // ============================================
  useEffect(() => {
    if (!selectedEventId) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const chatUrl = `${appUrl}/chat?eventId=${selectedEventId}`;

    QRCode.toDataURL(chatUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setQrDataUrl).catch(console.error);
  }, [selectedEventId]);

  // ============================================
  // Actions
  // ============================================
  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from('messages')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.email || 'admin',
      })
      .eq('id', id);

    if (!error) showToast('success', 'Pesan disetujui ✅');
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (!error) showToast('info', 'Pesan ditolak');
  };

  const handleEdit = async (id: string) => {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from('messages')
      .update({ text: editText.trim() })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      setEditText('');
      showToast('success', 'Pesan diedit');
    }
  };

  const handleBan = async (ipHash: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_banned: true, status: 'rejected' })
      .eq('ip_hash', ipHash)
      .eq('event_id', selectedEventId);

    if (!error) showToast('info', 'Pengirim di-ban');
  };

  const handleClearScreen = async () => {
    // Broadcast clear_screen event via Supabase Realtime channel
    const channel = supabase.channel(`overlay-${selectedEventId}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'clear_screen',
      payload: {},
    });
    supabase.removeChannel(channel);
    showToast('info', 'Layar dibersihkan');
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const { data, error } = await supabase
      .from('events')
      .insert({
        name: newEventName.trim(),
        date: newEventDate || new Date().toISOString(),
        overlay_config: DEFAULT_OVERLAY_CONFIG,
      })
      .select()
      .single();

    if (!error && data) {
      setEvents(prev => [data as EventData, ...prev]);
      setSelectedEventId(data.id);
      setShowCreateEvent(false);
      setNewEventName('');
      setNewEventDate('');
      showToast('success', 'Event dibuat!');
    }
  };

  const handleSaveOverlayConfig = async () => {
    const { error } = await supabase
      .from('events')
      .update({ overlay_config: overlayConfig })
      .eq('id', selectedEventId);

    if (!error) showToast('success', 'Pengaturan tersimpan');
  };

  const handleExportCSV = () => {
    const eventMessages = messages.filter(m => m.event_id === selectedEventId);
    const csv = [
      'ID,Text,Sender,Status,Created,Approved At',
      ...eventMessages.map(m =>
        `"${m.id}","${m.text.replace(/"/g, '""')}","${m.sender_name || '-'}","${m.status}","${m.created_at}","${m.approved_at || '-'}"`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `messages-${selectedEventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // ============================================
  // Filtered messages by tab
  // ============================================
  const filteredMessages = messages.filter(m => m.status === activeTab);
  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const approvedCount = messages.filter(m => m.status === 'approved').length;
  const rejectedCount = messages.filter(m => m.status === 'rejected').length;

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
      {toast && (
        <div className={`toast toast-${toast.type}`} key={toast.text}>
          {toast.text}
        </div>
      )}

      {/* Top Bar */}
      <div className="admin-topbar">
        <h1>📊 Admin Panel</h1>
        <div className="flex items-center gap-md">
          <div className="event-selector">
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              id="event-selector"
            >
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCreateEvent(true)}
              id="create-event-btn"
            >
              + Event Baru
            </button>
          </div>
          <span className="text-muted text-sm">{user?.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="logout-btn">
            Keluar
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="admin-layout">
        {/* Left: Message Queue */}
        <div className="admin-main">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{pendingCount}</div>
              <div className="stat-label">Menunggu</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{approvedCount}</div>
              <div className="stat-label">Disetujui</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{rejectedCount}</div>
              <div className="stat-label">Ditolak</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Menunggu ({pendingCount})
            </button>
            <button
              className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              Disetujui ({approvedCount})
            </button>
            <button
              className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              Ditolak ({rejectedCount})
            </button>
          </div>

          {/* Message List */}
          <div className="message-list">
            {filteredMessages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  {activeTab === 'pending' ? '📭' : activeTab === 'approved' ? '✅' : '❌'}
                </div>
                <p>Tidak ada pesan {activeTab === 'pending' ? 'menunggu' : activeTab === 'approved' ? 'disetujui' : 'ditolak'}</p>
              </div>
            ) : (
              filteredMessages.map(msg => (
                <div className="message-card" key={msg.id}>
                  <div className="message-card-header">
                    <div className="flex items-center gap-sm">
                      <span className={`badge badge-${msg.status}`}>
                        {msg.status === 'pending' ? '⏳ Menunggu' : msg.status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
                      </span>
                      {msg.sender_name && (
                        <span className="text-sm text-secondary">{msg.sender_name}</span>
                      )}
                    </div>
                    <span className="message-meta">
                      {new Date(msg.created_at).toLocaleTimeString('id-ID')}
                    </span>
                  </div>

                  {editingId === msg.id ? (
                    <div className="flex flex-col gap-sm">
                      <textarea
                        className="edit-textarea"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                      />
                      <div className="flex gap-sm">
                        <button className="btn btn-success btn-sm" onClick={() => handleEdit(msg.id)}>
                          Simpan
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="message-text">{msg.text}</div>
                  )}

                  <div className="message-actions">
                    {msg.status === 'pending' && (
                      <>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprove(msg.id)}
                          id={`approve-${msg.id}`}
                        >
                          ✅ Setujui
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleReject(msg.id)}
                          id={`reject-${msg.id}`}
                        >
                          ❌ Tolak
                        </button>
                      </>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditingId(msg.id);
                        setEditText(msg.text);
                      }}
                    >
                      ✏️ Edit
                    </button>
                    {msg.ip_hash && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleBan(msg.ip_hash)}
                        style={{ color: 'var(--accent-danger)' }}
                      >
                        🚫 Ban
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex gap-sm">
            <button className="btn btn-danger btn-sm" onClick={handleClearScreen} id="clear-screen-btn">
              🗑️ Bersihkan Layar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleExportCSV} id="export-csv-btn">
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="admin-sidebar">
          {/* QR Code */}
          <div className="glass-card">
            <div className="panel-title">📱 QR Code</div>
            <div className="qr-container">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code" width={200} height={200} />
              )}
              <canvas ref={qrCanvasRef} style={{ display: 'none' }} />
              <a
                href={qrDataUrl}
                download={`qr-${selectedEventId}.png`}
                className="btn btn-ghost btn-sm w-full"
              >
                📥 Download QR
              </a>
              <div className="text-xs text-muted text-center" style={{ wordBreak: 'break-all' }}>
                {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?eventId={selectedEventId}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="glass-card">
            <div className="panel-title">👁️ Live Preview</div>
            <div className="preview-frame">
              {selectedEventId && (
                <iframe
                  src={`/overlay?eventId=${selectedEventId}`}
                  title="Overlay Preview"
                  id="overlay-preview"
                />
              )}
            </div>
          </div>

          {/* Overlay Styling */}
          <div className="glass-card">
            <div className="panel-title">🎨 Pengaturan Overlay</div>

            <div className="style-control">
              <label>Font Size: {overlayConfig.fontSize}px</label>
              <input
                type="range"
                min="16"
                max="96"
                value={overlayConfig.fontSize}
                onChange={e =>
                  setOverlayConfig(prev => ({ ...prev, fontSize: Number(e.target.value) }))
                }
              />
            </div>

            <div className="style-control">
              <label>Warna Teks</label>
              <input
                type="color"
                value={overlayConfig.color}
                onChange={e =>
                  setOverlayConfig(prev => ({ ...prev, color: e.target.value }))
                }
              />
            </div>

            <div className="style-control">
              <label>Warna Stroke</label>
              <input
                type="color"
                value={overlayConfig.stroke}
                onChange={e =>
                  setOverlayConfig(prev => ({ ...prev, stroke: e.target.value }))
                }
              />
            </div>

            <div className="style-control">
              <label>Kecepatan: {overlayConfig.speed}px/s</label>
              <input
                type="range"
                min="30"
                max="400"
                value={overlayConfig.speed}
                onChange={e =>
                  setOverlayConfig(prev => ({ ...prev, speed: Number(e.target.value) }))
                }
              />
            </div>

            <div className="style-control">
              <label>Jumlah Lane: {overlayConfig.laneCount}</label>
              <input
                type="range"
                min="1"
                max="8"
                value={overlayConfig.laneCount}
                onChange={e =>
                  setOverlayConfig(prev => ({ ...prev, laneCount: Number(e.target.value) }))
                }
              />
            </div>

            <div className="style-control">
              <label>Jarak Spawn: {overlayConfig.spawnInterval}ms</label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={overlayConfig.spawnInterval}
                onChange={e =>
                  setOverlayConfig(prev => ({ ...prev, spawnInterval: Number(e.target.value) }))
                }
              />
            </div>

            <div className="style-control">
              <label>Font</label>
              <select
                value={overlayConfig.fontFamily}
                onChange={e =>
                  setOverlayConfig(prev => ({ ...prev, fontFamily: e.target.value }))
                }
              >
                <option value="Arial">Arial</option>
                <option value="Inter">Inter</option>
                <option value="Outfit">Outfit</option>
                <option value="Impact">Impact</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Georgia">Georgia</option>
              </select>
            </div>

            <div className="style-control">
              <div className="flex items-center gap-sm">
                <input
                  type="checkbox"
                  checked={overlayConfig.shadow}
                  onChange={e =>
                    setOverlayConfig(prev => ({ ...prev, shadow: e.target.checked }))
                  }
                  id="shadow-toggle"
                />
                <label style={{ margin: 0 }}>Shadow Teks</label>
              </div>
            </div>

            <button
              className="btn btn-primary btn-sm w-full"
              onClick={handleSaveOverlayConfig}
              id="save-config-btn"
            >
              💾 Simpan Pengaturan
            </button>
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateEvent && (
        <div className="modal-overlay" onClick={() => setShowCreateEvent(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h2>🎉 Buat Event Baru</h2>
            <form onSubmit={handleCreateEvent}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Nama Event</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Konser Tahun Baru"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  required
                  id="new-event-name"
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="input-label">Tanggal</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={newEventDate}
                  onChange={e => setNewEventDate(e.target.value)}
                  id="new-event-date"
                />
              </div>
              <div className="flex gap-sm">
                <button type="submit" className="btn btn-primary w-full" id="create-event-submit">
                  Buat Event
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateEvent(false)}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
