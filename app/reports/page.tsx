import { Shell } from '@/components/shell';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { money } from '@/lib/utils';
import { ReportControls } from '@/components/report-controls';

const TZ = 'Africa/Lagos';

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
}

function lagosBoundary(year: number, month: number, day: number) {
  // Nigeria uses UTC+1 year-round. Build the local midnight and convert it to UTC.
  return new Date(Date.UTC(year, month, day, -1, 0, 0, 0));
}

function boundaries() {
  const now = localParts();
  const dayStart = lagosBoundary(now.year, now.month, now.day);
  const nextDay = lagosBoundary(now.year, now.month, now.day + 1);
  const day = new Date(dayStart);
  const weekday = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) + 'T00:00:00+01:00').getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = new Date(day.getTime() + mondayOffset * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const monthStart = lagosBoundary(now.year, now.month, 1);
  const monthEnd = lagosBoundary(now.year, now.month + 1, 1);
  const yearStart = lagosBoundary(now.year, 0, 1);
  const yearEnd = lagosBoundary(now.year + 1, 0, 1);
  return { daily: [dayStart, nextDay], weekly: [weekStart, weekEnd], monthly: [monthStart, monthEnd], yearly: [yearStart, yearEnd] } as const;
}

async function summary(businessId: string, start: Date, end: Date) {
  const rows = await db.sale.findMany({ where: { businessId, createdAt: { gte: start, lt: end }, paymentStatus: { not: 'CANCELLED' } }, select: { total: true, amountPaid: true, balance: true } });
  return { count: rows.length, total: rows.reduce((a, x) => a + Number(x.total), 0), paid: rows.reduce((a, x) => a + Number(x.amountPaid), 0), balance: rows.reduce((a, x) => a + Number(x.balance), 0) };
}

export default async function Reports() {
  const u = await requireUser();
  const b = boundaries();
  const [daily, weekly, monthly, yearly] = await Promise.all([
    summary(u.businessId, ...b.daily), summary(u.businessId, ...b.weekly), summary(u.businessId, ...b.monthly), summary(u.businessId, ...b.yearly),
  ]);
  const cards = [['Today', daily, 'daily'], ['This week', weekly, 'weekly'], ['This month', monthly, 'monthly'], ['This year', yearly, 'yearly']];
  return <Shell title="Sales Reports">
    <div className="mb-6"><h2 className="text-xl font-bold">Sales reporting</h2><p className="text-sm text-gray-500">Daily, weekly, monthly and yearly figures using Nigeria time (Africa/Lagos). Cancelled receipts are excluded.</p></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">{cards.map(([label, s, period]) => { const x = s as Awaited<ReturnType<typeof summary>>; return <div className="card p-5" key={period as string}><div className="flex justify-between items-center"><span className="text-sm font-semibold">{label as string}</span><span className="text-xs text-gray-400">{x.count} sales</span></div><div className="text-xl font-black mt-3">{money(x.total)}</div><div className="text-xs text-green-700 mt-1">Collected {money(x.paid)}</div><div className="text-xs text-red-600">Outstanding {money(x.balance)}</div></div>; })}</div>
    <ReportControls />
    <div className="card p-5"><h3 className="font-bold mb-4">What the reports contain</h3><div className="grid md:grid-cols-2 gap-3 text-sm text-gray-600"><div>• Transaction count and total sales</div><div>• Amount collected and outstanding</div><div>• Receipt number and customer</div><div>• Payment method and sale total</div><div>• Cancelled receipts excluded</div><div>• Downloadable PDF for each period</div></div></div>
  </Shell>;
}
