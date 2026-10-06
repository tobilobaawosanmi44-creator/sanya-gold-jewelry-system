import { Shell } from '@/components/shell';
import { BusinessForm, PasswordForm } from '@/components/settings-forms';
import { requireUser } from '@/lib/auth';

export default async function Settings() {
  const u = await requireUser();
  const b = u.business;
  return (
    <Shell title="Settings">
      <div className="grid xl:grid-cols-[1fr_340px] gap-6 items-start">
        <BusinessForm
          canEdit={u.role === 'SUPER_ADMIN'}
          initial={{
            name: b.name,
            phone: b.phone,
            email: b.email,
            address: b.address,
            description: b.description ?? '',
            whatsapp: b.whatsapp ?? '',
            website: b.website ?? '',
          }}
        />
        <PasswordForm />
      </div>
    </Shell>
  );
}
