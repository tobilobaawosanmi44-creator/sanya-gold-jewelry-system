'use client';
import { useState } from 'react';
import { api, jsonInit } from '@/lib/client';
import { Modal } from '@/components/modal';
import { mailtoUrl, receiptText, whatsappUrl } from '@/lib/share';

type Props = {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  total: string;
  balance: string;
  balanceDue: boolean;
  link: string;
  businessName: string;
  emailConfigured: boolean;
};

export function ShareReceipt(p: Props) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [to, setTo] = useState(p.customerEmail);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState('');
  const [copied, setCopied] = useState(false);

  const text = receiptText({ businessName: p.businessName, customerName: p.customerName, number: p.number, total: p.total, balance: p.balance, balanceDue: p.balanceDue, link: p.link });
  const subject = `Your receipt ${p.number} from ${p.businessName}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(p.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this receipt link:', p.link);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setSent('');
    try {
      await api(`/api/receipts/${p.id}/email`, jsonInit('POST', { to, note }));
      setSent(`Receipt emailed to ${to}.`);
      setNote('');
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a className="btn text-white" style={{ background: '#1faa59' }} href={whatsappUrl(p.customerPhone, text)} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <button type="button" className="btn btn-light" onClick={() => { setErr(''); setSent(''); setEmailOpen(true); }}>
        Email
      </button>
      <button type="button" className="btn btn-light" onClick={copy}>
        {copied ? '✓ Link copied' : 'Copy link'}
      </button>

      {emailOpen && (
        <Modal title="Email this receipt" subtitle={`${p.number} · ${p.total}`} onClose={() => setEmailOpen(false)}>
          <form onSubmit={send}>
            {!p.emailConfigured && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
                Automatic email isn&apos;t set up yet, so the system can&apos;t send it for you. Use the button below to open your own email app with the message ready, or ask your administrator to finish the email setup.
              </div>
            )}
            {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
            {sent && <div className="mb-3 p-3 rounded-xl bg-green-50 text-green-700 text-sm">{sent}</div>}
            <label className="label">Customer&apos;s email address</label>
            <input className="input mb-3" type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" />
            {p.emailConfigured && (
              <>
                <label className="label">Personal note (optional)</label>
                <textarea className="input mb-4" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Thank you for your purchase!" />
                <p className="text-xs text-gray-400 mb-4">The PDF receipt is attached, along with a link to view it online.</p>
              </>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="btn btn-light" onClick={() => setEmailOpen(false)}>Close</button>
              {p.emailConfigured ? (
                <button className="btn btn-gold" disabled={busy || !to}>{busy ? 'Sending…' : 'Send receipt'}</button>
              ) : (
                <a className="btn btn-gold" href={to ? mailtoUrl(to, subject, text) : undefined} aria-disabled={!to}>Open in my email app</a>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
