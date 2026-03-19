import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { checkZebraBrowserPrint, sendToZebraPrinter } from '../../services/zebraBrowserPrint';
import { buildGS1ElementString, buildHriText } from '../../utils/gs1Encoder';
import { exportLabelPng, exportLabelPdf } from '../../utils/labelExport';
import DataMatrixPreview from '../LabelPreview/DataMatrixPreview';
import HriTextPreview from '../LabelPreview/HriTextPreview';

interface Product {
  id: string;
  name: string;
  partNumber: string;
  gtin: string;
  identifierMode: 'lot' | 'serial';
  lotPrefix: string | null;
  serialPrefix: string | null;
  serialStart: number | null;
  shelfLifeYears: number;
  shelfLifeMonths: number;
  shelfLifeDays: number;
}

interface TemplateElement {
  id: string;
  type: 'datamatrix' | 'hri_text' | 'static_text' | 'line' | 'rectangle';
  x_mm: number;
  y_mm: number;
  moduleSize?: number;
  fontSize?: number;
  fontFamily?: string;
  lineSpacing?: number;
  text?: string;
  bold?: boolean;
  rotation: number;
  locked: boolean;
}

interface Template {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  isCurrent: boolean;
  elements: TemplateElement[];
}

interface Printer {
  id: string;
  name: string;
  connectionType: string;
  isDefault: boolean;
}

