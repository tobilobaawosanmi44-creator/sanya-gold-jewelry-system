// Public base URL of the app (set NEXT_PUBLIC_APP_URL in Render; change it when you add a custom domain).
export const siteUrl = (fallback?: string) => (process.env.NEXT_PUBLIC_APP_URL || fallback || 'http://localhost:3000').replace(/\/$/, '');

// Links that can be shared with a customer. Both use the receipt's long random token,
// so they cannot be guessed from the receipt number.
export const receiptLinks = (token: string, base = siteUrl()) => ({
  pdf: `${base}/r/${token}`,
  verify: `${base}/verify/${token}`,
});
