/** Link to the sign-in page that returns the user to `next` afterwards. */
export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * The `?next=` target from a query string, if it is a same-site path. Anything else (absolute URLs,
 * protocol-relative `//evil.com`, `/\evil.com`) falls back to "/" to prevent open redirects.
 */
export function safeNextPath(search: string): string {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
