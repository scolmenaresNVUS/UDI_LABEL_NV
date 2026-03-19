import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { checkZebraBrowserPrint, sendToZebraPrinter } from '../../services/zebraBrowserPrint';

interface PrintJob {
  id: string;
  userId: string;
  productId: string;
  identifierMode: 'lot' | 'serial';
  gtin: string;
  lotNumber: string | null;
  serialPatternJson: string | null;
  totalLabels: number;
  copiesPerLabel: number;
  status: string;
  labelsPrinted: number;
  errorMessage: string | null;
  zplData: string | null;
  createdAt: string;
}

export default function PrintQueue() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [zbpAvailable, setZbpAvailable] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchJobs = useCallback(async () => {
    const res = await api.get('/print-jobs');
    // Show queued and printing jobs
    const queuedJobs = (res.data as PrintJob[]).filter(j => j.status === 'queued' || j.status === 'printing');
    setJobs(queuedJobs);
  }, []);

  useEffect(() => {
    fetchJobs();
    checkZebraBrowserPrint().then(r => setZbpAvailable(r.available));

    // Poll every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handlePrintNow = async (job: PrintJob) => {
    if (!job.zplData) {
      alert('No ZPL data in this job');
      return;
    }

    setPrintingJobId(job.id);
    setProgress({ current: 0, total: job.totalLabels });

    try {
      // Try to send via API first (handles network printers)
      const printRes = await api.post(`/print-jobs/${job.id}/print`);

      if (printRes.data.deliveryMethod === 'zebra_browser_print' && printRes.data.zpl) {
        // Chunked delivery
        const zplBlocks = printRes.data.zpl.split('^XZ').filter((b: string) => b.trim()).map((b: string) => b.trim() + '^XZ');
        const chunkSize = 10;

        for (let i = 0; i < zplBlocks.length; i += chunkSize) {
          const chunk = zplBlocks.slice(i, i + chunkSize).join('\n');
          await sendToZebraPrinter(chunk);
          setProgress({
            current: Math.min(i + chunkSize, zplBlocks.length),
            total: zplBlocks.length,
          });
          if (i + chunkSize < zplBlocks.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        await api.post(`/print-jobs/${job.id}/complete`);
      }

      fetchJobs();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Print failed';
      await api.post(`/print-jobs/${job.id}/fail`, { errorMessage: msg });
      alert(`Print failed: ${msg}`);
      fetchJobs();
    } finally {
      setPrintingJobId(null);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleCancel = async (jobId: string) => {
    await api.post(`/print-jobs/${jobId}/cancel`);
    fetchJobs();
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Print Queue</h1>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${zbpAvailable ? 'bg-green-900/20 border border-green-700/50' : 'bg-yellow-900/20 border border-yellow-700/50'}`}>
            <div className={`w-2 h-2 rounded-full ${zbpAvailable ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className={`text-xs ${zbpAvailable ? 'text-green-400' : 'text-yellow-400'}`}>
              {zbpAvailable ? 'Printer Ready' : 'No Printer'}
            </span>
          </div>
          <button onClick={fetchJobs} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs">
            Refresh
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <p className="text-gray-500">No pending print jobs.</p>
          <p className="text-gray-600 text-sm mt-1">Jobs queued from any LAN client will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${job.identifierMode === 'serial' ? 'text-purple-400 bg-purple-900/30' : 'text-blue-400 bg-blue-900/30'}`}>
                      {job.identifierMode.toUpperCase()}
                    </span>
                    <span className="text-white text-sm font-mono">{job.gtin}</span>
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${job.status === 'queued' ? 'text-yellow-400 bg-yellow-900/20' : 'text-blue-400 bg-blue-900/20'}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>{job.totalLabels} labels x {job.copiesPerLabel} copies</span>
                    {job.lotNumber && <span>Lot: {job.lotNumber}</span>}
                    {job.serialPatternJson && <span>{JSON.parse(job.serialPatternJson).length} serials</span>}
                    <span>{new Date(job.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {job.status === 'queued' && (
                    <>
                      <button
                        onClick={() => handlePrintNow(job)}
                        disabled={!zbpAvailable || printingJobId !== null}
                        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        Print Now
                      </button>
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress bar for currently printing job */}
              {printingJobId === job.id && progress.total > 0 && (
                <div className="mt-3">
                  <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {progress.current} / {progress.total} labels sent
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
