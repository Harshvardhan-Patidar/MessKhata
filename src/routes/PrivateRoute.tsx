import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  // Track whether an auto-signout is in progress to prevent rendering children
  // during the async signout operation (was a race condition before this fix)
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (session) {
      const loginTime = localStorage.getItem('admin_login_timestamp');
      if (loginTime) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const timeElapsed = Date.now() - parseInt(loginTime, 10);

        if (timeElapsed > thirtyDaysMs) {
          // Mark as signing out BEFORE the async call so children are never rendered
          setIsSigningOut(true);
          supabase.auth.signOut().then(() => {
            localStorage.removeItem('admin_login_timestamp');
            // isSigningOut stays true — component will redirect via the !session path
          });
        }
      }
    }
  }, [session]);

  if (loading || isSigningOut) {
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