import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getReport, toPeriod } from '@/lib/reports';
import { renderReportPdf } from '@/lib/report-pdf';

export async function GET(req: Request) {
  const u = await requireUser();

  // The sales report lists customer names and amounts, so only administrators may download it.
  if (u.role !== 'SUPER_ADMIN') {
    await db.auditLog
      .create({ data: { businessId: u.businessId, userId: u.id, action: 'REPORT_EXPORT_DENIED', recordType: 'REPORT' } })
      .catch(() => undefined);
    return NextResponse.json({ error: 'Only an administrator can download reports.' }, { status: 403 });
  }

  try {
    const q = new URL(req.url).searchParams;
    const period = toPeriod(q.get('period'));
    const report = await getReport(u.businessId, period, q.get('date') ?? undefined);
    const pdf = await renderReportPdf(u.business, report, u.name);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="Sales-Report-${period}-${report.anchor}.pdf"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Report PDF failed', e);
    return NextResponse.json({ error: 'Could not generate the report. Please try again.' }, { status: 500 });
  }
}
