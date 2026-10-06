// Small fetch helper for client components: always returns parsed JSON or throws a readable Error.
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new Error(res.redirected ? 'Your session has expired. Please log in again.' : 'Unexpected server response. Please try again.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error((data && data.error) || 'Request failed.');
  return data as T;
}

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
