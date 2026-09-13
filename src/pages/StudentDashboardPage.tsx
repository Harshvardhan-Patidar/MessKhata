import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LogHistoryModal, type LogEntry } from '../components/StudentPortal/LogHistoryModal';

/**
 * Represents a student enrollment retrieved from the backend.
 */
type Customer = {
  id: string;
  admin_id: string;
  mess_name: string;
  admin_phone: string;
  admin_name: string;
  full_name: string;
  mobile: string;
  customer_code: string;
  status: string;
  current_plan_type: string;
  remaining_plates: number;
  total_plates: number;
  last_visit_at: string;
  plan_expiry_date: string;
  menu_data?: { morning: string[], evening: string[] };
  menu_last_updated?: string | null;
};

/**
 * StudentDashboardPage Component
 * 
 * Main portal for students. Displays all their active enrollments across different messes,
 * allows them to view their meal history, and send WhatsApp notifications to skip meals.
 * 
 * @returns {JSX.Element} The Student Dashboard Page
 */
export const StudentDashboardPage = () => {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Customer[] | null>(null);

  // Modal State
  const [selectedMess, setSelectedMess] = useState<Customer | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Time state to evaluate skip button availability
  const [timeInMinutes, setTimeInMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    // Update time every minute to accurately disable buttons if dashboard is left open
    const interval = setInterval(() => {
      const now = new Date();
      setTimeInMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const studentData = localStorage.getItem('student_session');
    if (!studentData) {
      navigate('/login', { replace: true });
      return;
    }

    // ── 30-day session expiry ────────────────────────────────────────────
    const loginTimestamp = localStorage.getItem('student_login_timestamp');
    if (loginTimestamp) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - parseInt(loginTimestamp, 10) > thirtyDaysMs) {
        localStorage.removeItem('student_session');
        localStorage.removeItem('student_login_timestamp');
        navigate('/login', { replace: true });
        return;
      }
    } else {
      // No timestamp stored — treat as a legacy session and stamp it now
      localStorage.setItem('student_login_timestamp', Date.now().toString());
    }

    try {
      const parsedData = JSON.parse(studentData);
      if (Array.isArray(parsedData)) {
        setEnrollments(parsedData);
      } else {
        setEnrollments([parsedData]);
      }
    } catch {
      localStorage.removeItem('student_session');
      localStorage.removeItem('student_login_timestamp');
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('student_session');
    localStorage.removeItem('student_login_timestamp');
    navigate('/login', { replace: true });
  };

  /**
   * Fetches the 3-day meal history for a specific mess enrollment.
   * @param {Customer} student The specific enrollment to fetch logs for.
   */
  const fetchLogs = async (student: Customer) => {
    setSelectedMess(student);
    setLoadingLogs(true);
    setLogsError(null);
    setLogs([]);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('student-logs', {
        body: {
          customer_id: student.id,
          mobile: student.mobile,
          customer_code: student.customer_code
        }
      });

      if (invokeError) throw new Error(invokeError.message || 'Failed to fetch logs');
      if (data?.error) throw new Error(data.error);

      if (data?.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogsError(msg.includes('Edge Function returned a non-2xx status code') ? 'Failed to load meal history. Please try again later.' : msg);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleWhatsAppSkip = (student: Customer, time: 'Morning' | 'Evening') => {
    if (!student.admin_phone) {
      alert("This mess owner has not provided a contact number.");
      return;
    }

    // Format for WhatsApp: Remove all non-digits. If it's exactly 10 digits, assume India (+91)
    const cleanPhone = student.admin_phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const message = `Hello ${student.mess_name},\nI (${student.full_name}) will skip my tiffin this ${time}. Please do not prepare my meal.\nThank you!`;
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (!enrollments) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
    );
  }

  // 9:30 AM is 570 minutes
  const isMorningActive = timeInMinutes < 570;
  // 4:30 PM is 990 minutes
  const isEveningActive = timeInMinutes < 990;

  const getActiveMenu = (student: Customer) => {
    if (!student.menu_data || !student.menu_last_updated) return null;

    const now = new Date();
    const updated = new Date(student.menu_last_updated);

    // Time difference in hours
    const diffHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);

    // If it was updated more than 20 hours ago, it's considered an old menu and we hide it automatically as the day changes.
    if (diffHours > 20) return null;

    const currentHour = now.getHours();
    const isMorning = currentHour >= 5 && currentHour < 17;

    if (isMorning) {
      return { title: "🌅 Today's Morning Menu", items: student.menu_data.morning };
    } else {
      return { title: "🌆 Today's Evening Menu", items: student.menu_data.evening };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-200 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm sticky top-4 z-10 shadow-lg">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Student Portal
            </h1>
            <p className="text-xs text-slate-400">Welcome back, {enrollments[0]?.full_name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 hover:border-slate-500 shadow-sm"
          >
            Logout
          </button>
        </div>

        {/* Enrollments List */}
        <div className="space-y-6">
          {enrollments.map((student) => {
            const statusColor =
              student.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                student.status === 'expired' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

            return (
              <div key={student.id} className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-colors">

                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1 block">Enrolled At</span>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      {student.mess_name || 'MessKhata Partner'}
                    </h2>
                    {student.admin_name && (
                      <p className="text-sm text-slate-400 mt-1">Admin: {student.admin_name}</p>
                    )}
                  </div>
                  <span className={`mt-2 md:mt-0 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide border shadow-sm ${statusColor}`}>
                    {student.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center shadow-lg shrink-0 border border-slate-600">
                    <span className="text-2xl md:text-3xl font-bold text-slate-300">
                      {student.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-2 w-full">
                    <div className="flex flex-col md:flex-row gap-4 text-sm text-slate-400 bg-slate-800/30 p-3 rounded-xl border border-slate-800/50">
                      <p>Mobile: <span className="text-slate-200">{student.mobile}</span></p>
                      <div className="hidden md:block w-px h-4 bg-slate-700"></div>
                      <p>ID: <span className="text-slate-200 font-mono tracking-wider">{student.customer_code || 'N/A'}</span></p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">

                      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                        <span className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Plan</span>
                        <span className="font-semibold text-white capitalize text-sm">
                          {student.current_plan_type.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="bg-slate-800/80 rounded-2xl p-4 border border-primary/30 flex flex-col items-center justify-center text-center shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                        <span className="text-xs text-primary/80 mb-1 uppercase tracking-wider font-semibold">Remaining</span>
                        <span className="text-3xl font-bold text-primary">
                          {student.remaining_plates ?? '∞'}
                        </span>
                      </div>

                      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                        <span className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Total</span>
                        <span className="font-semibold text-white text-lg">
                          {student.total_plates ?? '0'}
                        </span>
                      </div>

                      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                        <span className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Last Visit</span>
                        <span className="font-semibold text-white text-sm">
                          {student.last_visit_at ? new Date(student.last_visit_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Never'}
                        </span>
                      </div>
                    </div>

                    {/* Menu Display Section */}
                    {(() => {
                      const activeMenu = getActiveMenu(student);
                      if (!activeMenu || !activeMenu.items || activeMenu.items.length === 0) return null;

                      return (
                        <div className="mt-5 bg-slate-800/40 rounded-2xl p-4 border border-slate-700/60 shadow-inner">
                          <h3 className="text-sm font-bold text-slate-200 mb-2">{activeMenu.title}</h3>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {activeMenu.items.map((item, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex gap-2 w-full md:w-auto flex-wrap md:flex-nowrap">
                        <button
                          onClick={() => handleWhatsAppSkip(student, 'Morning')}
                          disabled={!isMorningActive}
                          title={!isMorningActive ? "Morning skip deadline (9:30 AM) has passed" : "Notify admin to skip morning tiffin"}
                          className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${isMorningActive
                            ? "bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-yellow-500/50 text-yellow-400"
                            : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                            }`}
                        >
                          Skip Morning ☀️
                        </button>

                        <button
                          onClick={() => handleWhatsAppSkip(student, 'Evening')}
                          disabled={!isEveningActive}
                          title={!isEveningActive ? "Evening skip deadline (4:30 PM) has passed" : "Notify admin to skip evening tiffin"}
                          className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${isEveningActive
                            ? "bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-blue-400/50 text-blue-300"
                            : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                            }`}
                        >
                          Skip Evening 🌙
                        </button>
                      </div>

                      <button
                        onClick={() => fetchLogs(student)}
                        className="w-full md:w-auto px-6 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-green-500/50 rounded-xl text-green-400 font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View History
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extracted History Modal Component */}
      {selectedMess && (
        <LogHistoryModal
          messName={selectedMess.mess_name}
          logs={logs}
          loadingLogs={loadingLogs}
          logsError={logsError}
          onClose={() => setSelectedMess(null)}
        />
      )}

    </div>
  );
};
