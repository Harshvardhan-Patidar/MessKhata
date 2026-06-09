import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'admin' | 'student'>('admin');
  
  // Admin State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Student State
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in and user somehow visits /login, redirect to dashboard
  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  const handleAdminLogin = async (e: React.FormEvent) => {
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

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;
      
      const { data, error: invokeError } = await supabase.functions.invoke('student-login', {
        body: { full_name: fullName.trim(), mobile: formattedMobile, customer_code: customerCode.trim() }
      });

      if (invokeError) throw new Error(invokeError.message || 'Failed to verify details');
      if (data?.error) throw new Error(data.error);

      if (data?.enrollments) {
        localStorage.setItem('student_session', JSON.stringify(data.enrollments));
        navigate('/student', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900/90 backdrop-blur rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
        
        {/* Tabs */}
        <div className="flex w-full bg-slate-800/50">
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'admin' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            onClick={() => { setActiveTab('admin'); setError(null); }}
          >
            Admin Login
          </button>
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'student' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            onClick={() => { setActiveTab('student'); setError(null); }}
          >
            Student Login
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{activeTab === 'admin' ? 'MessKhata Admin' : 'Student Portal'}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {activeTab === 'admin' ? 'Login with your credentials' : 'View your meal details'}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/60 border border-red-700 rounded-md px-3 py-2 text-center">
              {error}
            </p>
          )}

          {activeTab === 'admin' ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-slate-300">Email</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-slate-300">Password</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
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
                className="w-full bg-primary hover:bg-green-600 text-white font-semibold rounded-lg py-3 text-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Logging in…' : 'Login as Admin'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-slate-300">Full Name</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-slate-300">Mobile Number</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-slate-300">Customer Code</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white font-mono"
                  type="text"
                  placeholder="e.g. CUST-123"
                  value={customerCode}
                  onChange={e => setCustomerCode(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-3 text-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Fetching details…' : 'View Details'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};