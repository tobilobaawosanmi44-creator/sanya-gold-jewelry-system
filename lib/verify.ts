import { db } from '@/lib/db';

// Looks a receipt up by its secret token (full details) or by its public number (minimal details).
// Receipt numbers are sequential and guessable, so a number alone never reveals customer or amount.
export async function findReceipt(key: string) {
  const byToken = /^[a-f0-9]{48}$/.test(key);
  const r = await db.receipt.findUnique({
    where: byToken ? { verificationToken: key } : { receiptNumber: key },
    include: { sale: { include: { customer: { select: { name: true } }, business: { select: { name: true } } } } },
  });
  return r ? { r, full: byToken } : null;
}
