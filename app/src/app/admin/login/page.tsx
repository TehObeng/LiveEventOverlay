'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getBrowserSupabaseClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
  isSupabaseSessionMissingError,
} from '@/lib/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigError(true);
      setCheckingSession(false);
      return;
    }

    let active = true;
    const supabase = getBrowserSupabaseClient();

    const checkSession = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (!active) return;

        if (authError) {
          if (isSupabaseSessionMissingError(authError)) {
            return;
          }

          console.error('Session check failed:', authError);
          setError('Gagal memverifikasi sesi login.');
          return;
        }

        if (data.user) {
          router.replace('/admin');
          return;
        }
      } catch (sessionError) {
        console.error('Session check failed:', sessionError);
        if (active) {
          setError('Gagal memverifikasi sesi login.');
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (!isSupabaseConfigured()) {
      setConfigError(true);
      setLoading(false);
      return;
    }

    try {
      const supabase = getBrowserSupabaseClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error details:', authError);
        const errorMap: Record<string, string> = {
          'Invalid login credentials': 'Email atau password salah',
          'Email not confirmed': 'Email belum dikonfirmasi. Cek inbox email Anda.',
          'Too many requests': 'Terlalu banyak percobaan. Tunggu beberapa menit.',
          'User not found': 'Akun tidak ditemukan',
          'Invalid email or password': 'Email atau password salah',
        };

        setError(errorMap[authError.message] || `Login gagal: ${authError.message}`);
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError('Koneksi bermasalah. Pastikan internet tersambung dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (configError) {
    return (
      <div className="login-page">
        <div className="login-card glass-card">
          <h1>Konfigurasi Error</h1>
          <div
            style={{
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.3)',
              borderRadius: 12,
              padding: '16px 20px',
              fontSize: '0.875rem',
              color: '#ff6b6b',
              lineHeight: 1.6,
            }}
          >
            <p style={{ marginBottom: 12, fontWeight: 600 }}>
              {getSupabaseConfigError()}
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
              <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
              <li><code>SUPABASE_SERVICE_ROLE_KEY</code></li>
            </ul>
            <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Restart server setelah mengubah environment variable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (checkingSession) {
    return (
      <div className="login-page">
        <div className="login-card glass-card">
          <div className="flex items-center justify-center" style={{ minHeight: 160 }}>
            <span className="spinner" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card glass-card">
        <h1>Admin Login</h1>

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              id="login-password"
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(255,107,107,0.1)',
                border: '1px solid rgba(255,107,107,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: '0.875rem',
                color: '#ff6b6b',
              }}
            >
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
