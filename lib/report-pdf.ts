import PDFDocument from 'pdfkit';
import path from 'path';
import type { Report } from '@/lib/reports';

const FONTS = path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const GOLD = '#b8901f';
const INK = '#171717';
const MUTED = '#777777';
const LINE = '#e4dcc6';
const SOFT = '#faf7ed';

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const METHOD: Record<string, string> = { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', POS: 'POS', CARD: 'Card', OTHER: 'Other' };
const STATUS: Record<string, string> = { PAID: 'Paid', PARTIALLY_PAID: 'Part paid', PENDING: 'Pending', CANCELLED: 'Cancelled' };

const fmtDateTime = (d: Date) =>
  d.toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Biz = { name: string; address: string; phone: string; email: string };

export function renderReportPdf(biz: Biz, r: Report, generatedBy: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      bufferPages: true,
      font: path.join(FONTS, 'DejaVuSans.ttf'),
      info: { Title: `${r.title} – ${r.label}`, Author: biz.name },
    });
    doc.registerFont('R', path.join(FONTS, 'DejaVuSans.ttf'));
    doc.registerFont('B', path.join(FONTS, 'DejaVuSans-Bold.ttf'));

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const L = 36;
      const W = doc.page.width - 72;
      const bottom = () => doc.page.height - 52;
      let y = 36;

      const newPage = () => {
        doc.addPage();
        y = 36;
      };

      // ---------- header ----------
      doc.font('B').fontSize(17).fillColor(INK).text(biz.name.toUpperCase(), L, y, { width: W * 0.6, lineBreak: false });
      doc.font('R').fontSize(8).fillColor(MUTED).text(`${biz.address}  ·  ${biz.phone}  ·  ${biz.email}`, L, y + 24, { width: W * 0.6, lineBreak: false });
      doc.font('B').fontSize(13).fillColor(INK).text(r.title, L + W * 0.55, y, { width: W * 0.45, align: 'right', lineBreak: false });
      doc.font('R').fontSize(10).fillColor(GOLD).text(r.label, L + W * 0.55, y + 19, { width: W * 0.45, align: 'right', lineBreak: false });
      y += 44;
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.5).strokeColor(GOLD).stroke();
      y += 14;

      // ---------- KPI boxes ----------
      const kpis: [string, string][] = [
        ['TOTAL SALES', naira(r.totals.total)],
        ['COLLECTED', naira(r.totals.paid)],
        ['OUTSTANDING', naira(r.totals.balance)],
        ['RECEIPTS', String(r.totals.count)],
        ['AVERAGE SALE', naira(r.totals.average)],
      ];
      const gap = 10;
      const bw = (W - gap * (kpis.length - 1)) / kpis.length;
      kpis.forEach(([label, value], i) => {
        const x = L + i * (bw + gap);
        doc.roundedRect(x, y, bw, 46, 6).fillAndStroke(SOFT, LINE);
        doc.font('R').fontSize(7).fillColor(MUTED).text(label, x + 10, y + 9, { width: bw - 20, lineBreak: false });
        doc.font('B').fontSize(12.5).fillColor(INK).text(value, x + 10, y + 23, { width: bw - 20, lineBreak: false });
      });
      y += 46 + 6;
      if (r.totals.cancelled > 0) {
        doc.font('R').fontSize(7.5).fillColor(MUTED).text(`${r.totals.cancelled} cancelled receipt(s) in this period are excluded from all figures.`, L, y + 2, { width: W, lineBreak: false });
      } else {
        doc.font('R').fontSize(7.5).fillColor(MUTED).text('Cancelled receipts are excluded from all figures.', L, y + 2, { width: W, lineBreak: false });
      }
      y += 22;

      // ---------- generic table ----------
      type Align = 'left' | 'right';
      function table(opts: {
        x: number;
        widths: number[];
        head: string[];
        rows: string[][];
        aligns: Align[];
        paginate?: boolean;
        total?: string[];
        color?: (row: string[], col: number) => string | undefined;
      }) {
        const { x, widths, head, rows, aligns } = opts;
        const sum = widths.reduce((a, b) => a + b, 0);
        const rowH = 17;
        const drawHead = () => {
          doc.rect(x, y, sum, rowH + 2).fill(INK);
          doc.font('B').fontSize(7).fillColor('#ffffff');
          let cx = x;
          head.forEach((h, i) => {
            doc.text(h.toUpperCase(), cx + 5, y + 6, { width: widths[i] - 10, height: 9, align: aligns[i], ellipsis: true });
            cx += widths[i];
          });
          y += rowH + 2;
        };
        const drawRow = (cells: string[], idx: number, bold = false) => {
          if (!bold && idx % 2 === 1) doc.rect(x, y, sum, rowH).fill('#faf8f1');
          if (bold) {
            doc.moveTo(x, y).lineTo(x + sum, y).lineWidth(1).strokeColor(INK).stroke();
          }
          doc.font(bold ? 'B' : 'R');
          let cx = x;
          cells.forEach((c, i) => {
            // Shrink text slightly rather than ever cutting a figure off.
            let fs = 8;
            while (fs > 5 && doc.fontSize(fs).widthOfString(c) > widths[i] - 10) fs -= 0.5;
            doc.fontSize(fs).fillColor((!bold && opts.color?.(cells, i)) || INK);
            doc.text(c, cx + 5, y + 5 + (8 - fs) / 2, { width: widths[i] - 10, height: 10, align: aligns[i], ellipsis: true });
            cx += widths[i];
          });
          y += rowH;
        };
        drawHead();
        rows.forEach((row, idx) => {
          if (opts.paginate && y + rowH > bottom()) {
            newPage();
            drawHead();
          }
          drawRow(row, idx);
        });
        if (opts.total) {
          if (opts.paginate && y + rowH + 4 > bottom()) {
            newPage();
            drawHead();
          }
          drawRow(opts.total, 0, true);
        }
      }

      const title = (t: string, at: number, x = L) => {
        doc.font('B').fontSize(10).fillColor(INK).text(t, x, at, { lineBreak: false });
      };

      if (r.totals.count === 0) {
        doc.font('R').fontSize(11).fillColor(MUTED).text('No sales were recorded in this period.', L, y + 10, { width: W, lineBreak: false });
        y += 40;
      } else {
        // ---------- payment methods + top products, side by side ----------
        const half = (W - 24) / 2;
        const startY = y;
        title('By payment method', y);
        y += 16;
        const methodTotal = r.methods.reduce((a, m) => a + m.total, 0) || 1;
        table({
          x: L,
          widths: [half * 0.4, half * 0.15, half * 0.3, half * 0.15],
          head: ['Method', 'Receipts', 'Sales', 'Share'],
          aligns: ['left', 'right', 'right', 'right'],
          rows: r.methods.map((m) => [METHOD[m.name] ?? m.name, String(m.count), naira(m.total), `${Math.round((m.total / methodTotal) * 100)}%`]),
        });
        const leftEnd = y;

        y = startY;
        title('Best-selling products', y, L + half + 24);
        y += 16;
        table({
          x: L + half + 24,
          widths: [half * 0.5, half * 0.15, half * 0.35],
          head: ['Product', 'Qty', 'Revenue'],
          aligns: ['left', 'right', 'right'],
          rows: r.products.slice(0, 8).map((p) => [p.name, String(p.qty), naira(p.revenue)]),
        });
        y = Math.max(y, leftEnd) + 20;

        // ---------- breakdown over time ----------
        if (r.buckets.length) {
          if (y + 80 > bottom()) newPage();
          title(r.bucketTitle, y);
          y += 16;
          table({
            x: L,
            widths: [W * 0.4, W * 0.2, W * 0.4],
            head: ['Period', 'Receipts', 'Sales'],
            aligns: ['left', 'right', 'right'],
            paginate: true,
            rows: r.buckets.map((b) => [b.label, String(b.count), naira(b.total)]),
            total: ['Total', String(r.totals.count), naira(r.totals.total)],
          });
          y += 20;
        }

        // ---------- receipts ----------
        if (r.salesOmitted) {
          if (y + 30 > bottom()) newPage();
          doc.font('R').fontSize(8.5).fillColor(MUTED).text('Individual receipts are not listed in yearly reports. Download a monthly report for receipt-level detail.', L, y, { width: W });
        } else {
          if (y + 70 > bottom()) newPage();
          title(`Receipts (${r.sales.length})`, y);
          y += 16;
          const f = [0.13, 0.11, 0.19, 0.1, 0.09, 0.13, 0.13, 0.12].map((v) => v * W);
          table({
            x: L,
            widths: f,
            head: ['Receipt', 'Date & time', 'Customer', 'Method', 'Status', 'Total', 'Paid', 'Balance'],
            aligns: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right'],
            paginate: true,
            rows: r.sales.map((s) => [
              s.receiptNumber,
              s.at.toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
              s.customer,
              METHOD[s.method] ?? s.method,
              STATUS[s.status] ?? s.status,
              naira(s.total),
              naira(s.paid),
              naira(s.balance),
            ]),
            total: ['TOTAL', '', '', '', '', naira(r.totals.total), naira(r.totals.paid), naira(r.totals.balance)],
            color: (row, col) => (col === 7 && row[7] !== naira(0) ? '#b00020' : undefined),
          });
        }
      }

      // ---------- footer on every page ----------
      const range = doc.bufferedPageRange();
      const stamp = `Generated ${fmtDateTime(new Date())} by ${generatedBy}`;
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0; // allow drawing in the bottom margin without creating a new page
        const fy = doc.page.height - 30;
        doc.font('R').fontSize(7).fillColor(MUTED);
        doc.text(`${biz.name}  ·  ${r.title}  ·  ${r.label}  ·  ${stamp}`, L, fy, { width: W - 90, lineBreak: false });
        doc.text(`Page ${i + 1} of ${range.count}`, L + W - 90, fy, { width: 90, align: 'right', lineBreak: false });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
