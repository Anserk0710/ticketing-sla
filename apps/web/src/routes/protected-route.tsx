import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';

export function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (session.user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (!session.user.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to={session.user.roles.includes('TECHNICIAN') ? '/app/assignments' : '/app/dashboard'} replace />;
  }
  return <Outlet />;
}
