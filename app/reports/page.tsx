import { Shell } from '@/components/shell';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { money } from '@/lib/utils';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default async function Reports() {
  const u = await requireUser();
  const where = { businessId: u.businessId, paymentStatus: { not: 'CANCELLED' as const } };

  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - 5);

  const [totals, recentSales, items, owing] = await Promise.all([
    db.sale.aggregate({ where, _sum: { total: true, amountPaid: true, balance: true }, _count: true }),
    db.sale.findMany({ where: { ...where, createdAt: { gte: since } }, select: { createdAt: true, total: true, paymentMethod: true } }),
    db.saleItem.findMany({ where: { sale: where }, select: { quantity: true, subtotal: true, product: { select: { name: true } } } }),
    db.sale.findMany({
      where: { ...where, balance: { gt: 0 } },
      include: { customer: true, receipt: true },
      orderBy: { balance: 'desc' },
      take: 10,
    }),
  ]);

  // Revenue for each of the last 6 months
  const months: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    months.push({ key: monthKey(d), label: d.toLocaleString('en-NG', { month: 'short', year: '2-digit' }), total: 0 });
  }
  const byMethod = new Map<string, number>();
  for (const s of recentSales) {
    const m = months.find((x) => x.key === monthKey(s.createdAt));
    if (m) m.total += Number(s.total);
    byMethod.set(s.paymentMethod, (byMethod.get(s.paymentMethod) ?? 0) + Number(s.total));
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const methods = [...byMethod.entries()].sort((a, b) => b[1] - a[1]);
  const maxMethod = Math.max(1, ...methods.map(([, v]) => v));

  // Best-selling products by revenue
  const perProduct = new Map<string, { qty: number; revenue: number }>();
  for (const it of items) {
    const cur = perProduct.get(it.product.name) ?? { qty: 0, revenue: 0 };
    cur.qty += it.quantity;
    cur.revenue += Number(it.subtotal);
    perProduct.set(it.product.name, cur);
  }
  const top = [...perProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

  const cards: [string, string][] = [
    ['Total sales', money(Number(totals._sum.total ?? 0))],
    ['Collected', money(Number(totals._sum.amountPaid ?? 0))],
    ['Outstanding', money(Number(totals._sum.balance ?? 0))],
    ['Receipts', String(totals._count)],
  ];

  return (
    <Shell title="Reports">
      <p className="text-xs text-gray-400 mb-4">Cancelled receipts are excluded from all figures.</p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map(([a, b]) => (
          <div className="card p-5" key={a}>
            <div className="text-xs text-gray-500">{a}</div>
            <div className="text-xl md:text-2xl font-bold mt-2">{b}</div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h2 className="font-bold text-lg mb-4">Sales by month</h2>
          <div className="space-y-3">
            {months.map((m) => (
              <div key={m.key}>
                <div className="flex justify-between text-xs mb-1"><span>{m.label}</span><span className="font-semibold">{money(m.total)}</span></div>
                <div className="h-2 rounded-full bg-[#f1ecdc]"><div className="h-2 rounded-full gold-bg" style={{ width: `${(m.total / maxMonth) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold text-lg mb-4">By payment method <span className="text-xs font-normal text-gray-400">(last 6 months)</span></h2>
          <div className="space-y-3">
            {methods.map(([name, v]) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1"><span>{name.replace('_', ' ')}</span><span className="font-semibold">{money(v)}</span></div>
                <div className="h-2 rounded-full bg-[#f1ecdc]"><div className="h-2 rounded-full bg-[#171717]" style={{ width: `${(v / maxMethod) * 100}%` }} /></div>
              </div>
            ))}
            {methods.length === 0 && <div className="text-sm text-gray-400">No sales in this period.</div>}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-bold text-lg mb-4">Best-selling products</h2>
          {top.map(([name, v], i) => (
            <div key={name} className="flex justify-between border-b last:border-0 py-3 text-sm">
              <div><b>{i + 1}. {name}</b><div className="text-xs text-gray-400">{v.qty} sold</div></div>
              <div className="font-semibold">{money(v.revenue)}</div>
            </div>
          ))}
          {top.length === 0 && <div className="text-sm text-gray-400">No sales yet.</div>}
        </div>
        <div className="card p-5">
          <h2 className="font-bold text-lg mb-4">Customers who owe</h2>
          {owing.map((s) => (
            <a key={s.id} href={`/receipts/${s.id}`} className="flex justify-between border-b last:border-0 py-3 text-sm hover:bg-[#faf7ed]">
              <div><b>{s.customer.name}</b><div className="text-xs text-gray-400">{s.receipt?.receiptNumber}</div></div>
              <div className="font-semibold text-red-600">{money(s.balance.toString())}</div>
            </a>
          ))}
          {owing.length === 0 && <div className="text-sm text-gray-400">Nobody owes anything.</div>}
        </div>
      </div>
    </Shell>
  );
}
