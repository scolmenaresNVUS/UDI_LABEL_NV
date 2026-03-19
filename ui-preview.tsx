import { useState, useEffect, useRef, useCallback } from "react";

// ============ REAL GS1 DATAMATRIX ENCODER ============
// Uses bwip-js loaded from CDN for actual GS1 DataMatrix encoding

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

function formatGS1Date(dateStr) {
  if (!dateStr) return "";
  const d = dateStr.replace(/-/g, "");
  return d.slice(2); // YYMMDD
}

function buildGS1String(mode, gtin, lot, serial, mfg, exp) {
  const mfgF = formatGS1Date(mfg);
  if (mode === "lot") {
    return `(01)${gtin}(11)${mfgF}(10)${lot}`;
  }
  const expF = formatGS1Date(exp);
  return `(01)${gtin}(17)${expF}(11)${mfgF}(21)${serial}`;
}

function DataMatrixCanvas({ gs1String, size = 120, onError }) {
  const ref = useRef(null);
  const ready = useScript("https://cdnjs.cloudflare.com/ajax/libs/bwip-js/4.5.1/bwip-js.min.js");
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!ready || !ref.current || !gs1String) return;
    try {
      window.bwipjs.toCanvas(ref.current, {
        bcid: "gs1datamatrix",
        text: gs1String,
        scale: 3,
        padding: 2,
        parsefnc: true,
      });
      setErr(null);
      if (onError) onError(null);
    } catch (e) {
      setErr(e.message || "Encoding error");
      if (onError) onError(e.message);
    }
  }, [ready, gs1String, size]);

  if (!ready) return <div className="flex items-center justify-center" style={{width:size,height:size}}><span className="text-gray-500 text-xs">Loading encoder...</span></div>;
  if (err) return <div className="flex items-center justify-center bg-red-900/20 border border-red-700/30 rounded" style={{width:size,height:size}}><span className="text-red-400 text-xs text-center px-2">{err}</span></div>;
  return <canvas ref={ref} style={{maxWidth:size,maxHeight:size,width:"auto",height:"auto"}} />;
}

// ============ GTIN VALIDATOR ============
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

// ============ PAGES ============

