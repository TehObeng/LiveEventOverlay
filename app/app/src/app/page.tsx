import Link from 'next/link';

export default function Home() {
  return (
    <div className="chat-page">
      <div className="chat-container" style={{ maxWidth: 500, textAlign: 'center' }}>
        <div className="chat-header">
          <h1 style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎤 Live Chat Overlay</h1>
          <p style={{ fontSize: '1.1rem' }}>
            Sistem overlay chat real-time untuk acara live
          </p>
        </div>
        <div className="glass-card animate-in" style={{ padding: 32 }}>
          <div className="flex flex-col gap-md">
            <Link href="/admin/login" className="btn btn-primary btn-lg w-full" style={{ textDecoration: 'none' }}>
              🔐 Admin Panel
            </Link>
            <Link href="/chat?eventId=demo" className="btn btn-ghost btn-lg w-full" style={{ textDecoration: 'none' }}>
              💬 Demo Chat Page
            </Link>
          </div>
          <p className="text-muted text-sm" style={{ marginTop: 24 }}>
            Scan QR code dari admin panel untuk mengirim pesan
          </p>
        </div>
      </div>
    </div>
  );
}
