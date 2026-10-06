import { Shell } from '@/components/shell';
import { UserManager } from '@/components/user-manager';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function UsersPage() {
  const u = await requireUser();
  if (u.role !== 'SUPER_ADMIN') redirect('/dashboard');
  const users = await db.user.findMany({ where: { businessId: u.businessId }, select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  return <Shell title="Staff & Users"><UserManager initialUsers={users.map(x => ({ ...x, createdAt: x.createdAt.toISOString() }))} /></Shell>;
}