export default function BatchPrintPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [zbpAvailable, setZbpAvailable] = useState(false);
  const [zbpChecking, setZbpChecking] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState(new Date().toISOString().slice(0, 10));
  const [expirationDate, setExpirationDate] = useState('');
  const [totalLabels, setTotalLabels] = useState(1);
  const [copiesPerLabel, setCopiesPerLabel] = useState(1);

  // Serial mode
  const [serialStart, setSerialStart] = useState(1);
  const [serialCount, setSerialCount] = useState(1);

  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState('');
  const [exportDpi, setExportDpi] = useState(600);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data)).catch(() => {});
    api.get('/templates').then(r => {
      const current = (r.data as Template[]).filter(t => t.isCurrent);
      setTemplates(current);
      if (current.length > 0) {
        const square1x1 = current.find(t => t.widthMm === 25.4 && t.heightMm === 25.4);
        setTemplateId(square1x1 ? square1x1.id : current[0].id);
      }
    }).catch(() => {});
    api.get('/printers').then(r => {
      setPrinters(r.data);
      const def = (r.data as Printer[]).find(p => p.isDefault);
      if (def) setPrinterId(def.id);
    }).catch(() => {});
    setZbpChecking(true);
    checkZebraBrowserPrint().then(r => {
      setZbpAvailable(r.available);
      setZbpChecking(false);
    });
  }, []);

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId) || null;
    setSelectedProduct(product);
    if (product) {
      if (product.identifierMode === 'lot' && product.lotPrefix) {
        const d = new Date();
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setLotNumber(`${product.lotPrefix}-${yy}${mm}${dd}`);
      }
      if (product.identifierMode === 'serial') {
        const mfg = new Date(manufacturingDate);
        const exp = new Date(mfg);
        exp.setFullYear(exp.getFullYear() + product.shelfLifeYears);
        exp.setMonth(exp.getMonth() + product.shelfLifeMonths);
        exp.setDate(exp.getDate() + product.shelfLifeDays);
        setExpirationDate(exp.toISOString().slice(0, 10));
        if (product.serialStart != null) {
          setSerialStart(product.serialStart);
        }
      }
    }
  };

  const generateSerials = (): string[] => {
    if (!selectedProduct?.serialPrefix) return [];
    const prefix = selectedProduct.serialPrefix;
    const year = new Date().getFullYear().toString();
    const serials: string[] = [];
    for (let i = 0; i < serialCount; i++) {
      serials.push(`${prefix}${year}-${serialStart + i}`);
    }
    return serials;
  };

  // Build preview GS1 string and HRI for the first label
  const previewData = useMemo(() => {
    if (!selectedProduct) return { gs1String: '', hriLines: [] as string[] };

    try {
      const mfgDate = new Date(manufacturingDate + 'T00:00:00');
      const firstSerial = selectedProduct.identifierMode === 'serial' && selectedProduct.serialPrefix
        ? `${selectedProduct.serialPrefix}${new Date().getFullYear()}-${serialStart}`
        : undefined;

      const labelData = {
        gtin: selectedProduct.gtin,
        identifierMode: selectedProduct.identifierMode,
        lotNumber: selectedProduct.identifierMode === 'lot' ? lotNumber : undefined,
        serialNumber: firstSerial,
        manufacturingDate: mfgDate,
        expirationDate: selectedProduct.identifierMode === 'serial' && expirationDate
          ? new Date(expirationDate + 'T00:00:00')
          : undefined,
      };

      const gs1String = buildGS1ElementString(labelData);
      const hriLines = buildHriText(labelData);
      return { gs1String, hriLines };
    } catch {
      return { gs1String: '', hriLines: [] as string[] };
    }
  }, [selectedProduct, lotNumber, manufacturingDate, expirationDate, serialStart]);

  const selectedTemplate = templates.find(t => t.id === templateId);

  const handleExport = async (format: 'png' | 'pdf') => {
    if (!selectedProduct || !previewData.gs1String) {
      setError('Select a product with valid data before exporting.');
      return;
    }
    setError('');
    setExporting(true);
    try {
      const template = templates.find(t => t.id === templateId);
      const identifier = selectedProduct.identifierMode === 'lot'
        ? lotNumber
        : `${selectedProduct.serialPrefix}${new Date().getFullYear()}-${serialStart}`;
      const filename = `${selectedProduct.name}-${identifier}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      const opts = {
        gs1String: previewData.gs1String,
        hriLines: previewData.hriLines,
        labelWidthMm: template?.widthMm || 25.4,
        labelHeightMm: template?.heightMm || 25.4,
        elements: (template?.elements || []).map(e => ({
          type: e.type,
          x_mm: e.x_mm,
          y_mm: e.y_mm,
          moduleSize: e.moduleSize,
          fontSize: e.fontSize,
          lineSpacing: e.lineSpacing,
          text: e.text,
          bold: e.bold,
        })),
        dpi: exportDpi,
        filename,
      };

      if (format === 'png') {
        await exportLabelPng(opts);
      } else {
        await exportLabelPdf(opts);
      }
    } catch (err: any) {
      setError(err.message || `${format.toUpperCase()} export failed`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }
    if (!templateId) {
      setError('Please select a template. Go to Templates to create one first.');
      return;
    }

    // Check if printer requires ZBP and ZBP is not available
    const selectedPrinter = printers.find(p => p.id === printerId);
    if (selectedPrinter?.connectionType === 'zebra_browser_print' && !zbpAvailable) {
      setError('Zebra Browser Print is not running. Start it on this PC, or select a network printer / "Queue Only".');
      return;
    }

    setError('');
    setPrinting(true);
    setProgress({ current: 0, total: 0, status: 'Creating print job...' });

    try {
      const serialNumbers = selectedProduct.identifierMode === 'serial' ? generateSerials() : undefined;
      const total = selectedProduct.identifierMode === 'serial' ? serialCount : totalLabels;

      // Create print job
      const jobRes = await api.post('/print-jobs', {
        templateId,
        printerId,
        productId: selectedProduct.id,
        identifierMode: selectedProduct.identifierMode,
        gtin: selectedProduct.gtin,
        lotNumber: selectedProduct.identifierMode === 'lot' ? lotNumber : undefined,
        serialNumbers,
        manufacturingDate,
        expirationDate: selectedProduct.identifierMode === 'serial' ? expirationDate : undefined,
        totalLabels: total,
        copiesPerLabel,
      });

      const job = jobRes.data;
      setProgress({ current: 0, total: job.totalLabels, status: 'Sending to printer...' });

      if (!printerId) {
        // Queue only mode — no actual printing
        setProgress({ current: total, total, status: 'Queued! Go to Print Queue to print.' });
        setPrinting(false);
        return;
      }

      // Execute print
      const printRes = await api.post(`/print-jobs/${job.id}/print`);

      if (printRes.data.deliveryMethod === 'zebra_browser_print' && printRes.data.zpl) {
        // Chunked delivery for Zebra Browser Print
        const zplBlocks = printRes.data.zpl.split('^XZ')
          .filter((b: string) => b.trim())
          .map((b: string) => b.trim() + '^XZ');
        const chunkSize = 10;

        for (let i = 0; i < zplBlocks.length; i += chunkSize) {
          const chunk = zplBlocks.slice(i, i + chunkSize).join('\n');
          try {
            await sendToZebraPrinter(chunk);
          } catch (zbpErr: any) {
            // If ZBP send fails, mark the job as failed
            await api.post(`/print-jobs/${job.id}/fail`, {
              errorMessage: zbpErr.message || 'Zebra Browser Print send failed',
            }).catch(() => {});
            throw new Error(`Printer communication failed: ${zbpErr.message}. Is the printer connected and Zebra Browser Print running?`);
          }
          setProgress({
            current: Math.min(i + chunkSize, zplBlocks.length),
            total: zplBlocks.length,
            status: `Printing ${Math.min(i + chunkSize, zplBlocks.length)} of ${zplBlocks.length}...`,
          });
          if (i + chunkSize < zplBlocks.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        await api.post(`/print-jobs/${job.id}/complete`);
        setProgress({ current: zplBlocks.length, total: zplBlocks.length, status: 'Completed!' });
      } else {
        // Network printer — already sent server-side
        setProgress({ current: total, total, status: 'Completed!' });
      }

      if (selectedProduct.identifierMode === 'serial') {
        setSerialStart(serialStart + serialCount);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Print failed';
      setError(msg);
      setProgress(prev => ({ ...prev, status: 'Failed' }));
    } finally {
      setPrinting(false);
    }
  };

  const lotProducts = products.filter(p => p.identifierMode === 'lot');
  const serialProducts = products.filter(p => p.identifierMode === 'serial');

  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-xl font-bold text-white mb-6">Batch Print</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Configuration */}
        <div className="space-y-4">
          {/* Product Selection */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white text-sm font-medium mb-3">Product</h2>
            <select
              value={selectedProduct?.id || ''}
              onChange={e => handleProductChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">Select Product...</option>
              {serialProducts.length > 0 && (
                <optgroup label="Serial Products">
                  {serialProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.partNumber})</option>
                  ))}
                </optgroup>
              )}
              {lotProducts.length > 0 && (
                <optgroup label="Lot Products">
                  {lotProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.partNumber})</option>
                  ))}
                </optgroup>
              )}
            </select>

            {selectedProduct && (
              <div className="mt-2 text-xs text-gray-400">
                GTIN: {selectedProduct.gtin} | Mode: {selectedProduct.identifierMode.toUpperCase()}
              </div>
            )}
          </div>

          {/* Template & Printer */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white text-sm font-medium mb-3">Template & Printer</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Template</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                  {templates.length === 0 && <option value="">No templates — create one first</option>}
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.widthMm}x{t.heightMm}mm)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Printer</label>
                <select value={printerId} onChange={e => setPrinterId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                  <option value="">Queue Only (No Direct Print)</option>
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedTemplate && (
              <div className="mt-2 text-xs text-gray-500">
                Label: {selectedTemplate.widthMm} x {selectedTemplate.heightMm} mm
              </div>
            )}
          </div>

          {/* Label Data */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white text-sm font-medium mb-3">Label Data</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Manufacturing Date</label>
                <input type="date" value={manufacturingDate}
                  onChange={e => setManufacturingDate(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
              </div>

              {selectedProduct?.identifierMode === 'lot' && (
                <>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Lot Number</label>
                    <input value={lotNumber} onChange={e => setLotNumber(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Number of Labels</label>
                    <input type="number" min={1} max={500} value={totalLabels}
                      onChange={e => setTotalLabels(parseInt(e.target.value) || 1)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                  </div>
                </>
              )}

              {selectedProduct?.identifierMode === 'serial' && (
                <>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Expiration Date</label>
                    <input type="date" value={expirationDate}
                      onChange={e => setExpirationDate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Serial Start</label>
                      <input type="number" min={1} value={serialStart}
                        onChange={e => setSerialStart(parseInt(e.target.value) || 1)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Count</label>
                      <input type="number" min={1} max={500} value={serialCount}
                        onChange={e => setSerialCount(parseInt(e.target.value) || 1)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Serials: {selectedProduct.serialPrefix}{new Date().getFullYear()}-{serialStart} to {selectedProduct.serialPrefix}{new Date().getFullYear()}-{serialStart + serialCount - 1}
                  </div>
                </>
              )}

              <div>
                <label className="block text-gray-400 text-xs mb-1">Copies Per Label</label>
                <input type="number" min={1} max={10} value={copiesPerLabel}
                  onChange={e => setCopiesPerLabel(parseInt(e.target.value) || 1)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview & Actions */}
        <div className="space-y-4">
          {/* Printer Status */}
          <div className={`rounded-lg p-3 border ${zbpChecking ? 'bg-gray-800 border-gray-700' : zbpAvailable ? 'bg-green-900/20 border-green-700/50' : 'bg-yellow-900/20 border-yellow-700/50'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${zbpChecking ? 'bg-gray-400 animate-pulse' : zbpAvailable ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className={`text-sm ${zbpChecking ? 'text-gray-400' : zbpAvailable ? 'text-green-400' : 'text-yellow-400'}`}>
                {zbpChecking ? 'Checking printer...' : zbpAvailable ? 'Zebra Browser Print connected' : 'Zebra Browser Print not detected'}
              </span>
            </div>
            {!zbpChecking && !zbpAvailable && (
              <p className="text-gray-400 text-xs mt-1">
                USB printing requires Zebra Browser Print. Use "Queue Only" or a network printer.
              </p>
            )}
          </div>

          {/* Label Preview Image */}
          {selectedProduct && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-white text-sm font-medium mb-3">Label Preview</h2>
              <div className="flex justify-center">
                {(() => {
                  const tw = selectedTemplate?.widthMm || 25.4;
                  const th = selectedTemplate?.heightMm || 25.4;
                  const elements = selectedTemplate?.elements || [];
                  const scale = 5;
                  const pw = tw * scale;
                  const ph = th * scale;

                  const dmEl = elements.find(e => e.type === 'datamatrix');
                  const hriEl = elements.find(e => e.type === 'hri_text');

                  // DataMatrix size from moduleSize (each module ~moduleSize*0.75mm rendered)
                  const dmModuleSize = dmEl?.moduleSize || 3;
                  const dmSize = Math.floor(dmModuleSize * 10 * scale / 4);

                  const hriFontSize = hriEl?.fontSize
                    ? Math.max(5, Math.floor(hriEl.fontSize * scale / 3.5))
                    : Math.max(5, Math.floor(Math.min(pw / 22, ph / 14)));

                  const displayLines = previewData.hriLines.length > 0 ? previewData.hriLines : (
                    selectedProduct.identifierMode === 'lot'
                      ? [`(01) ${selectedProduct.gtin}`, `(10) ${lotNumber || '...'}`, '(11) ...']
                      : [`(01) ${selectedProduct.gtin}`, '(21) ...', '(11) ...', '(17) ...']);

                  return (
                    <div
                      className="bg-white rounded shadow-lg relative overflow-hidden"
                      style={{ width: pw, height: ph }}
                    >
                      {dmEl && (
                        <div className="absolute" style={{ left: dmEl.x_mm * scale, top: dmEl.y_mm * scale }}>
                          <DataMatrixPreview gs1String={previewData.gs1String} size={dmSize} />
                        </div>
                      )}
                      {hriEl && (
                        <div className="absolute" style={{ left: hriEl.x_mm * scale, top: hriEl.y_mm * scale }}>
                          <HriTextPreview lines={displayLines} fontSize={hriFontSize} />
                        </div>
                      )}
                      {!dmEl && !hriEl && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <DataMatrixPreview gs1String={previewData.gs1String} size={dmSize} />
                          <HriTextPreview lines={displayLines} fontSize={hriFontSize} />
                        </div>
                      )}
                      <div className="absolute bottom-0.5 right-1 text-gray-400" style={{ fontSize: Math.max(6, Math.floor(ph * 0.06)) }}>
                        {tw} x {th} mm
                      </div>
                    </div>
                  );
                })()}
              </div>
              {selectedTemplate && (
                <div className="text-center mt-2 text-xs text-gray-500">
                  {selectedTemplate.name}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white text-sm font-medium mb-3">Print Summary</h2>
            {selectedProduct ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Product:</span>
                  <span className="text-white">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Mode:</span>
                  <span className={`font-medium ${selectedProduct.identifierMode === 'serial' ? 'text-purple-400' : 'text-blue-400'}`}>
                    {selectedProduct.identifierMode.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Labels:</span>
                  <span className="text-white">{selectedProduct.identifierMode === 'serial' ? serialCount : totalLabels}</span>
                </div>
                {selectedProduct.identifierMode === 'lot' && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lot:</span>
                    <span className="text-white font-mono">{lotNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Copies Each:</span>
                  <span className="text-white">{copiesPerLabel}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between">
                  <span className="text-gray-400">Total Prints:</span>
                  <span className="text-white font-bold">
                    {(selectedProduct.identifierMode === 'serial' ? serialCount : totalLabels) * copiesPerLabel}
                  </span>
                </div>

                {selectedProduct.identifierMode === 'lot' && (
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded p-2 mt-2">
                    <span className="text-blue-400 text-xs">LOT mode: No expiration date will be encoded</span>
                  </div>
                )}
                {selectedProduct.identifierMode === 'serial' && (
                  <div className="bg-purple-900/20 border border-purple-700/50 rounded p-2 mt-2">
                    <span className="text-purple-400 text-xs">SERIAL mode: Expiration date {expirationDate} will be encoded</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Select a product to see summary</p>
            )}
          </div>

          {/* Progress */}
          {(printing || progress.status) && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-white text-sm font-medium mb-3">Progress</h2>
              {progress.total > 0 && (
                <div className="mb-2">
                  <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress.status.includes('Completed') ? 'bg-green-500' : progress.status === 'Failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <span>{progress.current} / {progress.total}</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                </div>
              )}
              <p className={`text-sm ${progress.status.includes('Completed') || progress.status.includes('Queued') ? 'text-green-400' : progress.status === 'Failed' ? 'text-red-400' : 'text-gray-300'}`}>
                {progress.status}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Print Button */}
          <button
            onClick={handlePrint}
            disabled={printing || !selectedProduct || !templateId}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl text-sm font-medium transition-colors"
          >
            {printing ? 'Printing...' : printerId ? 'Print Labels' : 'Queue Labels'}
          </button>

          {/* Save / Export */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white text-sm font-medium mb-3">Save Label</h2>
            <div className="mb-3">
              <label className="block text-gray-400 text-xs mb-1">Quality (DPI)</label>
              <select
                value={exportDpi}
                onChange={e => setExportDpi(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              >
                <option value={300}>300 DPI — Fast</option>
                <option value={600}>600 DPI — High Quality (Recommended)</option>
                <option value={1200}>1200 DPI — Maximum Quality</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleExport('png')}
                disabled={exporting || !selectedProduct || !previewData.gs1String}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {exporting ? 'Exporting...' : 'Save PNG'}
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting || !selectedProduct || !previewData.gs1String}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {exporting ? 'Exporting...' : 'Save PDF'}
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Saves the first label preview as a high-resolution file.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
