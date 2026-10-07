'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';

type Customer = { id: string; name: string; phone: string };
type Product = { id: string; name: string; price: string | number; stockQty?: number };
type Line = { productId: string; quantity: number; unitPrice: string };

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewReceipt() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [status, setStatus] = useState('PAID');
  const [paid, setPaid] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api<Customer[]>('/api/customers'), api<Product[]>('/api/products')])
      .then(([c, p]) => {
        setCustomers(c);
        setProducts(p);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const lineTotal = (l: Line) => l.quantity * (Number(l.unitPrice) || 0);
  const total = lines.reduce((a, l) => a + lineTotal(l), 0);
  const productOf = (id: string) => products.find((x) => x.id === id);
  const pricesOk = lines.length > 0 && lines.every((l) => Number(l.unitPrice) > 0);
  const stockOk = lines.every((l) => l.quantity <= (productOf(l.productId)?.stockQty ?? Infinity));

  function addLine() {
    const p = products[0];
    if (p) setLines((x) => [...x, { productId: p.id, quantity: 1, unitPrice: '' }]);
  }
  const patch = (n: number, change: Partial<Line>) => setLines((a) => a.map((l, k) => (k === n ? { ...l, ...change } : l)));

  async function createCustomer() {
    setCreating(true);
    setError('');
    try {
      const c = await api<Customer>('/api/customers', jsonInit('POST', { name: newName, phone: newPhone }));
      setCustomers((x) => [c, ...x]);
      setCustomerId(c.id);
      setShowNew(false);
      setNewName('');
      setNewPhone('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const j = await api<{ id: string }>(
        '/api/sales',
        jsonInit('POST', {
          customerId,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: Number(l.unitPrice), discount: 0 })),
          discount: 0,
          tax: 0,
          paymentMethod: method,
          paymentStatus: status,
          amountPaid: status === 'PARTIALLY_PAID' ? Number(paid || 0) : 0,
          customerMessage: 'Thank you for choosing Sanya Gold Jewelry.',
        }),
      );
      router.push('/receipts/' + j.id);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-2xl font-black">Create Receipt</div>
            <div className="text-xs text-gray-500">New 18KT Italian gold jewelry sale</div>
          </div>
          <a href="/dashboard" className="btn btn-light">Back</a>
        </div>
        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700">{error}</div>}
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <section className="card p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">Customer</h2>
              <button type="button" className="btn btn-light text-sm" onClick={() => setShowNew((v) => !v)}>
                {showNew ? 'Cancel' : '＋ New customer'}
              </button>
            </div>
            {showNew && (
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mb-4 p-4 rounded-xl bg-[#faf7ed] border border-[#eee2bc]">
                <input className="input" placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className="input" placeholder="Phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                <button type="button" className="btn btn-gold" disabled={creating || newName.trim().length < 2 || newPhone.trim().length < 7} onClick={createCustomer}>
                  {creating ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
            <select className="input mb-6" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{loading ? 'Loading…' : 'Select customer'}</option>
              {customers.map((c) => (
                <option value={c.id} key={c.id}>{c.name} · {c.phone}</option>
              ))}
            </select>

            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">Items</h2>
              <button type="button" className="btn btn-light text-sm" onClick={addLine} disabled={!products.length}>＋ Add item</button>
            </div>
            {!loading && products.length === 0 && (
              <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm mb-3">
                No products yet. <a className="underline" href="/products">Add a product</a> first.
              </div>
            )}
            {lines.length === 0 && <div className="border border-dashed rounded-xl p-8 text-center text-gray-400">Add a product to begin.</div>}
            {lines.map((l, n) => {
              const p = productOf(l.productId);
              const ref = Number(p?.price ?? 0);
              const over = p?.stockQty !== undefined && l.quantity > p.stockQty;
              return (
                <div className="grid md:grid-cols-[1fr_80px_160px_120px_32px] gap-3 border-b py-4 items-start" key={n}>
                  <div>
                    <select
                      className="input"
                      value={l.productId}
                      onChange={(e) => patch(n, { productId: e.target.value, unitPrice: '' })}
                    >
                      {products.map((x) => (
                        <option key={x.id} value={x.id}>{x.name} · {x.stockQty ?? 0} in stock</option>
                      ))}
                    </select>
                    {over && <div className="text-xs text-red-600 mt-1">Only {p?.stockQty} in stock.</div>}
                  </div>
                  <input className="input" type="number" min="1" value={l.quantity} onChange={(e) => patch(n, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} aria-label="Quantity" />
                  <div>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Enter price (₦)"
                      value={l.unitPrice}
                      onChange={(e) => patch(n, { unitPrice: e.target.value })}
                      aria-label="Price per item"
                    />
                    {ref > 0 && !l.unitPrice && (
                      <button type="button" className="text-[11px] text-gray-500 underline mt-1" onClick={() => patch(n, { unitPrice: String(ref) })}>
                        Use last catalogue price {naira(ref)}
                      </button>
                    )}
                  </div>
                  <div className="font-bold pt-2">{naira(lineTotal(l))}</div>
                  <button type="button" aria-label="Remove item" className="text-gray-400 hover:text-red-600 text-lg pt-1" onClick={() => setLines((a) => a.filter((_, k) => k !== n))}>✕</button>
                </div>
              );
            })}
            {lines.length > 0 && !pricesOk && <p className="text-xs text-amber-700 mt-3">Enter the price for every item before generating the receipt.</p>}
          </section>

          <aside className="card p-5 h-fit">
            <h2 className="font-bold mb-5">Payment</h2>
            <label className="label">Payment method</label>
            <select className="input mb-4" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="POS">POS</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
            <label className="label">Status</label>
            <select className="input mb-4" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PAID">Paid in full</option>
              <option value="PARTIALLY_PAID">Partially paid</option>
              <option value="PENDING">Pending (nothing paid yet)</option>
            </select>
            {status === 'PARTIALLY_PAID' && (
              <>
                <label className="label">Amount paid</label>
                <input className="input mb-4" type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
              </>
            )}
            {status === 'PAID' && <p className="text-xs text-gray-500 mb-4">The full total will be recorded as paid.</p>}
            <div className="border-t pt-4 flex justify-between text-lg font-black">
              <span>Total</span><span>{naira(total)}</span>
            </div>
            <button type="button" disabled={saving || !customerId || !pricesOk || !stockOk} onClick={save} className="btn btn-gold w-full mt-5">
              {saving ? 'Generating…' : 'Generate Receipt'}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
