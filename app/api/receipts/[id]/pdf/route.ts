import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { receiptInclude, renderReceiptPdf } from '@/lib/receipt-pdf';
import { siteUrl } from '@/lib/site';

// Staff view of a receipt as a real PDF. Add ?download=1 to download instead of opening it.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const s = await db.sale.findFirst({ where: { id, businessId: u.businessId }, include: receiptInclude });
  if (!s || !s.receipt) return new NextResponse('Not found', { status: 404 });
  try {
    const pdf = await renderReceiptPdf(s, siteUrl(new URL(req.url).origin));
    const download = new URL(req.url).searchParams.get('download') === '1';
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${download ? 'attachment' : 'inline'}; filename="Receipt-${s.receipt.receiptNumber}.pdf"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Receipt PDF failed', e);
    return new NextResponse('Could not generate the receipt PDF.', { status: 500 });
  }
}
