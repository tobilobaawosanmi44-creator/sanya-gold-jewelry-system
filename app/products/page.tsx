import { Shell } from '@/components/shell';
import { AddProduct } from '@/components/add-product';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { money } from '@/lib/utils';

export default async function Products() {
  const u = await requireUser();
  const rows = await db.product.findMany({ where: { businessId: u.businessId }, orderBy: [{ category: 'asc' }, { name: 'asc' }], take: 500 });

  return (
    <Shell title="Products">
      <div className="grid xl:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="card p-5">
          <div className="mb-5">
            <h2 className="font-bold text-lg">Catalogue</h2>
            <p className="text-xs text-gray-400">{rows.length} products</p>
          </div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y text-left text-xs text-gray-400">
                  <th className="py-3">Product</th><th>SKU</th><th>Category</th><th className="text-right">Price</th><th className="text-right">In stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-3"><b>{p.name}</b></td>
                    <td className="text-gray-500">{p.sku}</td>
                    <td>{p.category}</td>
                    <td className="text-right">{money(p.price.toString())}</td>
                    <td className={`text-right ${p.stockQty < 5 ? 'text-red-600 font-bold' : ''}`}>{p.stockQty}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No products yet. Add your first one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <AddProduct />
      </div>
    </Shell>
  );
}
