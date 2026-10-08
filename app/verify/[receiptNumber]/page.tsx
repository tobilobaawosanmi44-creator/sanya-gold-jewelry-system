import { money } from '@/lib/utils';
import { findReceipt } from '@/lib/verify';

export const dynamic = 'force-dynamic';

export default async function Verify({ params }: { params: Promise<{ receiptNumber: string }> }) {
  const { receiptNumber: key } = await params;
  const found = await findReceipt(key);

  if (!found) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <div className="text-4xl">✕</div>
          <h1 className="text-2xl font-black mt-4">Receipt not found</h1>
          <p className="text-gray-500 mt-2">This receipt could not be verified.</p>
        </div>
      </main>
    );
  }

  const { r, full } = found;
  const valid = r.status === 'VALID';
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f8f7f3] flex items-center justify-center p-6">
      <div className="card bg-white max-w-lg w-full p-8">
        <div className="text-center border-b pb-6">
          <div className="text-2xl font-black">{r.sale.business.name.toUpperCase()}</div>
          <div className={`mx-auto mt-6 w-fit px-4 py-2 rounded-full font-bold ${valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {valid ? '✓ VERIFIED RECEIPT' : '✕ CANCELLED RECEIPT'}
          </div>
        </div>
        <div className="py-6 space-y-4 text-sm">
          {row('Business', r.sale.business.name)}
          {row('Receipt', r.receiptNumber)}
          {row('Date', new Date(r.createdAt).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }))}
          {full && row('Customer', r.sale.customer.name)}
          {full && row('Amount', money(r.sale.total.toString()))}
          {full && row('Payment', r.sale.paymentStatus.replace('_', ' '))}
        </div>
        <p className="text-xs text-gray-400 text-center border-t pt-5">
          {full ? 'Only the minimum information needed for verification is displayed.' : 'To see the full details, scan the QR code printed on the receipt.'}
        </p>
      </div>
    </main>
  );
}
