import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { runtimeValue, sessionCookieMaxAge, supabaseConfig } from '../runtime-config';

export async function sessionClient() {
  const config = await supabaseConfig();
  if (!config) throw new Error('Supabase is not configured.');
  const jar = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/', maxAge: sessionCookieMaxAge },
    cookies: {
      getAll() { return jar.getAll(); },
      setAll(items) {
        try { for (const { name, value, options } of items) jar.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/', maxAge: sessionCookieMaxAge }); }
        catch { /* Server Component cookies are read-only; proxy.ts refreshes them. */ }
      },
    },
  });
}
// Elevated key stays in server modules. All callers must supply a verified owner.
export async function databaseClient() {
  const config = await supabaseConfig(), secret = await runtimeValue('SUPABASE_SECRET_KEY');
  if (!config || !secret) throw new Error('Supabase database is not configured.');
  return createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
