import { Navigate } from 'react-router-dom';
import type { ReactNode } from "react";
import { useAuth } from '../context/AuthContext';

export const PrivateRoute = ({ children }: { children: ReactNode  }) => {
  const { session, loading } = useAuth();

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

  return children;
};