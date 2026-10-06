import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, HttpError } from '@/lib/http';

const s = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

export async function POST(req: Request) {
  const u = await requireUser();
  try {
    const b = s.parse(await req.json());
    if (!(await bcrypt.compare(b.currentPassword, u.passwordHash))) throw new HttpError('Current password is incorrect.');
    if (b.currentPassword === b.newPassword) throw new HttpError('Choose a password different from the current one.');
    await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(b.newPassword, 12) } });
    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'PASSWORD_CHANGED', recordType: 'USER', recordId: u.id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
