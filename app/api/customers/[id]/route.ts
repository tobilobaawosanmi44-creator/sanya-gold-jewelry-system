import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, HttpError } from '@/lib/http';
import { customerSchema } from '@/lib/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const u = await requireUser();
  const { id } = await params;
  try {
    const b = customerSchema.parse(await req.json());
    const r = await db.customer.updateMany({
      where: { id, businessId: u.businessId },
      data: { name: b.name, phone: b.phone, email: b.email || null, address: b.address || null },
    });
    if (!r.count) throw new HttpError('Customer not found.', 404);
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'CUSTOMER_UPDATED', recordType: 'CUSTOMER', recordId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// A customer with receipts is archived (hidden from lists; their receipts and reports stay intact).
// A customer with no receipts is deleted outright.
export async function DELETE(_req: Request, { params }: Ctx) {
  const u = await requireUser();
  const { id } = await params;
  try {
    const c = await db.customer.findFirst({
      where: { id, businessId: u.businessId },
      include: { _count: { select: { sales: true } } },
    });
    if (!c) throw new HttpError('Customer not found.', 404);
    const archived = c._count.sales > 0;
    if (archived) await db.customer.update({ where: { id }, data: { active: false } });
    else await db.customer.delete({ where: { id } });
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: archived ? 'CUSTOMER_ARCHIVED' : 'CUSTOMER_DELETED', recordType: 'CUSTOMER', recordId: id },
    });
    return NextResponse.json({ ok: true, archived });
  } catch (e) {
    return fail(e);
  }
}