function LoginPage({ onLogin }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 w-96 shadow-2xl border border-gray-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="white"><rect x="2" y="2" width="6" height="6"/><rect x="10" y="2" width="6" height="6"/><rect x="18" y="2" width="6" height="6"/><rect x="2" y="10" width="6" height="6"/><rect x="18" y="10" width="6" height="6"/><rect x="2" y="18" width="6" height="6"/><rect x="10" y="18" width="6" height="6"/><rect x="18" y="18" width="6" height="6"/></svg>
          </div>
          <h1 className="text-xl font-bold text-white">GS1 Label System</h1>
          <p className="text-gray-400 text-sm mt-1">Medical Device UDI Labels</p>
        </div>
        <div className="space-y-4">
          <div><label className="text-gray-400 text-sm block mb-1">Username</label><input className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" placeholder="admin"/></div>
          <div><label className="text-gray-400 text-sm block mb-1">Password</label><input type="password" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" placeholder="••••••••"/></div>
          <button onClick={onLogin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors">Sign In</button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, collapsed, setCollapsed }) {
  const nav = [
    { id: "labels", icon: "🏷️", label: "Label Creator" },
    { id: "templates", icon: "📐", label: "Templates" },
    { id: "products", icon: "📦", label: "Products" },
    { id: "history", icon: "📋", label: "Print History" },
  ];
  const admin = [
    { id: "printers", icon: "🖨️", label: "Printers" },
    { id: "users", icon: "👥", label: "Users" },
    { id: "audit", icon: "📜", label: "Audit Log" },
  ];
  return (
    <div className={`bg-gray-900 border-r border-gray-700 flex flex-col transition-all ${collapsed ? "w-16" : "w-56"}`}>
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
          <span className="text-white text-xs font-bold">GS1</span>
        </div>
        {!collapsed && <span className="text-white font-semibold text-sm">Label System</span>}
      </div>
      <div className="flex-1 py-2">
        {nav.map(n => (
          <button key={n.id} onClick={() => setActive(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active === n.id ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-400" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
            <span className="text-base flex-shrink-0">{n.icon}</span>{!collapsed && <span>{n.label}</span>}
          </button>
        ))}
        {!collapsed && <div className="px-3 py-2 mt-4"><span className="text-xs text-gray-600 uppercase tracking-wider">Admin</span></div>}
        {collapsed && <div className="border-t border-gray-700 my-2 mx-2"></div>}
        {admin.map(n => (
          <button key={n.id} onClick={() => setActive(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active === n.id ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-400" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
            <span className="text-base flex-shrink-0">{n.icon}</span>{!collapsed && <span>{n.label}</span>}
          </button>
        ))}
      </div>
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-white text-xs font-bold">A</span></div>
          {!collapsed && <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">admin</p><p className="text-gray-500 text-xs">Admin</p></div>}
        </div>
      </div>
    </div>
  );
}

const TEMPLATES = [
  { id: "std", name: 'Standard 2" × 1"', wMm: 50.8, hMm: 25.4, wLabel: "50.8mm × 25.4mm" },
  { id: "sm", name: 'Small 1.5" × 0.75"', wMm: 38.1, hMm: 19.05, wLabel: "38.1mm × 19.05mm" },
  { id: "sq", name: 'Square 1" × 1"', wMm: 25.4, hMm: 25.4, wLabel: "25.4mm × 25.4mm" },
  { id: "sq2", name: 'Square 2" × 2"', wMm: 50.8, hMm: 50.8, wLabel: "50.8mm × 50.8mm" },
  { id: "lg", name: 'Large 3" × 2"', wMm: 76.2, hMm: 50.8, wLabel: "76.2mm × 50.8mm" },
];

function LabelCreatorPage() {
  const [mode, setMode] = useState("lot");
  const [gtin, setGtin] = useState("00850008393006");
  const [lot, setLot] = useState("MG96CI-260116");
  const [serial, setSerial] = useState("BWIII2026-1234");
  const [mfg, setMfg] = useState("2026-02-18");
  const [exp, setExp] = useState("2033-02-18");
  const [autoExp, setAutoExp] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [prefix, setPrefix] = useState("BWIII2026-");
  const [start, setStart] = useState("1234");
  const [end, setEnd] = useState("1298");
  const [tplId, setTplId] = useState("std");
  const [encErr, setEncErr] = useState(null);

  const tpl = TEMPLATES.find(t => t.id === tplId) || TEMPLATES[0];
  const gv = validateGtin(gtin);
  const identifier = mode === "lot" ? lot : (batchMode ? `${prefix}${start}` : serial);
  const dataComplete = gv.valid && identifier.length > 0 && mfg;
  const gs1Str = dataComplete ? buildGS1String(mode, gtin, lot, batchMode ? `${prefix}${start}` : serial, mfg, mode === "serial" ? exp : null) : "";

  // Responsive label preview sizing
  const maxW = 320, scale = Math.min(maxW / tpl.wMm, 260 / tpl.hMm);
  const prevW = Math.round(tpl.wMm * scale), prevH = Math.round(tpl.hMm * scale);
  const isSquare = Math.abs(tpl.wMm - tpl.hMm) < 0.5;
  const isSmall = tpl.wMm < 30;
  const dmSize = isSmall ? 60 : isSquare && tpl.wMm < 55 ? 70 : 90;
  const fontSize = isSmall ? 7 : 9;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-xl font-bold text-white">Label Creator</h1><p className="text-gray-400 text-sm">Create and print GS1 DataMatrix labels</p></div>
          <div className="flex gap-2">
            <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">🔍 Preview</button>
            <button className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">🖨️ Print</button>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-4">
            {/* Template */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Template</label>
              <select value={tplId} onChange={e => setTplId(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name} ({t.wLabel})</option>)}
              </select>
            </div>
            {/* Mode */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-3">Identifier Mode</label>
              <div className="flex bg-gray-700 rounded-lg p-1">
                <button onClick={() => setMode("lot")} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "lot" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Lot Number</button>
                <button onClick={() => setMode("serial")} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "serial" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Serial Number</button>
              </div>
            </div>
            {/* GTIN */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">GTIN-14 (AI 01)</label>
              <div className="relative">
                <input value={gtin} onChange={e => setGtin(e.target.value.replace(/\D/g,"").slice(0,14))} maxLength={14} className={`w-full bg-gray-700 border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none ${gv.valid ? "border-green-500" : gtin.length > 0 ? "border-red-500" : "border-gray-600"}`} placeholder="00850008393006"/>
                <span className="absolute right-3 top-2.5">{gv.valid ? <span className="text-green-400">✓</span> : gtin.length > 0 ? <span className="text-red-400">✗</span> : null}</span>
              </div>
              {gtin.length > 0 && !gv.valid && <p className="text-red-400 text-xs mt-1">{gv.error}</p>}
            </div>
            {/* Lot / Serial */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              {mode === "lot" ? (
                <><label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Lot Number (AI 10)</label>
                <input value={lot} onChange={e => setLot(e.target.value.slice(0,20))} maxLength={20} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="MG96CI-260116"/>
                <p className="text-gray-500 text-xs mt-1">Alphanumeric + hyphens, max 20 chars ({lot.length}/20)</p></>
              ) : (
                <><div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 text-xs uppercase tracking-wider">Serial Number (AI 21)</label>
                  <label className="flex items-center gap-2 cursor-pointer"><span className="text-gray-400 text-xs">Batch</span>
                    <div onClick={() => setBatchMode(!batchMode)} className={`w-9 h-5 rounded-full transition-colors flex items-center ${batchMode ? "bg-blue-600" : "bg-gray-600"}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${batchMode ? "translate-x-4" : ""}`}/></div>
                  </label></div>
                {!batchMode ? (
                  <><input value={serial} onChange={e => setSerial(e.target.value.slice(0,20))} maxLength={20} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="BWIII2026-1234"/>
                  <p className="text-gray-500 text-xs mt-1">{serial.length}/20 characters</p></>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-gray-500 text-xs block mb-1">Prefix</label><input value={prefix} onChange={e=>setPrefix(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"/></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Suffix</label><input className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="(optional)"/></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-gray-500 text-xs block mb-1">Start</label><input value={start} onChange={e=>setStart(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"/></div>
                      <div><label className="text-gray-500 text-xs block mb-1">End</label><input value={end} onChange={e=>setEnd(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"/></div>
                      <div><label className="text-gray-500 text-xs block mb-1">Step</label><input value="1" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" readOnly/></div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2"><span className="text-gray-400 text-xs">Preview</span><span className="text-blue-400 text-xs font-medium">{Math.max(0,parseInt(end||0)-parseInt(start||0)+1)} labels</span></div>
                      <div className="font-mono text-xs text-gray-300 space-y-0.5">
                        <p>{prefix}{start}</p><p>{prefix}{parseInt(start||0)+1}</p><p>{prefix}{parseInt(start||0)+2}</p><p className="text-gray-500">⋮</p><p>{prefix}{end}</p>
                      </div>
                    </div>
                  </div>
                )}</>
              )}
            </div>
            {/* Dates */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className={`grid gap-4 ${mode === "serial" ? "grid-cols-2" : "grid-cols-1"}`}>
                <div><label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Manufacturing Date (AI 11)</label>
                  <input type="date" value={mfg} onChange={e=>setMfg(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"/></div>
                {mode === "serial" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-gray-400 text-xs uppercase tracking-wider">Expiration Date (AI 17)</label>
                      <label className="flex items-center gap-1 cursor-pointer"><span className="text-gray-500 text-xs">Auto</span>
                        <div onClick={()=>setAutoExp(!autoExp)} className={`w-8 h-4 rounded-full transition-colors flex items-center ${autoExp?"bg-blue-600":"bg-gray-600"}`}><div className={`w-3 h-3 bg-white rounded-full shadow transition-transform mx-0.5 ${autoExp?"translate-x-4":""}`}/></div>
                      </label>
                    </div>
                    <input type="date" value={exp} onChange={e=>setExp(e.target.value)} className={`w-full border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${autoExp?"bg-gray-600 cursor-not-allowed":"bg-gray-700 focus:border-blue-500"}`} readOnly={autoExp}/>
                    {autoExp && <p className="text-blue-400 text-xs mt-1">Auto: +7 years from manufacturing</p>}
                  </div>
                )}
              </div>
            </div>
            {/* Export */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex gap-2">
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex-1">📄 Save as PDF</button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex-1">🖼️ Save as PNG</button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex-1">⬇️ Download ZPL</button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="col-span-5">
            <div className="bg-gray-800 rounded-xl border border-gray-700 sticky top-6">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-white text-sm font-medium">Live Preview</h3><p className="text-gray-500 text-xs">Real GS1 DataMatrix • {tpl.name}</p></div>
                  <span className={`text-xs px-2 py-0.5 rounded ${mode==="lot"?"bg-amber-600/20 text-amber-400":"bg-cyan-600/20 text-cyan-400"}`}>{mode==="lot"?"Lot":"Serial"}</span>
                </div>
              </div>
              <div className="p-6 flex justify-center">
                {/* Actual label shape preview */}
                <div className="relative">
                  <div className="bg-white rounded shadow-lg flex overflow-hidden" style={{width: prevW, height: prevH, padding: Math.max(6, Math.round(scale * 1.5))}}>
                    {isSmall ? (
                      /* Small/square: stack vertically */
                      <div className="flex flex-col items-center justify-center w-full gap-1">
                        {dataComplete ? <DataMatrixCanvas gs1String={gs1Str} size={dmSize} onError={setEncErr}/> : <div className="bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-400 text-xs" style={{width:dmSize,height:dmSize}}>Enter data</div>}
                        <div className="font-mono text-gray-900 text-center" style={{fontSize: fontSize, lineHeight: 1.4}}>
                          <p>(01) {gtin||"—"}</p>
                          {mode==="lot"?<><p>(10) {lot||"—"}</p><p>(11) {formatGS1Date(mfg)||"—"}</p></>:<><p>(21) {batchMode?`${prefix}${start}`:serial||"—"}</p><p>(11) {formatGS1Date(mfg)||"—"}</p><p>(17) {formatGS1Date(exp)||"—"}</p></>}
                        </div>
                      </div>
                    ) : (
                      /* Wide/standard: side by side */
                      <div className="flex items-center gap-3 w-full">
                        {dataComplete ? <DataMatrixCanvas gs1String={gs1Str} size={dmSize} onError={setEncErr}/> : <div className="bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-400 text-xs flex-shrink-0" style={{width:dmSize,height:dmSize}}>Enter data</div>}
                        <div className="font-mono text-gray-900 flex flex-col justify-center min-w-0" style={{fontSize: fontSize, lineHeight: 1.5}}>
                          <p className="font-bold truncate">(01) {gtin||"—"}</p>
                          {mode==="lot"?<><p className="truncate">(10) {lot||"—"}</p><p className="truncate">(11) {formatGS1Date(mfg)||"—"}</p></>:<><p className="truncate">(21) {batchMode?`${prefix}${start}`:serial||"—"}</p><p className="truncate">(11) {formatGS1Date(mfg)||"—"}</p><p className="truncate">(17) {formatGS1Date(exp)||"—"}</p></>}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Dimension labels */}
                  <div className="absolute -bottom-5 left-0 right-0 text-center text-gray-500 text-xs">{tpl.wLabel.split("×")[0].trim()}</div>
                  <div className="absolute -right-8 top-0 bottom-0 flex items-center"><span className="text-gray-500 text-xs -rotate-90 whitespace-nowrap">{tpl.wLabel.split("×")[1]?.trim()}</span></div>
                </div>
              </div>
              {/* Encoded string */}
              <div className="px-4 pb-4 space-y-2">
                {encErr && <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-2"><p className="text-red-400 text-xs">⚠ Encoding error: {encErr}</p></div>}
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">GS1 Element String {dataComplete ? <span className="text-green-400">(encoding order)</span> : <span className="text-gray-500">(incomplete)</span>}:</p>
                  <p className="font-mono text-xs text-green-400 break-all">{gs1Str || <span className="text-gray-500">Fill in all fields to generate</span>}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">HRI Display Order:</p>
                  <div className="font-mono text-xs text-blue-300">
                    <p>(01) {gtin||"..."}</p>
                    {mode==="lot"?<><p>(10) {lot||"..."}</p><p>(11) {formatGS1Date(mfg)||"..."}</p></>:<><p>(21) {batchMode?`${prefix}${start}`:serial||"..."}</p><p>(11) {formatGS1Date(mfg)||"..."}</p><p>(17) {formatGS1Date(exp)||"..."}</p></>}
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

function TemplateDesignerPage() {
  const [unit, setUnit] = useState("mm");
  const [sel, setSel] = useState("dm");
  const [grid, setGrid] = useState(true);
  const [tplId, setTplId] = useState("std");
  const tpl = TEMPLATES.find(t=>t.id===tplId)||TEMPLATES[0];

  const maxCanvasW = 450, maxCanvasH = 320;
  const sc = Math.min(maxCanvasW/tpl.wMm, maxCanvasH/tpl.hMm);
  const cW = Math.round(tpl.wMm*sc), cH = Math.round(tpl.hMm*sc);
  const margin = Math.round(1*sc);
  const isSquarish = Math.abs(tpl.wMm-tpl.hMm)<5;
  const fmt = v => unit==="mm"?`${v.toFixed(1)}`:`${(v/25.4).toFixed(3)}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <select value={tplId} onChange={e=>setTplId(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs"><option value="std">2"×1"</option><option value="sm">1.5"×0.75"</option><option value="sq">1"×1" □</option><option value="sq2">2"×2" □</option><option value="lg">3"×2"</option></select>
        <div className="w-px h-6 bg-gray-700 mx-1"/>
        <button className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-600/30">+ DataMatrix</button>
        <button className="bg-purple-600/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-600/30">+ HRI Text</button>
        <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-600">+ Text</button>
        <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-600">+ Line</button>
        <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-600">+ Rect</button>
        <div className="w-px h-6 bg-gray-700 mx-1"/>
        <button onClick={()=>setGrid(!grid)} className={`px-3 py-1.5 rounded-lg text-xs ${grid?"bg-gray-600 text-white":"bg-gray-700 text-gray-400"}`}>⊞ Grid</button>
        <button className="bg-gray-700 text-gray-400 px-2 py-1.5 rounded-lg text-xs">↩</button>
        <button className="bg-gray-700 text-gray-400 px-2 py-1.5 rounded-lg text-xs">↪</button>
        <select className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs"><option>100%</option><option>75%</option><option>150%</option></select>
        <div className="flex-1"/>
        <div className="flex bg-gray-700 rounded-lg p-0.5">
          <button onClick={()=>setUnit("mm")} className={`px-3 py-1 text-xs rounded-md ${unit==="mm"?"bg-blue-600 text-white":"text-gray-400"}`}>mm</button>
          <button onClick={()=>setUnit("in")} className={`px-3 py-1 text-xs rounded-md ${unit==="in"?"bg-blue-600 text-white":"text-gray-400"}`}>in</button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-950 flex items-center justify-center overflow-auto p-8">
          <div className="relative">
            <div className="bg-white rounded shadow-xl relative" style={{width:cW,height:cH}}>
              {grid && <svg className="absolute inset-0" width={cW} height={cH} style={{opacity:.07}}>
                {Array.from({length:Math.ceil(cW/(sc*2))+1}).map((_,i)=><line key={`v${i}`} x1={i*sc*2} y1={0} x2={i*sc*2} y2={cH} stroke="#000" strokeWidth={0.5}/>)}
                {Array.from({length:Math.ceil(cH/(sc*2))+1}).map((_,i)=><line key={`h${i}`} x1={0} y1={i*sc*2} x2={cW} y2={i*sc*2} stroke="#000" strokeWidth={0.5}/>)}
              </svg>}
              <div className="absolute border border-dashed border-blue-400/30" style={{top:margin,left:margin,right:margin,bottom:margin}}/>
              {/* DataMatrix */}
              <div onClick={()=>setSel("dm")} className={`absolute cursor-move ${sel==="dm"?"ring-2 ring-blue-400":""}`} style={{left:margin+4,top:margin+4,width:Math.min(cH-margin*2-8,cW*0.4),height:Math.min(cH-margin*2-8,cW*0.4)}}>
                <div className="w-full h-full bg-gray-100 border-2 border-dashed border-gray-400 flex items-center justify-center"><span className="text-gray-400 text-xs">DataMatrix</span></div>
              </div>
              {/* HRI text */}
              <div onClick={()=>setSel("hri")} className={`absolute cursor-move ${sel==="hri"?"ring-2 ring-blue-400":""}`} style={{left:isSquarish?margin+4:Math.min(cH-margin*2,cW*0.4)+margin+8,top:isSquarish?Math.min(cH-margin*2-8,cW*0.4)+margin+10:margin+6, maxWidth:isSquarish?cW-margin*2-8:cW-Math.min(cH-margin*2,cW*0.4)-margin*2-12}}>
                <div className="font-mono text-black leading-snug" style={{fontSize:Math.max(7,Math.min(10,sc*1.2))}}>
                  <p>(01) 00000000000000</p><p>(10) XXXXXXXXXXXX</p><p>(11) YYMMDD</p>
                </div>
              </div>
              {/* Static text - only on larger labels */}
              {tpl.hMm>30 && <div onClick={()=>setSel("txt")} className={`absolute cursor-move ${sel==="txt"?"ring-2 ring-blue-400":""}`} style={{left:margin+4,bottom:margin+4}}>
                <div className="text-black font-semibold" style={{fontSize:Math.max(7,sc*1)}}>Manufacturer Inc.</div>
              </div>}
            </div>
            <div className="absolute -bottom-6 left-0 right-0 text-center text-gray-500 text-xs">{fmt(tpl.wMm)}{unit==="mm"?" mm":'"'}</div>
            <div className="absolute -right-10 top-0 bottom-0 flex items-center"><span className="text-gray-500 text-xs -rotate-90 whitespace-nowrap">{fmt(tpl.hMm)}{unit==="mm"?" mm":'"'}</span></div>
          </div>
        </div>
        {/* Properties */}
        <div className="w-60 bg-gray-800 border-l border-gray-700 overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-gray-700"><h3 className="text-white text-sm font-medium">Properties</h3><p className="text-gray-500 text-xs">{sel==="dm"?"DataMatrix Barcode":sel==="hri"?"HRI Text Block":"Static Text"}</p></div>
          <div className="p-4 space-y-3">
            <div><label className="text-gray-400 text-xs block mb-1">X ({unit})</label><input className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm font-mono" value={fmt(2)} readOnly/></div>
            <div><label className="text-gray-400 text-xs block mb-1">Y ({unit})</label><input className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm font-mono" value={fmt(2)} readOnly/></div>
            <div><label className="text-gray-400 text-xs block mb-1">Rotation</label><select className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"><option>0°</option><option>90°</option><option>180°</option><option>270°</option></select></div>
            {sel==="dm"&&<div><label className="text-gray-400 text-xs block mb-1">Module Size</label><input type="number" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm font-mono" value="4" readOnly/><p className="text-gray-500 text-xs mt-1">≈ {fmt(12)}{unit==="mm"?" mm":'"'}</p></div>}
            {sel==="hri"&&<><div><label className="text-gray-400 text-xs block mb-1">Font Size (pt)</label><input type="number" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" value="7" readOnly/></div><div><label className="text-gray-400 text-xs block mb-1">Font</label><select className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"><option>Font 0 (Default)</option></select></div></>}
            {sel==="txt"&&<div><label className="text-gray-400 text-xs block mb-1">Text</label><textarea className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" rows={2} defaultValue="Manufacturer Inc."/></div>}
            <div className="pt-2 border-t border-gray-700"><label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer"><input type="checkbox" className="rounded"/> Lock</label></div>
            <button className="w-full bg-red-600/20 text-red-400 py-1.5 rounded-lg text-sm hover:bg-red-600/30 border border-red-600/20">Delete Element</button>
          </div>
        </div>
      </div>
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <span className="text-gray-400 text-xs">Template:</span><span className="text-white text-sm font-medium">{tpl.name}</span><span className="text-gray-500 text-xs">(v3)</span>
        <div className="flex-1"/>
        <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs hover:bg-gray-600">💾 Save</button>
        <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs hover:bg-gray-600">Save As</button>
        <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs hover:bg-gray-600">📤 Export</button>
        <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs hover:bg-gray-600">📥 Import</button>
      </div>
    </div>
  );
}

function TemplateListPage({setActive}) {
  const tpls = [
    {name:"Standard 2×1 inch",desc:"Default medical device label",w:"50.8 × 25.4 mm",v:3,d:"2026-02-18"},
    {name:"Small 1.5×0.75 inch",desc:"Small vial labels",w:"38.1 × 19.05 mm",v:1,d:"2026-02-15"},
    {name:"Square 1×1 inch",desc:"Implant device labels",w:"25.4 × 25.4 mm",v:2,d:"2026-02-16"},
    {name:"Large 3×2 inch",desc:"Box labels",w:"76.2 × 50.8 mm",v:1,d:"2026-02-10"},
    {name:"CardioSensor CS-500",desc:"CS-500 product line",w:"50.8 × 25.4 mm",v:5,d:"2026-02-17"},
    {name:"Sterile Pack Label",desc:"Sterile packaging",w:"38.1 × 25.4 mm",v:2,d:"2026-02-14"},
  ];
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-white">Templates</h1><p className="text-gray-400 text-sm">{tpls.length} label templates</p></div>
        <div className="flex gap-2">
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">📥 Import</button>
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">📤 Export All</button>
          <button onClick={()=>setActive("designer")} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ New Template</button>
        </div>
      </div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wider grid grid-cols-12 gap-4"><div className="col-span-4">Name</div><div className="col-span-3">Dimensions</div><div className="col-span-1">Ver</div><div className="col-span-2">Modified</div><div className="col-span-2">Actions</div></div>
        {tpls.map((t,i)=>(
          <div key={i} className="px-4 py-3 border-b border-gray-700/50 grid grid-cols-12 gap-4 items-center hover:bg-gray-700/30">
            <div className="col-span-4"><p className="text-white text-sm font-medium">{t.name}</p><p className="text-gray-500 text-xs">{t.desc}</p></div>
            <div className="col-span-3 text-gray-400 text-sm font-mono">{t.w}</div>
            <div className="col-span-1"><span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">v{t.v}</span></div>
            <div className="col-span-2 text-gray-400 text-sm">{t.d}</div>
            <div className="col-span-2 flex gap-1">
              <button onClick={()=>setActive("designer")} className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs hover:bg-blue-600/30">Edit</button>
              <button className="bg-gray-700 text-gray-400 px-2 py-1 rounded text-xs hover:bg-gray-600">📤</button>
              <button className="bg-gray-700 text-gray-400 px-2 py-1 rounded text-xs hover:bg-gray-600">📋</button>
              <button className="bg-red-600/10 text-red-400 px-2 py-1 rounded text-xs hover:bg-red-600/20">🗑</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-2 border-dashed border-gray-700 rounded-xl p-6 text-center"><p className="text-gray-500 text-sm">Drop <span className="text-gray-400 font-mono">.gslabel</span> or <span className="text-gray-400 font-mono">.gslabel-pack</span> files here to import</p></div>
    </div>
  );
}

function PrintHistoryPage() {
  const jobs = [
    {id:"PJ-0042",user:"admin",tpl:"Standard 2×1",gtin:"00850008393006",mode:"Lot",ident:"MG96CI-260116",total:50,status:"completed",date:"2026-02-18 10:31"},
    {id:"PJ-0041",user:"operator1",tpl:"Standard 2×1",gtin:"00850008393006",mode:"Serial",ident:"BWIII2026-1234…1298",total:65,status:"completed",date:"2026-02-18 09:45"},
    {id:"PJ-0040",user:"admin",tpl:"Small 1.5×0.75",gtin:"00850025507338",mode:"Lot",ident:"LOT-2026B",total:100,status:"completed",date:"2026-02-17 16:20"},
    {id:"PJ-0039",user:"operator2",tpl:"Standard 2×1",gtin:"00850008393006",mode:"Serial",ident:"SN-0001…0010",total:10,status:"failed",date:"2026-02-17 14:05"},
  ];
  const sc={completed:"text-green-400 bg-green-600/20",failed:"text-red-400 bg-red-600/20",queued:"text-blue-400 bg-blue-600/20"};
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-xl font-bold text-white">Print History</h1></div>
        <div className="flex gap-2"><select className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"><option>All Status</option><option>Completed</option><option>Failed</option></select><input type="date" className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"/></div></div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wider grid grid-cols-12 gap-2"><div className="col-span-2">Date</div><div className="col-span-1">User</div><div className="col-span-2">Template</div><div className="col-span-1">Mode</div><div className="col-span-3">Identifier</div><div className="col-span-1">Qty</div><div className="col-span-1">Status</div><div className="col-span-1"/></div>
        {jobs.map(j=>(
          <div key={j.id} className="px-4 py-3 border-b border-gray-700/50 grid grid-cols-12 gap-2 items-center hover:bg-gray-700/30 cursor-pointer">
            <div className="col-span-2 text-gray-400 text-sm">{j.date}</div><div className="col-span-1 text-gray-300 text-sm">{j.user}</div><div className="col-span-2 text-white text-sm">{j.tpl}</div>
            <div className="col-span-1"><span className={`text-xs px-2 py-0.5 rounded ${j.mode==="Lot"?"bg-amber-600/20 text-amber-400":"bg-cyan-600/20 text-cyan-400"}`}>{j.mode}</span></div>
            <div className="col-span-3 text-gray-300 text-sm font-mono truncate">{j.ident}</div><div className="col-span-1 text-gray-300 text-sm">{j.total}</div>
            <div className="col-span-1"><span className={`text-xs px-2 py-0.5 rounded ${sc[j.status]}`}>{j.status}</span></div><div className="col-span-1 text-right"><button className="text-gray-500 hover:text-white text-sm">→</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintersPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-xl font-bold text-white mb-6">Printers</h1>
      <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"/><div><p className="text-green-400 text-sm font-medium">Zebra Browser Print Active</p><p className="text-green-400/60 text-xs">1 printer detected</p></div>
        <div className="flex-1"/><button className="bg-green-600/20 text-green-400 px-3 py-1.5 rounded-lg text-xs border border-green-600/30">Discover Printers</button>
      </div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center"><span className="text-white font-medium text-sm">Configured Printers</span><button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs">+ Add Printer</button></div>
        <div className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-lg">🖨️</div>
          <div className="flex-1"><div className="flex items-center gap-2"><p className="text-white text-sm font-medium">Lab Zebra GK420D</p><span className="text-yellow-400 text-xs">⭐ Default</span></div><p className="text-gray-500 text-xs">USB • 203 DPI</p></div>
          <span className="text-green-400 text-xs bg-green-600/20 px-2 py-1 rounded">Online</span>
          <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs">Test</button><button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs">Edit</button>
        </div>
      </div>
      <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center"><div className="flex items-center gap-2"><span className="text-white font-medium text-sm">Print Queue</span><span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">2</span></div><button className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs">🖨️ Print All</button></div>
        <div className="p-3 border-b border-gray-700/50 flex items-center gap-3"><span className="text-blue-400 text-xs bg-blue-600/20 px-2 py-0.5 rounded">queued</span><span className="text-gray-300 text-sm">operator1 — 25 labels</span><span className="text-gray-500 text-xs">2 min ago</span><div className="flex-1"/><button className="bg-green-600/20 text-green-400 px-3 py-1 rounded text-xs border border-green-600/30">Print Now</button></div>
        <div className="p-3 flex items-center gap-3"><span className="text-blue-400 text-xs bg-blue-600/20 px-2 py-0.5 rounded">queued</span><span className="text-gray-300 text-sm">operator2 — 10 labels</span><span className="text-gray-500 text-xs">5 min ago</span><div className="flex-1"/><button className="bg-green-600/20 text-green-400 px-3 py-1 rounded text-xs border border-green-600/30">Print Now</button></div>
      </div>
    </div>
  );
}

function ProductsPage() {
  const prods=[{name:"CardioSensor CS-500",gtin:"00850008393006",mode:"lot",shelf:"—"},{name:"NeuroStim Electrode",gtin:"00850025507338",mode:"serial",shelf:"7y"},{name:"SterileWrap Kit",gtin:"00850008399991",mode:"lot",shelf:"—"},{name:"ImplantLink Bridge",gtin:"00850025501122",mode:"serial",shelf:"5y"}];
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-xl font-bold text-white">Products</h1></div><button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ Add Product</button></div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {prods.map((p,i)=>(
          <div key={i} className="p-4 border-b border-gray-700/50 flex items-center gap-4 hover:bg-gray-700/30">
            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-lg">📦</div>
            <div className="flex-1"><p className="text-white text-sm font-medium">{p.name}</p><p className="text-gray-500 text-xs font-mono">{p.gtin}</p></div>
            <span className={`text-xs px-2 py-0.5 rounded ${p.mode==="lot"?"bg-amber-600/20 text-amber-400":"bg-cyan-600/20 text-cyan-400"}`}>{p.mode==="lot"?"Lot":"Serial"}</span>
            {p.mode==="serial"&&<span className="text-green-400 text-xs">{p.shelf} auto</span>}
            <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs">Edit</button>
            <button className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded text-xs">Use</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPage({title,desc}) {
  return <div className="flex-1 overflow-auto p-6"><h1 className="text-xl font-bold text-white mb-2">{title}</h1><p className="text-gray-400 text-sm">{desc}</p><div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 p-12 text-center"><p className="text-gray-500">Full implementation in other screens</p></div></div>;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [active, setActive] = useState("labels");
  const [collapsed, setCollapsed] = useState(false);
  if (!loggedIn) return <LoginPage onLogin={()=>setLoggedIn(true)}/>;
  const pg = () => {
    switch(active) {
      case "labels": return <LabelCreatorPage/>;
      case "designer": return <TemplateDesignerPage/>;
      case "templates": return <TemplateListPage setActive={setActive}/>;
      case "products": return <ProductsPage/>;
      case "history": return <PrintHistoryPage/>;
      case "printers": return <PrintersPage/>;
      case "users": return <PlaceholderPage title="User Management" desc="Up to 6 users (admin/operator roles)"/>;
      case "audit": return <PlaceholderPage title="Audit Log" desc="Immutable action log for regulatory compliance"/>;
      default: return <LabelCreatorPage/>;
    }
  };
  return <div className="h-screen flex bg-gray-900 text-white overflow-hidden"><Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed}/>{pg()}</div>;
}
