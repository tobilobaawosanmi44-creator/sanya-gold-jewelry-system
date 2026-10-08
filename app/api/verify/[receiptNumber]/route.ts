import { NextResponse } from 'next/server';
import { findReceipt } from '@/lib/verify';

export async function GET(_req: Request, { params }: { params: Promise<{ receiptNumber: string }> }) {
  const { receiptNumber: key } = await params;
  const found = await findReceipt(key);
  if (!found) return NextResponse.json({ valid: false, status: 'NOT_FOUND' }, { status: 404 });
  const { r, full } = found;
  const base = { valid: r.status === 'VALID', status: r.status, receiptNumber: r.receiptNumber, date: r.sale.createdAt, business: r.sale.business.name };
  return NextResponse.json(
    full ? { ...base, amount: r.sale.total, paymentStatus: r.sale.paymentStatus, customer: r.sale.customer.name } : base,
  );
}
