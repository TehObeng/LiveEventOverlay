'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Email atau password salah');
      } else {
        router.push('/admin');
      }
    } catch {
      setError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-card">
        <h1>🔐 Admin Login</h1>
        
        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              id="login-email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="input-label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              id="login-password"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: '0.875rem',
              color: '#ff6b6b',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            id="login-submit"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-sm">
                <span className="spinner" />
                Logging in...
              </span>
            ) : (
              'Masuk'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
