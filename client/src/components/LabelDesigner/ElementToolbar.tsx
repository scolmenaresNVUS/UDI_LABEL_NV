import type { LabelElement } from '../../types/template.types';

interface Props {
  elements: LabelElement[];
  showGrid: boolean;
  zoom: number;
  onAddElement: (type: LabelElement['type']) => void;
  onToggleGrid: () => void;
  onZoomChange: (zoom: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function ElementToolbar({
  elements, showGrid, zoom,
  onAddElement, onToggleGrid, onZoomChange,
  onUndo, onRedo, canUndo, canRedo,
}: Props) {
  const hasDataMatrix = elements.some(e => e.type === 'datamatrix');
  const hasHri = elements.some(e => e.type === 'hri_text');

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onAddElement('datamatrix')}
          disabled={hasDataMatrix}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs"
          title={hasDataMatrix ? 'Max 1 DataMatrix' : 'Add DataMatrix'}
        >
          + DataMatrix
        </button>
        <button
          onClick={() => onAddElement('hri_text')}
          disabled={hasHri}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs"
          title={hasHri ? 'Max 1 HRI Text' : 'Add HRI Text'}
        >
          + HRI Text
        </button>
        <button onClick={() => onAddElement('static_text')} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs">
          + Text
        </button>
        <button onClick={() => onAddElement('line')} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs">
          + Line
        </button>
        <button onClick={() => onAddElement('rectangle')} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs">
          + Rectangle
        </button>

        <div className="w-px h-6 bg-gray-600 self-center" />

        <button onClick={onToggleGrid} className={`px-3 py-1.5 rounded text-xs ${showGrid ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
          Grid
        </button>
        <button onClick={onUndo} disabled={!canUndo} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs">
          Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs">
          Redo
        </button>

        <div className="w-px h-6 bg-gray-600 self-center" />

        <select
          value={zoom}
          onChange={e => onZoomChange(parseFloat(e.target.value))}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs"
        >
          <option value={0.5}>50%</option>
          <option value={0.75}>75%</option>
          <option value={1}>100%</option>
          <option value={1.5}>150%</option>
          <option value={2}>200%</option>
        </select>
      </div>

      {!hasHri && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-2">
          <p className="text-yellow-400 text-xs">
            FDA UDI and EU MDR require human-readable interpretation (HRI) text on the label.
          </p>
        </div>
      )}
    </div>
  );
}
