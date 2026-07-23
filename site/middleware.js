// Edge Middleware: HTTP Basic Auth for the whole site.
// Password comes from the SITE_PASSWORD env var (set on the Vercel project,
// never committed). Any username is accepted; only the password is checked.
export const config = { matcher: '/(.*)' };

export default function middleware(request) {
  const expected = process.env.SITE_PASSWORD || '';
  const auth = request.headers.get('authorization') || '';

  if (expected && auth.startsWith('Basic ')) {
    try {
      const given = atob(auth.slice(6));
      const password = given.slice(given.indexOf(':') + 1);
      if (password === expected) return; // fall through to the site
    } catch {}
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="IMAI internal docs", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
