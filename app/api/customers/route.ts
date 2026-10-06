import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail } from '@/lib/http';

const s = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  phone: z.string().trim().min(7, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  address: z.string().trim().optional(),
});

export async function GET(req: Request) {
  const u = await requireUser();
  const q = new URL(req.url).searchParams.get('q') || '';
  return NextResponse.json(
    await db.customer.findMany({
      where: {
        businessId: u.businessId,
        OR: q ? [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  );
}

export async function POST(req: Request) {
  const u = await requireUser();
  try {
    const b = s.parse(await req.json());
    const c = await db.customer.create({
      data: { businessId: u.businessId, name: b.name, phone: b.phone, email: b.email || null, address: b.address || null },
    });
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'CUSTOMER_CREATED', recordType: 'CUSTOMER', recordId: c.id },
    });
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  const u = await requireUser();
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Customer ID is required.' }, { status: 400 });

    const customer = await db.customer.findFirst({
      where: { id, businessId: u.businessId },
      include: { _count: { select: { sales: true } } },
    });

    if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });

    // Never delete a customer that has sales history. This protects receipts,
    // reports and financial records from losing their customer relationship.
    if (customer._count.sales > 0) {
      return NextResponse.json(
        { error: 'This customer cannot be deleted because they have sales/receipt history. Keep the customer record to preserve business records.' },
        { status: 409 },
      );
    }

    await db.customer.delete({ where: { id: customer.id } });
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'CUSTOMER_DELETED', recordType: 'CUSTOMER', recordId: customer.id },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
