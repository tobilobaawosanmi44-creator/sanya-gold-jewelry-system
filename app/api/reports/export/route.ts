import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getReport, resolvePeriod, toPeriod } from '@/lib/reports';
import { buildWorkbook, getExportRows, itemsCsv, receiptsCsv } from '@/lib/report-export';

const FORMATS = ['xlsx', 'csv', 'csv-items'] as const;
type Format = (typeof FORMATS)[number];

// Sales report export: ?period=day|week|month|year&date=YYYY-MM-DD&format=xlsx|csv|csv-items
export async function GET(req: Request) {
  const u = await requireUser();
  const q = new URL(req.url).searchParams;
  const period = toPeriod(q.get('period'));
  const date = q.get('date') ?? undefined;
  const format = (q.get('format') ?? 'xlsx') as Format;
  if (!FORMATS.includes(format)) return NextResponse.json({ error: 'Unknown export format.' }, { status: 400 });

  try {
    const rows = await getExportRows(u.businessId, period, date);
    const name = `Sales-Report-${period}-${resolvePeriod(period, date).anchor}`;

    let body: BodyInit;
    let type: string;
    let ext: string;
    if (format === 'xlsx') {
      const report = await getReport(u.businessId, period, date, { allProducts: true });
      body = new Uint8Array(await buildWorkbook(u.business, report, rows, u.name));
      type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    } else {
      body = new TextEncoder().encode(format === 'csv' ? receiptsCsv(rows) : itemsCsv(rows));
      type = 'text/csv; charset=utf-8';
      ext = 'csv';
    }

    await db.auditLog.create({
      data: { businessId: u.businessId, userId: u.id, action: 'REPORT_EXPORTED', recordType: 'REPORT', metadata: { period, date: date ?? null, format, receipts: rows.length } },
    });

    return new NextResponse(body, {
      headers: {
        'content-type': type,
        'content-disposition': `attachment; filename="${name}${format === 'csv-items' ? '-items' : ''}.${ext}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Report export failed', e);
    return NextResponse.json({ error: 'Could not export the report. Please try again.' }, { status: 500 });
  }
}
