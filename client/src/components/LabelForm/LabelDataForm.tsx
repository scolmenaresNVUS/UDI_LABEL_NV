import { useState, useEffect, useMemo } from 'react';
import { addYears, addMonths, addDays, format } from 'date-fns';
import { useProducts } from '../../hooks/useProducts';
import { validateGtin14 } from '../../utils/gtinValidator';
import { buildGS1ElementString, buildHriText, formatGS1Date } from '../../utils/gs1Encoder';
import type { GS1LabelData } from '../../types/gs1.types';
import type { Product } from '../../types/product.types';
import DataMatrixPreview from '../LabelPreview/DataMatrixPreview';
import HriTextPreview from '../LabelPreview/HriTextPreview';

function formatDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function autoLot(prefix: string, mfgDate: string): string {
  if (!prefix || !mfgDate) return '';
  const d = parseDate(mfgDate);
  return `${prefix}-${formatGS1Date(d)}`;
}

function calcExpiration(mfgDate: string, years: number, months: number, days: number): string {
  if (!mfgDate) return '';
  let d = parseDate(mfgDate);
  if (years > 0) d = addYears(d, years);
  if (months > 0) d = addMonths(d, months);
  if (days > 0) d = addDays(d, days);
  return formatDateInput(d);
}

export default function LabelDataForm() {
  const { products, loading, seedProducts } = useProducts();
  const [productId, setProductId] = useState<string>('');
  const [mfgDate, setMfgDate] = useState(formatDateInput(new Date()));
  const [expDate, setExpDate] = useState('');
  const [autoExp, setAutoExp] = useState(true);
  const [serial, setSerial] = useState('');
  const [lotOverride, setLotOverride] = useState('');
  const [labelSize, setLabelSize] = useState('25.4x25.4');
  const [labelW, labelH] = labelSize.split('x').map(Number);

  const product: Product | undefined = products.find(p => p.id === productId);
  const mode = product?.identifierMode || 'lot';
  const gtin = product?.gtin || '';
  const gtinValidation = gtin ? validateGtin14(gtin) : { valid: false, error: 'Select a product' };

  // Auto-select first product
  useEffect(() => {
    if (products.length > 0 && !productId) {
      setProductId(products[0].id);
    }
  }, [products, productId]);

  // When product changes, reset fields
  useEffect(() => {
    if (!product) return;
    setLotOverride('');
    if (product.identifierMode === 'serial') {
      const year = mfgDate ? mfgDate.split('-')[0] : '2026';
      setSerial(`${product.serialPrefix || ''}${year}-${product.serialStart || 0}`);
      if (autoExp && (product.shelfLifeYears > 0 || product.shelfLifeMonths > 0 || product.shelfLifeDays > 0)) {
        setExpDate(calcExpiration(mfgDate, product.shelfLifeYears, product.shelfLifeMonths, product.shelfLifeDays));
      }
    }
  }, [productId]);

  // Auto-recalculate expiration when mfg date changes
  useEffect(() => {
    if (mode === 'serial' && autoExp && product) {
      setExpDate(calcExpiration(mfgDate, product.shelfLifeYears, product.shelfLifeMonths, product.shelfLifeDays));
      const year = mfgDate ? mfgDate.split('-')[0] : '2026';
      setSerial(`${product.serialPrefix || ''}${year}-${product.serialStart || 0}`);
    }
  }, [mfgDate]);

  const autoLotNum = product?.lotPrefix ? autoLot(product.lotPrefix, mfgDate) : '';
  const lotNum = lotOverride || autoLotNum;

  const dataComplete = gtinValidation.valid &&
    (mode === 'lot' ? lotNum.length > 0 : serial.length > 0) &&
    mfgDate &&
    (mode === 'lot' || expDate);

  const labelData: GS1LabelData | null = dataComplete ? {
    gtin,
    identifierMode: mode,
    lotNumber: mode === 'lot' ? lotNum : undefined,
    serialNumber: mode === 'serial' ? serial : undefined,
    manufacturingDate: parseDate(mfgDate),
    expirationDate: mode === 'serial' && expDate ? parseDate(expDate) : undefined,
  } : null;

  const gs1String = useMemo(() => {
    if (!labelData) return '';
    try {
      return buildGS1ElementString(labelData);
    } catch {
      return '';
    }
  }, [labelData?.gtin, labelData?.identifierMode, labelData?.lotNumber, labelData?.serialNumber, mfgDate, expDate]);

  const hriLines = useMemo(() => {
    if (!labelData) return [];
    return buildHriText(labelData);
  }, [labelData?.gtin, labelData?.identifierMode, labelData?.lotNumber, labelData?.serialNumber, mfgDate, expDate]);

  const serialProducts = products.filter(p => p.identifierMode === 'serial');
  const lotProducts = products.filter(p => p.identifierMode === 'lot');

  if (loading) {
    return <div className="p-6 text-gray-400">Loading products...</div>;
  }

  if (products.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-white mb-4">Label Creator</h1>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
          <p className="text-gray-400 mb-4">No products found. Seed the default 39 products to get started.</p>
          <button onClick={seedProducts} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm">
            Seed Default Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Label Creator</h1>
          <p className="text-gray-400 text-sm">GS1 DataMatrix UDI Labels</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: FORM */}
        <div className="col-span-7 space-y-4">
          {/* Product selector */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Product</label>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            >
              <optgroup label="Serial Mode (with expiration)">
                {serialProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
              <optgroup label="Lot Mode (no expiration)">
                {lotProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            </select>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded ${mode === 'lot' ? 'bg-amber-600/20 text-amber-400' : 'bg-cyan-600/20 text-cyan-400'}`}>
                {mode === 'lot' ? 'LOT' : 'SERIAL'}
              </span>
              <span className="text-gray-500 text-xs font-mono">{gtin}</span>
              {gtinValidation.valid
                ? <span className="text-green-400 text-xs">Valid</span>
                : <span className="text-red-400 text-xs">{gtinValidation.error}</span>
              }
            </div>
          </div>

          {/* Lot / Serial */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            {mode === 'lot' ? (
              <>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">
                  Lot Number (AI 10) — Auto-generated
                </label>
                <input
                  value={lotOverride || autoLotNum}
                  onChange={e => setLotOverride(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-gray-500 text-xs">Format: {product?.lotPrefix}-YYMMDD</p>
                  {lotOverride && (
                    <button onClick={() => setLotOverride('')} className="text-blue-400 text-xs hover:underline">
                      Reset to auto
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">
                  Serial Number (AI 21)
                </label>
                <input
                  value={serial}
                  onChange={e => setSerial(e.target.value.slice(0, 20))}
                  maxLength={20}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Format: {product?.serialPrefix}{'{YYYY}'}-{'{N}'}
                </p>
              </>
            )}
          </div>

          {/* Dates */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className={`grid gap-4 ${mode === 'serial' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">
                  Manufacturing Date (AI 11)
                </label>
                <input
                  type="date"
                  value={mfgDate}
                  onChange={e => setMfgDate(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {mode === 'serial' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-400 text-xs uppercase tracking-wider">
                      Expiration (AI 17)
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <span className="text-gray-500 text-xs">
                        Auto {product?.shelfLifeYears}y
                      </span>
                      <div
                        onClick={() => setAutoExp(!autoExp)}
                        className={`w-8 h-4 rounded-full transition-colors flex items-center cursor-pointer ${autoExp ? 'bg-blue-600' : 'bg-gray-600'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform mx-0.5 ${autoExp ? 'translate-x-4' : ''}`} />
                      </div>
                    </label>
                  </div>
                  <input
                    type="date"
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    readOnly={autoExp}
                    className={`w-full border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${
                      autoExp ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-700 focus:border-blue-500'
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div className="col-span-5">
          <div className="bg-gray-800 rounded-xl border border-gray-700 sticky top-6">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-sm font-medium">Live Preview</h3>
                  <p className="text-gray-500 text-xs">{product?.name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${mode === 'lot' ? 'bg-amber-600/20 text-amber-400' : 'bg-cyan-600/20 text-cyan-400'}`}>
                  {mode === 'lot' ? 'LOT' : 'SERIAL'}
                </span>
              </div>
            </div>

            {/* Label size selector */}
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2">
                <label className="text-gray-400 text-xs">Label Size:</label>
                <select
                  value={labelSize}
                  onChange={e => setLabelSize(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs flex-1"
                >
                  <option value="25.4x25.4">1" x 1" (25.4 x 25.4 mm)</option>
                  <option value="50.8x25.4">2" x 1" (50.8 x 25.4 mm)</option>
                  <option value="38.1x19.05">1.5" x 0.75" (38.1 x 19.05 mm)</option>
                  <option value="76.2x50.8">3" x 2" (76.2 x 50.8 mm)</option>
                  <option value="50.8x50.8">2" x 2" (50.8 x 50.8 mm)</option>
                  <option value="101.6x50.8">4" x 2" (101.6 x 50.8 mm)</option>
                  <option value="101.6x76.2">4" x 3" (101.6 x 76.2 mm)</option>
                </select>
              </div>
            </div>

            {/* Label preview */}
            <div className="p-6 flex justify-center">
              {(() => {
                const scale = 5;
                const pw = labelW * scale;
                const ph = labelH * scale;
                const isCompact = labelW <= 30 || labelH <= 30;
                const dmSize = isCompact
                  ? Math.floor(Math.min(ph * 0.45, pw * 0.45))
                  : Math.floor(Math.min(ph * 0.7, pw * 0.4));
                const hriFontSize = isCompact
                  ? Math.max(5, Math.floor(Math.min(pw / 22, ph / 14)))
                  : Math.max(7, Math.floor(Math.min(pw / 18, ph / 10)));
                const displayLines = hriLines.length > 0 ? hriLines : (mode === 'lot'
                  ? [`(01) ${gtin}`, `(10) ${lotNum || '...'}`, `(11) ...`]
                  : [`(01) ${gtin}`, `(21) ${serial || '...'}`, '(11) ...', '(17) ...']);

                return (
                  <div
                    className="bg-white rounded shadow-lg relative overflow-hidden"
                    style={{ width: pw, height: ph, padding: Math.max(4, Math.floor(ph * 0.04)) }}
                  >
                    <div className={`w-full h-full flex ${isCompact ? 'flex-col items-center justify-center gap-1' : 'flex-row items-center gap-2'}`}>
                      <div className="flex-shrink-0">
                        <DataMatrixPreview gs1String={gs1String} size={dmSize} />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <HriTextPreview lines={displayLines} fontSize={hriFontSize} />
                      </div>
                    </div>
                    <div className="absolute bottom-0.5 right-1 text-gray-400" style={{ fontSize: Math.max(6, Math.floor(ph * 0.06)) }}>
                      {labelW} x {labelH} mm
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* GS1 string display */}
            <div className="px-4 pb-4 space-y-2">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">GS1 Element String:</p>
                <p className="font-mono text-xs text-green-400 break-all">
                  {gs1String || <span className="text-gray-500">Complete all fields</span>}
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">HRI Display Order:</p>
                <div className="font-mono text-xs text-blue-300">
                  {hriLines.length > 0 ? hriLines.map((line, i) => (
                    <p key={i}>{line}</p>
                  )) : (
                    <p className="text-gray-500">Complete all fields</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
