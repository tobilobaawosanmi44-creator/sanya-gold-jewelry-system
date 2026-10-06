'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';

type Biz = { name: string; phone: string; email: string; address: string; description: string; whatsapp: string; website: string };

export function BusinessForm({ initial, canEdit }: { initial: Biz; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const set = (k: keyof Biz) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await api('/api/settings', jsonInit('PUT', f));
      setOk('Business details saved. They now appear on new receipts.');
      router.refresh();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <h2 className="font-bold text-lg mb-1">Business profile</h2>
      <p className="text-xs text-gray-400 mb-4">Shown on every receipt.{!canEdit && ' Only a super admin can edit this.'}</p>
      {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
      {ok && <div className="mb-3 p-3 rounded-xl bg-green-50 text-green-700 text-sm">{ok}</div>}
      <fieldset disabled={!canEdit || busy} className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Business name</label><input className="input" value={f.name} onChange={set('name')} required /></div>
        <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={set('phone')} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div><label className="label">WhatsApp</label><input className="input" value={f.whatsapp} onChange={set('whatsapp')} /></div>
        <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={f.address} onChange={set('address')} required /></div>
        <div className="sm:col-span-2"><label className="label">Tagline / description</label><input className="input" value={f.description} onChange={set('description')} /></div>
        <div className="sm:col-span-2"><label className="label">Website</label><input className="input" value={f.website} onChange={set('website')} /></div>
      </fieldset>
      {canEdit && <button className="btn btn-gold mt-5" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>}
    </form>
  );
}

export function PasswordForm() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (next !== again) return setErr('The new passwords do not match.');
    setBusy(true);
    try {
      await api('/api/account/password', jsonInit('POST', { currentPassword: cur, newPassword: next }));
      setCur('');
      setNext('');
      setAgain('');
      setOk('Password changed.');
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 h-fit">
      <h2 className="font-bold text-lg mb-4">Change password</h2>
      {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
      {ok && <div className="mb-3 p-3 rounded-xl bg-green-50 text-green-700 text-sm">{ok}</div>}
      <label className="label">Current password</label>
      <input className="input mb-3" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
      <label className="label">New password (min. 8 characters)</label>
      <input className="input mb-3" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
      <label className="label">Repeat new password</label>
      <input className="input mb-5" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
