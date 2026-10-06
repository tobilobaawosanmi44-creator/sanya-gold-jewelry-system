import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail } from '@/lib/http';

const s = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  sku: z.string().trim().min(2, 'SKU is too short'),
  category: z.string().trim().min(1, 'Choose a category'),
  description: z.string().trim().optional(),
  price: z.coerce.number().positive('Price must be greater than zero'),
  stockQty: z.coerce.number().int().min(0, 'Stock cannot be negative'),
});

export async function GET() {
  const u = await requireUser();
  return NextResponse.json(await db.product.findMany({ where: { businessId: u.businessId, active: true }, orderBy: { createdAt: 'desc' } }));
}

export async function POST(req: Request) {
  const u = await requireUser();
  try {
    const b = s.parse(await req.json());
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
