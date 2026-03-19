import { useState } from 'react';
import { useProducts } from '../../hooks/useProducts';
import type { Product } from '../../types/product.types';

type FormData = {
  name: string;
  partNumber: string;
  gtin: string;
  description: string;
  identifierMode: 'lot' | 'serial';
  lotPrefix: string;
  serialPrefix: string;
  serialStart: number;
  shelfLifeYears: number;
  shelfLifeMonths: number;
  shelfLifeDays: number;
};

const emptyForm: FormData = {
  name: '',
  partNumber: '',
  gtin: '',
  description: '',
  identifierMode: 'lot',
  lotPrefix: '',
  serialPrefix: '',
  serialStart: 1,
  shelfLifeYears: 0,
  shelfLifeMonths: 0,
  shelfLifeDays: 0,
};

function productToForm(p: Product): FormData {
  return {
    name: p.name,
    partNumber: p.partNumber,
    gtin: p.gtin,
    description: p.description,
    identifierMode: p.identifierMode,
    lotPrefix: p.lotPrefix ?? '',
    serialPrefix: p.serialPrefix ?? '',
    serialStart: p.serialStart ?? 1,
    shelfLifeYears: p.shelfLifeYears,
    shelfLifeMonths: p.shelfLifeMonths,
    shelfLifeDays: p.shelfLifeDays,
  };
}

function formToPayload(f: FormData) {
  return {
    name: f.name,
    partNumber: f.partNumber,
    gtin: f.gtin,
    description: f.description,
    identifierMode: f.identifierMode,
    lotPrefix: f.identifierMode === 'lot' ? f.lotPrefix : null,
    serialPrefix: f.identifierMode === 'serial' ? f.serialPrefix : null,
    serialStart: f.identifierMode === 'serial' ? f.serialStart : null,
    shelfLifeYears: f.identifierMode === 'serial' ? f.shelfLifeYears : 0,
    shelfLifeMonths: f.identifierMode === 'serial' ? f.shelfLifeMonths : 0,
    shelfLifeDays: f.identifierMode === 'serial' ? f.shelfLifeDays : 0,
  };
}

export default function ProductList() {
  const { products, loading, seedProducts, createProduct, updateProduct, deleteProduct } = useProducts();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const serialProducts = products.filter(p => p.identifierMode === 'serial');
  const lotProducts = products.filter(p => p.identifierMode === 'lot');

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm(productToForm(p));
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(p.id);
    } catch {
      alert('Failed to delete product.');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Product name is required.'); return; }
    if (!form.gtin.trim() || !/^\d{14}$/.test(form.gtin.trim())) { setFormError('GTIN must be exactly 14 digits.'); return; }
    if (!form.partNumber.trim()) { setFormError('Part number is required.'); return; }
    if (form.identifierMode === 'lot' && !form.lotPrefix.trim()) { setFormError('Lot prefix is required for lot mode.'); return; }
    if (form.identifierMode === 'serial' && !form.serialPrefix.trim()) { setFormError('Serial prefix is required for serial mode.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const payload = formToPayload(form);
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await createProduct(payload);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save product.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm(f => ({ ...f, [key]: value }));

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  const inputCls = "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500";
  const labelCls = "block text-gray-400 text-xs mb-1";

  const renderRow = (p: Product) => (
    <div key={p.id} className="p-3 border-b border-gray-700/50 flex items-center gap-3 hover:bg-gray-700/30 group">
      <span className={`text-xs px-2 py-0.5 rounded ${p.identifierMode === 'serial' ? 'text-cyan-400 bg-cyan-600/20' : 'text-amber-400 bg-amber-600/20'}`}>
        {p.identifierMode === 'serial' ? 'Serial' : 'Lot'}
      </span>
      <span className="text-white text-sm flex-1">{p.name}</span>
      <span className="text-gray-500 text-xs font-mono">{p.gtin}</span>
      <span className="text-gray-400 text-xs">{p.partNumber}</span>
      {p.identifierMode === 'serial' ? (
        <span className="text-green-400 text-xs">{p.shelfLifeYears}y exp</span>
      ) : (
        <span className="text-gray-500 text-xs">Lot: {p.lotPrefix}-YYMMDD</span>
      )}
      <button onClick={() => openEdit(p)} className="text-gray-500 hover:text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
        Edit
      </button>
      <button onClick={() => handleDelete(p)} className="text-gray-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
        Delete
      </button>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Products ({products.length})</h1>
        <div className="flex gap-2">
          {products.length === 0 && (
            <button onClick={seedProducts} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
              Seed Default Products
            </button>
          )}
          <button onClick={openAdd} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm">
            + Add Product
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <p className="text-gray-500">No products. Click "Seed Default Products" to load the 39 pre-configured products.</p>
        </div>
      ) : (
        <>
          <h2 className="text-white text-sm font-medium mb-2">Serial Mode — {serialProducts.length} products</h2>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-6">
            {serialProducts.map(renderRow)}
          </div>

          <h2 className="text-white text-sm font-medium mb-2">Lot Mode — {lotProducts.length} products</h2>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {lotProducts.map(renderRow)}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModalOpen(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-white text-lg font-bold mb-4">{editingId ? 'Edit Product' : 'Add Product'}</h2>

            {formError && <div className="bg-red-600/20 border border-red-600/40 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">{formError}</div>}

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Product Name</label>
                <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Part Number</label>
                  <input className={inputCls} value={form.partNumber} onChange={e => set('partNumber', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>GTIN / UDI Number (14 digits)</label>
                  <input className={inputCls} value={form.gtin} onChange={e => set('gtin', e.target.value)} maxLength={14} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input className={inputCls} value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Identifier Mode</label>
                <select className={inputCls} value={form.identifierMode} onChange={e => set('identifierMode', e.target.value as 'lot' | 'serial')}>
                  <option value="lot">Lot</option>
                  <option value="serial">Serial</option>
                </select>
              </div>

              {form.identifierMode === 'lot' ? (
                <div>
                  <label className={labelCls}>Lot Prefix</label>
                  <input className={inputCls} value={form.lotPrefix} onChange={e => set('lotPrefix', e.target.value)} placeholder="e.g. MG96CI" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Serial Prefix</label>
                      <input className={inputCls} value={form.serialPrefix} onChange={e => set('serialPrefix', e.target.value)} placeholder="e.g. BW3" />
                    </div>
                    <div>
                      <label className={labelCls}>Serial Start</label>
                      <input className={inputCls} type="number" min={1} value={form.serialStart} onChange={e => set('serialStart', parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Shelf Life</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <input className={inputCls} type="number" min={0} value={form.shelfLifeYears} onChange={e => set('shelfLifeYears', parseInt(e.target.value) || 0)} />
                        <span className="text-gray-500 text-xs">Years</span>
                      </div>
                      <div>
                        <input className={inputCls} type="number" min={0} value={form.shelfLifeMonths} onChange={e => set('shelfLifeMonths', parseInt(e.target.value) || 0)} />
                        <span className="text-gray-500 text-xs">Months</span>
                      </div>
                      <div>
                        <input className={inputCls} type="number" min={0} value={form.shelfLifeDays} onChange={e => set('shelfLifeDays', parseInt(e.target.value) || 0)} />
                        <span className="text-gray-500 text-xs">Days</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">
                {saving ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
