'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';

export function CustomerActions({ id, name, hasSales }: { id: string; name: string; hasSales: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (hasSales) {
      setError('Cannot delete: this customer has sales history.');
      return;
    }
    if (!window.confirm(`Delete customer "${name}"? This cannot be undone.`)) return;

    setBusy(true);
    setError('');
    try {
      await api(`/api/customers?id=${encodeURIComponent(id)}`, jsonInit('DELETE', null));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={busy || hasSales}
        title={hasSales ? 'Customers with sales history cannot be deleted' : 'Delete customer'}
        className="text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="max-w-[180px] text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
