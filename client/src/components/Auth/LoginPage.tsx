import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ username, password });
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 w-96 shadow-2xl border border-gray-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="white">
              <rect x="2" y="2" width="6" height="6" />
              <rect x="10" y="2" width="6" height="6" />
              <rect x="18" y="2" width="6" height="6" />
              <rect x="2" y="10" width="6" height="6" />
              <rect x="18" y="10" width="6" height="6" />
              <rect x="2" y="18" width="6" height="6" />
              <rect x="10" y="18" width="6" height="6" />
              <rect x="18" y="18" width="6" height="6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">GS1 Label System</h1>
          <p className="text-gray-400 text-sm mt-1">Medical Device UDI Labels</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <div>
            <label className="text-gray-400 text-sm block mb-1">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="admin"
              autoFocus
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
