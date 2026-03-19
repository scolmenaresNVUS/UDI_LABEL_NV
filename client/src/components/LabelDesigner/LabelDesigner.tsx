import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../../services/api';
import type { LabelTemplate, LabelElement, MeasurementUnit } from '../../types/template.types';
import { LABEL_PRESETS, inchesToMm } from '../../types/template.types';
import DesignerCanvas from './DesignerCanvas';
import ElementToolbar from './ElementToolbar';
import ElementProperties from './ElementProperties';

const MAX_HISTORY = 50;

export default function LabelDesigner() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [template, setTemplate] = useState<LabelTemplate | null>(null);
  const [elements, setElements] = useState<LabelElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [unit, setUnit] = useState<MeasurementUnit>('mm');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [showNew, setShowNew] = useState(false);

  // Undo/redo
  const historyRef = useRef<LabelElement[][]>([]);
  const historyIndexRef = useRef(-1);

  const pushHistory = useCallback((els: LabelElement[]) => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    historyRef.current = [...history.slice(0, idx + 1), JSON.parse(JSON.stringify(els))].slice(-MAX_HISTORY);
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setElements(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
    }
  };

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setElements(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
    }
  };

  // Load templates
  const fetchTemplates = async () => {
    try {
      const res = await api.get('/templates');
      setTemplates(res.data);
      if (res.data.length === 0) {
        // Seed defaults
        await api.post('/templates/seed');
        const res2 = await api.get('/templates');
        setTemplates(res2.data);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const loadTemplate = (t: LabelTemplate) => {
    setTemplate(t);
    setElements(t.elements || []);
    setSelectedId(null);
    historyRef.current = [JSON.parse(JSON.stringify(t.elements || []))];
    historyIndexRef.current = 0;
  };

  useEffect(() => {
    if (templates.length > 0 && !template) {
      loadTemplate(templates[0]);
    }
  }, [templates]);

  const updateElements = (newEls: LabelElement[]) => {
    setElements(newEls);
    pushHistory(newEls);
  };

  const addElement = (type: LabelElement['type']) => {
    let el: LabelElement;
    const base = { id: uuidv4(), x_mm: 5, y_mm: 5, rotation: 0 as const, locked: false };

    switch (type) {
      case 'datamatrix':
        el = { ...base, type: 'datamatrix', moduleSize: 4 };
        break;
      case 'hri_text':
        el = { ...base, type: 'hri_text', fontSize: 7, fontFamily: '0', lineSpacing: 1.2 };
        break;
      case 'static_text':
        el = { ...base, type: 'static_text', text: 'Text', fontSize: 8, fontFamily: '0', bold: false };
        break;
      case 'line':
        el = { ...base, type: 'line', endX_mm: 20, endY_mm: 5, thickness: 1 };
        break;
      case 'rectangle':
        el = { ...base, type: 'rectangle', width_mm: 15, height_mm: 10, borderThickness: 1, filled: false };
        break;
    }

    const newEls = [...elements, el];
    updateElements(newEls);
    setSelectedId(el.id);
  };

  const moveElement = (id: string, x_mm: number, y_mm: number) => {
    const newEls = elements.map(e => e.id === id ? { ...e, x_mm, y_mm } as LabelElement : e);
    updateElements(newEls);
  };

  const updateElement = (id: string, changes: Partial<LabelElement>) => {
    const newEls = elements.map(e => e.id === id ? { ...e, ...changes } as LabelElement : e);
    updateElements(newEls);
  };

  const deleteElement = (id: string) => {
    const newEls = elements.filter(e => e.id !== id);
    updateElements(newEls);
    if (selectedId === id) setSelectedId(null);
  };

  const saveTemplate = async () => {
    if (!template) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await api.put(`/templates/${template.id}`, {
        ...template,
        elements,
      });
      const saved = res.data;
      setTemplate(saved);
      setElements(saved.elements || []);
      await fetchTemplates();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Template save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
    setSaving(false);
  };

  const selectedElement = elements.find(e => e.id === selectedId) || null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const el = elements.find(el => el.id === selectedId);
      if (!el || el.locked) return;

      const nudge = e.shiftKey ? 1 : 0.25;
      let dx = 0, dy = 0;

      switch (e.key) {
        case 'ArrowUp': dy = -nudge; break;
        case 'ArrowDown': dy = nudge; break;
        case 'ArrowLeft': dx = -nudge; break;
        case 'ArrowRight': dx = nudge; break;
        case 'Delete':
        case 'Backspace':
          if (confirm('Delete element?')) deleteElement(selectedId);
          e.preventDefault();
          return;
        default: return;
      }

      if (dx || dy) {
        e.preventDefault();
        moveElement(selectedId, el.x_mm + dx, el.y_mm + dy);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId, elements]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Template Designer</h1>
          <p className="text-gray-400 text-sm">{template?.name} {template ? `v${template.version}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Template selector */}
          <select
            value={template?.id || ''}
            onChange={e => {
              const t = templates.find(t => t.id === e.target.value);
              if (t) loadTemplate(t);
            }}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            {templates.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
          </select>

          {/* Unit toggle */}
          <div className="flex bg-gray-700 rounded-lg overflow-hidden">
            <button onClick={() => setUnit('mm')} className={`px-3 py-2 text-xs ${unit === 'mm' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>mm</button>
            <button onClick={() => setUnit('in')} className={`px-3 py-2 text-xs ${unit === 'in' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>in</button>
          </div>

          <button onClick={() => setShowNew(true)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm">
            New
          </button>
          <button onClick={saveTemplate} disabled={saving || !template} className={`${saveStatus === 'saved' ? 'bg-green-600' : saveStatus === 'error' ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-500'} disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm`}>
            {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Save Failed!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <ElementToolbar
        elements={elements}
        showGrid={showGrid}
        zoom={zoom}
        onAddElement={addElement}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onZoomChange={setZoom}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndexRef.current > 0}
        canRedo={historyIndexRef.current < historyRef.current.length - 1}
      />

      {/* Canvas + Properties */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-9">
          {template ? (
            <DesignerCanvas
              template={template}
              elements={elements}
              selectedId={selectedId}
              zoom={zoom}
              showGrid={showGrid}
              onSelect={setSelectedId}
              onElementMove={moveElement}
            />
          ) : (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
              <p className="text-gray-500">Select or create a template</p>
            </div>
          )}
        </div>
        <div className="col-span-3">
          <ElementProperties
            element={selectedElement}
            unit={unit}
            onUpdate={updateElement}
            onDelete={deleteElement}
          />
        </div>
      </div>

      {/* New Template Modal */}
      {showNew && <NewTemplateModal unit={unit} onClose={() => setShowNew(false)} onCreated={async (t) => {
        await fetchTemplates();
        loadTemplate(t);
        setShowNew(false);
      }} />}
    </div>
  );
}

function NewTemplateModal({ unit, onClose, onCreated }: { unit: MeasurementUnit; onClose: () => void; onCreated: (t: LabelTemplate) => void }) {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState(0);
  const [widthMm, setWidthMm] = useState(50.8);
  const [heightMm, setHeightMm] = useState(25.4);
  const [dpi, setDpi] = useState(203);

  const isCustom = preset === LABEL_PRESETS.length - 1;

  const handlePreset = (idx: number) => {
    setPreset(idx);
    const p = LABEL_PRESETS[idx];
    if (p.widthMm > 0) {
      setWidthMm(p.widthMm);
      setHeightMm(p.heightMm);
    }
  };

  const handleCreate = async () => {
    const res = await api.post('/templates', {
      name: name || 'Untitled Template',
      widthMm,
      heightMm,
      dpi,
      elements: [],
    });
    onCreated(res.data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-white text-lg font-medium mb-4">New Template</h2>
        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Label Size</label>
            <select value={preset} onChange={e => handlePreset(parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
              {LABEL_PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
            </select>
          </div>
          {isCustom && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Width ({unit})</label>
                <input type="number" value={unit === 'in' ? Math.round(widthMm / 25.4 * 1000) / 1000 : widthMm}
                  onChange={e => setWidthMm(unit === 'in' ? inchesToMm(parseFloat(e.target.value)) : parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Height ({unit})</label>
                <input type="number" value={unit === 'in' ? Math.round(heightMm / 25.4 * 1000) / 1000 : heightMm}
                  onChange={e => setHeightMm(unit === 'in' ? inchesToMm(parseFloat(e.target.value)) : parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
              </div>
            </div>
          )}
          <div>
            <label className="text-gray-400 text-xs block mb-1">DPI</label>
            <select value={dpi} onChange={e => setDpi(parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
              <option value={203}>203 (GK420D)</option>
              <option value={300}>300</option>
              <option value={600}>600</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
            <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
