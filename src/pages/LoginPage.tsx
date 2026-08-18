import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'admin' | 'student'>('admin');

  // Admin State
  const [adminStep, setAdminStep] = useState<'request' | 'verify'>('request');
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminOtp, setAdminOtp] = useState('');

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

  // Prevent vertical scroll bar on login page
  useEffect(() => {
    const originalMinHeight = document.body.style.minHeight;
    const originalPaddingBottom = document.body.style.paddingBottom;
    const originalOverflow = document.body.style.overflow;

    document.body.style.minHeight = '100vh';
    document.body.style.paddingBottom = '0px';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.minHeight = originalMinHeight;
      document.body.style.paddingBottom = originalPaddingBottom;
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleAdminRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-login', {
        body: { name: adminName.trim(), phone: adminPhone.trim() }
      });

      if (invokeError) throw new Error(invokeError.message || 'Failed to request OTP');
      if (data?.error) throw new Error(data.error);

      setAdminStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-verify', {
        body: { phone: adminPhone.trim(), otp: adminOtp.trim() }
      });

      if (invokeError) throw new Error(invokeError.message || 'Failed to verify OTP');
      if (data?.error) throw new Error(data.error);

      if (data?.session) {
        // Set the session
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) throw sessionError;

        // Save the login timestamp for 30-day enforcement
        localStorage.setItem('admin_login_timestamp', Date.now().toString());

        navigate('/', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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
        localStorage.setItem('student_login_timestamp', Date.now().toString());
        navigate('/student', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-gradient-to-b from-background-light to-slate-100 dark:from-background-dark dark:to-slate-900">
      <div className="w-full max-w-md bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden relative z-10">

        {/* Tabs */}
        <div className="flex w-full bg-slate-55 dark:bg-slate-900/50 p-1.5 gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-300 cursor-pointer ${
              activeTab === 'admin' 
                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                : 'text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark'
            }`}
            onClick={() => { setActiveTab('admin'); setError(null); }}
          >
            Admin Login
          </button>
          <button
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-300 cursor-pointer ${
              activeTab === 'student' 
                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                : 'text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark'
            }`}
            onClick={() => { setActiveTab('student'); setError(null); }}
          >
            Student Login
          </button>
        </div>

        <div className="p-7 space-y-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black tracking-tight text-text-light dark:text-text-dark">
              {activeTab === 'admin' ? (
                <>
                  MessKhata <span className="font-light text-text-muted-light dark:text-text-muted-dark">Admin</span>
                </>
              ) : (
                <>
                  Student <span className="font-light text-text-muted-light dark:text-text-muted-dark">Portal</span>
                </>
              )}
            </h1>
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-2 font-medium">
              {activeTab === 'admin' ? 'Login with your credentials' : 'View your meal details'}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-center font-bold">
              {error}
            </p>
          )}

          {activeTab === 'admin' ? (
            adminStep === 'request' ? (
              <form onSubmit={handleAdminRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-text-muted-light dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">Admin Name</label>
                  <input
                    className="w-full glass-input px-4 py-3.5 text-sm font-medium rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
                    type="text"
                    placeholder="e.g. Aarti Sharma"
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-text-muted-light dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">Phone Number</label>
                  <input
                    className="w-full glass-input px-4 py-3.5 text-sm font-medium rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={adminPhone}
                    onChange={e => setAdminPhone(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:hover:bg-slate-105 dark:text-slate-900 font-bold rounded-xl py-3.5 text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shadow-md cursor-pointer mt-3"
                >
                  {loading ? 'Requesting OTP…' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-text-muted-light dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">Enter OTP</label>
                  <input
                    className="w-full glass-input px-4 py-3.5 text-2xl text-center tracking-widest font-mono font-bold rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
                    type="text"
                    placeholder="------"
                    maxLength={6}
                    value={adminOtp}
                    onChange={e => setAdminOtp(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:hover:bg-slate-105 dark:text-slate-900 font-bold rounded-xl py-3.5 text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shadow-md cursor-pointer mt-3"
                >
                  {loading ? 'Verifying…' : 'Verify & Login'}
                </button>

                <button
                  type="button"
                  onClick={() => { setAdminStep('request'); setAdminOtp(''); setError(null); }}
                  className="w-full text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark text-xs py-2 font-bold transition-colors cursor-pointer text-center"
                >
                  Back to Phone Number
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-text-muted-light dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">Full Name</label>
                <input
                  className="w-full glass-input px-4 py-3.5 text-sm font-medium rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
                  type="text"
                  placeholder="e.g. Aarti Sharma"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-text-muted-light dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">Mobile Number</label>
                <input
                  className="w-full glass-input px-4 py-3.5 text-sm font-medium rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-text-muted-light dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">Customer Code</label>
                <input
                  className="w-full glass-input px-4 py-3.5 text-sm font-mono font-bold rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
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
                className="w-full bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:hover:bg-slate-105 dark:text-slate-900 font-bold rounded-xl py-3.5 text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shadow-md cursor-pointer mt-3"
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