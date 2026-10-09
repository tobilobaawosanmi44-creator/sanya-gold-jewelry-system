import { db } from '@/lib/db';

export type Period = 'day' | 'week' | 'month' | 'year';

export const PERIODS: { key: Period; label: string; title: string }[] = [
  { key: 'day', label: 'Daily', title: 'Daily Sales Report' },
  { key: 'week', label: 'Weekly', title: 'Weekly Sales Report' },
  { key: 'month', label: 'Monthly', title: 'Monthly Sales Report' },
  { key: 'year', label: 'Yearly', title: 'Yearly Sales Report' },
];

const ALIASES: Record<string, Period> = { day: 'day', daily: 'day', week: 'week', weekly: 'week', month: 'month', monthly: 'month', year: 'year', yearly: 'year' };
export function toPeriod(v: string | null | undefined): Period {
  return (v && ALIASES[v]) || 'day';
}

// Nigeria (Africa/Lagos) is UTC+1 all year with no daylight saving. Every day/week/month/year
// boundary is calculated in Nigerian time, never in the server's clock (which is UTC on Render).
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OFFSET = HOUR;
export const TZ = 'Africa/Lagos';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// "Calendar milliseconds": UTC midnight of a Nigerian calendar date.
function parseDay(s?: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (m) {
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(t) && ymd(t) === s) return t;
  }
  return Math.floor((Date.now() + OFFSET) / DAY) * DAY; // today in Nigeria
}

function calRange(period: Period, dayMs: number) {
  const d = new Date(dayMs);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  if (period === 'day') return { a: dayMs, b: dayMs + DAY };
  if (period === 'week') {
    const a = dayMs - ((d.getUTCDay() + 6) % 7) * DAY; // Monday
    return { a, b: a + 7 * DAY };
  }
  if (period === 'month') return { a: Date.UTC(y, mo, 1), b: Date.UTC(y, mo + 1, 1) };
  return { a: Date.UTC(y, 0, 1), b: Date.UTC(y + 1, 0, 1) };
}

function shift(period: Period, dayMs: number, dir: 1 | -1): number {
  const d = new Date(dayMs);
  if (period === 'day') return dayMs + dir * DAY;
  if (period === 'week') return dayMs + dir * 7 * DAY;
  if (period === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1);
  return Date.UTC(d.getUTCFullYear() + dir, 0, 1);
}

const fmtCal = (ms: number, o: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString('en-NG', { timeZone: 'UTC', ...o });

export function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-NG', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export type ReportSale = {
  id: string;
  receiptNumber: string;
  at: Date;
  customer: string;
  method: string;
  status: string;
  total: number;
  paid: number;
  balance: number;
};

export type Report = {
  period: Period;
  title: string;
  label: string;
  anchor: string;
  prev: string;
  next: string;
  from: Date;
  to: Date;
  totals: { count: number; total: number; paid: number; balance: number; average: number; cancelled: number };
  bucketTitle: string;
  buckets: { label: string; count: number; total: number }[];
  methods: { name: string; count: number; total: number }[];
  products: { name: string; qty: number; revenue: number }[];
  sales: ReportSale[];
  salesOmitted: boolean;
};

// The exact start/end (in real UTC time) of the Nigerian day/week/month/year containing `dateStr`.
export function resolvePeriod(period: Period, dateStr?: string) {
  const dayMs = parseDay(dateStr);
  const { a, b } = calRange(period, dayMs);
  return { anchor: ymd(dayMs), from: new Date(a - OFFSET), to: new Date(b - OFFSET) };
}

