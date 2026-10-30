import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main
        className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" aria-hidden="true" />
        <span className="text-slate-300 font-medium text-sm">Verifying security credentials...</span>
      </main>
    );
  }

  if (!isAuthenticated) {
    // Preserve requested route for seamless redirection after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
