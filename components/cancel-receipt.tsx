'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export function CancelReceipt({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!window.confirm(`Cancel receipt ${number}?\n\nIt will be marked CANCELLED, removed from all sales reports, and the items go back into stock. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/api/receipts/${id}/cancel`, { method: 'POST' });
      router.refresh();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-light text-red-600" onClick={cancel} disabled={busy}>
      {busy ? 'Cancelling…' : 'Cancel receipt'}
    </button>
  );
}
