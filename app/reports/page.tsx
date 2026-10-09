import { Shell } from '@/components/shell';
import { requireUser } from '@/lib/auth';
import { money } from '@/lib/utils';
import { PERIODS, getReport, fmtDateTime, toPeriod } from '@/lib/reports';

const METHOD: Record<string, string> = { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', POS: 'POS', CARD: 'Card', OTHER: 'Other' };
const STATUS: Record<string, string> = { PAID: 'Paid', PARTIALLY_PAID: 'Part paid', PENDING: 'Pending' };
const SHOW_LIMIT = 300;

export default async function Reports({ searchParams }: { searchParams: Promise<{ period?: string; date?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const period = toPeriod(sp.period);
  const r = await getReport(u.businessId, period, sp.date);

  const href = (p: string, date: string) => `/reports?period=${p}&date=${date}`;
  const pdfHref = `/api/reports/pdf?period=${period}&date=${r.anchor}`;
  const exportHref = (format: string) => `/api/reports/export?period=${period}&date=${r.anchor}&format=${format}`;
  const maxBucket = Math.max(1, ...r.buckets.map((b) => b.total));
  const maxMethod = Math.max(1, ...r.methods.map((m) => m.total));

  const cards: [string, string][] = [
    ['Total sales', money(r.totals.total)],
    ['Collected', money(r.totals.paid)],
    ['Outstanding', money(r.totals.balance)],
    ['Receipts', String(r.totals.count)],
    ['Average sale', money(r.totals.average)],
  ];

  return (
    <Shell title="Sales Reports">
      <div className="card p-4 md:p-5 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {PERIODS.map((p) => (
            <a key={p.key} href={href(p.key, r.anchor)} className={`btn ${p.key === period ? 'btn-gold' : 'btn-light'}`}>{p.label}</a>
          ))}
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <a className="btn btn-light" href={href(period, r.prev)} aria-label="Previous period">←</a>
            <div className="min-w-[200px] text-center">
              <div className="text-lg font-black">{r.label}</div>
              <div className="text-[11px] text-gray-400">Nigeria time (Africa/Lagos)</div>
            </div>
            <a className="btn btn-light" href={href(period, r.next)} aria-label="Next period">→</a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="period" value={period} />
              <input className="input" type="date" name="date" defaultValue={r.anchor} />
              <button className="btn btn-light">Go</button>
            </form>
            <a className="btn btn-light" href={`/reports?period=${period}`}>Today</a>
            <a className="btn btn-gold" href={pdfHref}>⬇ Download PDF</a>
            <details className="relative">
              <summary className="btn btn-light cursor-pointer list-none select-none">⬇ Export ▾</summary>
              <div className="absolute right-0 mt-2 z-20 w-72 card p-2 shadow-xl">
                <a className="block rounded-xl p-3 hover:bg-[#faf7ed]" href={exportHref('xlsx')}>
                  <b className="text-sm">Excel workbook (.xlsx)</b>
                  <div className="text-xs text-gray-500">Summary, all receipts and items sold, in separate sheets</div>
                </a>
                <a className="block rounded-xl p-3 hover:bg-[#faf7ed]" href={exportHref('csv')}>
                  <b className="text-sm">CSV: receipts</b>
                  <div className="text-xs text-gray-500">One row per receipt, for other software</div>
                </a>
                <a className="block rounded-xl p-3 hover:bg-[#faf7ed]" href={exportHref('csv-items')}>
                  <b className="text-sm">CSV: items sold</b>
                  <div className="text-xs text-gray-500">One row per item on every receipt</div>
                </a>
              </div>
            </details>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Weekly reports run Monday to Sunday. Cancelled receipts are excluded
          {r.totals.cancelled > 0 ? ` (${r.totals.cancelled} cancelled in this period)` : ''}.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {cards.map(([a, b], i) => (
          <div className={`card p-4 md:p-5 ${i === 0 ? 'col-span-2 xl:col-span-1' : ''}`} key={a}>
            <div className="text-xs text-gray-500">{a}</div>
            <div className="text-lg md:text-xl font-bold mt-2 break-words">{b}</div>
          </div>
        ))}
      </div>

      {r.totals.count === 0 ? (
        <div className="card p-10 text-center text-gray-400">No sales were recorded in this period.</div>
      ) : (
        <>
          <div className="grid xl:grid-cols-2 gap-6 mb-6">
            {r.buckets.length > 0 && (
              <div className="card p-5">
                <h2 className="font-bold text-lg mb-4">{r.bucketTitle}</h2>
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {r.buckets.map((b) => (
                    <div key={b.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{b.label} <span className="text-gray-400">· {b.count} receipt{b.count === 1 ? '' : 's'}</span></span>
                        <span className="font-semibold">{money(b.total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f1ecdc]"><div className="h-2 rounded-full gold-bg" style={{ width: `${(b.total / maxBucket) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="card p-5">
              <h2 className="font-bold text-lg mb-4">By payment method</h2>
              <div className="space-y-3 mb-8">
                {r.methods.map((m) => (
                  <div key={m.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{METHOD[m.name] ?? m.name} <span className="text-gray-400">· {m.count}</span></span>
                      <span className="font-semibold">{money(m.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#f1ecdc]"><div className="h-2 rounded-full bg-[#171717]" style={{ width: `${(m.total / maxMethod) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <h2 className="font-bold text-lg mb-3">Best-selling products</h2>
              {r.products.slice(0, 5).map((p, i) => (
                <div key={p.name} className="flex justify-between border-b last:border-0 py-2.5 text-sm">
                  <div><b>{i + 1}. {p.name}</b><div className="text-xs text-gray-400">{p.qty} sold</div></div>
                  <div className="font-semibold">{money(p.revenue)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Receipts in this period</h2>
              <a className="text-sm font-semibold underline" href={pdfHref}>Download full list (PDF)</a>
            </div>
            {r.salesOmitted ? (
              <p className="text-sm text-gray-500">Individual receipts are not listed for a whole year. Open a monthly report for receipt-level detail.</p>
            ) : (
              <div className="table-wrap">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y text-left text-xs text-gray-400">
                      <th className="py-3">Receipt</th><th>Date &amp; time</th><th>Customer</th><th>Method</th><th>Status</th>
                      <th className="text-right">Total</th><th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.sales.slice(0, SHOW_LIMIT).map((s) => (
                      <tr key={s.id} className="border-b">
                        <td className="py-3"><a className="font-semibold underline" href={`/receipts/${s.id}`}>{s.receiptNumber}</a></td>
                        <td className="text-gray-500 whitespace-nowrap">{fmtDateTime(s.at)}</td>
                        <td>{s.customer}</td>
                        <td>{METHOD[s.method] ?? s.method}</td>
                        <td>{STATUS[s.status] ?? s.status}</td>
                        <td className="text-right font-semibold whitespace-nowrap">{money(s.total)}</td>
                        <td className={`text-right whitespace-nowrap ${s.balance > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{money(s.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.sales.length > SHOW_LIMIT && (
                  <p className="text-xs text-gray-400 mt-3">Showing the first {SHOW_LIMIT} of {r.sales.length} receipts. The PDF contains all of them.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
