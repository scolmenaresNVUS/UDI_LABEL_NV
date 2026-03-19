import { useState, useEffect } from 'react';
import api from '../../services/api';
import type { User, CreateUserData } from '../../types/auth.types';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CreateUserData>({ username: '', email: '', password: '', role: 'operator' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    const res = await api.get('/auth/users');
    setUsers(res.data);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/users', form);
      setForm({ username: '', email: '', password: '', role: 'operator' });
      setShowAdd(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create user';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (user: User) => {
    await api.patch(`/auth/users/${user.id}`, { isActive: !user.isActive });
    fetchUsers();
  };

  const resetPassword = async (userId: string) => {
    const newPass = prompt('Enter new password (min 8 chars):');
    if (!newPass || newPass.length < 8) return;
    try {
      await api.patch(`/auth/users/${userId}`, { password: newPass });
      alert('Password reset successfully');
    } catch {
      alert('Failed to reset password');
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 text-sm">{users.length}/6 users</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          disabled={users.length >= 6}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          Add User
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <h2 className="text-white text-sm font-medium mb-3">New User</h2>
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            <input
              placeholder="Username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'operator' })}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowAdd(false); setError(''); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Username</th>
              <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Email</th>
              <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Role</th>
              <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Status</th>
              <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Created</th>
              <th className="text-right text-gray-400 text-xs uppercase px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 text-white text-sm">{user.username}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-purple-600/20 text-purple-400' : 'bg-blue-600/20 text-blue-400'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${user.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive(user)} className="text-gray-400 hover:text-white text-xs mr-2">
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => resetPassword(user.id)} className="text-gray-400 hover:text-white text-xs">
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
