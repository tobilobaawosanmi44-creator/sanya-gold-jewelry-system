'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';

const CATEGORIES = ['Chain', 'Necklace', 'Ring', 'Pendant', 'Hand Chain', 'Earrings', 'Bracelet', 'Other'];
const empty = { name: '', sku: '', category: 'Chain', price: '', stockQty: '1', description: '' };

export function AddProduct() {
  const router = useRouter();
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await api('/api/products', jsonInit('POST', f));
      setF(empty);
      setOk('Product added.');
      router.refresh();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="card p-5 h-fit">
      <h2 className="font-bold text-lg mb-4">Add product</h2>
      {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
      {ok && <div className="mb-3 p-3 rounded-xl bg-green-50 text-green-700 text-sm">{ok}</div>}
      <label className="label">Name *</label>
      <input className="input mb-3" value={f.name} onChange={set('name')} required />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">SKU *</label>
          <input className="input" value={f.sku} onChange={set('sku')} placeholder="CHN-004" required />
        </div>
        <div>
          <label className="label">Category *</label>
          <select className="input" value={f.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Price (₦) *</label>
          <input className="input" type="number" min="1" step="0.01" value={f.price} onChange={set('price')} required />
        </div>
        <div>
          <label className="label">In stock *</label>
          <input className="input" type="number" min="0" step="1" value={f.stockQty} onChange={set('stockQty')} required />
        </div>
      </div>
      <label className="label">Description</label>
      <input className="input mb-5" value={f.description} onChange={set('description')} />
      <button className="btn btn-gold w-full" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
    </form>
  );
}
