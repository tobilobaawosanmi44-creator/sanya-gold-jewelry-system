import { receiptLinks } from '@/lib/site';
import type { ReceiptSale } from '@/lib/receipt-pdf';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ESC[c]);
const money = (v: { toString(): string }) => `₦${Number(v.toString()).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Builds the subject, plain-text and HTML bodies for a receipt email.
export function buildReceiptEmail(s: ReceiptSale, base: string, note?: string) {
  const rc = s.receipt!;
  const biz = s.business;
  const link = receiptLinks(rc.verificationToken, base).pdf;
  const number = rc.receiptNumber;
  const total = money(s.total);
  const balance = money(s.balance);
  const due = Number(s.balance) > 0;
  const first = s.customer.name.trim().split(/\s+/)[0] || 'there';

  const text = [
    `Hello ${first},`,
    '',
    note || '',
    `Thank you for shopping with ${biz.name}. Your receipt ${number} is attached (total ${total}).`,
    due ? `Balance outstanding: ${balance}.` : '',
    '',
    `You can also view it online: ${link}`,
    '',
    biz.name,
    [biz.phone, biz.email].filter(Boolean).join(' · '),
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#171717">
  <div style="border-bottom:3px solid #b8901f;padding-bottom:12px;margin-bottom:20px"><b style="font-size:20px">${esc(biz.name.toUpperCase())}</b></div>
  <p>Hello ${esc(first)},</p>
  ${note ? `<p style="white-space:pre-line">${esc(note)}</p>` : ''}
  <p>Thank you for shopping with ${esc(biz.name)}. Your receipt is attached to this email.</p>
  <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
    <tr><td style="padding:4px 24px 4px 0;color:#777">Receipt</td><td><b>${esc(number)}</b></td></tr>
    <tr><td style="padding:4px 24px 4px 0;color:#777">Total</td><td><b>${esc(total)}</b></td></tr>
    ${due ? `<tr><td style="padding:4px 24px 4px 0;color:#777">Balance due</td><td><b style="color:#b00020">${esc(balance)}</b></td></tr>` : ''}
  </table>
  <p><a href="${esc(link)}" style="background:#171717;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;display:inline-block">View receipt online</a></p>
  <p style="color:#777;font-size:12px;margin-top:28px">${esc(biz.name)}<br>${esc(biz.address)}<br>${esc([biz.phone, biz.email].filter(Boolean).join(' · '))}</p>
</div>`;

  return { subject: `Your receipt ${number} from ${biz.name}`, text, html };
}
