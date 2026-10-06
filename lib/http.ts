import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Turns any thrown error into a JSON response the UI can display.
export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const field = first?.path?.length ? `${String(first.path[first.path.length - 1])}: ` : '';
    return NextResponse.json({ error: `${field}${first?.message ?? 'Invalid input'}` }, { status: 400 });
  }
  if (e instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  console.error(e);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
