import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, HttpError } from '@/lib/http';
import { productSchema } from '@/lib/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const u = await requireUser();
  const { id } = await params;
  try {
    const b = productSchema.parse(await req.json());
    const existing = await db.product.findFirst({ where: { id, businessId: u.businessId }, select: { stockQty: true } });
    if (!existing) throw new HttpError('Product not found.', 404);
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { name: b.name, sku: b.sku, category: b.category, description: b.description || null, price: b.price, stockQty: b.stockQty },
      });
      if (existing.stockQty !== b.stockQty) {
        await tx.stockMovement.create({
          data: { productId: id, type: 'ADJUSTMENT', quantity: b.stockQty - existing.stockQty, previousQty: existing.stockQty, newQty: b.stockQty, note: `Stock edited manually by ${u.name}.` },
        });
      }
      await tx.auditLog.create({
        data: { businessId: u.businessId, userId: u.id, action: 'PRODUCT_UPDATED', recordType: 'PRODUCT', recordId: id },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Another product already uses this SKU.' }, { status: 409 });
    }
    return fail(e);
  }
}

// A product that appears on past receipts is archived (hidden; receipts and reports keep it).
// A product never sold is deleted outright.
export async function DELETE(_req: Request, { params }: Ctx) {
  const u = await requireUser();
  const { id } = await params;
  try {
    const p = await db.product.findFirst({
      where: { id, businessId: u.businessId },
      include: { _count: { select: { saleItems: true } } },
    });
    if (!p) throw new HttpError('Product not found.', 404);
    const archived = p._count.saleItems > 0;
    if (archived) {
      // Rename the SKU so it can be reused by a new product.
      await db.product.update({ where: { id }, data: { active: false, sku: `${p.sku}~archived-${Date.now()}` } });
    } else {
      await db.product.delete({ where: { id } });
    }
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: archived ? 'PRODUCT_ARCHIVED' : 'PRODUCT_DELETED', recordType: 'PRODUCT', recordId: id },
    });
    return NextResponse.json({ ok: true, archived });
  } catch (e) {
    return fail(e);
  }
}
