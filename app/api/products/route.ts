import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail } from '@/lib/http';
import { productSchema } from '@/lib/validators';

export async function GET() {
  const u = await requireUser();
  return NextResponse.json(await db.product.findMany({ where: { businessId: u.businessId, active: true }, orderBy: { name: 'asc' } }));
}

export async function POST(req: Request) {
  const u = await requireUser();
  try {
    const b = productSchema.parse(await req.json());
    const p = await db.product.create({
      data: {
        businessId: u.businessId,
        name: b.name,
        sku: b.sku,
        category: b.category,
        description: b.description || null,
        price: b.price,
        stockQty: b.stockQty,
      },
    });
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'PRODUCT_CREATED', recordType: 'PRODUCT', recordId: p.id },
    });
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 });
    }
    return fail(e);
  }
}
