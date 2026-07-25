'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid password');
      }

      // Success, redirect to home
      router.push('/');
      router.refresh(); // Ensure middleware re-evaluates
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-text p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500"></div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/30 mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">NetWatch Login</h1>
          <p className="text-text-muted text-sm mt-1">Enter your admin password to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary text-text placeholder-text-muted transition-colors"
              autoFocus
            />
            {error && <p className="text-danger text-xs mt-2 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-primary text-surface font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
