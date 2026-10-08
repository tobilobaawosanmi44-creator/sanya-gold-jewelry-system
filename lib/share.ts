// Pure helpers used in the browser and on the server (no imports, no secrets).

// Turns a Nigerian (or international) phone number into the digits-only format WhatsApp needs.
// Returns '' when the number cannot be recognised, so callers can fall back to "choose a contact".
export function normalizePhone(raw: string): string {
  const s = (raw || '').trim();
  const hadPlus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) return d.slice(2).length >= 8 ? d.slice(2) : '';
  if (hadPlus) return d.length >= 8 ? d : '';
  if (d.startsWith('234') && d.length >= 13) return d;
  if (d.startsWith('0') && d.length === 11) return '234' + d.slice(1);
  if (d.length === 10 && /^[789]/.test(d)) return '234' + d;
  if (d.length >= 11 && !d.startsWith('0')) return d; // assume already international
  return '';
}

export type ShareInfo = {
  businessName: string;
  customerName: string;
  number: string;
  total: string; // already formatted, e.g. "₦250,000.00"
  balance: string;
  balanceDue: boolean;
  link: string;
};

export function receiptText(i: ShareInfo): string {
  const first = (i.customerName || '').trim().split(/\s+/)[0] || 'there';
  return [
    `Hello ${first}, thank you for shopping with ${i.businessName}.`,
    '',
    `Receipt: ${i.number}`,
    `Total: ${i.total}`,
    i.balanceDue ? `Balance outstanding: ${i.balance}` : '',
    '',
    `View or download your receipt:`,
    i.link,
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');
}

export const whatsappUrl = (phone: string, text: string) => {
  const n = normalizePhone(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};

export const mailtoUrl = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
