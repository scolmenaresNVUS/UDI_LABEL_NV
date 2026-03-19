import { useState, useEffect, useRef } from "react";

// ============ BWIP-JS LOADER ============
function useScript(src) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.bwipjs) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, [src]);
  return loaded;
}

// ============ GS1 HELPERS ============
function formatGS1Date(dateStr) {
  if (!dateStr) return "";
  return dateStr.replace(/-/g, "").slice(2);
}

function buildGS1String(mode, gtin, lot, serial, mfg, exp) {
  const mfgF = formatGS1Date(mfg);
  if (mode === "lot") return `(01)${gtin}(11)${mfgF}(10)${lot}`;
  const expF = formatGS1Date(exp);
  return `(01)${gtin}(17)${expF}(11)${mfgF}(21)${serial}`;
}

function validateGtin(gtin) {
  if (gtin.length !== 14) return { valid: false, error: "Must be 14 digits" };
  if (!/^\d+$/.test(gtin)) return { valid: false, error: "Digits only" };
  const d = gtin.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += d[i] * ((i % 2 === 0) ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  if (check !== d[13]) return { valid: false, error: `Invalid check digit (expected ${check})` };
  return { valid: true };
}

function addYears(dateStr, years) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}

function autoLot(prefix, mfgDate) {
  if (!prefix || !mfgDate) return "";
  return `${prefix}-${formatGS1Date(mfgDate)}`;
}

// ============ DATAMATRIX CANVAS ============
function DataMatrixCanvas({ gs1String, size = 120, onError }) {
  const ref = useRef(null);
  const ready = useScript("https://cdnjs.cloudflare.com/ajax/libs/bwip-js/4.5.1/bwip-js.min.js");
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!ready || !ref.current || !gs1String) return;
    try {
      window.bwipjs.toCanvas(ref.current, { bcid: "gs1datamatrix", text: gs1String, scale: 3, padding: 2, parsefnc: true });
      setErr(null); onError?.(null);
    } catch (e) { setErr(e.message); onError?.(e.message); }
  }, [ready, gs1String, size]);
  if (!ready) return <div className="flex items-center justify-center" style={{width:size,height:size}}><span className="text-gray-500 text-xs">Loading...</span></div>;
  if (err) return <div className="flex items-center justify-center bg-red-900/20 border border-red-700/30 rounded" style={{width:size,height:size}}><span className="text-red-400 text-xs text-center px-2">{err}</span></div>;
  return <canvas ref={ref} style={{maxWidth:size,maxHeight:size,width:"auto",height:"auto"}} />;
}

