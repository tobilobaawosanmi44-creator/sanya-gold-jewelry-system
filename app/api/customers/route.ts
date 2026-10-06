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
