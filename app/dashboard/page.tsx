import { Shell } from '@/components/shell';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { money } from '@/lib/utils';

export default async function Dashboard() {
  const u = await requireUser();

  const [sales, customers, receipts, pending, completed, recent] = await Promise.all([
    db.sale.aggregate({ where: { businessId: u.businessId }, _sum: { total: true } }),
    db.customer.count({ where: { businessId: u.businessId } }),
    db.receipt.count({ where: { sale: { businessId: u.businessId } } }),
    db.sale.aggregate({
      where: { businessId: u.businessId, paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      _sum: { balance: true },
    }),
    db.sale.count({ where: { businessId: u.businessId, paymentStatus: 'PAID' } }),
    db.sale.findMany({
      where: { businessId: u.businessId },
      include: { customer: true, receipt: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const cards = [
    ['Total Revenue', money(Number(sales._sum.total || 0))],
    ['Receipts', receipts],
    ['Customers', customers],
    ['Outstanding', money(Number(pending._sum.balance || 0))],
    ['Paid Transactions', completed],
  ];

  return (
    <Shell title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {cards.map(([label, value]) => (
          <div
            className="card min-w-0 p-4 sm:p-5 overflow-hidden"
            key={String(label)}
          >
            <div className="text-[11px] sm:text-xs text-gray-500 truncate">{label}</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold mt-2 break-words leading-tight">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="font-bold text-lg">Recent Transactions</h2>
              <p className="text-xs text-gray-400">Latest business activity</p>
            </div>
            <a className="btn btn-light text-xs w-full sm:w-auto text-center shrink-0" href="/receipts">
              View all
            </a>
          </div>

          <div className="space-y-2">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border-b last:border-0 py-3 min-w-0">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{s.receipt?.receiptNumber}</div>
                  <div className="text-xs text-gray-500 truncate">{s.customer.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm">{money(Number(s.total))}</div>
                  <div className="text-[10px] text-gray-400">{s.paymentStatus.replace('_', ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-5 min-w-0">
          <h2 className="font-bold text-lg">Quick Actions</h2>
          <div className="grid gap-3 mt-5">
            <a className="btn btn-gold w-full" href="/receipts/new">＋ Create Receipt</a>
            <a className="btn btn-light w-full" href="/customers">Add Customer</a>
            <a className="btn btn-light w-full" href="/products">Add Product</a>
          </div>

          <div className="mt-7 p-4 rounded-xl bg-[#faf7ed] border border-[#eee2bc]">
            <div className="font-semibold text-sm">Business rule</div>
            <p className="text-xs text-gray-600 mt-1">
              All jewelry sold is new 18KT Italian gold jewelry. Used gold is not bought or sold.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
