'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';

const empty = { name: '', phone: '', email: '', address: '' };

export function AddCustomer() {
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
      await api('/api/customers', jsonInit('POST', f));
      setF(empty);
      setOk('Customer added.');
      router.refresh();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="card p-5 h-fit">
      <h2 className="font-bold text-lg mb-4">Add customer</h2>
      {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
      {ok && <div className="mb-3 p-3 rounded-xl bg-green-50 text-green-700 text-sm">{ok}</div>}
      <label className="label">Full name *</label>
      <input className="input mb-3" value={f.name} onChange={set('name')} required />
      <label className="label">Phone *</label>
      <input className="input mb-3" value={f.phone} onChange={set('phone')} required />
      <label className="label">Email</label>
      <input className="input mb-3" type="email" value={f.email} onChange={set('email')} />
      <label className="label">Address</label>
      <input className="input mb-5" value={f.address} onChange={set('address')} />
      <button className="btn btn-gold w-full" disabled={busy}>{busy ? 'Saving…' : 'Save customer'}</button>
    </form>
  );
}
