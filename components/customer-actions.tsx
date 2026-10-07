'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';
import { Modal } from '@/components/modal';

type C = { id: string; name: string; phone: string; email: string; address: string; receipts: number };

export function CustomerActions({ c }: { c: C }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: c.name, phone: c.phone, email: c.email, address: c.address });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function openEdit() {
    setF({ name: c.name, phone: c.phone, email: c.email, address: c.address });
    setErr('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api(`/api/customers/${c.id}`, jsonInit('PUT', f));
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
      c.receipts > 0
        ? `Remove "${c.name}" from your customer list?\n\nThey have ${c.receipts} receipt(s). Those receipts and your reports are kept exactly as they are.`
        : `Delete "${c.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await api(`/api/customers/${c.id}`, { method: 'DELETE' });
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
        <Modal title="Edit customer" subtitle="Changes also appear on that customer's past receipts." onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
            <label className="label">Full name *</label>
            <input className="input mb-3" value={f.name} onChange={set('name')} required />
            <label className="label">Phone *</label>
            <input className="input mb-3" value={f.phone} onChange={set('phone')} required />
            <label className="label">Email</label>
            <input className="input mb-3" type="email" value={f.email} onChange={set('email')} />
            <label className="label">Address</label>
            <input className="input mb-5" value={f.address} onChange={set('address')} />
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
