import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { money } from '@/lib/utils';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const s = await db.sale.findFirst({
    where: { id, businessId: u.businessId },
    include: { business: true, customer: true, staff: true, items: { include: { product: true } }, receipt: true },
  });
  if (!s || !s.receipt) return new NextResponse('Not found', { status: 404 });

  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '');
  const verifyUrl = `${base}/verify/${encodeURIComponent(s.receipt.receiptNumber)}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 260 });
  const b = s.business;
  const cancelled = s.receipt.status === 'CANCELLED';

  const rows = s.items
    .map(
      (i) =>
        `<tr><td>${esc(i.product.name)}<div class="muted">${esc(i.product.category)}</div></td><td>${i.quantity}</td><td class="r">${money(i.unitPrice.toString())}</td><td class="r">${money(i.subtotal.toString())}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.receipt.receiptNumber)}</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;padding:40px;color:#171717;max-width:800px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{font-size:24px;margin:0;letter-spacing:.5px}
.bar{height:4px;width:70px;background:#c9a227;margin:10px 0}
.muted{color:#777;font-size:12px}
.head{display:flex;justify-content:space-between;gap:24px}
.r{text-align:right}
.line{border-top:1px solid #ddd;margin:20px 0}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{font-size:11px;text-transform:uppercase;color:#888;text-align:left;padding:9px;border-bottom:1px solid #ccc}
th.r{text-align:right}
td{padding:9px;border-bottom:1px solid #eee;font-size:14px;text-align:left}
td.r{text-align:right}
.totals{margin-left:auto;width:280px;margin-top:16px;font-size:14px}
.totals div{display:flex;justify-content:space-between;padding:4px 0}
.totals .big{font-size:20px;font-weight:700;border-top:1px solid #ccc;margin-top:6px;padding-top:10px}
.foot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:28px}
.qr{text-align:center}
.qr img{width:120px;height:120px;display:block;margin:0 auto}
.stamp{color:#b00020;border:2px solid #b00020;display:inline-block;padding:4px 12px;font-weight:700;margin-top:10px}
@page{margin:14mm}
</style></head><body>
<div class="head">
  <div>
    <h1>${esc(b.name.toUpperCase())}</h1><div class="bar"></div>
    <div class="muted">${esc(b.description || '')}<br>${esc(b.address)}<br>${esc(b.phone)} · ${esc(b.email)}</div>
  </div>
  <div class="r"><div class="muted">RECEIPT</div><b>${esc(s.receipt.receiptNumber)}</b>
    <div class="muted" style="margin-top:6px">${esc(new Date(s.createdAt).toLocaleString('en-NG'))}</div>
    ${cancelled ? '<div class="stamp">CANCELLED</div>' : ''}
  </div>
</div>
<div class="line"></div>
<div class="muted">CUSTOMER</div><b>${esc(s.customer.name)}</b> · ${esc(s.customer.phone)}
<div class="muted" style="margin-top:6px">Served by ${esc(s.staff.name)}</div>
<table><tr><th>Item</th><th>Qty</th><th class="r">Unit</th><th class="r">Subtotal</th></tr>${rows}</table>
<div class="totals">
  <div><span>Subtotal</span><span>${money(s.subtotal.toString())}</span></div>
  <div><span>Discount</span><span>-${money(s.discount.toString())}</span></div>
  <div><span>Tax</span><span>${money(s.tax.toString())}</span></div>
  <div class="big"><span>Total</span><span>${money(s.total.toString())}</span></div>
  <div><span>Paid</span><span>${money(s.amountPaid.toString())}</span></div>
  <div><span>Balance</span><span>${money(s.balance.toString())}</span></div>
</div>
<div class="line"></div>
<div class="foot">
  <div class="muted" style="line-height:1.6"><b>Payment:</b> ${esc(s.paymentMethod.replace('_', ' '))}<br><b>Status:</b> ${esc(s.paymentStatus.replace('_', ' '))}<br><br>
    <b>All jewelry sold by ${esc(b.name)} is new 18KT Italian gold jewelry.</b><br>
    Thank you for choosing ${esc(b.name)}. Your trust means everything to us.</div>
  <div class="qr"><img src="${qr}" alt="Verification QR code"><div class="muted">Scan to verify this receipt</div></div>
</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},300)})</script>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `inline; filename="${s.receipt.receiptNumber.replace(/[^A-Za-z0-9_-]/g, '')}.html"`,
      'cache-control': 'no-store',
    },
  });
}
