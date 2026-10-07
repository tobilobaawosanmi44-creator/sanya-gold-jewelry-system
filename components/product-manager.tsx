'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';
import { Modal } from '@/components/modal';

const CATEGORIES = ['Chain', 'Necklace', 'Ring', 'Pendant', 'Hand Chain', 'Earrings', 'Bracelet', 'Other'];

type Product = { id: string; name: string; sku: string; category: string; price: string; stockQty: number; description: string; timesSold: number };

export function ProductManager({ product }: { product: Product }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ name: product.name, sku: product.sku, category: product.category, price: Number(product.price) > 0 ? product.price : '', stockQty: String(product.stockQty), description: product.description });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  function openEdit() {
    setF({ name: product.name, sku: product.sku, category: product.category, price: Number(product.price) > 0 ? product.price : '', stockQty: String(product.stockQty), description: product.description });
    setErr('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api(`/api/products/${product.id}`, jsonInit('PUT', f));
      setOpen(false);
      router.refresh();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const msg =
      product.timesSold > 0
        ? `Remove "${product.name}" from the catalogue?\n\nIt appears on ${product.timesSold} past sale line(s). Those receipts and your reports are kept exactly as they are.`
        : `Delete "${product.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await api(`/api/products/${product.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (x) {
      window.alert((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-light text-xs px-3 py-2" onClick={openEdit}>Edit</button>
        <button type="button" className="text-xs px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-40" onClick={remove} disabled={busy}>Delete</button>
      </div>
      {open && (
        <Modal title="Edit product" subtitle="The price here is only a reference. You enter the real price on each receipt." onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
            <label className="label">Name *</label>
            <input className="input mb-3" value={f.name} onChange={set('name')} required />
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div><label className="label">SKU *</label><input className="input" value={f.sku} onChange={set('sku')} required /></div>
              <div>
                <label className="label">Category *</label>
                <select className="input" value={f.category} onChange={set('category')}>
                  {(CATEGORIES.includes(f.category) ? CATEGORIES : [f.category, ...CATEGORIES]).map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div><label className="label">Reference price (₦, optional)</label><input className="input" type="number" min="0" step="0.01" value={f.price} onChange={set('price')} placeholder="Leave blank if it varies" /></div>
              <div><label className="label">In stock *</label><input className="input" type="number" min="0" step="1" value={f.stockQty} onChange={set('stockQty')} required /></div>
            </div>
            <label className="label">Description</label>
            <input className="input mb-5" value={f.description} onChange={set('description')} />
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