// ============ PRODUCT CATALOG ============
const PRODUCTS = [
  // SERIAL MODE — BWIII family
  { id:"p1", name:"PV2010E - BWIII Basics", gtin:"00850008393174", part:"PV2010E", mode:"serial", serialPrefix:"BWIII", serialStart:3000, lotPrefix:null, shelfYears:7 },
  { id:"p2", name:"PV2006E - BWIII EEG", gtin:"00850008393181", part:"PV2006E", mode:"serial", serialPrefix:"BWIII", serialStart:3000, lotPrefix:null, shelfYears:7 },
  { id:"p3", name:"PV2007E - BWIII EEG Plus", gtin:"00850008393198", part:"PV2007E", mode:"serial", serialPrefix:"BWIII", serialStart:3000, lotPrefix:null, shelfYears:7 },
  { id:"p4", name:"PV2008E - BWIII PSG", gtin:"00850008393204", part:"PV2008E", mode:"serial", serialPrefix:"BWIII", serialStart:3000, lotPrefix:null, shelfYears:7 },
  { id:"p5", name:"PV2009E - BWIII PSG Plus", gtin:"00850008393211", part:"PV2009E", mode:"serial", serialPrefix:"BWIII", serialStart:3000, lotPrefix:null, shelfYears:7 },
  // SERIAL MODE — BWMini family
  { id:"p6", name:"PV2310 - BWMini EEG", gtin:"00850008393235", part:"PV2310", mode:"serial", serialPrefix:"BWM", serialStart:3000, lotPrefix:null, shelfYears:7 },
  { id:"p7", name:"PV2312 - BWMini HST", gtin:"00850008393242", part:"PV2312", mode:"serial", serialPrefix:"BWM", serialStart:3000, lotPrefix:null, shelfYears:7 },
  { id:"p8", name:"SI1842 - BWMini HST Compass", gtin:"00850008393259", part:"SI1842", mode:"serial", serialPrefix:"BWM", serialStart:3000, lotPrefix:null, shelfYears:7 },
  { id:"p9", name:"PV2311 - BWMini PSG", gtin:"00850008393228", part:"PV2311", mode:"serial", serialPrefix:"BWM", serialStart:3000, lotPrefix:null, shelfYears:7 },
  // LOT MODE — Gold Electrodes
  { id:"p10", name:"PV1010-33CI - Maxxi Gold Electrode 48\"", gtin:"00850008393044", part:"PV1010-33CI", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MG48CI", shelfYears:0 },
  { id:"p11", name:"PV1010-13CI - Maxxi Gold Electrode 60\"", gtin:"00867975000295", part:"PV1010-13CI", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MG60CI", shelfYears:0 },
  { id:"p12", name:"PV1010-23CI - Maxxi Gold Electrode 96\"", gtin:"00850008393006", part:"PV1010-23CI", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MG96CI", shelfYears:0 },
  // LOT MODE — Snap Electrodes
  { id:"p13", name:"SI1872 - Maxxi Gold Snap Electrode 48\"", gtin:"00850008393037", part:"SI1872", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MS48CI", shelfYears:0 },
  { id:"p14", name:"SI1873 - Maxxi Gold Snap Electrode 60\"", gtin:"00850008393020", part:"SI1873", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MS60CI", shelfYears:0 },
  { id:"p15", name:"SI1778B - Maxxi Gold Snap Electrode 96\"", gtin:"00850008393013", part:"SI1778B", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MS96CI", shelfYears:0 },
  // LOT MODE — AgCl Electrodes
  { id:"p16", name:"SI2036 - Maxxi Gold AgCl Electrode 60\" Disposable", gtin:"00850008393303", part:"SI2036", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MA60CI", shelfYears:0 },
  { id:"p17", name:"SI2137 - Maxxi Gold AgCl Electrode 60\" Reusable", gtin:"00850008393358", part:"SI2137", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MAR60CI", shelfYears:0 },
  { id:"p18", name:"SI2037 - Maxxi Gold AgCl Electrode 96\" Disposable", gtin:"00850008393365", part:"SI2037", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MA96CI", shelfYears:0 },
  { id:"p19", name:"SI2138 - Maxxi Gold AgCl Electrode 96\" Reusable", gtin:"00850008393310", part:"SI2138", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MAR96CI", shelfYears:0 },
  // LOT MODE — Flow Sensors
  { id:"p20", name:"SI1775B - Maxxi Flow Sensor 3ft Key Connector", gtin:"00850008393341", part:"SI1775B", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MF3KCI", shelfYears:0 },
  { id:"p21", name:"SI1776B - Maxxi Flow Sensor 7ft Key Connector", gtin:"00850008393334", part:"SI1776B", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MF7KCI", shelfYears:0 },
  { id:"p22", name:"SI1486C - Maxxi Flow Sensor 7ft TP Connector", gtin:"00850008393327", part:"SI1486C", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MF7SCI", shelfYears:0 },
  // LOT MODE — Position Sensors (shared GTIN)
  { id:"p23", name:"SI1247U - Maxxi Position Sensor AC 1.0", gtin:"00850008393297", part:"SI1247U", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MP", shelfYears:0 },
  { id:"p24", name:"SI1247A - Maxxi Position Sensor AC 1.1", gtin:"00850008393297", part:"SI1247A", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MPAC", shelfYears:0 },
  { id:"p25", name:"SI1247D - Maxxi Position Sensor DC", gtin:"00850008393297", part:"SI1247D", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MPDC", shelfYears:0 },
  // LOT MODE — RIP
  { id:"p26", name:"SI2121 - Maxxi RIP Abdomen Interface 3ft", gtin:"00850008393136", part:"SI2121", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"IA3", shelfYears:0 },
  { id:"p27", name:"SI2124 - Maxxi RIP Abdomen Interface 7ft", gtin:"00850008393143", part:"SI2124", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"IA7", shelfYears:0 },
  { id:"p28", name:"SI1659 - Maxxi RIP Adjustable Inductive Belt", gtin:"00850008393105", part:"SI1659", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"AB", shelfYears:0 },
  { id:"p29", name:"SI1660 - Maxxi RIP Infant Inductive Belt", gtin:"00850008393051", part:"SI1660", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"IB", shelfYears:0 },
  { id:"p30", name:"SI1693 - Maxxi RIP Large Inductive Belt", gtin:"00850008393075", part:"SI1693", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"LB", shelfYears:0 },
  { id:"p31", name:"SI1665 - Maxxi RIP Pediatric Inductive Belt", gtin:"00850008393068", part:"SI1665", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"PB", shelfYears:0 },
  { id:"p32", name:"SI2125 - Maxxi RIP Thorax Interface 3ft", gtin:"00850008393129", part:"SI2125", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"IT3", shelfYears:0 },
  { id:"p33", name:"SI2123 - Maxxi RIP Thorax Interface 7ft", gtin:"00850008393112", part:"SI2123", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"IT7", shelfYears:0 },
  { id:"p34", name:"SI1694 - Maxxi RIP X-Large Inductive Belt", gtin:"00850008393082", part:"SI1694", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"XLB", shelfYears:0 },
  { id:"p35", name:"SI1662 - Maxxi RIP XX-Large Inductive Belt", gtin:"00850008393099", part:"SI1662", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"XXLB", shelfYears:0 },
  // LOT MODE — Snore
  { id:"p36", name:"SI1866B - Maxxi Snore 2ft Key Connector", gtin:"00850008393266", part:"SI1866B", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MS2K", shelfYears:0 },
  { id:"p37", name:"SI1784B - Maxxi Snore 7ft Key Connector", gtin:"00850008393273", part:"SI1784B", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MS7K", shelfYears:0 },
  { id:"p38", name:"SI1487B - Maxxi Snore 7ft TP Connector", gtin:"00850008393280", part:"SI1487B", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MS7S", shelfYears:0 },
  // LOT MODE — Cannula
  { id:"p39", name:"SI1058 - Maxxi Cannula 7ft Adult Nasal/Oral", gtin:"00850008393389", part:"SI1058", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MCANO7", shelfYears:0 },
  { id:"p40", name:"SI1057 - Maxxi Cannula 7ft Nasal", gtin:"00850008393396", part:"SI1057", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MCAN7", shelfYears:0 },
  { id:"p41", name:"SI1195 - Maxxi Cannula 2ft Nasal", gtin:"00850008393372", part:"SI1195", mode:"lot", serialPrefix:null, serialStart:null, lotPrefix:"MCAN2", shelfYears:0 },
];

const TEMPLATES = [
  { id:"std", name:'Standard 2"×1"', wMm:50.8, hMm:25.4, wLabel:"50.8mm × 25.4mm" },
  { id:"sm", name:'Small 1.5"×0.75"', wMm:38.1, hMm:19.05, wLabel:"38.1mm × 19.05mm" },
  { id:"sq", name:'Square 1"×1"', wMm:25.4, hMm:25.4, wLabel:"25.4mm × 25.4mm" },
  { id:"sq2", name:'Square 2"×2"', wMm:50.8, hMm:50.8, wLabel:"50.8mm × 50.8mm" },
  { id:"lg", name:'Large 3"×2"', wMm:76.2, hMm:50.8, wLabel:"76.2mm × 50.8mm" },
];

// ============ LAYOUT ENGINE ============
function computeLayout(wMm, hMm, scale) {
  const isSquare = Math.abs(wMm - hMm) < 1;
  const minDim = Math.min(wMm, hMm);
  const maxDim = Math.max(wMm, hMm);
  let dmFrac = isSquare ? 0.45 : wMm/hMm > 1.8 ? 0.35 : 0.40;
  let dmMm = Math.min(minDim * 0.85, maxDim * dmFrac) * scale;
  dmMm = Math.max(6, Math.min(dmMm, minDim * 0.9));
  const area = wMm * hMm;
  let fontMm = area < 500 ? 1.2 : area < 1000 ? 1.6 : area < 2000 ? 2.0 : 2.4;
  fontMm *= Math.min(scale, 1.5);
  fontMm = Math.max(0.8, Math.min(fontMm, 4));
  const useStack = isSquare || hMm > wMm || wMm < 35 || (wMm - dmMm - 3 < 18);
  return { dmMm, fontMm, stacked: useStack };
}

// ============ LABEL CREATOR PAGE ============
function LabelCreatorPage() {
  const [prodId, setProdId] = useState("p12"); // Gold Electrode 96"
  const [mfg, setMfg] = useState("2026-02-18");
  const [exp, setExp] = useState("2033-02-18");
  const [autoExp, setAutoExp] = useState(true);
  const [serial, setSerial] = useState("BWIII2026-3000");
  const [lotOverride, setLotOverride] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchEnd, setBatchEnd] = useState("3049");
  const [tplId, setTplId] = useState("sq");
  const [labelScale, setLabelScale] = useState(1.0);
  const [hriAlign, setHriAlign] = useState("left");
  const [encErr, setEncErr] = useState(null);

  const prod = PRODUCTS.find(p => p.id === prodId) || PRODUCTS[0];
  const mode = prod.mode;
  const tpl = TEMPLATES.find(t => t.id === tplId) || TEMPLATES[0];
  const gtin = prod.gtin;
  const gv = validateGtin(gtin);

  // Auto-generate lot number from product prefix + mfg date
  const autoLotNum = prod.lotPrefix ? autoLot(prod.lotPrefix, mfg) : "";
  const lotNum = lotOverride || autoLotNum;

  // Auto serial prefix
  const mfgYear = mfg ? mfg.split("-")[0] : "2026";
  const autoSerialBase = prod.serialPrefix ? `${prod.serialPrefix}${mfgYear}-` : "";
  const autoSerialStart = prod.serialStart || 0;

  // When product changes, reset relevant fields
  useEffect(() => {
    setLotOverride("");
    if (prod.mode === "serial") {
      setSerial(`${prod.serialPrefix || ""}${mfgYear}-${prod.serialStart || 0}`);
      setBatchEnd(String((prod.serialStart || 0) + 49));
      if (prod.shelfYears > 0 && mfg) setExp(addYears(mfg, prod.shelfYears));
    }
  }, [prodId]);

  useEffect(() => {
    if (mode === "serial" && autoExp && prod.shelfYears > 0 && mfg) {
      setExp(addYears(mfg, prod.shelfYears));
    }
    if (mode === "serial") {
      setSerial(`${autoSerialBase}${autoSerialStart}`);
      setBatchEnd(String(autoSerialStart + 49));
    }
  }, [mfg]);

  const curSerial = batchMode ? `${autoSerialBase}${autoSerialStart}` : serial;
  const identifier = mode === "lot" ? lotNum : curSerial;
  const dataComplete = gv.valid && identifier.length > 0 && mfg && (mode === "lot" || exp);
  const gs1Str = dataComplete ? buildGS1String(mode, gtin, lotNum, curSerial, mfg, mode === "serial" ? exp : null) : "";

  const lo = computeLayout(tpl.wMm, tpl.hMm, labelScale);
  const maxPW = 340, maxPH = 280;
  const ds = Math.min(maxPW / tpl.wMm, maxPH / tpl.hMm);
  const pW = Math.round(tpl.wMm * ds), pH = Math.round(tpl.hMm * ds);
  const dmPx = Math.round(lo.dmMm * ds);
  const fPx = Math.max(7, Math.round(lo.fontMm * ds));
  const pad = Math.max(4, Math.round(ds * 1));
  const ac = hriAlign === "center" ? "text-center" : hriAlign === "right" ? "text-right" : "text-left";

  const Hri = () => (
    <div className={`font-mono text-gray-900 ${ac}`} style={{ fontSize: fPx, lineHeight: 1.5 }}>
      <p className="font-bold truncate">(01) {gtin}</p>
      {mode === "lot" ? <>
        <p className="truncate">(10) {lotNum || "—"}</p>
        <p className="truncate">(11) {formatGS1Date(mfg) || "—"}</p>
      </> : <>
        <p className="truncate">(21) {curSerial || "—"}</p>
        <p className="truncate">(11) {formatGS1Date(mfg) || "—"}</p>
        <p className="truncate">(17) {formatGS1Date(exp) || "—"}</p>
      </>}
    </div>
  );

  const Dm = () => dataComplete
    ? <DataMatrixCanvas gs1String={gs1Str} size={dmPx} onError={setEncErr} />
    : <div className="bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-400" style={{ width: dmPx, height: dmPx, fontSize: Math.max(8, dmPx * 0.12) }}>Enter data</div>;

  const serialProds = PRODUCTS.filter(p => p.mode === "serial");
  const lotProds = PRODUCTS.filter(p => p.mode === "lot");

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-xl font-bold text-white">Label Creator</h1><p className="text-gray-400 text-sm">GS1 DataMatrix UDI Labels</p></div>
          <div className="flex gap-2">
            <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">🔍 Preview</button>
            <button className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm">🖨️ Print</button>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-4">
            {/* Product selector */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Product</label>
              <select value={prodId} onChange={e => setProdId(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                <optgroup label="Serial Mode (with expiration)">
                  {serialProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Lot Mode (no expiration)">
                  {lotProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              </select>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${mode === "lot" ? "bg-amber-600/20 text-amber-400" : "bg-cyan-600/20 text-cyan-400"}`}>{mode === "lot" ? "LOT" : "SERIAL"}</span>
                <span className="text-gray-500 text-xs font-mono">{gtin}</span>
                {gv.valid ? <span className="text-green-400 text-xs">✔ Valid</span> : <span className="text-red-400 text-xs">✗ {gv.error}</span>}
              </div>
            </div>

            {/* Template */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Template</label>
              <select value={tplId} onChange={e => setTplId(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name} ({t.wLabel})</option>)}
              </select>
            </div>

            {/* Lot / Serial */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              {mode === "lot" ? (
                <>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Lot Number (AI 10) — Auto-generated</label>
                  <input value={lotOverride || autoLotNum} onChange={e => setLotOverride(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" />
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-500 text-xs">Format: {prod.lotPrefix}-YYMMDD</p>
                    {lotOverride && <button onClick={() => setLotOverride("")} className="text-blue-400 text-xs hover:underline">Reset to auto</button>}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-400 text-xs uppercase tracking-wider">Serial Number (AI 21)</label>
                    <label className="flex items-center gap-2 cursor-pointer"><span className="text-gray-400 text-xs">Batch</span>
                      <div onClick={() => setBatchMode(!batchMode)} className={`w-9 h-5 rounded-full transition-colors flex items-center ${batchMode ? "bg-blue-600" : "bg-gray-600"}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${batchMode ? "translate-x-4" : ""}`} /></div>
                    </label>
                  </div>
                  {!batchMode ? (
                    <>
                      <input value={serial} onChange={e => setSerial(e.target.value.slice(0, 20))} maxLength={20} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" />
                      <p className="text-gray-500 text-xs mt-1">Format: {prod.serialPrefix}{"{YYYY}"}-{"{N}"}</p>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="text-gray-500 text-xs block mb-1">Prefix</label><input value={autoSerialBase} className="w-full bg-gray-600 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono cursor-not-allowed" readOnly /></div>
                        <div><label className="text-gray-500 text-xs block mb-1">Start</label><input value={autoSerialStart} onChange={e => {/* would update state in real app */}} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" /></div>
                        <div><label className="text-gray-500 text-xs block mb-1">End</label><input value={batchEnd} onChange={e => setBatchEnd(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" /></div>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2"><span className="text-gray-400 text-xs">Preview</span><span className="text-blue-400 text-xs font-medium">{Math.max(0, parseInt(batchEnd || 0) - autoSerialStart + 1)} labels</span></div>
                        <div className="font-mono text-xs text-gray-300 space-y-0.5">
                          <p>{autoSerialBase}{autoSerialStart}</p>
                          <p>{autoSerialBase}{autoSerialStart + 1}</p>
                          <p>{autoSerialBase}{autoSerialStart + 2}</p>
                          <p className="text-gray-500">⋮</p>
                          <p>{autoSerialBase}{batchEnd}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dates */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className={`grid gap-4 ${mode === "serial" ? "grid-cols-2" : "grid-cols-1"}`}>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Manufacturing Date (AI 11)</label>
                  <input type="date" value={mfg} onChange={e => setMfg(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                {mode === "serial" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-gray-400 text-xs uppercase tracking-wider">Expiration (AI 17)</label>
                      <label className="flex items-center gap-1 cursor-pointer"><span className="text-gray-500 text-xs">Auto {prod.shelfYears}y</span>
                        <div onClick={() => setAutoExp(!autoExp)} className={`w-8 h-4 rounded-full transition-colors flex items-center ${autoExp ? "bg-blue-600" : "bg-gray-600"}`}><div className={`w-3 h-3 bg-white rounded-full shadow transition-transform mx-0.5 ${autoExp ? "translate-x-4" : ""}`} /></div>
                      </label>
                    </div>
                    <input type="date" value={exp} onChange={e => setExp(e.target.value)} className={`w-full border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${autoExp ? "bg-gray-600 cursor-not-allowed" : "bg-gray-700 focus:border-blue-500"}`} readOnly={autoExp} />
                  </div>
                )}
              </div>
            </div>

            {/* Export */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex gap-2">
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex-1">📄 PDF</button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex-1">🖼️ PNG</button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex-1">⬇️ ZPL</button>
            </div>
          </div>

          {/* RIGHT: PREVIEW */}
          <div className="col-span-5">
            <div className="bg-gray-800 rounded-xl border border-gray-700 sticky top-6">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-white text-sm font-medium">Live Preview</h3><p className="text-gray-500 text-xs">{prod.name} • {tpl.name}</p></div>
                  <span className={`text-xs px-2 py-0.5 rounded ${mode === "lot" ? "bg-amber-600/20 text-amber-400" : "bg-cyan-600/20 text-cyan-400"}`}>{mode === "lot" ? "LOT" : "SERIAL"}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="px-4 pt-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Size</span>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={labelScale} onChange={e => setLabelScale(parseFloat(e.target.value))} className="w-20 h-1 accent-blue-500" />
                  <span className="text-gray-400 text-xs w-8">{Math.round(labelScale * 100)}%</span>
                </div>
                <div className="w-px h-4 bg-gray-700" />
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-xs mr-1">Align</span>
                  {[["left", "≡←"], ["center", "≡"], ["right", "≡→"]].map(([a, icon]) => (
                    <button key={a} onClick={() => setHriAlign(a)} className={`w-7 h-6 rounded text-xs flex items-center justify-center ${hriAlign === a ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}>{icon}</button>
                  ))}
                </div>
              </div>

              {/* Label */}
              <div className="p-6 flex justify-center">
                <div className="relative">
                  <div className="bg-white rounded shadow-lg overflow-hidden" style={{ width: pW, height: pH, padding: pad }}>
                    {lo.stacked ? (
                      <div className="flex flex-col items-center justify-center w-full h-full" style={{ gap: Math.max(2, pad / 2) }}>
                        <div className="flex-shrink-0"><Dm /></div>
                        <div className="w-full overflow-hidden flex-shrink-0" style={{ maxWidth: pW - pad * 2 }}><Hri /></div>
                      </div>
                    ) : (
                      <div className="flex items-center w-full h-full" style={{ gap: Math.max(4, pad) }}>
                        <div className="flex-shrink-0"><Dm /></div>
                        <div className="flex-1 min-w-0 overflow-hidden"><Hri /></div>
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-5 left-0 right-0 text-center text-gray-500 text-xs">{tpl.wLabel.split("×")[0].trim()}</div>
                  <div className="absolute -right-8 top-0 bottom-0 flex items-center"><span className="text-gray-500 text-xs -rotate-90 whitespace-nowrap">{tpl.wLabel.split("×")[1]?.trim()}</span></div>
                </div>
              </div>

              {/* Info */}
              <div className="px-4 pb-4 space-y-2">
                {encErr && <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-2"><p className="text-red-400 text-xs">⚠ {encErr}</p></div>}
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">GS1 Element String:</p>
                  <p className="font-mono text-xs text-green-400 break-all">{gs1Str || <span className="text-gray-500">Complete all fields</span>}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">HRI Display Order:</p>
                  <div className="font-mono text-xs text-blue-300">
                    <p>(01) {gtin}</p>
                    {mode === "lot" ? <><p>(10) {lotNum || "..."}</p><p>(11) {formatGS1Date(mfg) || "..."}</p></> : <><p>(21) {curSerial || "..."}</p><p>(11) {formatGS1Date(mfg) || "..."}</p><p>(17) {formatGS1Date(exp) || "..."}</p></>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ OTHER PAGES (abbreviated) ============
function LoginPage({ onLogin }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 w-96 shadow-2xl border border-gray-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center"><svg width="32" height="32" viewBox="0 0 32 32" fill="white"><rect x="2" y="2" width="6" height="6"/><rect x="10" y="2" width="6" height="6"/><rect x="18" y="2" width="6" height="6"/><rect x="2" y="10" width="6" height="6"/><rect x="18" y="10" width="6" height="6"/><rect x="2" y="18" width="6" height="6"/><rect x="10" y="18" width="6" height="6"/><rect x="18" y="18" width="6" height="6"/></svg></div>
          <h1 className="text-xl font-bold text-white">GS1 Label System</h1><p className="text-gray-400 text-sm mt-1">Medical Device UDI Labels</p>
        </div>
        <div className="space-y-4">
          <div><label className="text-gray-400 text-sm block mb-1">Username</label><input className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" placeholder="admin" /></div>
          <div><label className="text-gray-400 text-sm block mb-1">Password</label><input type="password" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" placeholder="••••••••" /></div>
          <button onClick={onLogin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors">Sign In</button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, collapsed, setCollapsed }) {
  const nav = [{ id:"labels", icon:"🏷️", label:"Label Creator" }, { id:"templates", icon:"📐", label:"Templates" }, { id:"products", icon:"📦", label:"Products" }, { id:"history", icon:"📋", label:"Print History" }];
  const admin = [{ id:"printers", icon:"🖨️", label:"Printers" }, { id:"users", icon:"👥", label:"Users" }, { id:"audit", icon:"📜", label:"Audit Log" }];
  return (
    <div className={`bg-gray-900 border-r border-gray-700 flex flex-col transition-all ${collapsed ? "w-16" : "w-56"}`}>
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setCollapsed(!collapsed)}><span className="text-white text-xs font-bold">GS1</span></div>
        {!collapsed && <span className="text-white font-semibold text-sm">Label System</span>}
      </div>
      <div className="flex-1 py-2">
        {nav.map(n => <button key={n.id} onClick={() => setActive(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active === n.id ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-400" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}><span className="text-base flex-shrink-0">{n.icon}</span>{!collapsed && <span>{n.label}</span>}</button>)}
        {!collapsed && <div className="px-3 py-2 mt-4"><span className="text-xs text-gray-600 uppercase tracking-wider">Admin</span></div>}
        {collapsed && <div className="border-t border-gray-700 my-2 mx-2" />}
        {admin.map(n => <button key={n.id} onClick={() => setActive(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active === n.id ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-400" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}><span className="text-base flex-shrink-0">{n.icon}</span>{!collapsed && <span>{n.label}</span>}</button>)}
      </div>
      <div className="p-3 border-t border-gray-700"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-white text-xs font-bold">A</span></div>{!collapsed && <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">admin</p><p className="text-gray-500 text-xs">Admin</p></div>}</div></div>
    </div>
  );
}

function ProductsPage() {
  const serial = PRODUCTS.filter(p => p.mode === "serial");
  const lot = PRODUCTS.filter(p => p.mode === "lot");
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6"><h1 className="text-xl font-bold text-white">Products ({PRODUCTS.length})</h1></div>
      <h2 className="text-white text-sm font-medium mb-2">Serial Mode — {serial.length} products</h2>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-6">
        {serial.map(p => (
          <div key={p.id} className="p-3 border-b border-gray-700/50 flex items-center gap-3 hover:bg-gray-700/30">
            <span className="text-cyan-400 text-xs bg-cyan-600/20 px-2 py-0.5 rounded">Serial</span>
            <span className="text-white text-sm flex-1">{p.name}</span>
            <span className="text-gray-500 text-xs font-mono">{p.gtin}</span>
            <span className="text-gray-400 text-xs">{p.part}</span>
            <span className="text-green-400 text-xs">{p.shelfYears}y exp</span>
          </div>
        ))}
      </div>
      <h2 className="text-white text-sm font-medium mb-2">Lot Mode — {lot.length} products</h2>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {lot.map(p => (
          <div key={p.id} className="p-3 border-b border-gray-700/50 flex items-center gap-3 hover:bg-gray-700/30">
            <span className="text-amber-400 text-xs bg-amber-600/20 px-2 py-0.5 rounded">Lot</span>
            <span className="text-white text-sm flex-1">{p.name}</span>
            <span className="text-gray-500 text-xs font-mono">{p.gtin}</span>
            <span className="text-gray-400 text-xs">{p.part}</span>
            <span className="text-gray-500 text-xs">Lot: {p.lotPrefix}-YYMMDD</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPage({ title, desc }) {
  return <div className="flex-1 overflow-auto p-6"><h1 className="text-xl font-bold text-white mb-2">{title}</h1><p className="text-gray-400 text-sm">{desc}</p><div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 p-12 text-center"><p className="text-gray-500">See other screens for full implementation</p></div></div>;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [active, setActive] = useState("labels");
  const [collapsed, setCollapsed] = useState(false);
  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;
  const pg = () => {
    switch (active) {
      case "labels": return <LabelCreatorPage />;
      case "products": return <ProductsPage />;
      case "templates": case "designer": case "history": case "printers": case "users": case "audit":
        return <PlaceholderPage title={{ templates:"Templates", designer:"Template Designer", history:"Print History", printers:"Printers", users:"User Management", audit:"Audit Log" }[active]} desc="Full implementation available" />;
      default: return <LabelCreatorPage />;
    }
  };
  return <div className="h-screen flex bg-gray-900 text-white overflow-hidden"><Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />{pg()}</div>;
}
