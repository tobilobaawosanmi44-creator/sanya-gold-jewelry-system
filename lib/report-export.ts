import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { resolvePeriod, type Period, type Report } from '@/lib/reports';

const LAGOS = 3_600_000; // Africa/Lagos is UTC+1 all year
const METHOD: Record<string, string> = { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', POS: 'POS', CARD: 'Card', OTHER: 'Other' };
const STATUS: Record<string, string> = { PAID: 'Paid', PARTIALLY_PAID: 'Part paid', PENDING: 'Pending' };

export type ExportItem = { product: string; category: string; qty: number; unitPrice: number; subtotal: number };
export type ExportRow = {
  receiptNumber: string;
  at: Date;
  customer: string;
  phone: string;
  method: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  staff: string;
  items: ExportItem[];
};

// Every non-cancelled receipt in the period, with its items. Same filters as the report page and PDF.
export async function getExportRows(businessId: string, period: Period, dateStr?: string): Promise<ExportRow[]> {
  const { from, to } = resolvePeriod(period, dateStr);
  const sales = await db.sale.findMany({
    where: { businessId, createdAt: { gte: from, lt: to }, paymentStatus: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
    take: 20000,
    select: {
      createdAt: true,
      subtotal: true,
      discount: true,
      tax: true,
      total: true,
      amountPaid: true,
      balance: true,
      paymentMethod: true,
      paymentStatus: true,
      customer: { select: { name: true, phone: true } },
      staff: { select: { name: true } },
      receipt: { select: { receiptNumber: true } },
      items: { select: { quantity: true, unitPrice: true, subtotal: true, product: { select: { name: true, category: true } } } },
    },
  });
  return sales.map((s) => ({
    receiptNumber: s.receipt?.receiptNumber ?? '',
    at: s.createdAt,
    customer: s.customer.name,
    phone: s.customer.phone,
    method: METHOD[s.paymentMethod] ?? s.paymentMethod,
    status: STATUS[s.paymentStatus] ?? s.paymentStatus,
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    tax: Number(s.tax),
    total: Number(s.total),
    paid: Number(s.amountPaid),
    balance: Number(s.balance),
    staff: s.staff.name,
    items: s.items.map((i) => ({ product: i.product.name, category: i.product.category, qty: i.quantity, unitPrice: Number(i.unitPrice), subtotal: Number(i.subtotal) })),
  }));
}

/* ------------------------------- CSV ------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');
const lagos = (d: Date) => new Date(d.getTime() + LAGOS);
const dateStr = (d: Date) => {
  const x = lagos(d);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};
const timeStr = (d: Date) => {
  const x = lagos(d);
  return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
};

// Text starting with = + - @ can be run as a formula by Excel ("CSV injection"), so it is
// neutralised with a leading apostrophe. Real phone numbers such as +234 808 242 3674 are left alone.
export function safeText(v: string): string {
  if (/^[=+\-@\t\r]/.test(v) && !/^\+?[\d\s()\-]+$/.test(v)) return `'${v}`;
  return v;
}
function cell(v: string | number): string {
  if (typeof v === 'number') return v.toFixed(2);
  const s = safeText(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (cols: (string | number)[]) => cols.map(cell).join(',');
const BOM = '\uFEFF'; // lets Excel read ₦, accents and other characters correctly

export function receiptsCsv(rows: ExportRow[]): string {
  const head = ['Receipt No', 'Date', 'Time', 'Customer', 'Phone', 'Payment method', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total', 'Amount paid', 'Balance', 'Served by'];
  const body = rows.map((r) => line([r.receiptNumber, dateStr(r.at), timeStr(r.at), r.customer, r.phone, r.method, r.status, r.subtotal, r.discount, r.tax, r.total, r.paid, r.balance, r.staff]));
  return BOM + [line(head), ...body].join('\r\n') + '\r\n';
}

export function itemsCsv(rows: ExportRow[]): string {
  const head = ['Receipt No', 'Date', 'Time', 'Customer', 'Product', 'Category', 'Quantity', 'Unit price', 'Line total'];
  const body = rows.flatMap((r) =>
    r.items.map((i) => {
      const cols = [r.receiptNumber, dateStr(r.at), timeStr(r.at), r.customer, i.product, i.category];
      return cols.map(cell).join(',') + ',' + i.qty + ',' + cell(i.unitPrice) + ',' + cell(i.subtotal);
    }),
  );
  return BOM + [line(head), ...body].join('\r\n') + '\r\n';
}

/* ------------------------------ Excel ------------------------------ */

const INK = 'FF171717';
const GOLD = 'FFB8901F';
const SOFT = 'FFFAF7ED';
const MONEY = '"₦"#,##0.00';

function styleHeader(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    c.alignment = { vertical: 'middle', horizontal: c.alignment?.horizontal ?? 'left' };
  });
}

