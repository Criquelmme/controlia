import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { backend, sessionCookieMaxAge, supabaseConfig } from './lib/runtime-config';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (await backend() !== 'supabase') return response;
  const config = await supabaseConfig();
  if (!config) return response;
  const client = createServerClient(config.url, config.publishableKey, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/', maxAge: sessionCookieMaxAge },
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/', maxAge: sessionCookieMaxAge });
      },
    },
  });
  try { await client.auth.getUser(); } catch { /* Page and API guards reject unauthenticated requests. */ }
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
export const config = { matcher: ['/', '/login', '/api/:path*'] };
