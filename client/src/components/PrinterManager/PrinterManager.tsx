import { useState, useEffect } from 'react';
import api from '../../services/api';
import { checkZebraBrowserPrint, discoverPrinters, sendToZebraPrinter, readPrinterStatus } from '../../services/zebraBrowserPrint';
import type { ZebraPrinter } from '../../services/zebraBrowserPrint';

interface Printer {
  id: string;
  name: string;
  connectionType: string;
  ipAddress: string | null;
  port: number;
  printerModel: string;
  dpi: number;
  isDefault: boolean;
}

export default function PrinterManager() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [zbpAvailable, setZbpAvailable] = useState(false);
  const [zbpChecking, setZbpChecking] = useState(true);
  const [zbpPrinter, setZbpPrinter] = useState<ZebraPrinter | null>(null);
  const [zbpStatus, setZbpStatus] = useState<string>('');
  const [discoveredPrinters, setDiscoveredPrinters] = useState<ZebraPrinter[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [testResult, setTestResult] = useState<{ printerId: string; status: 'testing' | 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState({ name: '', connectionType: 'zebra_browser_print', ipAddress: '', port: 9100, printerModel: 'Zebra GK420D', dpi: 203 });

  const fetchPrinters = async () => {
    const res = await api.get('/printers');
    setPrinters(res.data);
  };

  const checkZbp = async () => {
    setZbpChecking(true);
    const result = await checkZebraBrowserPrint();
    setZbpAvailable(result.available);
    if (result.printer) {
      setZbpPrinter(result.printer);
    }
    if (result.available) {
      // Discover all printers
      const discovered = await discoverPrinters();
      setDiscoveredPrinters(discovered);
      // Read status of default printer
      const status = await readPrinterStatus();
      setZbpStatus(status);
    }
    setZbpChecking(false);
  };

  useEffect(() => {
    fetchPrinters();
    checkZbp();
  }, []);

  const addPrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/printers', { ...form, isDefault: printers.length === 0 });
    setShowAdd(false);
    setForm({ name: '', connectionType: 'zebra_browser_print', ipAddress: '', port: 9100, printerModel: 'Zebra GK420D', dpi: 203 });
    fetchPrinters();
  };

  const addDiscoveredPrinter = async (zbp: ZebraPrinter) => {
    await api.post('/printers', {
      name: zbp.name || 'Zebra USB Printer',
      connectionType: 'zebra_browser_print',
      ipAddress: null,
      port: 9100,
      printerModel: zbp.name || 'Zebra GK420D',
      dpi: 203,
      isDefault: printers.length === 0,
    });
    fetchPrinters();
  };

  const testPrint = async (printer: Printer) => {
    setTestResult({ printerId: printer.id, status: 'testing', message: 'Sending test print...' });
    try {
      const res = await api.post(`/printers/${printer.id}/test`);
      if (res.data.deliveryMethod === 'zebra_browser_print' && res.data.zpl) {
        if (!zbpAvailable) {
          setTestResult({ printerId: printer.id, status: 'error', message: 'Zebra Browser Print is not running on this PC. Start it and try again.' });
          return;
        }
        try {
          await sendToZebraPrinter(res.data.zpl);
          setTestResult({ printerId: printer.id, status: 'success', message: 'Test print sent! Check the printer for output.' });
        } catch (zbpErr: any) {
          setTestResult({ printerId: printer.id, status: 'error', message: `Zebra Browser Print error: ${zbpErr.message}` });
        }
      } else {
        setTestResult({ printerId: printer.id, status: 'success', message: res.data.message || 'Test print sent to network printer.' });
      }
    } catch (err: any) {
      setTestResult({
        printerId: printer.id,
        status: 'error',
        message: err.response?.data?.error || err.message || 'Test print failed',
      });
    }
  };

  const checkPrinterStatus = async (printer: Printer) => {
    setTestResult({ printerId: printer.id, status: 'testing', message: 'Checking printer status...' });

    if (printer.connectionType === 'zebra_browser_print') {
      if (!zbpAvailable) {
        setTestResult({ printerId: printer.id, status: 'error', message: 'Zebra Browser Print not running. Cannot check status.' });
        return;
      }
      const status = await readPrinterStatus();
      if (status === 'Offline' || status === 'No printer found') {
        setTestResult({ printerId: printer.id, status: 'error', message: `Printer status: ${status}` });
      } else {
        setTestResult({ printerId: printer.id, status: 'success', message: `Printer status: ${status || 'Ready'}` });
      }
    } else if (printer.connectionType === 'network_tcp' && printer.ipAddress) {
      try {
        const res = await api.post(`/printers/${printer.id}/test`);
        setTestResult({ printerId: printer.id, status: 'success', message: res.data.message || 'Network printer reachable.' });
      } catch (err: any) {
        setTestResult({ printerId: printer.id, status: 'error', message: err.response?.data?.error || 'Network printer unreachable.' });
      }
    }
  };

  const setDefault = async (id: string) => {
    await api.post(`/printers/${id}/set-default`);
    fetchPrinters();
  };

  const deletePrinter = async (id: string) => {
    if (!confirm('Delete this printer?')) return;
    await api.delete(`/printers/${id}`);
    fetchPrinters();
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Printer Management</h1>
        <div className="flex gap-2">
          <button onClick={checkZbp} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
            Refresh Status
          </button>
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
            Add Printer
          </button>
        </div>
      </div>

      {/* Zebra Browser Print Status - Detailed */}
      <div className={`rounded-xl p-4 mb-4 border ${zbpChecking ? 'bg-gray-800 border-gray-700' : zbpAvailable ? 'bg-green-900/20 border-green-700/50' : 'bg-yellow-900/20 border-yellow-700/50'}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2.5 h-2.5 rounded-full ${zbpChecking ? 'bg-gray-400 animate-pulse' : zbpAvailable ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className={`text-sm font-medium ${zbpChecking ? 'text-gray-400' : zbpAvailable ? 'text-green-400' : 'text-yellow-400'}`}>
            {zbpChecking ? 'Checking Zebra Browser Print...' : zbpAvailable ? 'Zebra Browser Print Connected' : 'Zebra Browser Print Not Detected'}
          </span>
        </div>

        {zbpAvailable && zbpPrinter && (
          <div className="space-y-1 text-xs">
            <div className="flex gap-4">
              <span className="text-gray-400">Printer Name:</span>
              <span className="text-white">{zbpPrinter.name || 'Unknown'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-400">Connection:</span>
              <span className="text-white">{zbpPrinter.connection || 'USB'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-400">UID:</span>
              <span className="text-white font-mono">{zbpPrinter.uid || 'default'}</span>
            </div>
            {zbpStatus && (
              <div className="flex gap-4">
                <span className="text-gray-400">Status:</span>
                <span className="text-white">{zbpStatus}</span>
              </div>
            )}
          </div>
        )}

        {!zbpChecking && !zbpAvailable && (
          <div className="space-y-2 text-xs text-gray-400">
            <p>Zebra Browser Print is required for USB printer access. To set it up:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Download Zebra Browser Print from <span className="text-blue-400">zebra.com/software/printer-software/browser-print</span></li>
              <li>Install it on this PC (the one connected to the Zebra printer via USB)</li>
              <li>Ensure the Zebra printer is powered on and connected via USB</li>
              <li>Start the Zebra Browser Print service (it runs on port 9100)</li>
              <li>Click "Refresh Status" above to re-check</li>
            </ol>
            <p className="mt-2 text-gray-500">Alternatively, use a network TCP connection (port 9100) if the printer has an ethernet/wifi interface.</p>
          </div>
        )}

        {/* Discovered printers not yet added */}
        {discoveredPrinters.length > 0 && (
          <div className="mt-3 border-t border-gray-700/50 pt-3">
            <p className="text-xs text-gray-400 mb-2">Discovered USB printers:</p>
            {discoveredPrinters.map((dp, i) => {
              const alreadyAdded = printers.some(p => p.connectionType === 'zebra_browser_print' && p.printerModel === dp.name);
              return (
                <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded p-2 mb-1">
                  <span className="text-white text-sm">{dp.name || 'Zebra Printer'} ({dp.connection})</span>
                  {alreadyAdded ? (
                    <span className="text-gray-500 text-xs">Already added</span>
                  ) : (
                    <button
                      onClick={() => addDiscoveredPrinter(dp)}
                      className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs"
                    >
                      Add This Printer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4">
          <h2 className="text-white text-sm font-medium mb-3">Add Printer Manually</h2>
          <form onSubmit={addPrinter} className="grid grid-cols-2 gap-3">
            <input placeholder="Printer Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" required />
            <select value={form.connectionType} onChange={e => setForm({...form, connectionType: e.target.value})}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
              <option value="zebra_browser_print">Zebra Browser Print (USB)</option>
              <option value="network_tcp">Network TCP (Port 9100)</option>
            </select>
            {form.connectionType === 'network_tcp' && (
              <>
                <input placeholder="IP Address" value={form.ipAddress} onChange={e => setForm({...form, ipAddress: e.target.value})}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" required />
                <input type="number" placeholder="Port" value={form.port} onChange={e => setForm({...form, port: parseInt(e.target.value)})}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" />
              </>
            )}
            <select value={form.printerModel} onChange={e => setForm({...form, printerModel: e.target.value})}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
              <option value="Zebra GK420D">Zebra GK420D (203 DPI)</option>
              <option value="Zebra GK420T">Zebra GK420T (203 DPI)</option>
              <option value="Zebra ZD420">Zebra ZD420 (203 DPI)</option>
              <option value="Zebra ZD620">Zebra ZD620 (203 DPI)</option>
              <option value="Zebra ZT230">Zebra ZT230 (203 DPI)</option>
              <option value="Other">Other Zebra ZPL Printer</option>
            </select>
            <select value={form.dpi} onChange={e => setForm({...form, dpi: parseInt(e.target.value)})}>
              <option value={203}>203 DPI</option>
              <option value={300}>300 DPI</option>
              <option value={600}>600 DPI</option>
            </select>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Add</button>
            </div>
          </form>
        </div>
      )}

      {/* Printer list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {printers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No printers configured.</p>
            <p className="text-sm mt-1">
              {zbpAvailable && discoveredPrinters.length > 0
                ? 'Click "Add This Printer" above to add a discovered printer.'
                : 'Click "Add Printer" above to add one manually.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Name</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Type</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Address</th>
                <th className="text-left text-gray-400 text-xs uppercase px-4 py-3">Model</th>
                <th className="text-right text-gray-400 text-xs uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {printers.map(p => (
                <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-white text-sm">
                    {p.isDefault && <span className="text-yellow-400 mr-1">*</span>}
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{p.connectionType === 'zebra_browser_print' ? 'USB' : 'Network'}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm font-mono">{p.ipAddress ? `${p.ipAddress}:${p.port}` : 'Local USB'}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{p.printerModel}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => checkPrinterStatus(p)} className="text-green-400 hover:text-green-300 text-xs">Status</button>
                    <button onClick={() => testPrint(p)} className="text-blue-400 hover:text-blue-300 text-xs">Test Print</button>
                    {!p.isDefault && <button onClick={() => setDefault(p.id)} className="text-yellow-400 hover:text-yellow-300 text-xs">Set Default</button>}
                    <button onClick={() => deletePrinter(p.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </td>
                  {/* Test result inline */}
                  {testResult && testResult.printerId === p.id && (
                    <td colSpan={5} className="px-4 py-0">
                      {/* rendered in next row */}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <div className={`mt-3 rounded-lg p-3 border ${
          testResult.status === 'testing' ? 'bg-gray-800 border-gray-700' :
          testResult.status === 'success' ? 'bg-green-900/20 border-green-700/50' :
          'bg-red-900/20 border-red-700/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {testResult.status === 'testing' && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
              {testResult.status === 'success' && <div className="w-2 h-2 rounded-full bg-green-400" />}
              {testResult.status === 'error' && <div className="w-2 h-2 rounded-full bg-red-400" />}
              <span className={`text-sm ${
                testResult.status === 'testing' ? 'text-blue-400' :
                testResult.status === 'success' ? 'text-green-400' :
                'text-red-400'
              }`}>
                {testResult.message}
              </span>
            </div>
            <button onClick={() => setTestResult(null)} className="text-gray-500 hover:text-white text-xs">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