export async function buildWorkbook(biz: { name: string }, r: Report, rows: ExportRow[], generatedBy: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = biz.name;
  wb.created = new Date();
  const generated = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  /* ---- Summary ---- */
  const s = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  s.columns = [{ width: 34 }, { width: 18 }, { width: 22 }, { width: 18 }];
  s.getCell('A1').value = biz.name.toUpperCase();
  s.getCell('A1').font = { bold: true, size: 16 };
  s.getCell('A2').value = `${r.title} — ${r.label}`;
  s.getCell('A2').font = { size: 12, color: { argb: GOLD }, bold: true };
  s.getCell('A3').value = `Generated ${generated} by ${generatedBy}. Cancelled receipts are excluded.`;
  s.getCell('A3').font = { size: 9, color: { argb: 'FF777777' } };

  let y = 5;
  // Writes a titled table and returns the row number of its first data row.
  const section = (title: string, head: string[], data: (string | number)[][], formats: (string | undefined)[]): number => {
    s.getCell(y, 1).value = title;
    s.getCell(y, 1).font = { bold: true, size: 11 };
    y += 1;
    head.forEach((h, i) => {
      const c = s.getCell(y, i + 1);
      c.value = h;
      if (i > 0) c.alignment = { horizontal: 'right' };
    });
    styleHeader(s.getRow(y));
    y += 1;
    const first = y;
    data.forEach((d) => {
      d.forEach((v, i) => {
        const c = s.getCell(y, i + 1);
        c.value = v;
        if (formats[i]) c.numFmt = formats[i]!;
        if (i > 0) c.alignment = { horizontal: 'right' };
        c.border = { bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } } };
      });
      y += 1;
    });
    y += 1;
    return first;
  };

  const t = r.totals;
  const kpi = section('Key figures', ['Measure', 'Value'], [
    ['Total sales', t.total],
    ['Collected (amount paid)', t.paid],
    ['Outstanding (balance owed)', t.balance],
    ['Number of receipts', t.count],
    ['Average sale', t.average],
    ['Cancelled receipts (excluded)', t.cancelled],
  ], [undefined, MONEY]);
  // "Number of receipts" and "Cancelled receipts" are counts, not money.
  s.getCell(kpi + 3, 2).numFmt = '0';
  s.getCell(kpi + 5, 2).numFmt = '0';

  if (r.methods.length) {
    section('By payment method', ['Method', 'Receipts', 'Sales'], r.methods.map((m) => [METHOD[m.name] ?? m.name, m.count, m.total]), [undefined, '0', MONEY]);
  }
  if (r.buckets.length) {
    section(r.bucketTitle, ['Period', 'Receipts', 'Sales'], r.buckets.map((b) => [b.label, b.count, b.total]), [undefined, '0', MONEY]);
  }
  if (r.products.length) {
    section('Best-selling products', ['Product', 'Quantity sold', 'Revenue'], r.products.map((p) => [p.name, p.qty, p.revenue]), [undefined, '0', MONEY]);
  }

  /* ---- Receipts ---- */
  const rc = wb.addWorksheet('Receipts', { views: [{ state: 'frozen', ySplit: 1 }] });
  rc.columns = [
    { header: 'Receipt No', key: 'no', width: 18 },
    { header: 'Date & time', key: 'at', width: 20 },
    { header: 'Customer', key: 'customer', width: 26 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Payment method', key: 'method', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Subtotal', key: 'subtotal', width: 16 },
    { header: 'Discount', key: 'discount', width: 14 },
    { header: 'Tax', key: 'tax', width: 12 },
    { header: 'Total', key: 'total', width: 17 },
    { header: 'Amount paid', key: 'paid', width: 17 },
    { header: 'Balance', key: 'balance', width: 16 },
    { header: 'Served by', key: 'staff', width: 18 },
  ];
  for (const x of rows) {
    // Excel has no time zones, so store Nigerian wall-clock time as if it were UTC.
    rc.addRow({ no: x.receiptNumber, at: lagos(x.at), customer: x.customer, phone: x.phone, method: x.method, status: x.status, subtotal: x.subtotal, discount: x.discount, tax: x.tax, total: x.total, paid: x.paid, balance: x.balance, staff: x.staff });
  }
  styleHeader(rc.getRow(1));
  ['G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
    rc.getColumn(col).numFmt = MONEY;
    rc.getCell(`${col}1`).alignment = { horizontal: 'right', vertical: 'middle' };
  });
  rc.getColumn('B').numFmt = 'dd mmm yyyy hh:mm';
  rc.getColumn('B').alignment = { horizontal: 'left' };
  rc.getColumn('M').alignment = { horizontal: 'left', indent: 1 };
  rc.getCell('M1').alignment = { horizontal: 'left', indent: 1, vertical: 'middle' };
  rc.getCell('B1').alignment = { horizontal: 'left', vertical: 'middle' };
  if (rows.length) {
    rc.autoFilter = { from: 'A1', to: `M${rows.length + 1}` };
    const last = rows.length + 1;
    const tr = rc.getRow(last + 1);
    tr.getCell(1).value = 'TOTAL';
    const cols: [string, keyof ExportRow][] = [['G', 'subtotal'], ['H', 'discount'], ['I', 'tax'], ['J', 'total'], ['K', 'paid'], ['L', 'balance']];
    for (const [col, key] of cols) {
      const result = rows.reduce((a, x) => a + (x[key] as number), 0);
      tr.getCell(col).value = { formula: `SUBTOTAL(109,${col}2:${col}${last})`, result };
      tr.getCell(col).numFmt = MONEY;
    }
    tr.eachCell({ includeEmpty: true }, (c) => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
      c.border = { top: { style: 'thin', color: { argb: INK } } };
    });
  }

  /* ---- Items sold ---- */
  const it = wb.addWorksheet('Items sold', { views: [{ state: 'frozen', ySplit: 1 }] });
  it.columns = [
    { header: 'Receipt No', key: 'no', width: 18 },
    { header: 'Date & time', key: 'at', width: 20 },
    { header: 'Customer', key: 'customer', width: 26 },
    { header: 'Product', key: 'product', width: 32 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Quantity', key: 'qty', width: 10 },
    { header: 'Unit price', key: 'unit', width: 17 },
    { header: 'Line total', key: 'line', width: 17 },
  ];
  let itemRows = 0;
  let qtySum = 0;
  let lineSum = 0;
  for (const x of rows) {
    for (const i of x.items) {
      it.addRow({ no: x.receiptNumber, at: lagos(x.at), customer: x.customer, product: i.product, category: i.category, qty: i.qty, unit: i.unitPrice, line: i.subtotal });
      itemRows += 1;
      qtySum += i.qty;
      lineSum += i.subtotal;
    }
  }
  styleHeader(it.getRow(1));
  it.getColumn('B').numFmt = 'dd mmm yyyy hh:mm';
  it.getColumn('B').alignment = { horizontal: 'left' };
  it.getCell('B1').alignment = { horizontal: 'left', vertical: 'middle' };
  it.getColumn('G').numFmt = MONEY;
  it.getColumn('H').numFmt = MONEY;
  ['F', 'G', 'H'].forEach((c) => (it.getCell(`${c}1`).alignment = { horizontal: 'right', vertical: 'middle' }));
  if (itemRows) {
    it.autoFilter = { from: 'A1', to: `H${itemRows + 1}` };
    const tr = it.getRow(itemRows + 2);
    tr.getCell(1).value = 'TOTAL';
    tr.getCell('F').value = { formula: `SUBTOTAL(109,F2:F${itemRows + 1})`, result: qtySum };
    tr.getCell('H').value = { formula: `SUBTOTAL(109,H2:H${itemRows + 1})`, result: lineSum };
    tr.getCell('H').numFmt = MONEY;
    tr.eachCell({ includeEmpty: true }, (c) => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
      c.border = { top: { style: 'thin', color: { argb: INK } } };
    });
  }

  for (const ws of [s, rc, it]) ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
