import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, HttpError } from '@/lib/http';
import { receiptInclude, renderReceiptPdf } from '@/lib/receipt-pdf';
import { emailConfigured, sendMail, MailError } from '@/lib/mailer';
import { siteUrl } from '@/lib/site';
import { buildReceiptEmail } from '@/lib/receipt-email';

const body = z.object({
  to: z.string().trim().email('Enter a valid email address'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').optional(),
});

// Emails the receipt (PDF attached + a link) to the address typed in by staff.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  try {
    const b = body.parse(await req.json());
    if (!emailConfigured()) throw new HttpError('Email sending is not set up yet.', 501);

    const s = await db.sale.findFirst({ where: { id, businessId: u.businessId }, include: receiptInclude });
    if (!s || !s.receipt) throw new HttpError('Receipt not found.', 404);
    if (s.receipt.status === 'CANCELLED') throw new HttpError("A cancelled receipt can't be emailed.");

    const base = siteUrl(new URL(req.url).origin);
    const pdf = await renderReceiptPdf(s, base);
    const number = s.receipt.receiptNumber;
    const mail = buildReceiptEmail(s, base, b.note);

    try {
      await sendMail({
        to: b.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        fromName: s.business.name,
        replyTo: s.business.email || undefined,
        attachments: [{ filename: `Receipt-${number}.pdf`, content: pdf, contentType: 'application/pdf' }],
      });
    } catch (e) {
      if (e instanceof MailError) return NextResponse.json({ error: e.message }, { status: 502 });
      throw e;
    }

    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'RECEIPT_EMAILED', recordType: 'SALE', recordId: id, metadata: { to: b.to, receipt: number } },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
