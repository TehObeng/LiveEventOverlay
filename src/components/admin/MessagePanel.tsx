'use client';

import { Message } from '@/lib/types';

interface MessagePanelProps {
  messages: Message[];
  activeTab: 'pending' | 'approved' | 'rejected';
  loading: boolean;
  editingId: string | null;
  editText: string;
  pendingAction: string | null;
  onTabChange: (tab: 'pending' | 'approved' | 'rejected') => void;
  onEditTextChange: (value: string) => void;
  onStartEdit: (message: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onBan: (ipHash: string) => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onBulkDelete: () => void;
  onSendTestMessage: () => void;
  onClearScreen: () => void;
  onExportCsv: () => void;
}

export function MessagePanel({
  messages,
  activeTab,
  loading,
  editingId,
  editText,
  pendingAction,
  onTabChange,
  onEditTextChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onApprove,
  onReject,
  onDelete,
  onBan,
  onBulkApprove,
  onBulkReject,
  onBulkDelete,
  onSendTestMessage,
  onClearScreen,
  onExportCsv,
}: MessagePanelProps) {
  const filteredMessages = messages.filter((message) => message.status === activeTab);
  const pendingCount = messages.filter((message) => message.status === 'pending').length;
  const approvedCount = messages.filter((message) => message.status === 'approved').length;
  const rejectedCount = messages.filter((message) => message.status === 'rejected').length;
  const isBusy = (action: string) => pendingAction === action;
  const hasPendingAction = Boolean(pendingAction);

  return (
    <div className="admin-main">
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

      <div className="tabs">
        <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => onTabChange('pending')} disabled={hasPendingAction}>
          Menunggu ({pendingCount})
        </button>
        <button className={`tab ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => onTabChange('approved')} disabled={hasPendingAction}>
          Disetujui ({approvedCount})
        </button>
        <button className={`tab ${activeTab === 'rejected' ? 'active' : ''}`} onClick={() => onTabChange('rejected')} disabled={hasPendingAction}>
          Ditolak ({rejectedCount})
        </button>
      </div>

      <div className="message-list">
        {loading && messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <p>Memuat antrean pesan...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              {activeTab === 'pending' ? '📭' : activeTab === 'approved' ? '✅' : '❌'}
            </div>
            <p>
              Tidak ada pesan {activeTab === 'pending' ? 'menunggu' : activeTab === 'approved' ? 'disetujui' : 'ditolak'}
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div className="message-card" key={message.id}>
              <div className="message-card-header">
                <div className="flex items-center gap-sm">
                  <span className={`badge badge-${message.status}`}>
                    {message.status === 'pending' ? '⏳ Menunggu' : message.status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
                  </span>
                  {message.risk_level === 'risky' && (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(253, 203, 110, 0.15)',
                        color: 'var(--accent-warning)',
                        border: '1px solid rgba(253, 203, 110, 0.3)',
                      }}
                    >
                      ⚠️ Berisiko
                    </span>
                  )}
                  {message.approved_by === 'auto' && message.status === 'approved' && (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(0, 184, 148, 0.15)',
                        color: 'var(--accent-success)',
                        border: '1px solid rgba(0, 184, 148, 0.3)',
                      }}
                    >
                      Auto
                    </span>
                  )}
                  {message.sender_name && <span className="text-sm text-secondary">{message.sender_name}</span>}
                </div>
                <span className="message-meta">{new Date(message.created_at).toLocaleTimeString('id-ID')}</span>
              </div>

              {editingId === message.id ? (
                <div className="flex flex-col gap-sm">
                  <textarea className="edit-textarea" value={editText} onChange={(event) => onEditTextChange(event.target.value)} disabled={hasPendingAction} />
                  <div className="flex gap-sm">
                    <button className="btn btn-success btn-sm" onClick={() => onSaveEdit(message.id)} disabled={hasPendingAction}>
                      {isBusy(`save-edit:${message.id}`) ? 'Menyimpan...' : 'Simpan'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={onCancelEdit} disabled={hasPendingAction}>Batal</button>
                  </div>
                </div>
              ) : (
                <div className="message-text">{message.text}</div>
              )}

              <div className="message-actions">
                {message.status === 'pending' && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => onApprove(message.id)} disabled={hasPendingAction}>
                      {isBusy(`approve:${message.id}`) ? 'Menyetujui...' : '✅ Setujui'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onReject(message.id)} disabled={hasPendingAction}>
                      {isBusy(`reject:${message.id}`) ? 'Menolak...' : '❌ Tolak'}
                    </button>
                  </>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => onStartEdit(message)} disabled={hasPendingAction}>✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(message.id)} style={{ color: 'var(--accent-danger)' }} disabled={hasPendingAction}>
                  {isBusy(`delete:${message.id}`) ? 'Menghapus...' : '🗑️'}
                </button>
                {message.ip_hash && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onBan(message.ip_hash || '')} style={{ color: 'var(--accent-danger)' }} disabled={hasPendingAction}>
                    {isBusy(`ban:${message.ip_hash}`) ? 'Mem-ban...' : '🚫 Ban'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
        {activeTab === 'pending' && pendingCount > 0 && (
          <>
            <button className="btn btn-success btn-sm" onClick={onBulkApprove} disabled={hasPendingAction}>
              {isBusy('bulk-approve') ? 'Menyetujui...' : `✅ Setujui Semua (${pendingCount})`}
            </button>
            <button className="btn btn-danger btn-sm" onClick={onBulkReject} disabled={hasPendingAction}>
              {isBusy('bulk-reject') ? 'Menolak...' : `❌ Tolak Semua (${pendingCount})`}
            </button>
          </>
        )}
        {filteredMessages.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={onBulkDelete} disabled={hasPendingAction}>
            {isBusy('bulk-delete') ? 'Menghapus...' : `🗑️ Hapus Semua ${activeTab} (${filteredMessages.length})`}
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={onSendTestMessage} id="test-msg-btn" disabled={hasPendingAction}>
          {isBusy('send-test') ? 'Mengirim...' : '🧪 Kirim Test'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={onClearScreen} disabled={hasPendingAction}>
          {isBusy('clear-screen') ? 'Membersihkan...' : '🧹 Bersihkan Layar'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onExportCsv} disabled={hasPendingAction}>📥 Export CSV</button>
      </div>
    </div>
  );
}
