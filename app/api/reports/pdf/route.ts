import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getReport, toPeriod } from '@/lib/reports';
import { renderReportPdf } from '@/lib/report-pdf';

export async function GET(req: Request) {
  const u = await requireUser();
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
