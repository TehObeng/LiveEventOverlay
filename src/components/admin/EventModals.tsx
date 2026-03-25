'use client';

interface EventModalsProps {
  showCreateEvent: boolean;
  showEditEvent: boolean;
  showDeleteConfirm: boolean;
  newEventName: string;
  newEventDate: string;
  editEventName: string;
  editEventDate: string;
  selectedEventName: string;
  onNewEventNameChange: (value: string) => void;
  onNewEventDateChange: (value: string) => void;
  onEditEventNameChange: (value: string) => void;
  onEditEventDateChange: (value: string) => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onCreateEvent: (event: React.FormEvent) => void;
  onUpdateEvent: (event: React.FormEvent) => void;
  onDeleteEvent: () => void;
}

export function EventModals({
  showCreateEvent,
  showEditEvent,
  showDeleteConfirm,
  newEventName,
  newEventDate,
  editEventName,
  editEventDate,
  selectedEventName,
  onNewEventNameChange,
  onNewEventDateChange,
  onEditEventNameChange,
  onEditEventDateChange,
  onCloseCreate,
  onCloseEdit,
  onCloseDelete,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: EventModalsProps) {
  return (
    <>
      {showCreateEvent && (
        <div className="modal-overlay" onClick={onCloseCreate}>
          <div className="modal-content glass-card" onClick={(event) => event.stopPropagation()}>
            <h2>Buat Event Baru</h2>
            <form onSubmit={onCreateEvent}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label" htmlFor="new-event-name">Nama Event</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Konser Tahun Baru"
                  value={newEventName}
                  onChange={(event) => onNewEventNameChange(event.target.value)}
                  required
                  id="new-event-name"
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="input-label" htmlFor="new-event-date">Tanggal</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={newEventDate}
                  onChange={(event) => onNewEventDateChange(event.target.value)}
                  id="new-event-date"
                />
              </div>
              <div className="flex gap-sm">
                <button type="submit" className="btn btn-primary w-full" id="create-event-submit">Buat Event</button>
                <button type="button" className="btn btn-ghost" onClick={onCloseCreate}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditEvent && (
        <div className="modal-overlay" onClick={onCloseEdit}>
          <div className="modal-content glass-card" onClick={(event) => event.stopPropagation()}>
            <h2>Edit Event</h2>
            <form onSubmit={onUpdateEvent}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label" htmlFor="edit-event-name">Nama Event</label>
                <input
                  id="edit-event-name"
                  type="text"
                  className="input"
                  value={editEventName}
                  onChange={(event) => onEditEventNameChange(event.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="input-label" htmlFor="edit-event-date">Tanggal</label>
                <input
                  id="edit-event-date"
                  type="datetime-local"
                  className="input"
                  value={editEventDate}
                  onChange={(event) => onEditEventDateChange(event.target.value)}
                />
              </div>
              <div className="flex gap-sm">
                <button type="submit" className="btn btn-primary w-full">Simpan</button>
                <button type="button" className="btn btn-ghost" onClick={onCloseEdit}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={onCloseDelete}>
          <div className="modal-content glass-card" onClick={(event) => event.stopPropagation()}>
            <h2>Hapus Event?</h2>
            <p className="text-muted">
              Event &quot;{selectedEventName}&quot; dan semua pesan akan dihapus permanen.
            </p>
            <div className="confirm-actions">
              <button className="btn btn-danger w-full" onClick={onDeleteEvent}>Ya, Hapus</button>
              <button className="btn btn-ghost" onClick={onCloseDelete}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
