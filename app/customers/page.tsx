import { Shell } from '@/components/shell';
import { AddCustomer } from '@/components/add-customer';
import { CustomerActions } from '@/components/customer-actions';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

export default async function Customers() {
  const u = await requireUser();
  const rows = await db.customer.findMany({
    where: { businessId: u.businessId },
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { _count: { select: { sales: true } } },
  });

  return (
    <Shell title="Customers">
      <div className="grid xl:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="card p-5">
          <div className="mb-5">
            <h2 className="font-bold text-lg">All customers</h2>
            <p className="text-xs text-gray-400">{rows.length} on record</p>
          </div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y text-left text-xs text-gray-400">
                  <th className="py-3">Name</th><th>Phone</th><th>Email</th><th className="text-right">Receipts</th><th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-3"><b>{c.name}</b><div className="text-xs text-gray-400">{c.address}</div></td>
                    <td>{c.phone}</td>
                    <td className="text-gray-500">{c.email}</td>
                    <td className="text-right">{c._count.sales}</td>
                    <td className="text-right"><CustomerActions id={c.id} name={c.name} hasSales={c._count.sales > 0} /></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No customers yet. Add your first one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <AddCustomer />
      </div>
    </Shell>
  );
}
