import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, HttpError } from '@/lib/http';

const s = z.object({
  name: z.string().trim().min(2, 'Business name is too short'),
  phone: z.string().trim().min(7, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address'),
  address: z.string().trim().min(3, 'Enter an address'),
  description: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  website: z.string().trim().optional(),
});

export async function PUT(req: Request) {
  const u = await requireUser();
  try {
    if (u.role !== 'SUPER_ADMIN') throw new HttpError('Only a super admin can change business settings.', 403);
    const b = s.parse(await req.json());
    await db.business.update({
      where: { id: u.businessId },
      data: {
        name: b.name,
        phone: b.phone,
        email: b.email,
        address: b.address,
        description: b.description || null,
        whatsapp: b.whatsapp || null,
        website: b.website || null,
      },
    });
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'SETTINGS_UPDATED', recordType: 'BUSINESS', recordId: u.businessId },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
