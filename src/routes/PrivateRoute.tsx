import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactNode } from "react";
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export const PrivateRoute = ({ children }: { children: ReactNode  }) => {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (session) {
      const loginTime = localStorage.getItem('admin_login_timestamp');
      if (loginTime) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const timeElapsed = Date.now() - parseInt(loginTime, 10);
        
        if (timeElapsed > thirtyDaysMs) {
          supabase.auth.signOut().then(() => {
            localStorage.removeItem('admin_login_timestamp');
          });
        }
      }
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};