export async function getReport(businessId: string, period: Period, dateStr?: string, opts: { allProducts?: boolean } = {}): Promise<Report> {
  const dayMs = parseDay(dateStr);
  const { a, b } = calRange(period, dayMs);
  const from = new Date(a - OFFSET);
  const to = new Date(b - OFFSET);

  const inRange = { businessId, createdAt: { gte: from, lt: to } };
  const live = { ...inRange, paymentStatus: { not: 'CANCELLED' as const } };

  const [rows, cancelled, items] = await Promise.all([
    db.sale.findMany({
      where: live,
      orderBy: { createdAt: 'asc' },
      take: 20000,
      select: {
        id: true,
        createdAt: true,
        total: true,
        amountPaid: true,
        balance: true,
        paymentMethod: true,
        paymentStatus: true,
        customer: { select: { name: true } },
        receipt: { select: { receiptNumber: true } },
      },
    }),
    db.sale.count({ where: { ...inRange, paymentStatus: 'CANCELLED' } }),
    db.saleItem.findMany({ where: { sale: live }, select: { quantity: true, subtotal: true, product: { select: { name: true } } } }),
  ]);

  let total = 0;
  let paid = 0;
  let balance = 0;
  const methodMap = new Map<string, { count: number; total: number }>();

  let bucketTitle = '';
  let buckets: { label: string; count: number; total: number }[] = [];
  if (period === 'week' || period === 'month') {
    const days = Math.round((b - a) / DAY);
    bucketTitle = 'Sales by day';
    buckets = Array.from({ length: days }, (_, i) => ({
      label: fmtCal(a + i * DAY, period === 'week' ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' }),
      count: 0,
      total: 0,
    }));
  } else if (period === 'year') {
    bucketTitle = 'Sales by month';
    buckets = Array.from({ length: 12 }, (_, i) => ({ label: fmtCal(Date.UTC(new Date(a).getUTCFullYear(), i, 1), { month: 'long' }), count: 0, total: 0 }));
  }

  for (const s of rows) {
    const t = Number(s.total);
    total += t;
    paid += Number(s.amountPaid);
    balance += Number(s.balance);
    const m = methodMap.get(s.paymentMethod) ?? { count: 0, total: 0 };
    m.count += 1;
    m.total += t;
    methodMap.set(s.paymentMethod, m);

    const local = s.createdAt.getTime() + OFFSET;
    const idx = period === 'year' ? new Date(local).getUTCMonth() : Math.floor((local - a) / DAY);
    const bk = buckets[idx];
    if (bk) {
      bk.count += 1;
      bk.total += t;
    }
  }

  const productMap = new Map<string, { qty: number; revenue: number }>();
  for (const it of items) {
    const cur = productMap.get(it.product.name) ?? { qty: 0, revenue: 0 };
    cur.qty += it.quantity;
    cur.revenue += Number(it.subtotal);
    productMap.set(it.product.name, cur);
  }

  const count = rows.length;
  const salesOmitted = period === 'year';
  const label =
    period === 'day'
      ? fmtCal(a, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : period === 'week'
        ? `${fmtCal(a, { weekday: 'short', day: 'numeric', month: 'short' })} – ${fmtCal(b - DAY, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`
        : period === 'month'
          ? fmtCal(a, { month: 'long', year: 'numeric' })
          : String(new Date(a).getUTCFullYear());

  return {
    period,
    title: PERIODS.find((p) => p.key === period)!.title,
    label,
    anchor: ymd(dayMs),
    prev: ymd(shift(period, dayMs, -1)),
    next: ymd(shift(period, dayMs, 1)),
    from,
    to,
    totals: { count, total: r2(total), paid: r2(paid), balance: r2(balance), average: count ? r2(total / count) : 0, cancelled },
    bucketTitle,
    buckets: buckets.map((x) => ({ ...x, total: r2(x.total) })),
    methods: [...methodMap.entries()].map(([name, v]) => ({ name, count: v.count, total: r2(v.total) })).sort((x, y) => y.total - x.total),
    products: [...productMap.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, revenue: r2(v.revenue) }))
      .sort((x, y) => y.revenue - x.revenue)
      .slice(0, opts.allProducts ? 1000 : 10),
    sales: salesOmitted
      ? []
      : rows.map((s) => ({
          id: s.id,
          receiptNumber: s.receipt?.receiptNumber ?? '—',
          at: s.createdAt,
          customer: s.customer.name,
          method: s.paymentMethod,
          status: s.paymentStatus,
          total: Number(s.total),
          paid: Number(s.amountPaid),
          balance: Number(s.balance),
        })),
    salesOmitted,
  };
}
