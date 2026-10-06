'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';

const CATEGORIES = ['Chain', 'Necklace', 'Ring', 'Pendant', 'Hand Chain', 'Earrings', 'Bracelet', 'Other'];

type Product = { id: string; name: string; sku: string; category: string; price: string; stockQty: number; description: string };

export function ProductManager({ product }: { product: Product }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState(product);

  async function save() {
    setBusy(true); setErr('');
    try { await api(`/api/products?id=${product.id}`, jsonInit('PATCH', { ...f, price: Number(f.price), stockQty: Number(f.stockQty) })); setOpen(false); router.refresh(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Remove ${product.name} from the catalogue?`)) return;
    setBusy(true); setErr('');
    try { const r = await api<{ message?: string }>(`/api/products?id=${product.id}`, { method: 'DELETE' }); if (r.message) alert(r.message); router.refresh(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return <>
    <div className="flex justify-end gap-2"><button className="btn btn-light text-xs px-3 py-2" onClick={() => setOpen(true)}>Edit</button><button className="text-xs px-3 py-2 rounded-xl text-red-600 hover:bg-red-50" onClick={remove} disabled={busy}>Delete</button></div>
    {open && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl">
        <div className="flex justify-between items-center mb-5"><div><h2 className="font-bold text-lg">Edit product</h2><p className="text-xs text-gray-400">Change the catalogue price anytime.</p></div><button onClick={() => setOpen(false)}>✕</button></div>
        {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
        <label className="label">Name</label><input className="input mb-3" value={f.name} onChange={e => setF({...f,name:e.target.value})}/>
        <div className="grid sm:grid-cols-2 gap-3"><div><label className="label">SKU</label><input className="input mb-3" value={f.sku} onChange={e => setF({...f,sku:e.target.value})}/></div><div><label className="label">Category</label><select className="input mb-3" value={f.category} onChange={e => setF({...f,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div></div>
        <div className="grid sm:grid-cols-2 gap-3"><div><label className="label">Current price (₦)</label><input className="input mb-3" type="number" min="0" step="0.01" value={f.price} onChange={e => setF({...f,price:e.target.value})}/></div><div><label className="label">Stock</label><input className="input mb-3" type="number" min="0" value={f.stockQty} onChange={e => setF({...f,stockQty:Number(e.target.value)})}/></div></div>
        <label className="label">Description</label><input className="input mb-5" value={f.description} onChange={e => setF({...f,description:e.target.value})}/>
        <div className="flex justify-end gap-3"><button className="btn btn-light" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-gold" onClick={save} disabled={busy}>{busy?'Saving…':'Save changes'}</button></div>
      </div>
    </div>}
  </>;
}
