import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import type { Prisma } from '@prisma/client';
import { receiptLinks } from '@/lib/site';

export const receiptInclude = {
  business: true,
  customer: true,
  staff: true,
  items: { include: { product: true } },
  receipt: true,
} satisfies Prisma.SaleInclude;

export type ReceiptSale = Prisma.SaleGetPayload<{ include: typeof receiptInclude }>;

const FONTS = path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const GOLD = '#b8901f';
const INK = '#171717';
const MUTED = '#777777';
const LINE = '#e4dcc6';

const naira = (v: { toString(): string } | number) =>
  `₦${Number(v.toString()).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const METHOD: Record<string, string> = { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', POS: 'POS', CARD: 'Card', OTHER: 'Other' };
const STATUS: Record<string, string> = { PAID: 'Paid in full', PARTIALLY_PAID: 'Partially paid', PENDING: 'Payment pending', CANCELLED: 'Cancelled' };

export async function renderReceiptPdf(s: ReceiptSale, base?: string): Promise<Buffer> {
  if (!s.receipt) throw new Error('Sale has no receipt');
  const rc = s.receipt;
  const b = s.business;
  const cancelled = rc.status === 'CANCELLED';
  const qr = await QRCode.toBuffer(receiptLinks(rc.verificationToken, base).verify, { margin: 1, width: 360 });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      font: path.join(FONTS, 'DejaVuSans.ttf'),
      info: { Title: `Receipt ${rc.receiptNumber}`, Author: b.name },
    });
    doc.registerFont('R', path.join(FONTS, 'DejaVuSans.ttf'));
    doc.registerFont('B', path.join(FONTS, 'DejaVuSans-Bold.ttf'));
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const L = 40;
      const W = doc.page.width - 80;
      const bottom = () => doc.page.height - 60;
      let y = 40;

      // ---- header ----
      doc.font('B').fontSize(18).fillColor(INK).text(b.name.toUpperCase(), L, y, { width: W * 0.58, lineBreak: false });
      doc.font('R').fontSize(8).fillColor(MUTED);
      let hy = y + 26;
      for (const line of [b.description, b.address, [b.phone, b.email].filter(Boolean).join('  ·  ')]) {
        if (line) {
          doc.text(line, L, hy, { width: W * 0.6, lineBreak: false, ellipsis: true });
          hy += 12;
        }
      }
      doc.font('R').fontSize(8).fillColor(MUTED).text('RECEIPT', L + W * 0.6, y, { width: W * 0.4, align: 'right', lineBreak: false });
      doc.font('B').fontSize(14).fillColor(INK).text(rc.receiptNumber, L + W * 0.6, y + 12, { width: W * 0.4, align: 'right', lineBreak: false });
      doc.font('R').fontSize(8.5).fillColor(MUTED).text(
        s.createdAt.toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        L + W * 0.6, y + 32, { width: W * 0.4, align: 'right', lineBreak: false },
      );
      if (cancelled) {
        doc.font('B').fontSize(11).fillColor('#b00020');
        doc.roundedRect(L + W - 96, y + 50, 96, 22, 3).lineWidth(1.5).strokeColor('#b00020').stroke();
        doc.text('CANCELLED', L + W - 96, y + 56, { width: 96, align: 'center', lineBreak: false });
      }
      y = Math.max(hy, y + 76) + 8;
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.5).strokeColor(GOLD).stroke();
      y += 16;

      // ---- customer / payment ----
      const colW = W / 3;
      const block = (x: number, label: string, main: string, sub?: string) => {
        doc.font('R').fontSize(7).fillColor(MUTED).text(label, x, y, { width: colW - 10, lineBreak: false });
        doc.font('B').fontSize(10.5).fillColor(INK).text(main, x, y + 11, { width: colW - 10, lineBreak: false, ellipsis: true });
        if (sub) doc.font('R').fontSize(8.5).fillColor(MUTED).text(sub, x, y + 26, { width: colW - 10, lineBreak: false, ellipsis: true });
      };
      block(L, 'CUSTOMER', s.customer.name, [s.customer.phone, s.customer.email].filter(Boolean).join('  ·  '));
      block(L + colW, 'PAYMENT', METHOD[s.paymentMethod] ?? s.paymentMethod, STATUS[s.paymentStatus] ?? s.paymentStatus);
      block(L + colW * 2, 'SERVED BY', s.staff.name);
      y += 52;

      // ---- items ----
      const widths = [W * 0.46, W * 0.1, W * 0.22, W * 0.22];
      const head = ['Item', 'Qty', 'Unit price', 'Subtotal'];
      const aligns: ('left' | 'right')[] = ['left', 'right', 'right', 'right'];
      const drawHead = () => {
        doc.rect(L, y, W, 20).fill(INK);
        doc.font('B').fontSize(7.5).fillColor('#ffffff');
        let cx = L;
        head.forEach((h, i) => {
          doc.text(h.toUpperCase(), cx + 8, y + 7, { width: widths[i] - 16, align: aligns[i], lineBreak: false });
          cx += widths[i];
        });
        y += 20;
      };
      drawHead();
      s.items.forEach((it, idx) => {
        const rowH = 32;
        if (y + rowH > bottom()) {
          doc.addPage();
          y = 40;
          drawHead();
        }
        if (idx % 2 === 1) doc.rect(L, y, W, rowH).fill('#faf8f1');
        let cx = L;
        doc.font('B').fontSize(9.5).fillColor(INK).text(it.product.name, cx + 8, y + 7, { width: widths[0] - 16, lineBreak: false, ellipsis: true });
        doc.font('R').fontSize(7.5).fillColor(MUTED).text(it.product.category, cx + 8, y + 20, { width: widths[0] - 16, lineBreak: false, ellipsis: true });
        cx += widths[0];
        const cell = (text: string, w: number) => {
          doc.font('R').fontSize(9.5).fillColor(INK).text(text, cx + 8, y + 11, { width: w - 16, align: 'right', lineBreak: false });
          cx += w;
        };
        cell(String(it.quantity), widths[1]);
        cell(naira(it.unitPrice), widths[2]);
        doc.font('B');
        cell(naira(it.subtotal), widths[3]);
        doc.moveTo(L, y + rowH).lineTo(L + W, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
        y += rowH;
      });
      y += 16;

      // ---- totals + QR ----
      if (y + 150 > bottom()) {
        doc.addPage();
        y = 40;
      }
      const tw = 235;
      const tx = L + W - tw;
      const line = (label: string, value: string, o: { bold?: boolean; size?: number; color?: string } = {}) => {
        doc.font(o.bold ? 'B' : 'R').fontSize(o.size ?? 9.5).fillColor(o.color ?? INK);
        doc.text(label, tx, y, { width: tw * 0.45, lineBreak: false });
        doc.text(value, tx + tw * 0.4, y, { width: tw * 0.6, align: 'right', lineBreak: false });
        y += (o.size ?? 9.5) + 8;
      };
      const top = y;
      line('Subtotal', naira(s.subtotal));
      if (Number(s.discount) > 0) line('Discount', `-${naira(s.discount)}`);
      if (Number(s.tax) > 0) line('Tax', naira(s.tax));
      doc.moveTo(tx, y).lineTo(tx + tw, y).lineWidth(1).strokeColor(INK).stroke();
      y += 7;
      line('Total', naira(s.total), { bold: true, size: 13 });
      line('Amount paid', naira(s.amountPaid));
      line('Balance', naira(s.balance), { bold: true, color: Number(s.balance) > 0 ? '#b00020' : INK });

      // QR on the left, level with the totals
      doc.image(qr, L, top, { width: 92 });
      doc.font('R').fontSize(7).fillColor(MUTED).text('Scan to verify this receipt', L, top + 96, { width: 92, align: 'center', lineBreak: false });
      y = Math.max(y, top + 112) + 18;

      // ---- message + guarantee ----
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(LINE).stroke();
      y += 12;
      doc.font('B').fontSize(8.5).fillColor(INK).text(`All jewelry sold by ${b.name} is new 18KT Italian gold jewelry.`, L, y, { width: W });
      y += 16;
      doc.font('R').fontSize(8.5).fillColor(MUTED).text(s.customerMessage || `Thank you for choosing ${b.name}. Your trust means everything to us.`, L, y, { width: W });

      // ---- footer ----
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0;
        doc.font('R').fontSize(7).fillColor(MUTED);
        doc.text(`${b.name}  ·  ${rc.receiptNumber}`, L, doc.page.height - 32, { width: W - 80, lineBreak: false });
        if (range.count > 1) doc.text(`Page ${i + 1} of ${range.count}`, L + W - 80, doc.page.height - 32, { width: 80, align: 'right', lineBreak: false });
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
