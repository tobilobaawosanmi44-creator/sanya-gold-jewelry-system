import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, HttpError } from '@/lib/http';

// Cancels a receipt: it is excluded from reports, and the items go back into stock.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  try {
    await db.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, businessId: u.businessId },
        include: { receipt: true, items: { select: { productId: true, quantity: true } } },
      });
      if (!sale || !sale.receipt) throw new HttpError('Receipt not found.', 404);
      if (sale.receipt.status === 'CANCELLED') throw new HttpError('This receipt is already cancelled.');

      const qty = new Map<string, number>();
      for (const i of sale.items) qty.set(i.productId, (qty.get(i.productId) ?? 0) + i.quantity);
      for (const [productId, q] of qty) {
        const p = await tx.product.findUnique({ where: { id: productId }, select: { stockQty: true } });
        if (!p) continue;
        await tx.product.update({ where: { id: productId }, data: { stockQty: { increment: q } } });
        await tx.stockMovement.create({
          data: {
            productId,
            type: 'ADJUSTMENT',
            quantity: q,
            previousQty: p.stockQty,
            newQty: p.stockQty + q,
            saleId: id,
            note: `Stock restored: receipt ${sale.receipt.receiptNumber} was cancelled.`,
          },
        });
      }

      await tx.receipt.update({ where: { saleId: id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await tx.sale.update({ where: { id }, data: { paymentStatus: 'CANCELLED' } });
      await tx.auditLog.create({
        data: { businessId: u.businessId, userId: u.id, action: 'RECEIPT_CANCELLED', recordType: 'SALE', recordId: id },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
