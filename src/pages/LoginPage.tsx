import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in and user somehow visits /login, redirect to dashboard
  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // On successful login, go to dashboard
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-slate-900/90 backdrop-blur rounded-2xl p-6 space-y-4 shadow-2xl"
      >
        <h1 className="text-2xl font-bold text-center">MessKhata Login</h1>
        <p className="text-xs text-center text-slate-400">
          contact admin for login credentials.
        </p>
        {error && (
          <p className="text-sm text-red-400 bg-red-950/60 border border-red-700 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-green-600 text-white font-semibold rounded-lg py-2 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  );
};