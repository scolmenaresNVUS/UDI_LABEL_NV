import { useState, useEffect } from 'react';
import api from '../../services/api';

interface PrintJob {
  id: string;
  userId: string;
  templateId: string;
  printerId: string;
  productId: string;
  identifierMode: 'lot' | 'serial';
  gtin: string;
  lotNumber: string | null;
  serialPatternJson: string | null;
  manufacturingDate: string;
  expirationDate: string | null;
  totalLabels: number;
  copiesPerLabel: number;
  status: string;
  labelsPrinted: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function PrintHistory() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    const res = await api.get('/print-jobs');
    setJobs(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-900/20';
      case 'printing': return 'text-blue-400 bg-blue-900/20';
      case 'queued': return 'text-yellow-400 bg-yellow-900/20';
      case 'failed': return 'text-red-400 bg-red-900/20';
      case 'cancelled': return 'text-gray-400 bg-gray-700/50';
      default: return 'text-gray-400 bg-gray-700/50';
    }
  };

  const handleReprint = async (job: PrintJob) => {
    try {
      // Create a new job with same parameters
      await api.post('/print-jobs', {
        templateId: job.templateId,
        printerId: job.printerId,
        productId: job.productId,
        identifierMode: job.identifierMode,
        gtin: job.gtin,
        lotNumber: job.lotNumber,
        serialNumbers: job.serialPatternJson ? JSON.parse(job.serialPatternJson) : undefined,
        manufacturingDate: job.manufacturingDate,
        expirationDate: job.expirationDate,
        totalLabels: job.totalLabels,
        copiesPerLabel: job.copiesPerLabel,
      });
      alert('Reprint job created! Go to Print Queue to execute.');
      fetchJobs();
    } catch {
      alert('Failed to create reprint job');
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Print History</h1>
        <div className="flex gap-2">
          {['all', 'completed', 'queued', 'printing', 'failed', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No print jobs found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Date</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Mode</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">GTIN</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Identifier</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Labels</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Status</th>
                <th className="text-right text-gray-400 text-xs uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => (
                <tr key={job.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-300 text-sm">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${job.identifierMode === 'serial' ? 'text-purple-400 bg-purple-900/30' : 'text-blue-400 bg-blue-900/30'}`}>
                      {job.identifierMode.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm font-mono">{job.gtin}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm font-mono">
                    {job.lotNumber || (job.serialPatternJson ? `${JSON.parse(job.serialPatternJson).length} serials` : '-')}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">
                    {job.labelsPrinted}/{job.totalLabels}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${statusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleReprint(job)} className="text-blue-400 hover:text-blue-300 text-xs">
                      Reprint
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
