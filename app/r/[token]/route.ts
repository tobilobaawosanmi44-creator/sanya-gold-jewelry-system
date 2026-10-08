import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { receiptInclude, renderReceiptPdf } from '@/lib/receipt-pdf';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Public receipt link for customers (sent by WhatsApp / email). Protected only by the
// receipt's long random token, so it works without logging in but cannot be guessed.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) return new NextResponse('Receipt not found.', { status: 404 });
  const r = await db.receipt.findUnique({ where: { verificationToken: token }, select: { saleId: true } });
  if (!r) return new NextResponse('Receipt not found.', { status: 404 });
  const s = await db.sale.findUnique({ where: { id: r.saleId }, include: receiptInclude });
  if (!s || !s.receipt) return new NextResponse('Receipt not found.', { status: 404 });
  try {
    const pdf = await renderReceiptPdf(s, siteUrl(new URL(req.url).origin));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="Receipt-${s.receipt.receiptNumber}.pdf"`,
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  } catch (e) {
    console.error('Public receipt PDF failed', e);
    return new NextResponse('Could not load the receipt right now.', { status: 500 });
  }
}
