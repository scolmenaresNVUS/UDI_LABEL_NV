import type { LabelElement, MeasurementUnit } from '../../types/template.types';
import { mmToInches, inchesToMm } from '../../types/template.types';

interface Props {
  element: LabelElement | null;
  unit: MeasurementUnit;
  onUpdate: (id: string, changes: Partial<LabelElement>) => void;
  onDelete: (id: string) => void;
}

function toDisplay(mm: number, unit: MeasurementUnit): number {
  return unit === 'in' ? mmToInches(mm) : Math.round(mm * 100) / 100;
}

function fromDisplay(val: number, unit: MeasurementUnit): number {
  return unit === 'in' ? inchesToMm(val) : val;
}

export default function ElementProperties({ element, unit, onUpdate, onDelete }: Props) {
  if (!element) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <p className="text-gray-500 text-sm">Select an element to edit properties</p>
      </div>
    );
  }

  const step = unit === 'in' ? 0.01 : 0.25;
  const suffix = unit === 'in' ? 'in' : 'mm';

  const numInput = (label: string, value: number, onChange: (v: number) => void, stepOverride?: number) => (
    <div>
      <label className="text-gray-400 text-xs block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        step={stepOverride || step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-sm font-medium capitalize">{element.type.replace('_', ' ')}</h3>
        <button
          onClick={() => { if (confirm('Delete this element?')) onDelete(element.id); }}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          Delete
        </button>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        {numInput(`X (${suffix})`, toDisplay(element.x_mm, unit), v => onUpdate(element.id, { x_mm: fromDisplay(v, unit) } as any))}
        {numInput(`Y (${suffix})`, toDisplay(element.y_mm, unit), v => onUpdate(element.id, { y_mm: fromDisplay(v, unit) } as any))}
      </div>

      {/* Rotation */}
      <div>
        <label className="text-gray-400 text-xs block mb-1">Rotation</label>
        <select
          value={element.rotation}
          onChange={e => onUpdate(element.id, { rotation: parseInt(e.target.value) as 0 | 90 | 180 | 270 } as any)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
        >
          <option value={0}>0</option>
          <option value={90}>90</option>
          <option value={180}>180</option>
          <option value={270}>270</option>
        </select>
      </div>

      {/* Lock */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate(element.id, { locked: e.target.checked } as any)} className="accent-blue-500" />
        <span className="text-gray-400 text-xs">Locked</span>
      </label>

      {/* Type-specific properties */}
      {element.type === 'datamatrix' && (
        <div>
          {numInput('Module Size (dots)', element.moduleSize, v => onUpdate(element.id, { moduleSize: v } as any), 1)}
          <p className="text-gray-500 text-xs mt-1">Approx. {Math.round(element.moduleSize * 24 / 8)}mm print size</p>
        </div>
      )}

      {element.type === 'hri_text' && (
        <>
          {numInput('Font Size (pt)', element.fontSize, v => onUpdate(element.id, { fontSize: v } as any), 1)}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Font</label>
            <select
              value={element.fontFamily}
              onChange={e => onUpdate(element.id, { fontFamily: e.target.value } as any)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
            >
              <option value="0">Font 0 (Default)</option>
              <option value="A">Font A</option>
              <option value="B">Font B</option>
              <option value="D">Font D</option>
              <option value="E">Font E</option>
              <option value="F">Font F</option>
            </select>
          </div>
          {numInput(`Line Spacing (${suffix})`, toDisplay(element.lineSpacing, unit), v => onUpdate(element.id, { lineSpacing: fromDisplay(v, unit) } as any))}
        </>
      )}

      {element.type === 'static_text' && (
        <>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Text</label>
            <textarea
              value={element.text}
              onChange={e => onUpdate(element.id, { text: e.target.value } as any)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm resize-none focus:border-blue-500 focus:outline-none"
              rows={3}
            />
          </div>
          {numInput('Font Size (pt)', element.fontSize, v => onUpdate(element.id, { fontSize: v } as any), 1)}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={element.bold} onChange={e => onUpdate(element.id, { bold: e.target.checked } as any)} className="accent-blue-500" />
            <span className="text-gray-400 text-xs">Bold</span>
          </label>
        </>
      )}

      {element.type === 'line' && (
        <div className="grid grid-cols-2 gap-2">
          {numInput(`End X (${suffix})`, toDisplay(element.endX_mm, unit), v => onUpdate(element.id, { endX_mm: fromDisplay(v, unit) } as any))}
          {numInput(`End Y (${suffix})`, toDisplay(element.endY_mm, unit), v => onUpdate(element.id, { endY_mm: fromDisplay(v, unit) } as any))}
          {numInput('Thickness (dots)', element.thickness, v => onUpdate(element.id, { thickness: v } as any), 1)}
        </div>
      )}

      {element.type === 'rectangle' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {numInput(`Width (${suffix})`, toDisplay(element.width_mm, unit), v => onUpdate(element.id, { width_mm: fromDisplay(v, unit) } as any))}
            {numInput(`Height (${suffix})`, toDisplay(element.height_mm, unit), v => onUpdate(element.id, { height_mm: fromDisplay(v, unit) } as any))}
          </div>
          {numInput('Border (dots)', element.borderThickness, v => onUpdate(element.id, { borderThickness: v } as any), 1)}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={element.filled} onChange={e => onUpdate(element.id, { filled: e.target.checked } as any)} className="accent-blue-500" />
            <span className="text-gray-400 text-xs">Filled</span>
          </label>
        </>
      )}
    </div>
  );
}
