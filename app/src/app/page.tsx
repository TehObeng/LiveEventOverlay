import Link from 'next/link';

export default function Home() {
  return (
    <div className="chat-page">
      <div className="chat-container" style={{ maxWidth: 540, textAlign: 'center' }}>
        <div className="chat-header">
          <h1 style={{ fontSize: '2.5rem', marginBottom: 8 }}>Live Chat Overlay</h1>
          <p style={{ fontSize: '1.05rem' }}>
            Sistem overlay chat real-time untuk live event, QR audience, dan moderasi admin.
          </p>
        </div>

        <div className="glass-card animate-in" style={{ padding: 32 }}>
          <div className="flex flex-col gap-md">
            <Link href="/admin/login" className="btn btn-primary btn-lg w-full" style={{ textDecoration: 'none' }}>
              Buka Admin Panel
            </Link>
          </div>

          <div className="text-sm text-muted" style={{ marginTop: 24, lineHeight: 1.7 }}>
            <p>Alur yang direkomendasikan:</p>
            <p>1. Login admin dan buat event baru.</p>
            <p>2. Bagikan QR code event ke audience.</p>
            <p>3. Gunakan halaman overlay untuk OBS atau layar panggung.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
