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
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('Edge Function returned a non-2xx status code') ? 'User not present' : msg);
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
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('Edge Function returned a non-2xx status code') ? 'Invalid OTP or user not present' : msg);
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
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('Edge Function returned a non-2xx status code') ? 'Student not present' : msg);
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
            adminStep === 'request' ? (
              <form onSubmit={handleAdminRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1 text-slate-300">Admin Name</label>
                  <input
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    type="text"
                    placeholder="e.g. Aarti Sharma"
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1 text-slate-300">Phone Number</label>
                  <input
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
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
                  className="w-full bg-primary hover:bg-green-600 text-white font-semibold rounded-lg py-3 text-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
                >
                  {loading ? 'Requesting OTP…' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1 text-slate-300">Enter OTP</label>
                  <input
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-2xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary text-white font-mono"
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
                  className="w-full bg-primary hover:bg-green-600 text-white font-semibold rounded-lg py-3 text-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying…' : 'Verify & Login'}
                </button>

                <button
                  type="button"
                  onClick={() => { setAdminStep('request'); setAdminOtp(''); setError(null); }}
                  className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                >
                  Back to Phone Number
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-slate-300">Full Name</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  type="text"
                  placeholder="e.g. Aarti Sharma"
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