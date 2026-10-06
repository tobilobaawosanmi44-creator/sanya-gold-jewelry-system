import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, HttpError } from '@/lib/http';

const round2 = (n: number) => Math.round(n * 100) / 100;

const item = z.object({
  productId: z.string().min(1, 'Choose a product'),
  description: z.string().optional(),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
  unitPrice: z.coerce.number().nonnegative(),
  discount: z.coerce.number().min(0).default(0),
});

const schema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  items: z.array(item).min(1, 'Add at least one item'),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'OTHER']),
  paymentStatus: z.enum(['PAID', 'PARTIALLY_PAID', 'PENDING']),
  amountPaid: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  customerMessage: z.string().optional(),
});

export async function POST(req: Request) {
  const u = await requireUser();
  try {
    const b = schema.parse(await req.json());

    for (const i of b.items) {
      const lineTotal = round2(i.quantity * i.unitPrice - i.discount);
      if (lineTotal < 0) throw new HttpError('An item discount cannot be greater than its line value.');
    }

    const subtotal = round2(b.items.reduce((a, i) => a + (i.quantity * i.unitPrice - i.discount), 0));
    const total = round2(subtotal - b.discount + b.tax);
    if (total <= 0) throw new HttpError('The total must be greater than zero.');
    if (b.discount > subtotal) throw new HttpError('The overall discount cannot be greater than the subtotal.');

    let amountPaid = b.amountPaid;
    if (b.paymentStatus === 'PAID') amountPaid = total;
    else if (b.paymentStatus === 'PENDING') amountPaid = 0;
    else if (!(amountPaid > 0 && amountPaid < total)) {
      throw new HttpError('For a partial payment, enter an amount paid that is more than 0 and less than the total.');
    }

    const customer = await db.customer.findFirst({ where: { id: b.customerId, businessId: u.businessId }, select: { id: true } });
    if (!customer) throw new HttpError('Customer not found.');

    const requestedQty = new Map<string, number>();
    for (const i of b.items) requestedQty.set(i.productId, (requestedQty.get(i.productId) || 0) + i.quantity);
    const productIds = [...requestedQty.keys()];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, businessId: u.businessId, active: true },
      select: { id: true, name: true, stockQty: true },
    });
    if (products.length !== productIds.length) throw new HttpError('One of the selected products is no longer available.');
    for (const p of products) {
      const needed = requestedQty.get(p.id) || 0;
      if (p.stockQty < needed) throw new HttpError(`Insufficient stock for ${p.name}. Available: ${p.stockQty}. Requested: ${needed}.`);
    }

    const sale = await db.$transaction(async (tx) => {
      const existing = await tx.receipt.count({ where: { sale: { businessId: u.businessId } } });
      const current = await tx.business.findUniqueOrThrow({ where: { id: u.businessId }, select: { receiptCounter: true } });
      if (current.receiptCounter < existing) {
        await tx.business.update({ where: { id: u.businessId }, data: { receiptCounter: existing } });
      }

      let receiptNumber = '';
      for (let attempt = 0; attempt < 20; attempt++) {
        const biz = await tx.business.update({
          where: { id: u.businessId },
          data: { receiptCounter: { increment: 1 } },
          select: { receiptCounter: true },
        });
        const candidate = `SGJ-${new Date().getFullYear()}-${String(biz.receiptCounter).padStart(6, '0')}`;
        const taken = await tx.receipt.findUnique({ where: { receiptNumber: candidate }, select: { id: true } });
        if (!taken) { receiptNumber = candidate; break; }
      }
      if (!receiptNumber) throw new HttpError('Could not allocate a receipt number. Please try again.', 500);

      for (const p of products) {
        const quantity = requestedQty.get(p.id) || 0;
        const changed = await tx.product.updateMany({
          where: { id: p.id, businessId: u.businessId, active: true, stockQty: { gte: quantity } },
          data: { stockQty: { decrement: quantity } },
        });
        if (changed.count !== 1) throw new HttpError(`Stock changed while processing ${p.name}. Please try the sale again.`);
        await tx.stockMovement.create({
          data: { productId: p.id, type: 'SALE', quantity: -quantity, previousQty: p.stockQty, newQty: p.stockQty - quantity, note: 'Stock deducted when sale was completed.' },
        });
      }

      const created = await tx.sale.create({
        data: {
          businessId: u.businessId,
          customerId: b.customerId,
          staffId: u.id,
          subtotal,
          discount: b.discount,
          tax: b.tax,
          total,
          amountPaid,
          balance: round2(total - amountPaid),
          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
          notes: b.notes || null,
          customerMessage: b.customerMessage || null,
          items: {
            create: b.items.map((i) => ({
              productId: i.productId,
              description: i.description || null,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              subtotal: round2(i.quantity * i.unitPrice - i.discount),
            })),
          },
          receipt: { create: { receiptNumber, verificationToken: crypto.randomBytes(24).toString('hex') } },
        },
      });

      if (amountPaid > 0) {
        await tx.payment.create({ data: { saleId: created.id, amount: amountPaid, method: b.paymentMethod } });
      }
      await tx.auditLog.create({
        data: { businessId: u.businessId, userId: u.id, action: 'RECEIPT_CREATED', recordType: 'SALE', recordId: created.id },
      });
      return created;
    });

    return NextResponse.json({ id: sale.id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
