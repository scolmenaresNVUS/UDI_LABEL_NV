import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'operator';
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole === 'admin' && user?.role !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
}
