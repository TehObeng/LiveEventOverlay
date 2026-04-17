import { NextResponse } from 'next/server';

function withNoStoreHeaders(init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return {
    ...init,
    headers,
  };
}

export function noStoreJson<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, withNoStoreHeaders(init));
}
