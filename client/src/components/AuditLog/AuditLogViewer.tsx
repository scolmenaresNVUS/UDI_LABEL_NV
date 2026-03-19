import { useState, useEffect } from 'react';
import api from '../../services/api';

interface AuditEntry {
  id: number;
  timestamp: string;
  userId: string;
  username: string;
  actionType: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string;
}

export default function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchEntries = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (actionFilter) params.set('actionType', actionFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);

    const res = await api.get(`/audit-log?${params.toString()}`);
    setEntries(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [search, actionFilter, fromDate, toDate]);

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/audit-log/export/csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('CSV export failed');
    }
  };

  // Get unique action types for filter
  const actionTypes = [...new Set(entries.map(e => e.actionType))].sort();

  const actionColor = (action: string) => {
    if (action.includes('create')) return 'text-green-400';
    if (action.includes('delete')) return 'text-red-400';
    if (action.includes('login')) return 'text-blue-400';
    if (action.includes('complete')) return 'text-emerald-400';
    return 'text-gray-400';
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Audit Log</h1>
        <button onClick={handleExportCsv} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Search</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entries..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">All Actions</option>
              {actionTypes.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit entries found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Timestamp</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">User</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Action</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Entity</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Details</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white text-sm">{entry.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono ${actionColor(entry.actionType)}`}>
                      {entry.actionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {entry.entityType}/{entry.entityId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {JSON.stringify(entry.details)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{entry.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-600">
        Showing {entries.length} entries (read-only)
      </div>
    </div>
  );
}
